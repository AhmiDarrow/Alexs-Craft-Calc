import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sortedCatalog } from '../src/i18n/buildCatalog.ts'

const here = dirname(fileURLToPath(import.meta.url))
const outPath = join(here, '..', 'src', 'i18n', 'locales', 'en.json')
const catalog = sortedCatalog()
writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
console.log(`en.json ${Object.keys(catalog).length} keys`)
