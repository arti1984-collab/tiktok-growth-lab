/**
 * Builds build/icon.ico from scratch (a 256×256 PNG inside an ICO container)
 * so the .exe and the Android launcher get a real icon without image tooling.
 *
 * The mark is a rising line with an end point: this product measures growth
 * over time, so the icon shows the shape of its own data. No platform trade
 * dress, so it still works when Instagram, YouTube and others are added.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const SIZE = 256;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "build");

const CARD = [16, 21, 28, 255];
const EDGE = [38, 47, 60, 255];
const GOLD = [232, 179, 75, 255];

function insideRoundedRect(x, y, left, top, right, bottom, radius) {
  if (x < left || y < top || x >= right || y >= bottom) return false;
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const lengthSquared = (bx - ax) ** 2 + (by - ay) ** 2;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / lengthSquared));
  const cx = ax + t * (bx - ax);
  const cy = ay + t * (by - ay);
  return Math.hypot(px - cx, py - cy);
}

// The line: three steps up, ending in a point. Coordinates are drawn from the
// bottom left to the top right so it reads as growth in any context.
const LINE = [
  [58, 190],
  [104, 142],
  [140, 160],
  [198, 74],
];
const STROKE = 12;
const DOT = 16;

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

function pixel(x, y) {
  const inCard = insideRoundedRect(x, y, 6, 6, SIZE - 6, SIZE - 6, 54);
  if (!inCard) return [0, 0, 0, 0];

  let color = CARD;
  if (!insideRoundedRect(x, y, 9, 9, SIZE - 9, SIZE - 9, 51)) color = EDGE;

  let coverage = 0;
  for (let index = 0; index < LINE.length - 1; index += 1) {
    const [ax, ay] = LINE[index];
    const [bx, by] = LINE[index + 1];
    const distance = distanceToSegment(x, y, ax, ay, bx, by);
    coverage = Math.max(coverage, Math.min(1, STROKE + 0.5 - distance));
  }

  const [dotX, dotY] = LINE[LINE.length - 1];
  const dotDistance = Math.hypot(x - dotX, y - dotY);
  coverage = Math.max(coverage, Math.min(1, DOT + 0.5 - dotDistance));

  return blend(color, GOLD, coverage);
}

function buildRawImage() {
  const stride = SIZE * 4;
  const raw = Buffer.alloc((stride + 1) * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < SIZE; x += 1) {
      const [r, g, b, a] = pixel(x, y);
      const offset = y * (stride + 1) + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }
  return raw;
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

function encodePng() {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(buildRawImage(), { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function wrapIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = 0;
  entry[1] = 0;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const png = encodePng();
fs.writeFileSync(path.join(OUT_DIR, "icon.png"), png);
fs.writeFileSync(path.join(OUT_DIR, "icon.ico"), wrapIco(png));
console.log(`icon.ico geschrieben (${fs.statSync(path.join(OUT_DIR, "icon.ico")).size} Bytes)`);
