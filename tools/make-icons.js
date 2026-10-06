// Genera los iconos PNG de Banco Inverter sin dependencias externas.
// Dibuja la traza de multimetro del encabezado sobre fondo azul solido,
// que es lo que pide un icono maskable: color hasta el borde.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const BG = [11, 92, 173];     // --accent del sitio
const FG = [255, 255, 255];

// Polilinea de la onda, en coordenadas 0..24 (el viewBox del logo).
const WAVE = [[5, 12], [8.5, 12], [10, 8.5], [12.5, 15.5], [14, 12], [19, 12]];

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// scale: cuanto del lienzo ocupa el dibujo. 1.0 = borde a borde.
// Para maskable se reduce, porque el sistema recorta hasta un 20% por lado.
function makePng(size, scale) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const unit = (size * scale) / 24;          // pixeles por unidad del viewBox
  const off = (size - 24 * unit) / 2;
  const stroke = 1.9 * unit;                 // grosor de la traza

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;                        // filtro "none"
    for (let x = 0; x < size; x++) {
      const vx = (x + 0.5 - off) / unit;
      const vy = (y + 0.5 - off) / unit;

      let d = Infinity;
      for (let i = 0; i < WAVE.length - 1; i++) {
        d = Math.min(d, distToSegment(vx, vy, WAVE[i][0], WAVE[i][1], WAVE[i + 1][0], WAVE[i + 1][1]));
      }
      // cobertura suavizada en el borde de la traza
      const a = Math.max(0, Math.min(1, (stroke / 2 / unit - d) * unit + 0.5));

      const p = rowStart + 1 + x * 4;
      raw[p]     = Math.round(BG[0] + (FG[0] - BG[0]) * a);
      raw[p + 1] = Math.round(BG[1] + (FG[1] - BG[1]) * a);
      raw[p + 2] = Math.round(BG[2] + (FG[2] - BG[2]) * a);
      raw[p + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;    // bits por canal
  ihdr[9] = 6;    // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, "..");
const files = [
  ["icon-192.png", 192, 0.80],
  ["icon-512.png", 512, 0.80],
  ["icon-maskable-512.png", 512, 0.56],   // deja la zona segura del recorte
];

for (const [name, size, scale] of files) {
  const png = makePng(size, scale);
  fs.writeFileSync(path.join(out, name), png);
  console.log(name, size + "x" + size, (png.length / 1024).toFixed(1) + " KB");
}
