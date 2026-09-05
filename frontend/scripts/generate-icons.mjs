/**
 * Rasterises the Orbit mark into the raster icons a browser actually asks for.
 *
 * public/favicon.svg covers modern tabs, but an SVG favicon is ignored by
 * Safari, by Google's search results and by most link-preview scrapers, so the
 * mark has to exist as PNG and ICO too. Drawing those by hand would give the
 * mark a fourth copy to keep in step with OrbitMark.jsx and favicon.svg, which
 * is the drift those two files already warn about — so they are generated from
 * one description of the geometry instead.
 *
 * Run `npm run icons` after any change to the mark. Output is committed, so a
 * normal build and deploy never runs this.
 *
 * No image dependency: the shapes are circles and a rounded rect, which is
 * cheap to sample directly, and zlib is enough to write a PNG.
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

// The literal token values from src/index.css: --color-ink and --color-brand.
const PLATE = [0x0a, 0x0a, 0x0a];
const BRAND = [0xe3, 0xa7, 0x2f];

/**
 * The mark on its 32-unit grid, matching public/favicon.svg exactly. The SVG
 * expresses the inset as a transform on the group; here the transform is
 * already folded into the numbers, so ring radius 13 at stroke 2.6 scaled by
 * 0.8 becomes 10.4 at 2.08.
 */
const GRID = 32;
const PLATE_RADIUS = 7;
const RING_RADIUS = 10.4;
const RING_STROKE = 2.08;
const DOT_RADIUS = 2.72;
const CENTRE = 16;

/** Samples per pixel axis. At 16px the mark lives or dies on its edges. */
const SUPERSAMPLE = 8;

function insidePlate(x, y, rounded) {
  if (!rounded) return true;
  // Distance to the rounded rect, measured from the nearest corner centre.
  const cx = Math.min(Math.max(x, PLATE_RADIUS), GRID - PLATE_RADIUS);
  const cy = Math.min(Math.max(y, PLATE_RADIUS), GRID - PLATE_RADIUS);
  return Math.hypot(x - cx, y - cy) <= PLATE_RADIUS;
}

function insideMark(x, y) {
  const d = Math.hypot(x - CENTRE, y - CENTRE);
  return Math.abs(d - RING_RADIUS) <= RING_STROKE / 2 || d <= DOT_RADIUS;
}

/**
 * Renders the mark at `size` as raw RGBA. `rounded` draws the plate with the
 * favicon's corner radius; iOS masks its own corners onto a full-bleed square,
 * so the touch icon passes false and would otherwise show a dark fringe.
 */
function render(size, rounded) {
  const px = new Uint8Array(size * size * 4);
  const step = GRID / size;
  const samples = SUPERSAMPLE * SUPERSAMPLE;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      let plate = 0;
      let mark = 0;

      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const x = (col + (sx + 0.5) / SUPERSAMPLE) * step;
          const y = (row + (sy + 0.5) / SUPERSAMPLE) * step;
          if (!insidePlate(x, y, rounded)) continue;
          plate++;
          if (insideMark(x, y)) mark++;
        }
      }

      const i = (row * size + col) * 4;
      if (plate === 0) continue;

      // Coverage-weighted mix of gold over the plate, then the plate's own
      // coverage as alpha so the rounded corners stay antialiased.
      const gold = mark / plate;
      for (let c = 0; c < 3; c++) {
        px[i + c] = Math.round(BRAND[c] * gold + PLATE[c] * (1 - gold));
      }
      px[i + 3] = Math.round((plate / samples) * 255);
    }
  }

  return px;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha

  // One filter byte per scanline. Filter 0 (none) keeps this readable; these
  // images are small enough that a smarter filter would save nothing worth the
  // code.
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let row = 0; row < size; row++) {
    raw[row * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, row * stride, stride).copy(
      raw,
      row * (stride + 1) + 1,
    );
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** An ICO carrying PNG payloads, which every browser since IE11 accepts. */
function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const dir = [];
  for (const { size, data } of entries) {
    const entry = Buffer.alloc(16);
    entry[0] = size === 256 ? 0 : size; // 0 means 256 in the ICO format
    entry[1] = size === 256 ? 0 : size;
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    dir.push(entry);
    offset += data.length;
  }

  return Buffer.concat([
    header,
    ...dir,
    ...entries.map((entry) => entry.data),
  ]);
}

function write(name, buffer) {
  writeFileSync(join(OUT, name), buffer);
  console.log(`${name}  ${buffer.length} bytes`);
}

// The tab icon, at the sizes a browser picks between.
const icoSizes = [16, 32, 48];
write(
  "favicon.ico",
  ico(icoSizes.map((size) => ({ size, data: png(size, render(size, true)) }))),
);

// A 96px PNG for the browsers and crawlers that prefer one over the ICO.
write("favicon-96.png", png(96, render(96, true)));

// iOS home screen. Square and full-bleed: iOS applies its own mask.
write("apple-touch-icon.png", png(180, render(180, false)));

// Installed-app icons, referenced by site.webmanifest.
write("icon-192.png", png(192, render(192, true)));
write("icon-512.png", png(512, render(512, true)));

// The maskable variant. Android crops an installed icon to its own shape, so
// this one is full-bleed; the mark sits well inside the 40% safe radius either
// way, but the plate's own corners would otherwise be cropped to a fringe.
write("icon-maskable-512.png", png(512, render(512, false)));
