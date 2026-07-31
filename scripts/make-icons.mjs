/**
 * Build PWA / web icons for Alex's Craft Calc.
 * Prefer the ComfyUI soap-bar master (public/app-icon-source.png or ../app-icon.png).
 * Falls back to a procedural Alien Purple mark if no master is present.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicDir = join(root, 'public')
mkdirSync(publicDir, { recursive: true })

const masters = [
  join(publicDir, 'app-icon-source.png'),
  join(root, 'app-icon.png'),
  join(publicDir, 'app-icon-rounded.png'),
]

const master = masters.find((p) => existsSync(p))

function tryPillowResize() {
  if (!master) return false
  const pyCandidates = [
    process.env.COMFYUI_PYTHON,
    'C:\\Users\\Administrator\\Documents\\comfy\\ComfyUI\\.venv\\Scripts\\python.exe',
    'python',
    'py',
  ].filter(Boolean)

  const script = `
from PIL import Image
from pathlib import Path
src = Path(r"""${master.replace(/\\/g, '\\\\')}""")
public = Path(r"""${publicDir.replace(/\\/g, '\\\\')}""")
img = Image.open(src).convert("RGBA")
sizes = {
    "pwa-512.png": 512,
    "pwa-192.png": 192,
    "pwa-maskable-512.png": 512,
    "apple-touch-icon.png": 180,
    "favicon-32.png": 32,
    "brand-soap.png": 128,
    "icon-soap.png": 512,
}
for name, size in sizes.items():
    out = img.resize((size, size), Image.Resampling.LANCZOS)
    out.save(public / name, "PNG")
    print("wrote", name, size)
# keep brand-mark.png in sync for UI
(public / "brand-mark.png").write_bytes((public / "brand-soap.png").read_bytes())
print("wrote brand-mark.png")
`
  for (const py of pyCandidates) {
    const r = spawnSync(py, ['-c', script], { encoding: 'utf8' })
    if (r.status === 0) {
      console.log(r.stdout)
      return true
    }
  }
  // No Pillow — at least copy master to key slots if sizes match-ish
  try {
    copyFileSync(master, join(publicDir, 'pwa-512.png'))
    copyFileSync(master, join(publicDir, 'pwa-maskable-512.png'))
    copyFileSync(master, join(publicDir, 'app-icon-source.png'))
    console.log('copied master without resize (install Pillow for full set)')
    return true
  } catch {
    return false
  }
}

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
        const t = Math.min(1, d * 1.6)
        r = Math.round(40 + (168 - 40) * (1 - t) + 30 * (1 - y / size))
        g = Math.round(16 + (85 - 16) * (1 - t))
        b = Math.round(70 + (247 - 70) * (1 - t * 0.8))
        // soap-bar silhouette (rounded rect in center)
        const bx = Math.abs(dx) / 0.34
        const by = Math.abs(dy + 0.02) / 0.22
        const bar =
          Math.max(bx, by) < 0.85 ||
          (Math.max(0, bx - 0.7) ** 2 + Math.max(0, by - 0.7) ** 2 < 0.09)
        if (bar) {
          const shade = 0.55 + 0.35 * (1 - by * 0.5) + 0.1 * Math.sin(dx * 18)
          r = Math.min(255, Math.round(120 + shade * 100))
          g = Math.min(255, Math.round(70 + shade * 60))
          b = Math.min(255, Math.round(200 + shade * 40))
          // top highlight
          if (dy < -0.02 && dy > -0.16 && Math.abs(dx) < 0.28) {
            r = Math.min(255, r + 50)
            g = Math.min(255, g + 40)
            b = Math.min(255, b + 30)
          }
        }
        const sx = (x - cx) / size
        const sy = (y - cy * 0.55) / size
        const star = Math.exp(-(sx * sx * 40 + sy * sy * 28))
        r = Math.min(255, Math.round(r + star * 40))
        g = Math.min(255, Math.round(g + star * 30))
        b = Math.min(255, Math.round(b + star * 50))
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

if (tryPillowResize()) {
  console.log('icons from soap master:', master)
} else {
  console.log('no soap master — procedural fallback')
  for (const size of [192, 512]) {
    const out = join(publicDir, `pwa-${size}.png`)
    writeFileSync(out, makePng(size))
    console.log('wrote', out)
  }
  writeFileSync(join(publicDir, 'apple-touch-icon.png'), makePng(180))
  writeFileSync(join(publicDir, 'pwa-maskable-512.png'), makePng(512))
  writeFileSync(join(publicDir, 'favicon-32.png'), makePng(32))
  writeFileSync(join(publicDir, 'brand-soap.png'), makePng(128))
  console.log('done fallback')
}

// Ensure source is present in public for docs/rebuilds
if (master && !existsSync(join(publicDir, 'app-icon-source.png'))) {
  copyFileSync(master, join(publicDir, 'app-icon-source.png'))
}

console.log('make-icons complete')
