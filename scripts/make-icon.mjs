/**
 * Builds build/icon.ico and build/icon.png from scratch, without image tooling.
 *
 * The mark is a rising line with an end point: the product measures growth over
 * time, so the icon shows the shape of its own data. No platform trade dress, so
 * it still works when Instagram, YouTube and others are added.
 *
 * The ICO carries every size Windows asks for (16 to 256 px). Small sizes are
 * stored as plain bitmaps and only 128/256 as PNG, because Explorer older than
 * Windows 10 renders PNG entries in the taskbar and list views poorly.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

/** All geometry below is written in a 256 unit square and scaled per size. */
const UNIT = 256;
const BITMAP_SIZES = [16, 24, 32, 48, 64];
const PNG_SIZES = [128, 256];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "build");

const CARD = [16, 21, 28, 255];
const EDGE = [38, 47, 60, 255];
const GOLD = [232, 179, 75, 255];

const LINE = [
  [58, 190],
  [104, 142],
  [140, 160],
  [198, 74],
];
const STROKE = 12;
const DOT = 16;

const OUTER = { left: 6, top: 6, right: UNIT - 6, bottom: UNIT - 6, radius: 54 };
const INNER = { left: 9, top: 9, right: UNIT - 9, bottom: UNIT - 9, radius: 51 };

function insideRoundedRect(x, y, rect) {
  const { left, top, right, bottom, radius } = rect;
  if (x < left || y < top || x >= right || y >= bottom) return false;
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const lengthSquared = (bx - ax) ** 2 + (by - ay) ** 2;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / lengthSquared));
  const cx = ax + t * (bx - ax);
  const cy = ay + t * (by - ay);
  return Math.hypot(px - cx, py - cy);
}

function blend(base, over, coverage) {
  if (coverage <= 0) return base;
  if (coverage >= 1) return over;
  return [
    Math.round(base[0] + (over[0] - base[0]) * coverage),
    Math.round(base[1] + (over[1] - base[1]) * coverage),
    Math.round(base[2] + (over[2] - base[2]) * coverage),
    255,
  ];
}

/** `soft` widens the edge by one pixel of the target size, so 16 px stays clean. */
function pixelAt(x, y, soft) {
  if (!insideRoundedRect(x, y, OUTER)) return [0, 0, 0, 0];

  const color = insideRoundedRect(x, y, INNER) ? CARD : EDGE;

  let coverage = 0;
  for (let index = 0; index < LINE.length - 1; index += 1) {
    const [ax, ay] = LINE[index];
    const [bx, by] = LINE[index + 1];
    const distance = distanceToSegment(x, y, ax, ay, bx, by);
    coverage = Math.max(coverage, Math.min(1, STROKE + soft - distance));
  }

  const [dotX, dotY] = LINE[LINE.length - 1];
  const dotCoverage = Math.min(1, DOT + soft - Math.hypot(x - dotX, y - dotY));

  return blend(color, GOLD, Math.max(coverage, dotCoverage));
}

function renderRgba(size) {
  const scale = UNIT / size;
  const soft = 0.5 * scale;
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixelAt((x + 0.5) * scale, (y + 0.5) * scale, soft);
      const offset = (y * size + x) * 4;
      rgba[offset] = r;
      rgba[offset + 1] = g;
      rgba[offset + 2] = b;
      rgba[offset + 3] = a;
    }
  }
  return rgba;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(rgba, size) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 32 bit DIB as used inside ICO files: header, bottom-up pixels, AND mask. */
function encodeDib(rgba, size) {
  const maskStride = Math.ceil(size / 32) * 4;
  const mask = Buffer.alloc(maskStride * size);

  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const sourceRow = size - 1 - y;
    for (let x = 0; x < size; x += 1) {
      const from = (sourceRow * size + x) * 4;
      const to = (y * size + x) * 4;
      pixels[to] = rgba[from + 2];
      pixels[to + 1] = rgba[from + 1];
      pixels[to + 2] = rgba[from];
      pixels[to + 3] = rgba[from + 3];
      if (rgba[from + 3] === 0) mask[y * maskStride + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }

  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(size * size * 4 + mask.length, 20);

  return Buffer.concat([header, pixels, mask]);
}

function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const directory = entries.map((entry) => {
    const item = Buffer.alloc(16);
    item[0] = entry.size >= 256 ? 0 : entry.size;
    item[1] = entry.size >= 256 ? 0 : entry.size;
    item.writeUInt16LE(1, 4);
    item.writeUInt16LE(32, 6);
    item.writeUInt32LE(entry.data.length, 8);
    item.writeUInt32LE(offset, 12);
    offset += entry.data.length;
    return item;
  });

  return Buffer.concat([header, ...directory, ...entries.map((entry) => entry.data)]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const entries = [];
for (const size of [...BITMAP_SIZES, ...PNG_SIZES]) {
  const rgba = renderRgba(size);
  entries.push({
    size,
    data: size <= 64 ? encodeDib(rgba, size) : encodePng(rgba, size),
  });
}

const png256 = entries.find((entry) => entry.size === 256).data;
const ico = buildIco(entries);

fs.writeFileSync(path.join(OUT_DIR, "icon.png"), png256);
fs.writeFileSync(path.join(OUT_DIR, "icon.ico"), ico);

console.log(
  `icon.ico geschrieben (${ico.length} Bytes, Groessen: ${entries.map((e) => e.size).join(", ")})`,
);
