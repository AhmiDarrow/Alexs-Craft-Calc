/** Local recipe / preference storage for Alex's Craft Calc */

const SOAP_RECIPES_KEY = 'alien-craft-soap-recipes'
const CANDLE_RECIPES_KEY = 'alien-craft-candle-recipes'
const PREFS_KEY = 'alien-craft-prefs'

export const SHARE_FORMAT = 'alex-craft-calc-recipe' as const
export const SHARE_VERSION = 1 as const

export interface SavedSoapRecipe {
  id: string
  name: string
  savedAt: string
  oils: { oilId: string; amount: number; pct?: number }[]
  lyeType: 'naoh' | 'koh'
  superfatPct: number
  waterMethod: 'percent_oils' | 'lye_concentration' | 'discount'
  waterAsPercentOfOils: number
  lyeConcentrationPct: number
  waterDiscountPct: number
  fragrancePct: number
  unit: 'g' | 'oz' | 'lb'
  /** How oils were entered when saved */
  oilEntryMode?: 'weight' | 'percent'
  /** Dedicated total oils weight (used heavily in % mode) */
  totalOilsWeight?: number
  /** Free-form maker notes / custom recipe field */
  notes?: string
}

export interface SavedCandleRecipe {
  id: string
  name: string
  savedAt: string
  waxId: string
  vesselCount: number
  waxPerVessel: number
  useTotalWax: boolean
  totalWax: number
  fragrancePct: number
  dyeBlocksPerLb: number
  unit: 'g' | 'oz' | 'lb'
  vesselDiameterIn: number
  vesselPresetId?: string
}

/** Portable recipe pack — single recipe or a library dump */
export interface RecipeSharePack {
  format: typeof SHARE_FORMAT
  version: typeof SHARE_VERSION
  app: "Alex's Craft Calc"
  exportedAt: string
  kind: 'soap' | 'candle' | 'library'
  soap?: SavedSoapRecipe[]
  candle?: SavedCandleRecipe[]
}

export type ImportResult =
  | {
      ok: true
      kind: 'soap' | 'candle' | 'library'
      soapCount: number
      candleCount: number
      soap?: SavedSoapRecipe[]
      candle?: SavedCandleRecipe[]
      message: string
    }
  | { ok: false; error: string }

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / private mode */
  }
}

export function listSoapRecipes(): SavedSoapRecipe[] {
  return readJson<SavedSoapRecipe[]>(SOAP_RECIPES_KEY, []).sort((a, b) =>
    b.savedAt.localeCompare(a.savedAt),
  )
}

export function saveSoapRecipe(
  recipe: Omit<SavedSoapRecipe, 'id' | 'savedAt'> & { id?: string },
): SavedSoapRecipe {
  const all = listSoapRecipes()
  const entry: SavedSoapRecipe = {
    ...recipe,
    id: recipe.id || `soap-${Date.now().toString(36)}`,
    savedAt: new Date().toISOString(),
  }
  const idx = all.findIndex((r) => r.id === entry.id || r.name === entry.name)
  if (idx >= 0) all[idx] = entry
  else all.unshift(entry)
  writeJson(SOAP_RECIPES_KEY, all.slice(0, 40))
  return entry
}

export function deleteSoapRecipe(id: string) {
  writeJson(
    SOAP_RECIPES_KEY,
    listSoapRecipes().filter((r) => r.id !== id),
  )
}

export function listCandleRecipes(): SavedCandleRecipe[] {
  return readJson<SavedCandleRecipe[]>(CANDLE_RECIPES_KEY, []).sort((a, b) =>
    b.savedAt.localeCompare(a.savedAt),
  )
}

export function saveCandleRecipe(
  recipe: Omit<SavedCandleRecipe, 'id' | 'savedAt'> & { id?: string },
): SavedCandleRecipe {
  const all = listCandleRecipes()
  const entry: SavedCandleRecipe = {
    ...recipe,
    id: recipe.id || `candle-${Date.now().toString(36)}`,
    savedAt: new Date().toISOString(),
  }
  const idx = all.findIndex((r) => r.id === entry.id || r.name === entry.name)
  if (idx >= 0) all[idx] = entry
  else all.unshift(entry)
  writeJson(CANDLE_RECIPES_KEY, all.slice(0, 40))
  return entry
}

export function deleteCandleRecipe(id: string) {
  writeJson(
    CANDLE_RECIPES_KEY,
    listCandleRecipes().filter((r) => r.id !== id),
  )
}

export interface AppPrefs {
  lastWikiId?: string
}

export function getPrefs(): AppPrefs {
  return readJson<AppPrefs>(PREFS_KEY, {})
}

export function setPrefs(patch: Partial<AppPrefs>) {
  writeJson(PREFS_KEY, { ...getPrefs(), ...patch })
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

/* ─── Export / import ─────────────────────────────────────────────────── */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isSoapRecipe(v: unknown): v is SavedSoapRecipe {
  if (!isRecord(v)) return false
  if (typeof v.name !== 'string' || !Array.isArray(v.oils)) return false
  if (v.lyeType !== 'naoh' && v.lyeType !== 'koh') return false
  if (typeof v.superfatPct !== 'number') return false
  if (
    v.waterMethod !== 'percent_oils' &&
    v.waterMethod !== 'lye_concentration' &&
    v.waterMethod !== 'discount'
  )
    return false
  if (v.unit !== 'g' && v.unit !== 'oz' && v.unit !== 'lb') return false
  return v.oils.every(
    (o) =>
      isRecord(o) &&
      typeof o.oilId === 'string' &&
      typeof o.amount === 'number' &&
      Number.isFinite(o.amount),
  )
}

function isCandleRecipe(v: unknown): v is SavedCandleRecipe {
  if (!isRecord(v)) return false
  if (typeof v.name !== 'string' || typeof v.waxId !== 'string') return false
  if (typeof v.vesselCount !== 'number' || typeof v.waxPerVessel !== 'number') return false
  if (typeof v.useTotalWax !== 'boolean' || typeof v.totalWax !== 'number') return false
  if (typeof v.fragrancePct !== 'number') return false
  if (v.unit !== 'g' && v.unit !== 'oz' && v.unit !== 'lb') return false
  return true
}

function normalizeSoap(r: SavedSoapRecipe, forceNewId = true): SavedSoapRecipe {
  const unit = r.unit === 'oz' || r.unit === 'lb' ? r.unit : 'g'
  const oilEntryMode =
    r.oilEntryMode === 'percent' || r.oilEntryMode === 'weight' ? r.oilEntryMode : 'weight'
  const notes =
    typeof r.notes === 'string' ? r.notes.slice(0, 4000) : undefined
  const totalOilsWeight =
    typeof r.totalOilsWeight === 'number' && Number.isFinite(r.totalOilsWeight)
      ? r.totalOilsWeight
      : undefined
  return {
    id: forceNewId ? `soap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` : r.id,
    name: String(r.name).slice(0, 120) || 'Imported soap',
    savedAt: typeof r.savedAt === 'string' ? r.savedAt : new Date().toISOString(),
    oils: r.oils.map((o) => ({
      oilId: o.oilId,
      amount: o.amount,
      ...(typeof o.pct === 'number' && Number.isFinite(o.pct) ? { pct: o.pct } : {}),
    })),
    lyeType: r.lyeType,
    superfatPct: r.superfatPct,
    waterMethod: r.waterMethod,
    waterAsPercentOfOils: Number(r.waterAsPercentOfOils) || 33,
    lyeConcentrationPct: Number(r.lyeConcentrationPct) || 33,
    waterDiscountPct: Number(r.waterDiscountPct) || 0,
    fragrancePct: Number(r.fragrancePct) || 0,
    unit,
    oilEntryMode,
    ...(totalOilsWeight != null ? { totalOilsWeight } : {}),
    ...(notes ? { notes } : {}),
  }
}

function normalizeCandle(r: SavedCandleRecipe, forceNewId = true): SavedCandleRecipe {
  return {
    id: forceNewId
      ? `candle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      : r.id,
    name: String(r.name).slice(0, 120) || 'Imported candle',
    savedAt: typeof r.savedAt === 'string' ? r.savedAt : new Date().toISOString(),
    waxId: r.waxId,
    vesselCount: r.vesselCount,
    waxPerVessel: r.waxPerVessel,
    useTotalWax: r.useTotalWax,
    totalWax: r.totalWax,
    fragrancePct: r.fragrancePct,
    dyeBlocksPerLb: Number(r.dyeBlocksPerLb) || 0,
    unit: r.unit,
    vesselDiameterIn: Number(r.vesselDiameterIn) || 0,
    vesselPresetId: r.vesselPresetId,
  }
}

export function buildSoapSharePack(recipe: SavedSoapRecipe): RecipeSharePack {
  return {
    format: SHARE_FORMAT,
    version: SHARE_VERSION,
    app: "Alex's Craft Calc",
    exportedAt: new Date().toISOString(),
    kind: 'soap',
    soap: [recipe],
  }
}

export function buildCandleSharePack(recipe: SavedCandleRecipe): RecipeSharePack {
  return {
    format: SHARE_FORMAT,
    version: SHARE_VERSION,
    app: "Alex's Craft Calc",
    exportedAt: new Date().toISOString(),
    kind: 'candle',
    candle: [recipe],
  }
}

export function buildLibrarySharePack(): RecipeSharePack {
  return {
    format: SHARE_FORMAT,
    version: SHARE_VERSION,
    app: "Alex's Craft Calc",
    exportedAt: new Date().toISOString(),
    kind: 'library',
    soap: listSoapRecipes(),
    candle: listCandleRecipes(),
  }
}

export function packToJson(pack: RecipeSharePack): string {
  return JSON.stringify(pack, null, 2)
}

export function downloadJson(filename: string, json: string) {
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

function safeFilename(name: string, fallback: string): string {
  const base = (name || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 48)
  return base || fallback
}

export function exportSoapRecipeFile(recipe: SavedSoapRecipe) {
  const pack = buildSoapSharePack(recipe)
  downloadJson(`${safeFilename(recipe.name, 'soap-recipe')}.alex-soap.json`, packToJson(pack))
}

export function exportCandleRecipeFile(recipe: SavedCandleRecipe) {
  const pack = buildCandleSharePack(recipe)
  downloadJson(`${safeFilename(recipe.name, 'candle-recipe')}.alex-candle.json`, packToJson(pack))
}

export function exportLibraryFile() {
  const pack = buildLibrarySharePack()
  const stamp = new Date().toISOString().slice(0, 10)
  downloadJson(`alex-craft-library-${stamp}.json`, packToJson(pack))
}

/** Parse recipe JSON — accepts full pack, bare soap recipe, or bare candle recipe */
export function parseSharePayload(raw: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Not valid JSON' }
  }

  if (!isRecord(data)) return { ok: false, error: 'Invalid recipe file' }

  // Full share pack
  if (data.format === SHARE_FORMAT || data.format === 'alien-craft-calc-recipe') {
    const soapRaw = Array.isArray(data.soap) ? data.soap.filter(isSoapRecipe) : []
    const candleRaw = Array.isArray(data.candle) ? data.candle.filter(isCandleRecipe) : []
    if (soapRaw.length === 0 && candleRaw.length === 0) {
      return { ok: false, error: 'Recipe file has no recipes' }
    }
    const soap = soapRaw.map((r) => normalizeSoap(r))
    const candle = candleRaw.map((r) => normalizeCandle(r))
    const kind =
      data.kind === 'library' || (soap.length > 0 && candle.length > 0)
        ? 'library'
        : soap.length > 0
          ? 'soap'
          : 'candle'
    return {
      ok: true,
      kind,
      soapCount: soap.length,
      candleCount: candle.length,
      soap: soap.length ? soap : undefined,
      candle: candle.length ? candle : undefined,
      message:
        kind === 'library'
          ? `Library: ${soap.length} soap, ${candle.length} candle`
          : soap.length === 1 && candle.length === 0
            ? `Soap “${soap[0].name}”`
            : candle.length === 1 && soap.length === 0
              ? `Candle “${candle[0].name}”`
              : `${soap.length + candle.length} recipes`,
    }
  }

  // Bare soap recipe
  if (isSoapRecipe(data)) {
    const soap = [normalizeSoap(data)]
    return {
      ok: true,
      kind: 'soap',
      soapCount: 1,
      candleCount: 0,
      soap,
      message: `Soap “${soap[0].name}”`,
    }
  }

  // Bare candle recipe
  if (isCandleRecipe(data)) {
    const candle = [normalizeCandle(data)]
    return {
      ok: true,
      kind: 'candle',
      soapCount: 0,
      candleCount: 1,
      candle,
      message: `Candle “${candle[0].name}”`,
    }
  }

  // Array of mixed recipes
  if (Array.isArray(data)) {
    const soap = data.filter(isSoapRecipe).map((r) => normalizeSoap(r))
    const candle = data.filter(isCandleRecipe).map((r) => normalizeCandle(r))
    if (soap.length === 0 && candle.length === 0) {
      return { ok: false, error: 'No recognized recipes in file' }
    }
    return {
      ok: true,
      kind: soap.length && candle.length ? 'library' : soap.length ? 'soap' : 'candle',
      soapCount: soap.length,
      candleCount: candle.length,
      soap: soap.length ? soap : undefined,
      candle: candle.length ? candle : undefined,
      message: `Imported ${soap.length + candle.length} recipes`,
    }
  }

  return { ok: false, error: 'Unrecognized recipe format' }
}

/** Merge imported recipes into local library (by name overwrite) */
export function mergeImportedRecipes(result: Extract<ImportResult, { ok: true }>): {
  soapSaved: number
  candleSaved: number
} {
  let soapSaved = 0
  let candleSaved = 0
  if (result.soap) {
    for (const r of result.soap) {
      saveSoapRecipe({ ...r, id: undefined })
      soapSaved++
    }
  }
  if (result.candle) {
    for (const r of result.candle) {
      saveCandleRecipe({ ...r, id: undefined })
      candleSaved++
    }
  }
  return { soapSaved, candleSaved }
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'))
    reader.readAsText(file)
  })
}

export function currentSoapSnapshot(
  partial: Omit<SavedSoapRecipe, 'id' | 'savedAt'>,
): SavedSoapRecipe {
  return {
    ...partial,
    id: `soap-live-${Date.now().toString(36)}`,
    savedAt: new Date().toISOString(),
  }
}

export function currentCandleSnapshot(
  partial: Omit<SavedCandleRecipe, 'id' | 'savedAt'>,
): SavedCandleRecipe {
  return {
    ...partial,
    id: `candle-live-${Date.now().toString(36)}`,
    savedAt: new Date().toISOString(),
  }
}

/* Friendly aliases used by calculator UI */
export const exportSoapPack = buildSoapSharePack
export const exportCandlePack = buildCandleSharePack
export const exportLibraryPack = buildLibrarySharePack
export const importRecipesFromText = parseSharePayload

export function downloadSharePack(pack: RecipeSharePack) {
  if (pack.kind === 'soap' && pack.soap?.[0]) {
    exportSoapRecipeFile(pack.soap[0])
    return
  }
  if (pack.kind === 'candle' && pack.candle?.[0]) {
    exportCandleRecipeFile(pack.candle[0])
    return
  }
  exportLibraryFile()
}

