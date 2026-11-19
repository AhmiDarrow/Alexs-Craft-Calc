// Reads a recipe file with the shipped app's own parser and prints what it found as JSON
// (used by tests/migration.rs to prove files from the RemedyUI app load in the old app).
import { readFileSync } from 'node:fs'
import { parseSharePayload } from '../../src/lib/storage'

const r = parseSharePayload(readFileSync(process.argv[2], 'utf8'))
console.log(
  JSON.stringify(
    r.ok
      ? { ok: true, kind: r.kind, soap: r.soapCount, candle: r.candleCount, names: [...(r.soap ?? []), ...(r.candle ?? [])].map((x) => x.name) }
      : { ok: false, error: r.error },
  ),
)
