#!/usr/bin/env node
// Generates default and active toolbar icons as PNG files.
const fs   = require('fs');
const zlib = require('zlib');

// ── CRC32 ─────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
const crc32 = buf => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

// ── PNG ───────────────────────────────────────────────────────────────────────
function makePng(pixels, size) {
  const w32 = n => Buffer.from([(n>>>24)&0xff,(n>>>16)&0xff,(n>>>8)&0xff,n&0xff]);
  const chunk = (type, data) => {
    const t = Buffer.from(type);
    return Buffer.concat([w32(data.length), t, data, w32(crc32(Buffer.concat([t,data])))]);
  };
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y*(size*4+1)] = 0;
    pixels.copy(raw, y*(size*4+1)+1, y*size*4, (y+1)*size*4);
  }
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', Buffer.concat([w32(size), w32(size), Buffer.from([8,6,0,0,0])])),
    chunk('IDAT', zlib.deflateSync(raw, { level:9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Drawing helpers ───────────────────────────────────────────────────────────
function makeCanvas(size) {
  const buf = Buffer.alloc(size * size * 4); // RGBA, all transparent
  const u   = v => Math.round(v * size / 16);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y*size+x)*4;
    buf[i]=r; buf[i+1]=g; buf[i+2]=b; buf[i+3]=a;
  };
  const rect = (x1,y1,x2,y2,rgb) => {
    for (let y=y1; y<=y2; y++) for (let x=x1; x<=x2; x++) set(x,y,...rgb);
  };
  const circle = (cx,cy,r,rgb) => {
    for (let y=Math.floor(cy-r); y<=Math.ceil(cy+r); y++)
      for (let x=Math.floor(cx-r); x<=Math.ceil(cx+r); x++) {
        const dx=(x+.5)-cx, dy=(y+.5)-cy;
        if (dx*dx+dy*dy <= r*r) set(x,y,...rgb);
      }
  };
  return { buf, u, set, rect, circle };
}

// ── Icon design ───────────────────────────────────────────────────────────────
//
//  Default (inactive) — primary brand icon, complete & self-contained:
//    Blue bg · white corner brackets · white crosshair
//
//  Active — same base + one centre status accent:
//    Orange filled circle behind the crosshair  →  "target acquired / live"
//    White crosshair drawn on top preserves the tool identity.
//
function drawIcon(size, active) {
  const BG  = [37, 99, 235];   // #2563eb
  const MK  = [255,255,255];   // white
  const ORG = [249,115,22];    // #f97316

  const { buf, u, rect, circle } = makeCanvas(size);
  const cx = size / 2, cy = size / 2;

  // ── Rounded square background ──────────────────────────────────────────────
  const rad = u(2.5);
  for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
    const nL=x<rad, nR=x>=size-rad, nT=y<rad, nB=y>=size-rad;
    if ((nL||nR)&&(nT||nB)) {
      const ccx=nL?rad:size-rad, ccy=nT?rad:size-rad;
      const dx=(x+.5)-ccx, dy=(y+.5)-ccy;
      if (dx*dx+dy*dy>rad*rad) continue;
    }
    const i=(y*size+x)*4;
    buf[i]=BG[0]; buf[i+1]=BG[1]; buf[i+2]=BG[2]; buf[i+3]=255;
  }

  // ── Corner brackets ────────────────────────────────────────────────────────
  const INS = u(2.5);
  const ARM = u(4);
  const TH  = Math.max(1, Math.round(size/16*1.5));
  const e   = size - 1 - INS;

  const bracket = (hx1,hy1,hx2,hy2, vx1,vy1,vx2,vy2) => {
    rect(hx1,hy1,hx2,hy2,MK);
    rect(vx1,vy1,vx2,vy2,MK);
  };

  // TL
  bracket(INS,INS, INS+ARM,INS+TH-1,  INS,INS, INS+TH-1,INS+ARM);

  // TR
  bracket(e-ARM,INS, e,INS+TH-1,  e-TH+1,INS, e,INS+ARM);

  // BL
  bracket(INS,e-TH+1, INS+ARM,e,  INS,e-ARM, INS+TH-1,e);

  // BR
  bracket(e-ARM,e-TH+1, e,e,  e-TH+1,e-ARM, e,e);

  // ── Active additions (drawn before crosshair so crosshair stays on top) ────
  if (active) {
    // 1. Orange filled target circle in centre
    const targetR = Math.max(1.5, u(2.6));
    circle(cx, cy, targetR, ORG);
  }

  // ── Centre crosshair (always on top) ──────────────────────────────────────
  const cTH = Math.max(1, Math.round(size/16));
  const cAR = Math.max(2, u(2.2));
  const h   = Math.floor((cTH-1)/2);
  const ci  = Math.round(cx);
  rect(ci-cAR, ci-h, ci+cAR, ci+h, MK); // horizontal
  rect(ci-h, ci-cAR, ci+h, ci+cAR, MK); // vertical

  return buf;
}

// ── Generate ──────────────────────────────────────────────────────────────────
const SIZES = [16, 48, 128];
for (const size of SIZES) {
  fs.writeFileSync(`icons/icon${size}.png`,        makePng(drawIcon(size, false), size));
  fs.writeFileSync(`icons/icon${size}-active.png`, makePng(drawIcon(size, true),  size));
}
console.log('Icons generated: unified default + active centre target for 16, 48, 128 px');
