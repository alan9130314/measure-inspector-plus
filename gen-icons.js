#!/usr/bin/env node
// Generates default and active toolbar icons as PNG files.
const fs   = require('fs');
const zlib = require('zlib');

// ── CRC32 table ──────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── PNG builder ───────────────────────────────────────────────────────────────
function makePng(pixels, size) {
  const write32 = (n) => Buffer.from([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);

  const chunk = (type, data) => {
    const t = Buffer.from(type);
    const crc = write32(crc32(Buffer.concat([t, data])));
    return Buffer.concat([write32(data.length), t, data, crc]);
  };

  const sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = chunk('IHDR', Buffer.concat([
    write32(size), write32(size),
    Buffer.from([8, 6, 0, 0, 0]),   // 8-bit RGBA
  ]));

  // Build scanlines with filter byte 0 (None) per row
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: None
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const idat = chunk('IDAT', zlib.deflateSync(raw, { level: 9 }));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// ── Icon drawing ──────────────────────────────────────────────────────────────
// Design: 4 coloured quadrant squares with a white cross gap (matches current icon).
function drawIcon(size, squareHex, bgHex = '#ffffff') {
  const hex = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16), 255];
  const sq  = hex(squareHex);
  const bg  = hex(bgHex);

  const pixels = Buffer.alloc(size * size * 4);
  const gap    = Math.round(size * 0.14); // cross gap width
  const half   = Math.floor(gap / 2);
  const cx     = Math.floor(size / 2);
  const cy     = Math.floor(size / 2);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inCross = Math.abs(x - cx) < half || Math.abs(y - cy) < half;
      const [r, g, b, a] = inCross ? bg : sq;
      const i = (y * size + x) * 4;
      pixels[i] = r; pixels[i+1] = g; pixels[i+2] = b; pixels[i+3] = a;
    }
  }
  return pixels;
}

// ── Generate files ────────────────────────────────────────────────────────────
const SIZES = [16, 48, 128];

// Default icon:  purple #6b6bff  (matches existing icons)
// Active icon:   orange #f97316  (clear "running" signal)
for (const size of SIZES) {
  fs.writeFileSync(`icons/icon${size}.png`,        makePng(drawIcon(size, '#6b6bff'), size));
  fs.writeFileSync(`icons/icon${size}-active.png`, makePng(drawIcon(size, '#f97316'), size));
}

console.log('Icons generated: default (purple) + active (orange) for 16, 48, 128 px');
