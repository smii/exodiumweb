// Minimal read-only ZIP reader (stored + deflate, ZIP64), for random access to
// single entries in eXo's multi-GB metadata archives without extracting them.
import { openSync, readSync, writeSync, fstatSync, closeSync } from "node:fs";
import { inflateRawSync, crc32 } from "node:zlib";

function read(fd, pos, len) {
  const buf = Buffer.alloc(len);
  let off = 0;
  while (off < len) {
    const n = readSync(fd, buf, off, len - off, pos + off);
    if (n === 0) throw new Error("unexpected end of zip");
    off += n;
  }
  return buf;
}

export class ZipReader {
  constructor(path) {
    this.path = path;
    this.fd = openSync(path, "r");
    this.size = fstatSync(this.fd).size;
    this.entries = new Map(); // name -> { offset, csize, usize, method }
    this.#readDirectory();
  }

  #readDirectory() {
    const tailLen = Math.min(this.size, 65557 + 20);
    const tail = read(this.fd, this.size - tailLen, tailLen);
    const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    if (eocd < 0) throw new Error(`${this.path}: no end of central directory`);
    let count = tail.readUInt16LE(eocd + 10);
    let cdSize = tail.readUInt32LE(eocd + 12);
    let cdOffset = tail.readUInt32LE(eocd + 16);
    if (cdOffset === 0xffffffff || count === 0xffff) {
      // ZIP64: the locator sits right before the EOCD and points at the real record.
      const loc = eocd - 20;
      if (tail.readUInt32LE(loc) !== 0x07064b50) throw new Error(`${this.path}: bad zip64 locator`);
      const rec = read(this.fd, Number(tail.readBigUInt64LE(loc + 8)), 56);
      count = Number(rec.readBigUInt64LE(32));
      cdSize = Number(rec.readBigUInt64LE(40));
      cdOffset = Number(rec.readBigUInt64LE(48));
    }
    const cd = read(this.fd, cdOffset, cdSize);
    let p = 0;
    for (let i = 0; i < count; i++) {
      if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error(`${this.path}: bad central directory`);
      const madeBy = cd.readUInt16LE(p + 4);
      const extAttr = cd.readUInt32LE(p + 38);
      const method = cd.readUInt16LE(p + 10);
      const dosTime = cd.readUInt16LE(p + 12);
      const dosDate = cd.readUInt16LE(p + 14);
      const crc = cd.readUInt32LE(p + 16);
      let csize = cd.readUInt32LE(p + 20);
      let usize = cd.readUInt32LE(p + 24);
      const nameLen = cd.readUInt16LE(p + 28);
      const extraLen = cd.readUInt16LE(p + 30);
      const commentLen = cd.readUInt16LE(p + 32);
      let offset = cd.readUInt32LE(p + 42);
      const flags = cd.readUInt16LE(p + 8);
      const name = cd.toString(flags & 0x800 ? "utf8" : "latin1", p + 46, p + 46 + nameLen);
      // ZIP64 extra field carries the 64-bit values that overflowed, in order.
      let e = p + 46 + nameLen;
      const end = e + extraLen;
      while (e + 4 <= end) {
        const id = cd.readUInt16LE(e);
        const len = cd.readUInt16LE(e + 2);
        if (id === 0x0001) {
          let q = e + 4;
          if (usize === 0xffffffff) { usize = Number(cd.readBigUInt64LE(q)); q += 8; }
          if (csize === 0xffffffff) { csize = Number(cd.readBigUInt64LE(q)); q += 8; }
          if (offset === 0xffffffff) { offset = Number(cd.readBigUInt64LE(q)); q += 8; }
        }
        e += 4 + len;
      }
      this.entries.set(name, { offset, csize, usize, method, crc, dosTime, dosDate, madeBy, extAttr });
      p += 46 + nameLen + extraLen + commentLen;
    }
  }

  has(name) {
    return this.entries.has(name);
  }

  names() {
    return this.entries.keys();
  }

  /** File offset where an entry's (compressed) data starts. */
  dataOffset(name) {
    const e = this.entries.get(name);
    const local = read(this.fd, e.offset, 30);
    if (local.readUInt32LE(0) !== 0x04034b50) throw new Error(`${this.path}: bad local header for ${name}`);
    return e.offset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
  }

  /** Whole entry as a Buffer. */
  read(name) {
    const e = this.entries.get(name);
    if (!e) return null;
    const raw = read(this.fd, this.dataOffset(name), e.csize);
    if (e.method === 0) return raw;
    if (e.method === 8) return inflateRawSync(raw);
    throw new Error(`${this.path}: unsupported compression ${e.method} for ${name}`);
  }

  close() {
    closeSync(this.fd);
  }
}

/**
 * Write a new zip to `outPath`: every entry of `src` copied byte-for-byte
 * (still compressed, no re-deflate), then `extra` files ({ name, data })
 * stored uncompressed. Extra names replace same-named source entries.
 * Uses ZIP64 records whenever a size or offset needs them.
 */
export function writeBundle(src, extra, outPath) {
  const out = openSync(outPath, "w");
  let pos = 0;
  const write = (buf) => { let o = 0; while (o < buf.length) o += writeSync(out, buf, o, buf.length - o, pos + o); pos += buf.length; };
  const central = [];
  const replaced = new Set(extra.map((f) => f.name));
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const addEntry = (name, meta, copyData) => {
    const nameBuf = Buffer.from(name, "utf8");
    const offset = pos;
    const big = meta.csize >= 0xffffffff || meta.usize >= 0xffffffff;
    // Local header: sizes go in a zip64 extra when they don't fit.
    const localExtra = big ? Buffer.alloc(20) : Buffer.alloc(0);
    if (big) { localExtra.writeUInt16LE(1, 0); localExtra.writeUInt16LE(16, 2); localExtra.writeBigUInt64LE(BigInt(meta.usize), 4); localExtra.writeBigUInt64LE(BigInt(meta.csize), 12); }
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0);
    h.writeUInt16LE(big ? 45 : 20, 4);
    h.writeUInt16LE(0x800, 6); // UTF-8 names, no data descriptor
    h.writeUInt16LE(meta.method, 8);
    h.writeUInt16LE(meta.dosTime, 10);
    h.writeUInt16LE(meta.dosDate, 12);
    h.writeUInt32LE(meta.crc >>> 0, 14);
    h.writeUInt32LE(big ? 0xffffffff : meta.csize, 18);
    h.writeUInt32LE(big ? 0xffffffff : meta.usize, 22);
    h.writeUInt16LE(nameBuf.length, 26);
    h.writeUInt16LE(localExtra.length, 28);
    write(h); write(nameBuf); write(localExtra);
    copyData();
    // Our offset must win over the source entry's own `offset` field.
    central.push({ ...meta, nameBuf, offset });
  };

  // js-dos's extractor makes directories one level at a time, so every
  // directory (eXo zips sometimes omit the top one, e.g. "WC/" before
  // "WC/Crack/") is written first, parents before children.
  const allNames = [...src.entries.keys(), ...extra.map((f) => f.name)];
  const dirs = new Set();
  for (const n of allNames) {
    const parts = n.split("/");
    for (let i = 1; i < parts.length; i++) dirs.add(`${parts.slice(0, i).join("/")}/`);
  }
  const dirMeta = { method: 0, crc: 0, csize: 0, usize: 0, dosTime, dosDate, madeBy: 20, extAttr: 0x10 };
  for (const d of [...dirs].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))) {
    addEntry(d, src.entries.get(d) ?? dirMeta, () => {});
  }

  for (const [name, e] of src.entries) {
    if (replaced.has(name) || name.endsWith("/")) continue;
    addEntry(name, e, () => {
      // Stream the compressed bytes across in 4 MiB chunks.
      let from = src.dataOffset(name);
      let left = e.csize;
      while (left > 0) {
        const n = Math.min(left, 4 * 2 ** 20);
        write(read(src.fd, from, n));
        from += n; left -= n;
      }
    });
  }
  for (const f of extra) {
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data);
    addEntry(f.name, { method: 0, crc: crc32(data), csize: data.length, usize: data.length, dosTime, dosDate }, () => write(data));
  }

  const cdStart = pos;
  for (const c of central) {
    const needs64 = c.csize >= 0xffffffff || c.usize >= 0xffffffff || c.offset >= 0xffffffff;
    const ex = needs64 ? Buffer.alloc(28) : Buffer.alloc(0);
    if (needs64) { ex.writeUInt16LE(1, 0); ex.writeUInt16LE(24, 2); ex.writeBigUInt64LE(BigInt(c.usize), 4); ex.writeBigUInt64LE(BigInt(c.csize), 12); ex.writeBigUInt64LE(BigInt(c.offset), 20); }
    const h = Buffer.alloc(46);
    h.writeUInt32LE(0x02014b50, 0);
    // Keep the source's "made by" host and external attributes: that's where
    // directory entries are marked (js-dos's extractor relies on it).
    const hostOs = (c.madeBy ?? 20) & 0xff00;
    h.writeUInt16LE(hostOs | (needs64 ? 45 : Math.max(20, (c.madeBy ?? 20) & 0xff)), 4);
    h.writeUInt16LE(needs64 ? 45 : 20, 6);
    h.writeUInt16LE(0x800, 8);
    h.writeUInt16LE(c.method, 10);
    h.writeUInt16LE(c.dosTime, 12);
    h.writeUInt16LE(c.dosDate, 14);
    h.writeUInt32LE(c.crc >>> 0, 16);
    h.writeUInt32LE(needs64 ? 0xffffffff : c.csize, 20);
    h.writeUInt32LE(needs64 ? 0xffffffff : c.usize, 24);
    h.writeUInt16LE(c.nameBuf.length, 28);
    h.writeUInt16LE(ex.length, 30);
    h.writeUInt32LE((c.extAttr ?? 0) >>> 0, 38);
    h.writeUInt32LE(needs64 ? 0xffffffff : c.offset, 42);
    write(h); write(c.nameBuf); write(ex);
  }
  const cdSize = pos - cdStart;
  const zip64 = central.length >= 0xffff || cdStart >= 0xffffffff || cdSize >= 0xffffffff;
  if (zip64) {
    const rec = Buffer.alloc(56);
    rec.writeUInt32LE(0x06064b50, 0);
    rec.writeBigUInt64LE(44n, 4);
    rec.writeUInt16LE(45, 12); rec.writeUInt16LE(45, 14);
    rec.writeBigUInt64LE(BigInt(central.length), 24);
    rec.writeBigUInt64LE(BigInt(central.length), 32);
    rec.writeBigUInt64LE(BigInt(cdSize), 40);
    rec.writeBigUInt64LE(BigInt(cdStart), 48);
    const recAt = pos;
    write(rec);
    const loc = Buffer.alloc(20);
    loc.writeUInt32LE(0x07064b50, 0);
    loc.writeBigUInt64LE(BigInt(recAt), 8);
    loc.writeUInt32LE(1, 16);
    write(loc);
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Math.min(central.length, 0xffff), 8);
  end.writeUInt16LE(Math.min(central.length, 0xffff), 10);
  end.writeUInt32LE(zip64 ? 0xffffffff : cdSize, 12);
  end.writeUInt32LE(zip64 ? 0xffffffff : cdStart, 16);
  write(end);
  closeSync(out);
}
