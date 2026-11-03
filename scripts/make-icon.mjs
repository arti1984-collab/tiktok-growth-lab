/**
 * Builds build/icon.ico from scratch – a 256×256 PNG wrapped in an ICO
 * container – so the .exe gets a real icon without any image tooling.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const SIZE = 256;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "build");

const BG = [15, 19, 26, 255];
const CYAN = [37, 244, 238, 255];
const PINK = [254, 44, 85, 255];

/** Distance helper for rounded rectangles. */
function insideRoundedRect(x, y, left, top, right, bottom, radius) {
  if (x < left || x >= right || y < top || y >= bottom) return false;
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function pixel(x, y) {
  const inCard = insideRoundedRect(x, y, 8, 8, SIZE - 8, SIZE - 8, 54);
  if (!inCard) return [0, 0, 0, 0];

  // Two offset bars in TikTok colours, like the brand mark in the header.
  if (insideRoundedRect(x, y, 74, 58, 116, 198, 20)) {
    if (insideRoundedRect(x, y, 74, 74, 116, 198, 20)) return CYAN;
  }
  if (insideRoundedRect(x, y, 140, 58, 182, 198, 20)) return PINK;

  const glow = insideRoundedRect(x, y, 74, 58, 182, 198, 20);
  return glow ? [22, 28, 38, 255] : BG;
}

function buildRawImage() {
  const stride = SIZE * 4;
  const raw = Buffer.alloc((stride + 1) * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type: none
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
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(buildRawImage(), { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function wrapIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image

  const entry = Buffer.alloc(16);
  entry[0] = 0; // width 256
  entry[1] = 0; // height 256
  entry[2] = 0; // palette
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // size of the image data
  entry.writeUInt32LE(22, 12); // offset of the PNG data
  return Buffer.concat([header, entry, png]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const png = encodePng();
fs.writeFileSync(path.join(OUT_DIR, "icon.png"), png);
fs.writeFileSync(path.join(OUT_DIR, "icon.ico"), wrapIco(png));
console.log(`icon.ico geschrieben (${fs.statSync(path.join(OUT_DIR, "icon.ico")).size} Bytes)`);
