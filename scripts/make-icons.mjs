/**
 * Rasterize brand SVG into PWA PNG icons using pure Node (no native deps).
 * Creates a simple purple alien-mark PNG set if sharp isn't available.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
mkdirSync(publicDir, { recursive: true })

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const t = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}

function makePng(size) {
  // Deep purple bg + soft violet orb + star highlight
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const cx = size / 2
  const cy = size / 2
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4
      const dx = (x - cx) / size
      const dy = (y - cy) / size
      const d = Math.sqrt(dx * dx + dy * dy)
      // rounded square mask
      const nx = Math.abs(dx) * 2
      const ny = Math.abs(dy) * 2
      const corner = 0.72
      const inRound =
        Math.max(nx, ny) < corner ||
        (nx - corner) ** 2 + (ny - corner) ** 2 < (1 - corner) ** 2

      let r = 20,
        g = 8,
        b = 40,
        a = 255
      if (!inRound) {
        a = 0
      } else {
        // base gradient
        const t = Math.min(1, d * 1.6)
        r = Math.round(40 + (168 - 40) * (1 - t) + 30 * (1 - y / size))
        g = Math.round(16 + (85 - 16) * (1 - t))
        b = Math.round(70 + (247 - 70) * (1 - t * 0.8))
        // star glow center-top
        const sx = (x - cx) / size
        const sy = (y - cy * 0.55) / size
        const star = Math.exp(-(sx * sx * 40 + sy * sy * 28))
        r = Math.min(255, Math.round(r + star * 120))
        g = Math.min(255, Math.round(g + star * 90))
        b = Math.min(255, Math.round(b + star * 80))
        // border ring
        const edge = Math.abs(Math.max(nx, ny) - 0.92)
        if (edge < 0.06) {
          r = Math.min(255, r + 60)
          g = Math.min(255, g + 40)
          b = Math.min(255, b + 80)
        }
      }
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
      raw[i + 3] = a
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const compressed = deflateSync(raw)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) {
  const out = join(publicDir, `pwa-${size}.png`)
  writeFileSync(out, makePng(size))
  console.log('wrote', out)
}

// apple touch
writeFileSync(join(publicDir, 'apple-touch-icon.png'), makePng(180))
console.log('wrote apple-touch-icon.png')

// maskable slightly larger safe zone — same generator is fine
writeFileSync(join(publicDir, 'pwa-maskable-512.png'), makePng(512))
console.log('done')
