/// <reference types="node" />
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildCatalog } from './buildCatalog.ts'
import { LOCALE_IDS, type LocaleId } from './locales.ts'
import { placeholderNames } from './translate.ts'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const localeDir = join(root, 'src', 'i18n', 'locales')

function fail(message: string): never {
  throw new Error(message)
}

function readCatalog(id: string): Record<string, string> {
  const path = join(localeDir, `${id}.json`)
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    fail(`${id}.json is not valid JSON (${err instanceof Error ? err.message : err})`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail(`${id}.json must be an object`)
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string' || value.trim() === '') fail(`${id}.json ${key} is empty`)
    out[key] = value
  }
  return out
}

function markerCount(text: string, re: RegExp): number {
  return text.match(re)?.length ?? 0
}

function listCount(text: string, re: RegExp): number {
  return text.split('\n').filter((line) => re.test(line)).length
}

const CHEMICALS = [
  'NaOH',
  'KOH',
  'SAP',
  'INS',
  'IFRA',
  'DOS',
  'PPE',
  'RSPO',
  'ECO',
  'CD',
  'LX',
  'FO',
  'TiO₂',
  'Crisco',
  'Ahmi',
]

function sameShape(id: string, english: string, translated: string, key: string) {
  const a = placeholderNames(english).join(',')
  const b = placeholderNames(translated).join(',')
  if (a !== b) fail(`${id} ${key} placeholders ${b} != ${a}`)
  if (markerCount(english, /\*\*/g) !== markerCount(translated, /\*\*/g)) {
    fail(`${id} ${key} ** count changed`)
  }
  if (markerCount(english, /\n\n+/g) !== markerCount(translated, /\n\n+/g)) {
    fail(`${id} ${key} paragraph breaks changed`)
  }
  if (listCount(english, /^\s*[•\-*]\s+/) !== listCount(translated, /^\s*[•\-*]\s+/)) {
    fail(`${id} ${key} bullet lines changed`)
  }
  if (listCount(english, /^\s*\d+\.\s/) !== listCount(translated, /^\s*\d+\.\s/)) {
    fail(`${id} ${key} numbered lines changed`)
  }
  if (english.includes("Alex's Craft Calc") && !translated.includes("Alex's Craft Calc")) {
    fail(`${id} ${key} dropped Alex's Craft Calc`)
  }
  if (english.includes("Alex's") && !english.includes("Alex's Craft Calc") && !translated.includes("Alex's")) {
    fail(`${id} ${key} dropped Alex's`)
  }
  if (english.includes('"Hope this helps" - Ahmi') && !translated.includes('"Hope this helps" - Ahmi')) {
    fail(`${id} ${key} changed the Ahmi sign-off`)
  }
  for (const token of CHEMICALS) {
    if (hasToken(english, token) && !hasToken(translated, token)) fail(`${id} ${key} dropped ${token}`)
  }
}

/** Whole token only. "BEFORE" must not count as the fragrance-oil code FO. */
function hasToken(text: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`).test(text)
}

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name === 'locales' || name === 'node_modules') continue
      walk(path, out)
      continue
    }
    if (name.endsWith('.test.ts')) continue
    if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(path)
  }
}

const english = readCatalog('en')
const built = buildCatalog()
const builtKeys = Object.keys(built).sort()
const enKeys = Object.keys(english).sort()
if (builtKeys.length !== enKeys.length || builtKeys.some((key, i) => key !== enKeys[i])) {
  fail(`en.json keys differ from buildCatalog (${builtKeys.length} built, ${enKeys.length} file)`)
}
for (const key of builtKeys) {
  if (built[key] !== english[key]) fail(`en.json drifted on ${key}`)
}

const only = process.env.I18N_ONLY?.trim()
const ids: LocaleId[] = only
  ? LOCALE_IDS.filter((id) => id === only)
  : [...LOCALE_IDS]
if (only && ids.length === 0) fail(`I18N_ONLY=${only} is not a supported locale`)

for (const id of ids) {
  if (id === 'en') continue
  const catalog = readCatalog(id)
  const keys = Object.keys(catalog).sort()
  if (keys.length !== enKeys.length || keys.some((key, i) => key !== enKeys[i])) {
    const missing = enKeys.filter((key) => !(key in catalog))
    const extra = keys.filter((key) => !(key in english))
    fail(`${id}.json key mismatch missing=${missing.slice(0, 8).join(',')} extra=${extra.slice(0, 8).join(',')}`)
  }
  let long = 0
  let identical = 0
  for (const key of enKeys) {
    sameShape(id, english[key], catalog[key], key)
    if (english[key].length >= 80) {
      long += 1
      if (catalog[key] === english[key]) identical += 1
    }
  }
  if (long > 0 && identical / long > 0.25) {
    fail(`${id}.json looks untranslated (${identical}/${long} long strings still English)`)
  }
}

const staticKey = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"](?!\s*\+)/g
const txKey = /\btx\(\s*[^,]+,\s*['"]([a-zA-Z0-9_.]+)['"](?!\s*\+)/g
const files: string[] = []
walk(join(root, 'src'), files)
const missing = new Set<string>()
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const re of [staticKey, txKey]) {
    re.lastIndex = 0
    for (const match of text.matchAll(re)) {
      const key = match[1]
      if (key.endsWith('.')) continue
      if (!(key in english)) missing.add(`${relative(root, file)} ${key}`)
    }
  }
}
if (missing.size) fail(`static keys missing from en.json:\n${[...missing].join('\n')}`)

console.log(`i18n check ok (${enKeys.length} keys, ${ids.filter((id) => id !== 'en').length} locales)`)
