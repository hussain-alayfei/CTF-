// One-off generator: builds innocent-looking PNGs with a flag hidden in the
// raw file bytes (appended after IEND). Students recover it via Notepad /
// strings / a hex viewer — matching the lab hints. Run: node scripts/gen-stego.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// Build a WxH RGB PNG with a smooth gradient so it looks like a real picture.
function makePng(w, h, tint) {
  const raw = Buffer.alloc(h * (1 + w * 3));
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      raw[p++] = ((x / w) * 255) & 0xff; // R gradient
      raw[p++] = ((y / h) * 255) & 0xff; // G gradient
      raw[p++] = tint & 0xff; // B tint
    }
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function writeStego(path, w, h, tint, flag) {
  const png = makePng(w, h, tint);
  // Hide the flag as plain text appended after IEND (valid viewers ignore it).
  const hidden = Buffer.from(`\n<!-- ${flag} -->\n`, 'ascii');
  writeFileSync(path, Buffer.concat([png, hidden]));
  console.log('wrote', path, 'flag:', flag);
}

mkdirSync('public/challenges/labs', { recursive: true });
writeStego('public/challenges/labs/operation-hidden-message.png', 96, 96, 180, 'KGSP{steganography_master}');
writeStego('public/challenges/hidden.png', 80, 80, 90, 'KGSP{stego_hidden_in_the_pixels}');
