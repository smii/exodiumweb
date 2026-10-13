// Write a raw hard-disk image as a js-dos "sockdrive v2" static drive: the
// browser fetches 256 KiB ranges on demand instead of the whole game.
// Layout and constants follow caiiiycuk/sockdrive (v2, src/main.rs `mkd`):
//   <dir>/sockdrive.metaj        geometry + range bookkeeping (JSON)
//   <dir>/preload_ranges.metaj   ranges to fetch in the background up front
//   <dir>/<n>.raw                range n, uncompressed; all-zero ranges are
//                                listed in dropped_ranges and not written
// `size` is in KiB. A missing preload list makes js-dos fetch *every* range,
// so one is always written.
import { closeSync, mkdirSync, openSync, readSync, renameSync, rmSync, writeFileSync, writeSync, fstatSync } from "node:fs";
import { join } from "node:path";

export const AHEAD_READ = 256 * 1024;
export const SECTOR = 512;

/** CHS geometry for a disk of at least `bytes` (63 sectors, up to 255 heads). */
export function geometry(bytes) {
  const sectors = 63;
  let heads = 16;
  while (heads < 255 && Math.ceil(bytes / (heads * sectors * SECTOR)) > 1024) heads = Math.min(255, heads * 2);
  const cylinders = Math.ceil(bytes / (heads * sectors * SECTOR));
  return { heads, sectors, cylinders, bytes: heads * sectors * cylinders * SECTOR };
}

/**
 * Write an MBR with one active partition spanning the disk from sector 63
 * (classic DOS layout). Type 0x06 = FAT16 (>32 MB), 0x0C = FAT32 LBA.
 * Returns the partition's byte offset and sector count for mtools `-i img@@off`.
 */
export function writeMbr(image, geo, type) {
  const start = geo.sectors; // first track reserved, as DOS FDISK does
  const total = geo.heads * geo.sectors * geo.cylinders - start;
  const mbr = Buffer.alloc(SECTOR);
  const chs = (lba) => {
    const c = Math.min(1023, Math.floor(lba / (geo.heads * geo.sectors)));
    const h = Math.floor(lba / geo.sectors) % geo.heads;
    const s = (lba % geo.sectors) + 1;
    return [h, ((c >> 2) & 0xc0) | s, c & 0xff];
  };
  const e = 446;
  mbr[e] = 0x80; // active
  mbr.set(chs(start), e + 1);
  mbr[e + 4] = type;
  mbr.set(chs(start + total - 1), e + 5);
  mbr.writeUInt32LE(start, e + 8);
  mbr.writeUInt32LE(total, e + 12);
  mbr[510] = 0x55; mbr[511] = 0xaa;
  const fd = openSync(image, "r+");
  try { writeSync(fd, mbr, 0, SECTOR, 0); } finally { closeSync(fd); }
  return { offset: start * SECTOR, sectors: total };
}

/**
 * @param {string} image   raw disk image (MBR + partition), size = geometry(...).bytes
 * @param {string} outDir  drive folder to (re)create
 * @param {{name: string, heads: number, sectors: number, cylinders: number, preload?: number[]}} geo
 */
export function writeSockdrive(image, outDir, geo) {
  const tmp = `${outDir}.tmp`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const fd = openSync(image, "r");
  const size = fstatSync(fd).size;
  const rangeCount = Math.ceil(size / AHEAD_READ);
  const buf = Buffer.alloc(AHEAD_READ);
  const dropped = [];
  try {
    for (let i = 0; i < rangeCount; i++) {
      buf.fill(0);
      readSync(fd, buf, 0, AHEAD_READ, i * AHEAD_READ);
      if (buf.every((b) => b === 0)) dropped.push(i);
      else writeFileSync(join(tmp, `${i}.raw`), buf);
    }
  } finally {
    closeSync(fd);
  }
  const preload = (geo.preload ?? [0]).filter((r) => r < rangeCount && !dropped.includes(r));
  writeFileSync(join(tmp, "sockdrive.metaj"), JSON.stringify({
    name: geo.name,
    size: Math.ceil(size / 1024),
    heads: geo.heads,
    cylinders: geo.cylinders,
    sectors: geo.sectors,
    sector_size: SECTOR,
    ahead_read: AHEAD_READ,
    range_count: rangeCount,
    dropped_ranges: dropped,
    small_ranges: [],
    preload_ranges: preload,
  }));
  writeFileSync(join(tmp, "preload_ranges.metaj"), JSON.stringify(preload));
  rmSync(outDir, { recursive: true, force: true });
  renameSync(tmp, outDir);
  return { rangeCount, dropped: dropped.length, written: rangeCount - dropped.length };
}
