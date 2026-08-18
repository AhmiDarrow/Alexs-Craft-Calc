/** Local recipe / preference storage for Alex's Craft Calc */

const SOAP_RECIPES_KEY = 'alien-craft-soap-recipes'
const CANDLE_RECIPES_KEY = 'alien-craft-candle-recipes'
const PREFS_KEY = 'alien-craft-prefs'

export const SHARE_FORMAT = 'alex-craft-calc-recipe' as const
export const SHARE_VERSION = 1 as const

/** Max recipes kept per library (oldest beyond this are dropped). */
export const MAX_SAVED_RECIPES = 60

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
  /** How oils were entered when saved (dual = weight+% both live; ceiling = totalOilsWeight) */
  oilEntryMode?: 'weight' | 'percent' | 'dual'
  /** Fixed Total oils ceiling — batch size oils must match */
  totalOilsWeight?: number
  /** Free-form maker notes / custom recipe field */
  notes?: string
  /** Add-ins: ground oats, clays, milks, etc. (weight in the recipe unit) */
  additives?: { additiveId: string; amount: number }[]
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
  /** Free-form maker notes */
  notes?: string
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

export type StorageWriteResult =
  | { ok: true }
  | { ok: false; error: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isSoapRecipe(v: unknown): v is SavedSoapRecipe {
  if (!isRecord(v)) return false
  if (typeof v.name !== 'string' || !Array.isArray(v.oils)) return false
  if (v.lyeType !== 'naoh' && v.lyeType !== 'koh') return false
  if (typeof v.superfatPct !== 'number' || !Number.isFinite(v.superfatPct)) return false
  if (
    v.waterMethod !== 'percent_oils' &&
    v.waterMethod !== 'lye_concentration' &&
    v.waterMethod !== 'discount'
  )
    return false
  if (v.unit !== 'g' && v.unit !== 'oz' && v.unit !== 'lb') return false
  if (
    v.additives !== undefined &&
    (!Array.isArray(v.additives) ||
      !v.additives.every(
        (a) =>
          isRecord(a) &&
          typeof a.additiveId === 'string' &&
          a.additiveId.length > 0 &&
          typeof a.amount === 'number' &&
          Number.isFinite(a.amount),
      ))
  )
    return false
  return v.oils.every(
    (o) =>
      isRecord(o) &&
      typeof o.oilId === 'string' &&
      o.oilId.length > 0 &&
      typeof o.amount === 'number' &&
      Number.isFinite(o.amount),
  )
}

function isCandleRecipe(v: unknown): v is SavedCandleRecipe {
  if (!isRecord(v)) return false
  if (typeof v.name !== 'string' || typeof v.waxId !== 'string' || !v.waxId) return false
  if (typeof v.vesselCount !== 'number' || !Number.isFinite(v.vesselCount)) return false
  if (typeof v.waxPerVessel !== 'number' || !Number.isFinite(v.waxPerVessel)) return false
  if (typeof v.useTotalWax !== 'boolean') return false
  if (typeof v.totalWax !== 'number' || !Number.isFinite(v.totalWax)) return false
  if (typeof v.fragrancePct !== 'number' || !Number.isFinite(v.fragrancePct)) return false
  if (v.unit !== 'g' && v.unit !== 'oz' && v.unit !== 'lb') return false
  return true
}

function readJson<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): StorageWriteResult {
  try {
    if (typeof localStorage === 'undefined') {
      return { ok: false, error: 'Storage is not available in this environment' }
    }
    localStorage.setItem(key, JSON.stringify(value))
    return { ok: true }
  } catch (err) {
    const name = err instanceof DOMException ? err.name : ''
    if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      return { ok: false, error: 'Storage full — export a backup, then delete old recipes' }
    }
    if (name === 'SecurityError') {
      return { ok: false, error: 'Storage blocked (private / restricted mode)' }
    }
    return { ok: false, error: 'Could not save to local storage' }
  }
}

function newSoapId(): string {
  return `soap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function newCandleId(): string {
  return `candle-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function sortBySavedAtDesc<T extends { savedAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

function sanitizeSoapList(raw: unknown): SavedSoapRecipe[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(isSoapRecipe)
    .map((r) => normalizeSoap(r, false))
    .filter((r) => r.id && r.name)
}

function sanitizeCandleList(raw: unknown): SavedCandleRecipe[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(isCandleRecipe)
    .map((r) => normalizeCandle(r, false))
    .filter((r) => r.id && r.name)
}

export function listSoapRecipes(): SavedSoapRecipe[] {
  return sortBySavedAtDesc(sanitizeSoapList(readJson<unknown>(SOAP_RECIPES_KEY, [])))
}

export function listCandleRecipes(): SavedCandleRecipe[] {
  return sortBySavedAtDesc(sanitizeCandleList(readJson<unknown>(CANDLE_RECIPES_KEY, [])))
}

export function getSoapRecipe(id: string): SavedSoapRecipe | undefined {
  return listSoapRecipes().find((r) => r.id === id)
}

export function getCandleRecipe(id: string): SavedCandleRecipe | undefined {
  return listCandleRecipes().find((r) => r.id === id)
}

/**
 * True when Save would clobber another library slot by name alone
 * (no active id, or id not found, but a different recipe already uses this name).
 */
export function soapNameCollision(name: string, activeId?: string | null): SavedSoapRecipe | undefined {
  const nameKey = (name || '').trim().toLowerCase()
  if (!nameKey) return undefined
  return listSoapRecipes().find(
    (r) => r.name.trim().toLowerCase() === nameKey && (!activeId || r.id !== activeId),
  )
}

export function candleNameCollision(
  name: string,
  activeId?: string | null,
): SavedCandleRecipe | undefined {
  const nameKey = (name || '').trim().toLowerCase()
  if (!nameKey) return undefined
  return listCandleRecipes().find(
    (r) => r.name.trim().toLowerCase() === nameKey && (!activeId || r.id !== activeId),
  )
}

/**
 * Save soap recipe.
 * - If `id` matches an existing recipe → update that slot (stable id).
 * - Else if same name (case-insensitive) exists → overwrite that slot, keep its id.
 * - Else insert as new.
 */
export function saveSoapRecipe(
  recipe: Omit<SavedSoapRecipe, 'id' | 'savedAt'> & { id?: string },
): { recipe: SavedSoapRecipe; write: StorageWriteResult; overwritten: boolean } {
  const all = listSoapRecipes()
  const nameKey = (recipe.name || '').trim().toLowerCase()
  let idx = -1
  if (recipe.id) {
    idx = all.findIndex((r) => r.id === recipe.id)
  }
  if (idx < 0 && nameKey) {
    idx = all.findIndex((r) => r.name.trim().toLowerCase() === nameKey)
  }

  const keepId = idx >= 0 ? all[idx].id : recipe.id || newSoapId()
  const entry = normalizeSoap(
    {
      ...recipe,
      id: keepId,
      savedAt: new Date().toISOString(),
      name: recipe.name,
      oils: recipe.oils,
      lyeType: recipe.lyeType,
      superfatPct: recipe.superfatPct,
      waterMethod: recipe.waterMethod,
      waterAsPercentOfOils: recipe.waterAsPercentOfOils,
      lyeConcentrationPct: recipe.lyeConcentrationPct,
      waterDiscountPct: recipe.waterDiscountPct,
      fragrancePct: recipe.fragrancePct,
      unit: recipe.unit,
      oilEntryMode: recipe.oilEntryMode,
      totalOilsWeight: recipe.totalOilsWeight,
      notes: recipe.notes,
      additives: recipe.additives,
    } as SavedSoapRecipe,
    false,
  )

  const overwritten = idx >= 0
  if (idx >= 0) all[idx] = entry
  else all.unshift(entry)

  const write = writeJson(SOAP_RECIPES_KEY, sortBySavedAtDesc(all).slice(0, MAX_SAVED_RECIPES))
  return { recipe: entry, write, overwritten }
}

export function deleteSoapRecipe(id: string): StorageWriteResult {
  return writeJson(
    SOAP_RECIPES_KEY,
    listSoapRecipes().filter((r) => r.id !== id),
  )
}

export function saveCandleRecipe(
  recipe: Omit<SavedCandleRecipe, 'id' | 'savedAt'> & { id?: string },
): { recipe: SavedCandleRecipe; write: StorageWriteResult; overwritten: boolean } {
  const all = listCandleRecipes()
  const nameKey = (recipe.name || '').trim().toLowerCase()
  let idx = -1
  if (recipe.id) {
    idx = all.findIndex((r) => r.id === recipe.id)
  }
  if (idx < 0 && nameKey) {
    idx = all.findIndex((r) => r.name.trim().toLowerCase() === nameKey)
  }

  const keepId = idx >= 0 ? all[idx].id : recipe.id || newCandleId()
  const entry = normalizeCandle(
    {
      ...recipe,
      id: keepId,
      savedAt: new Date().toISOString(),
      name: recipe.name,
      waxId: recipe.waxId,
      vesselCount: recipe.vesselCount,
      waxPerVessel: recipe.waxPerVessel,
      useTotalWax: recipe.useTotalWax,
      totalWax: recipe.totalWax,
      fragrancePct: recipe.fragrancePct,
      dyeBlocksPerLb: recipe.dyeBlocksPerLb,
      unit: recipe.unit,
      vesselDiameterIn: recipe.vesselDiameterIn,
      vesselPresetId: recipe.vesselPresetId,
      notes: recipe.notes,
    } as SavedCandleRecipe,
    false,
  )

  const overwritten = idx >= 0
  if (idx >= 0) all[idx] = entry
  else all.unshift(entry)

  const write = writeJson(CANDLE_RECIPES_KEY, sortBySavedAtDesc(all).slice(0, MAX_SAVED_RECIPES))
  return { recipe: entry, write, overwritten }
}

export function deleteCandleRecipe(id: string): StorageWriteResult {
  return writeJson(
    CANDLE_RECIPES_KEY,
    listCandleRecipes().filter((r) => r.id !== id),
  )
}

export interface AppPrefs {
  lastWikiId?: string
}

export function getPrefs(): AppPrefs {
  const raw = readJson<unknown>(PREFS_KEY, {})
  if (!isRecord(raw)) return {}
  const out: AppPrefs = {}
  if (typeof raw.lastWikiId === 'string') out.lastWikiId = raw.lastWikiId.slice(0, 120)
  return out
}

export function setPrefs(patch: Partial<AppPrefs>): StorageWriteResult {
  return writeJson(PREFS_KEY, { ...getPrefs(), ...patch })
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    if (typeof document === 'undefined') return false
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

/* ─── Normalize ───────────────────────────────────────────────────────── */

function normalizeSoap(r: SavedSoapRecipe, forceNewId = true): SavedSoapRecipe {
  const unit = r.unit === 'oz' || r.unit === 'lb' || r.unit === 'g' ? r.unit : 'g'
  const oilEntryMode =
    r.oilEntryMode === 'percent' || r.oilEntryMode === 'weight' || r.oilEntryMode === 'dual'
      ? r.oilEntryMode
      : 'dual'
  const notes =
    typeof r.notes === 'string' && r.notes.trim() ? r.notes.trim().slice(0, 4000) : undefined
  const totalOilsWeight =
    typeof r.totalOilsWeight === 'number' && Number.isFinite(r.totalOilsWeight) && r.totalOilsWeight > 0
      ? r.totalOilsWeight
      : undefined
  const additives = (Array.isArray(r.additives) ? r.additives : [])
    .filter(
      (a) =>
        a &&
        typeof a.additiveId === 'string' &&
        a.additiveId &&
        typeof a.amount === 'number' &&
        Number.isFinite(a.amount) &&
        a.amount > 0,
    )
    .map((a) => ({ additiveId: a.additiveId.slice(0, 60), amount: a.amount }))
  const id =
    !forceNewId && typeof r.id === 'string' && r.id.trim()
      ? r.id.trim().slice(0, 80)
      : newSoapId()

  return {
    id,
    name: String(r.name || '').trim().slice(0, 120) || 'Imported soap',
    savedAt:
      typeof r.savedAt === 'string' && !Number.isNaN(Date.parse(r.savedAt))
        ? r.savedAt
        : new Date().toISOString(),
    oils: (Array.isArray(r.oils) ? r.oils : [])
      .filter(
        (o) =>
          o &&
          typeof o.oilId === 'string' &&
          o.oilId &&
          typeof o.amount === 'number' &&
          Number.isFinite(o.amount),
      )
      .map((o) => ({
        oilId: o.oilId,
        amount: o.amount,
        ...(typeof o.pct === 'number' && Number.isFinite(o.pct) ? { pct: o.pct } : {}),
      })),
    lyeType: r.lyeType === 'koh' ? 'koh' : 'naoh',
    superfatPct: Number.isFinite(Number(r.superfatPct)) ? Number(r.superfatPct) : 5,
    waterMethod:
      r.waterMethod === 'lye_concentration' || r.waterMethod === 'discount'
        ? r.waterMethod
        : 'percent_oils',
    waterAsPercentOfOils: Number(r.waterAsPercentOfOils) || 33,
    lyeConcentrationPct: Number(r.lyeConcentrationPct) || 33,
    waterDiscountPct: Number(r.waterDiscountPct) || 0,
    fragrancePct: Number(r.fragrancePct) || 0,
    unit,
    oilEntryMode,
    ...(totalOilsWeight != null ? { totalOilsWeight } : {}),
    ...(notes ? { notes } : {}),
    ...(additives.length > 0 ? { additives } : {}),
  }
}

function normalizeCandle(r: SavedCandleRecipe, forceNewId = true): SavedCandleRecipe {
  const unit = r.unit === 'oz' || r.unit === 'lb' || r.unit === 'g' ? r.unit : 'g'
  const notes =
    typeof r.notes === 'string' && r.notes.trim() ? r.notes.trim().slice(0, 4000) : undefined
  const id =
    !forceNewId && typeof r.id === 'string' && r.id.trim()
      ? r.id.trim().slice(0, 80)
      : newCandleId()

  return {
    id,
    name: String(r.name || '').trim().slice(0, 120) || 'Imported candle',
    savedAt:
      typeof r.savedAt === 'string' && !Number.isNaN(Date.parse(r.savedAt))
        ? r.savedAt
        : new Date().toISOString(),
    waxId: String(r.waxId || 'soy-111'),
    vesselCount: Math.max(1, Math.floor(Number(r.vesselCount)) || 1),
    waxPerVessel: Number(r.waxPerVessel) || 0,
    useTotalWax: Boolean(r.useTotalWax),
    totalWax: Number(r.totalWax) || 0,
    fragrancePct: Number(r.fragrancePct) || 0,
    dyeBlocksPerLb: Number(r.dyeBlocksPerLb) || 0,
    unit,
    vesselDiameterIn: Number(r.vesselDiameterIn) || 0,
    vesselPresetId:
      typeof r.vesselPresetId === 'string' && r.vesselPresetId
        ? r.vesselPresetId.slice(0, 40)
        : undefined,
    ...(notes ? { notes } : {}),
  }
}

/* ─── Export / import ─────────────────────────────────────────────────── */

export function buildSoapSharePack(recipe: SavedSoapRecipe): RecipeSharePack {
  return {
    format: SHARE_FORMAT,
    version: SHARE_VERSION,
    app: "Alex's Craft Calc",
    exportedAt: new Date().toISOString(),
    kind: 'soap',
    soap: [normalizeSoap(recipe, false)],
  }
}

export function buildCandleSharePack(recipe: SavedCandleRecipe): RecipeSharePack {
  return {
    format: SHARE_FORMAT,
    version: SHARE_VERSION,
    app: "Alex's Craft Calc",
    exportedAt: new Date().toISOString(),
    kind: 'candle',
    candle: [normalizeCandle(recipe, false)],
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
  if (typeof document === 'undefined') return
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
  const trimmed = (raw || '').replace(/^\uFEFF/, '').trim()
  if (!trimmed) return { ok: false, error: 'File is empty' }

  let data: unknown
  try {
    data = JSON.parse(trimmed)
  } catch {
    return { ok: false, error: 'Not valid JSON' }
  }

  if (!isRecord(data) && !Array.isArray(data)) {
    return { ok: false, error: 'Invalid recipe file' }
  }

  // Full share pack (current + legacy format id)
  if (isRecord(data) && (data.format === SHARE_FORMAT || data.format === 'alien-craft-calc-recipe')) {
    const soapRaw = Array.isArray(data.soap) ? data.soap.filter(isSoapRecipe) : []
    const candleRaw = Array.isArray(data.candle) ? data.candle.filter(isCandleRecipe) : []
    if (soapRaw.length === 0 && candleRaw.length === 0) {
      return { ok: false, error: 'Recipe file has no valid recipes' }
    }
    // Fresh ids on import so library slots don't collide with local ids
    const soap = soapRaw.map((r) => normalizeSoap(r, true))
    const candle = candleRaw.map((r) => normalizeCandle(r, true))
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
  if (isRecord(data) && isSoapRecipe(data)) {
    const soap = [normalizeSoap(data, true)]
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
  if (isRecord(data) && isCandleRecipe(data)) {
    const candle = [normalizeCandle(data, true)]
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
    const soap = data.filter(isSoapRecipe).map((r) => normalizeSoap(r, true))
    const candle = data.filter(isCandleRecipe).map((r) => normalizeCandle(r, true))
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

export type MergeImportResult = {
  soapSaved: number
  candleSaved: number
  soapUpdated: number
  candleUpdated: number
  write: StorageWriteResult
  /** Last soap recipe written (stable library id) — use this after single-file import */
  lastSoap?: SavedSoapRecipe
  /** Last candle recipe written (stable library id) */
  lastCandle?: SavedCandleRecipe
}

/**
 * Merge imported recipes into local library.
 * Matches by name (case-insensitive) so re-import updates rather than duplicates.
 * Returns write failures if storage is full / blocked.
 * `lastSoap` / `lastCandle` carry the final library ids (not the throwaway parse ids).
 */
export function mergeImportedRecipes(result: Extract<ImportResult, { ok: true }>): MergeImportResult {
  let soapSaved = 0
  let candleSaved = 0
  let soapUpdated = 0
  let candleUpdated = 0
  let lastWrite: StorageWriteResult = { ok: true }
  let lastSoap: SavedSoapRecipe | undefined
  let lastCandle: SavedCandleRecipe | undefined

  if (result.soap) {
    for (const r of result.soap) {
      // Drop forced-new id so name-match can update existing library entry
      const { recipe, write, overwritten } = saveSoapRecipe({ ...r, id: undefined })
      if (!write.ok) {
        lastWrite = write
        break
      }
      lastSoap = recipe
      if (overwritten) soapUpdated++
      else soapSaved++
    }
  }
  if (lastWrite.ok && result.candle) {
    for (const r of result.candle) {
      const { recipe, write, overwritten } = saveCandleRecipe({ ...r, id: undefined })
      if (!write.ok) {
        lastWrite = write
        break
      }
      lastCandle = recipe
      if (overwritten) candleUpdated++
      else candleSaved++
    }
  }

  return {
    soapSaved,
    candleSaved,
    soapUpdated,
    candleUpdated,
    write: lastWrite,
    lastSoap,
    lastCandle,
  }
}

/** Human-friendly import summary for toasts */
export function formatImportSummary(merged: {
  soapSaved: number
  candleSaved: number
  soapUpdated?: number
  candleUpdated?: number
}): string {
  const parts: string[] = []
  const sNew = merged.soapSaved
  const sUp = merged.soapUpdated || 0
  const cNew = merged.candleSaved
  const cUp = merged.candleUpdated || 0
  if (sNew) parts.push(`${sNew} new soap`)
  if (sUp) parts.push(`${sUp} updated soap`)
  if (cNew) parts.push(`${cNew} new candle`)
  if (cUp) parts.push(`${cUp} updated candle`)
  if (!parts.length) return 'Nothing new to import'
  return `Imported ${parts.join(', ')}`
}

export async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text()
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Read failed'))
    reader.readAsText(file)
  })
}

export function currentSoapSnapshot(
  partial: Omit<SavedSoapRecipe, 'id' | 'savedAt'> & { id?: string },
): SavedSoapRecipe {
  return normalizeSoap(
    {
      ...partial,
      id: partial.id || `soap-live-${Date.now().toString(36)}`,
      savedAt: new Date().toISOString(),
    } as SavedSoapRecipe,
    false,
  )
}

export function currentCandleSnapshot(
  partial: Omit<SavedCandleRecipe, 'id' | 'savedAt'> & { id?: string },
): SavedCandleRecipe {
  return normalizeCandle(
    {
      ...partial,
      id: partial.id || `candle-live-${Date.now().toString(36)}`,
      savedAt: new Date().toISOString(),
    } as SavedCandleRecipe,
    false,
  )
}

/** File input accept string for recipe import */
export const RECIPE_FILE_ACCEPT =
  '.json,.alex-soap.json,.alex-candle.json,application/json,text/json,text/plain'

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

/** Format a short meta line for saved-list rows */
export function formatSavedAt(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/* ─── Unified Load / Share (import+export folded here) ───────────────── */

export type LoadRecipesResult =
  | {
      ok: true
      parsed: Extract<ImportResult, { ok: true }>
      merged: MergeImportResult
      summary: string
    }
  | { ok: false; error: string }

/**
 * One-shot Load: read a recipe/library file, merge into local storage, return
 * stable library ids for the editor. Replaces separate import plumbing.
 */
export async function loadRecipesFromFile(file: File): Promise<LoadRecipesResult> {
  try {
    const text = await readFileAsText(file)
    const parsed = parseSharePayload(text)
    if (!parsed.ok) return { ok: false, error: parsed.error }
    const merged = mergeImportedRecipes(parsed)
    if (!merged.write.ok) {
      return { ok: false, error: merged.write.error }
    }
    return {
      ok: true,
      parsed,
      merged,
      summary: formatImportSummary(merged),
    }
  } catch {
    return { ok: false, error: 'Could not read that file' }
  }
}

export type ShareMode = 'native-file' | 'native-text' | 'download' | 'copied' | 'cancelled' | 'failed'

export type ShareRecipesResult = {
  ok: boolean
  mode: ShareMode
  message: string
}

function packFilename(pack: RecipeSharePack): string {
  if (pack.kind === 'soap' && pack.soap?.[0]) {
    return `${safeFilename(pack.soap[0].name, 'soap-recipe')}.alex-soap.json`
  }
  if (pack.kind === 'candle' && pack.candle?.[0]) {
    return `${safeFilename(pack.candle[0].name, 'candle-recipe')}.alex-candle.json`
  }
  const stamp = new Date().toISOString().slice(0, 10)
  return `alex-craft-library-${stamp}.json`
}

function packShareTitle(pack: RecipeSharePack): string {
  if (pack.kind === 'soap' && pack.soap?.[0]) return `Soap: ${pack.soap[0].name}`
  if (pack.kind === 'candle' && pack.candle?.[0]) return `Candle: ${pack.candle[0].name}`
  const n = (pack.soap?.length || 0) + (pack.candle?.length || 0)
  return `Alex's Craft Calc library (${n})`
}

function packShareText(pack: RecipeSharePack, plainSummary?: string): string {
  if (plainSummary && plainSummary.trim()) {
    return `${plainSummary.trim()}\n\n— Alex's Craft Calc recipe file attached (or use Load in the app).`
  }
  if (pack.kind === 'soap' && pack.soap?.[0]) {
    const r = pack.soap[0]
    return `Soap recipe “${r.name}” · ${r.oils.length} oils · ${r.lyeType.toUpperCase()} · SF ${r.superfatPct}%\nOpen in Alex's Craft Calc → Load`
  }
  if (pack.kind === 'candle' && pack.candle?.[0]) {
    const r = pack.candle[0]
    return `Candle recipe “${r.name}” · ${r.vesselCount} vessels · ${r.fragrancePct}% FO\nOpen in Alex's Craft Calc → Load`
  }
  return `Alex's Craft Calc library backup — Load this file in the app to restore recipes.`
}

/** True when the platform exposes a classic share sheet (phones, some desktops). */
export function canNativeShare(): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  } catch {
    return false
  }
}

/**
 * Classic Share: prefer OS/app share sheet with a recipe file (Messages, Drive,
 * WhatsApp, Mail, Nearby, etc.). Falls back to download, then clipboard JSON.
 * Replaces separate Export / Export-all buttons for day-to-day use.
 */
export async function shareRecipes(
  pack: RecipeSharePack,
  opts?: { plainText?: string },
): Promise<ShareRecipesResult> {
  const json = packToJson(pack)
  const filename = packFilename(pack)
  const title = packShareTitle(pack)
  const text = packShareText(pack, opts?.plainText)
  const mime = 'application/json'

  // 1) Native share with file (Android Chrome, iOS 15+, etc.)
  if (canNativeShare() && typeof File !== 'undefined') {
    try {
      const file = new File([json], filename, { type: mime })
      const dataWithFile: ShareData = { files: [file], title, text }
      let fileOk = false
      try {
        if (typeof navigator.canShare === 'function') {
          fileOk = navigator.canShare({ files: [file] })
        } else {
          fileOk = true
        }
      } catch {
        fileOk = false
      }
      if (fileOk) {
        try {
          await navigator.share(dataWithFile)
          return { ok: true, mode: 'native-file', message: 'Shared recipe file' }
        } catch (err) {
          const name = err instanceof DOMException ? err.name : ''
          if (name === 'AbortError') {
            return { ok: false, mode: 'cancelled', message: 'Share cancelled' }
          }
          // fall through to text / download
        }
      }

      // 2) Native share text-only (still opens Messages / Mail / …)
      try {
        const textPayload = `${title}\n\n${text}\n\n----- recipe json -----\n${json}`
        // Keep share sheet payloads reasonable
        const clipped =
          textPayload.length > 120_000
            ? `${title}\n\n${text}\n\n(Recipe too large for text share — use Load with a saved backup file.)`
            : textPayload
        if (typeof navigator.canShare === 'function' && !navigator.canShare({ text: clipped, title })) {
          /* skip */
        } else {
          await navigator.share({ title, text: clipped })
          return { ok: true, mode: 'native-text', message: 'Shared via device share sheet' }
        }
      } catch (err) {
        const name = err instanceof DOMException ? err.name : ''
        if (name === 'AbortError') {
          return { ok: false, mode: 'cancelled', message: 'Share cancelled' }
        }
      }
    } catch {
      /* fall through */
    }
  }

  // 3) Desktop / no share API — download portable file (old Export path)
  try {
    downloadSharePack(pack)
    return {
      ok: true,
      mode: 'download',
      message: `Downloaded ${filename}`,
    }
  } catch {
    /* fall through */
  }

  // 4) Last resort — clipboard
  const copied = await copyText(json)
  if (copied) {
    return { ok: true, mode: 'copied', message: 'Recipe JSON copied — paste into a file or message' }
  }
  return { ok: false, mode: 'failed', message: 'Could not share or download recipe' }
}

/** Share only the current soap recipe (file + summary). */
export async function shareSoapRecipe(
  recipe: SavedSoapRecipe,
  plainText?: string,
): Promise<ShareRecipesResult> {
  return shareRecipes(buildSoapSharePack(recipe), { plainText })
}

/** Share only the current candle recipe (file + summary). */
export async function shareCandleRecipe(
  recipe: SavedCandleRecipe,
  plainText?: string,
): Promise<ShareRecipesResult> {
  return shareRecipes(buildCandleSharePack(recipe), { plainText })
}

/** Share full local library (backup / move phones). */
export async function shareLibrary(): Promise<ShareRecipesResult> {
  const pack = buildLibrarySharePack()
  const n = (pack.soap?.length || 0) + (pack.candle?.length || 0)
  if (n === 0) {
    return { ok: false, mode: 'failed', message: 'No saved recipes to share' }
  }
  return shareRecipes(pack)
}
