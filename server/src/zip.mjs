// Minimal read-only ZIP reader (stored + deflate, ZIP64), for random access to
// single entries in eXo's multi-GB metadata archives without extracting them.
import { openSync, readSync, fstatSync, closeSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

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
      const method = cd.readUInt16LE(p + 10);
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
      this.entries.set(name, { offset, csize, usize, method });
      p += 46 + nameLen + extraLen + commentLen;
    }
  }

  has(name) {
    return this.entries.has(name);
  }

  names() {
    return this.entries.keys();
  }

  /** Whole entry as a Buffer. */
  read(name) {
    const e = this.entries.get(name);
    if (!e) return null;
    const local = read(this.fd, e.offset, 30);
    if (local.readUInt32LE(0) !== 0x04034b50) throw new Error(`${this.path}: bad local header for ${name}`);
    const dataAt = e.offset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
    const raw = read(this.fd, dataAt, e.csize);
    if (e.method === 0) return raw;
    if (e.method === 8) return inflateRawSync(raw);
    throw new Error(`${this.path}: unsupported compression ${e.method} for ${name}`);
  }

  close() {
    closeSync(this.fd);
  }
}
