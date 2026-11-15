import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { VESSEL_PRESETS, WAXES, getWax } from '../data/waxes'
import {
  calculateCandle,
  defaultCandleInput,
  fromOz,
  type CandleInput,
  type WeightUnit,
} from '../lib/candleCalc'
import { countOf, parseUserDecimal } from '../lib/parseDecimal'
import {
  copyText,
  currentCandleSnapshot,
  formatSavedAt,
  RECIPE_FILE_ACCEPT,
  type SavedCandleRecipe,
} from '../lib/storage'
import { escapeHtml } from '../lib/htmlEscape'
import { useCandleRecipeIO } from '../hooks/useCandleRecipeIO'
import { formatEditable, formatNumber, formatTempF, reformatEditable } from '../i18n/format'
import { useI18n } from '../i18n/I18nProvider'
import {
  displayTag,
  formatPourHint,
  formatWickHint,
  localizeWax,
  vesselLabel,
  waxDisplayName,
} from '../i18n/content'
import { importHasChanges, localizeImportSummary, localizeRuntimeMessage } from '../i18n/runtimeMessages'
import { waxWikiId } from './Wiki'
import type { ToastFn } from './Toast'

interface CandleCalculatorProps {
  onOpenWiki?: (articleId?: string) => void
  onToast?: ToastFn
}

export function CandleCalculator({ onOpenWiki, onToast }: CandleCalculatorProps) {
  const { t, intlLocale } = useI18n()
  const [waxId, setWaxId] = useState('soy-111')
  const [vesselCount, setVesselCount] = useState('4')
  const [waxPerVessel, setWaxPerVessel] = useState('200')
  const [useTotalWax, setUseTotalWax] = useState(false)
  const [totalWax, setTotalWax] = useState('800')
  const [fragrancePct, setFragrancePct] = useState('8')
  const [dyeBlocksPerLb, setDyeBlocksPerLb] = useState('1')
  const [unit, setUnit] = useState<WeightUnit>('g')
  const [vesselDiameterIn, setVesselDiameterIn] = useState('3')
  const [vesselPresetId, setVesselPresetId] = useState('custom')
  const [recipeName, setRecipeName] = useState('')
  const [recipeNotes, setRecipeNotes] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const localeRef = useRef(intlLocale)
  useEffect(() => {
    const prev = localeRef.current
    if (prev === intlLocale) return
    localeRef.current = intlLocale
    setWaxPerVessel((raw) => reformatEditable(raw, prev, intlLocale, 2))
    setTotalWax((raw) => reformatEditable(raw, prev, intlLocale, 2))
    setFragrancePct((raw) => reformatEditable(raw, prev, intlLocale, 2))
    setDyeBlocksPerLb((raw) => reformatEditable(raw, prev, intlLocale, 2))
    setVesselDiameterIn((raw) => reformatEditable(raw, prev, intlLocale, 2))
    setVesselCount((raw) => reformatEditable(raw, prev, intlLocale, 0))
  }, [intlLocale])
  const {
    saved,
    showSaved,
    setShowSaved,
    activeRecipeId,
    setActiveRecipeId,
    persistSave,
    removeSaved,
    loadFromFile,
    shareOne,
    shareAll,
  } = useCandleRecipeIO(onToast)

  const num = (raw: string) => {
    const n = parseUserDecimal(raw, intlLocale)
    return Number.isFinite(n) ? n : NaN
  }
  const edit = (n: number, places: number) => formatEditable(n, intlLocale, places)
  const show = (n: number, places: number) => formatNumber(n, intlLocale, places)

  const selectedWax = getWax(waxId)

  // Field text stays in the previous locale until the effect above rewrites it.
  // That setState reparses; doing it here would misread grouped values like "1,000".
  const input: CandleInput = useMemo(
    () => ({
      waxId,
      vesselCount: countOf(vesselCount, intlLocale),
      waxPerVessel: num(waxPerVessel) || 0,
      useTotalWax,
      totalWax: num(totalWax) || 0,
      fragrancePct: num(fragrancePct) || 0,
      dyeBlocksPerLb: num(dyeBlocksPerLb) || 0,
      unit,
      vesselDiameterIn: num(vesselDiameterIn) || 0,
    }),
    [
      waxId,
      vesselCount,
      waxPerVessel,
      useTotalWax,
      totalWax,
      fragrancePct,
      dyeBlocksPerLb,
      unit,
      vesselDiameterIn,
    ],
  )

  const result = useMemo(() => calculateCandle(input), [input])

  function onWaxChange(id: string) {
    setWaxId(id)
    const w = getWax(id)
    if (w) setFragrancePct(edit(w.fragranceTypical, 2))
  }

  function applyVesselPreset(id: string) {
    setVesselPresetId(id)
    const p = VESSEL_PRESETS.find((v) => v.id === id)
    if (!p || p.fillOz <= 0) return
    // fillOz is approximate wax fill weight in oz
    const waxInUnit = fromOz(p.fillOz, unit)
    setUseTotalWax(false)
    setWaxPerVessel(edit(waxInUnit, 2))
    // rough diameter defaults by vessel class
    if (id.startsWith('pillar-3')) setVesselDiameterIn(edit(3, 2))
    else if (id === 'tealight') setVesselDiameterIn(edit(1.5, 2))
    else if (id === 'votive') setVesselDiameterIn(edit(1.75, 2))
    else if (id === '4oz') setVesselDiameterIn(edit(2.5, 2))
    else if (id === '6oz') setVesselDiameterIn(edit(2.75, 2))
    else if (id === '8oz' || id === '9oz') setVesselDiameterIn(edit(3, 2))
    else if (id === '10oz' || id === '12oz') setVesselDiameterIn(edit(3.25, 2))
    else if (id === '16oz') setVesselDiameterIn(edit(3.5, 2))
  }

  function onUnitChange(next: WeightUnit) {
    if (next === unit) return
    const convert = (val: string) => {
      const n = num(val)
      if (!Number.isFinite(n)) return val
      const oz = unit === 'oz' ? n : unit === 'g' ? n / 28.349523125 : n * 16
      const out = next === 'oz' ? oz : next === 'g' ? oz * 28.349523125 : oz / 16
      return edit(out, 2)
    }
    setWaxPerVessel(convert(waxPerVessel))
    setTotalWax(convert(totalWax))
    setUnit(next)
  }

  function resetDefaults() {
    const d = defaultCandleInput()
    setWaxId(d.waxId)
    setVesselCount(edit(d.vesselCount, 0))
    setWaxPerVessel(edit(d.waxPerVessel, 2))
    setUseTotalWax(d.useTotalWax)
    setTotalWax(edit(d.totalWax, 2))
    setFragrancePct(edit(d.fragrancePct, 2))
    setDyeBlocksPerLb(edit(d.dyeBlocksPerLb, 2))
    setUnit(d.unit)
    setVesselDiameterIn(edit(d.vesselDiameterIn, 2))
    setVesselPresetId('custom')
    setRecipeName('')
    setRecipeNotes('')
    setActiveRecipeId(null)
    onToast?.(t('toast.candleReset'), 'ok')
  }

  function handleSave() {
    const recipe = persistSave({
      name: recipeName.trim(),
      waxId,
      vesselCount: countOf(vesselCount, intlLocale),
      waxPerVessel: num(waxPerVessel) || 0,
      useTotalWax,
      totalWax: num(totalWax) || 0,
      fragrancePct: num(fragrancePct) || 0,
      dyeBlocksPerLb: num(dyeBlocksPerLb) || 0,
      unit,
      vesselDiameterIn: num(vesselDiameterIn) || 0,
      vesselPresetId,
      notes: recipeNotes.trim() || undefined,
    })
    if (recipe) setRecipeName(recipe.name)
  }

  function loadRecipe(r: SavedCandleRecipe) {
    setWaxId(r.waxId)
    setVesselCount(edit(r.vesselCount, 0))
    setWaxPerVessel(edit(r.waxPerVessel, 4))
    setUseTotalWax(r.useTotalWax)
    setTotalWax(edit(r.totalWax, 4))
    setFragrancePct(edit(r.fragrancePct, 4))
    setDyeBlocksPerLb(edit(r.dyeBlocksPerLb, 4))
    setUnit(r.unit)
    setVesselDiameterIn(edit(r.vesselDiameterIn, 4))
    setVesselPresetId(r.vesselPresetId || 'custom')
    setRecipeName(r.name)
    setRecipeNotes(r.notes || '')
    setActiveRecipeId(r.id)
    setShowSaved(false)
    onToast?.(t('toast.loaded', { name: r.name }), 'ok')
  }

  function handleDelete(id: string) {
    removeSaved(id)
  }

  const currentCandleRecipe = useCallback((): SavedCandleRecipe => {
    const trimmed = recipeName.trim()
    const generated = t('recipe.candleTimes', {
      name: selectedWax
        ? waxDisplayName(t, selectedWax.id, selectedWax.name)
        : t('recipe.candleWord'),
      count: String(countOf(vesselCount, intlLocale)),
    })
    return currentCandleSnapshot({
      id: activeRecipeId || undefined,
      name: trimmed || generated,
      waxId,
      vesselCount: countOf(vesselCount, intlLocale),
      waxPerVessel: num(waxPerVessel) || 0,
      useTotalWax,
      totalWax: num(totalWax) || 0,
      fragrancePct: num(fragrancePct) || 0,
      dyeBlocksPerLb: num(dyeBlocksPerLb) || 0,
      unit,
      vesselDiameterIn: num(vesselDiameterIn) || 0,
      vesselPresetId,
      notes: recipeNotes.trim() || undefined,
    })
  }, [
    activeRecipeId,
    recipeName,
    selectedWax,
    vesselCount,
    waxId,
    waxPerVessel,
    useTotalWax,
    totalWax,
    fragrancePct,
    dyeBlocksPerLb,
    unit,
    vesselDiameterIn,
    vesselPresetId,
    recipeNotes,
    t,
    intlLocale,
  ])

  const formatRecipeText = useCallback(() => {
    const unitLabel = t(`unit.${unit}`)
    const diameter = num(vesselDiameterIn)
    const d = Number.isFinite(diameter) ? diameter : 0
    const wick =
      result.totalWax <= 0
        ? t('warn.needWaxForWick')
        : formatWickHint(d, selectedWax, t, intlLocale)
    const pour = result.totalWax > 0 ? formatPourHint(selectedWax, t, intlLocale) : ''
    const lines = [
      t('copy.candleTitle'),
      recipeName ? t('copy.candleName', { name: recipeName }) : null,
      t('copy.wax', { name: waxDisplayName(t, waxId, selectedWax?.name || waxId) }),
      t('copy.vessels', { count: show(countOf(vesselCount, intlLocale), 0) }),
      useTotalWax
        ? t('copy.totalWax', { amount: show(result.totalWax, 2), unit: unitLabel })
        : t('copy.waxPer', { amount: show(result.perVessel.wax, 2), unit: unitLabel }),
      t('copy.foLoad', {
        pct: show(num(fragrancePct) || 0, 2),
        amount: show(result.fragrance, 2),
        unit: unitLabel,
      }),
      t('copy.foPer', { amount: show(result.perVessel.fragrance, 2), unit: unitLabel }),
      t('copy.batch', { amount: show(result.totalBatch, 2), unit: unitLabel }),
      t('copy.dye', { amount: show(result.dyeBlocks, 2) }),
      t('copy.diameter', { d: show(d, 2) }),
      t('copy.wick', { hint: wick }),
      pour ? t('copy.pour', { hint: pour }) : null,
      result.warnings.length
        ? t('copy.warnings', {
            text: result.warnings.map((w) => localizeRuntimeMessage(w, t, intlLocale)).join(' | '),
          })
        : null,
      recipeNotes.trim() ? t('copy.notes', { notes: recipeNotes.trim() }) : null,
    ].filter(Boolean)
    return lines.join('\n')
  }, [
    recipeName,
    selectedWax,
    waxId,
    vesselCount,
    useTotalWax,
    result,
    unit,
    fragrancePct,
    vesselDiameterIn,
    recipeNotes,
    t,
    intlLocale,
  ])

  async function handleCopy() {
    const ok = await copyText(formatRecipeText())
    onToast?.(ok ? t('toast.resultsCopied') : t('toast.copyFailed'), ok ? 'ok' : 'err')
  }

  function handlePrint() {
    const w = window.open('', '_blank', 'noopener,noreferrer,width=720,height=900')
    if (!w) {
      onToast?.(t('toast.popup'), 'err')
      return
    }
    const html =
      '<!doctype html><html><head><title>' +
      escapeHtml(t('print.candleTitle')) +
      '</title><style>' +
      'body{font-family:' +
      t('print.font') +
      ';padding:2rem;color:#1a0a2e;line-height:1.5}' +
      'h1{color:#6b21a8;font-size:1.4rem}' +
      'pre{white-space:pre-wrap;background:#f5e9ff;padding:1rem;border-radius:12px}' +
      '.note{font-size:0.85rem;color:#666;margin-top:1.5rem}' +
      '</style></head><body>' +
      '<h1>' +
      escapeHtml(t('print.candleH1')) +
      '</h1><pre>' +
      escapeHtml(formatRecipeText()) +
      '</pre><p class="note">' +
      escapeHtml(t('print.candleNote')) +
      '</p><script>onload=()=>{print();}</script></body></html>'
    w.document.write(html)
    w.document.close()
  }

  /** Load = pick a recipe/library file and merge into Saved (replaces Import). */
  async function handleLoadFile(file: File | null) {
    if (!file) return
    try {
      const loaded = await loadFromFile(file)
      if (!loaded) return
      const { parsed, merged } = loaded
      if (
        merged.lastCandle &&
        parsed.kind === 'candle' &&
        parsed.candleCount === 1 &&
        parsed.soapCount === 0
      ) {
        loadRecipe(merged.lastCandle)
      }
      onToast?.(
        localizeImportSummary(merged, t, intlLocale),
        importHasChanges(merged) ? 'ok' : 'warn',
      )
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  /** Share current recipe via OS share sheet (phone) or download (desktop). */
  async function handleShare() {
    await shareOne(currentCandleRecipe(), formatRecipeText())
  }

  /** Share full soap+candle library backup (long-press Share or saved-list action). */
  async function handleShareLibrary() {
    await shareAll()
  }

  function setFoTypical() {
    if (selectedWax) setFragrancePct(edit(selectedWax.fragranceTypical, 2))
  }

  function setFoMin() {
    if (selectedWax) setFragrancePct(edit(selectedWax.fragranceMin, 2))
  }

  function setFoMax() {
    if (selectedWax) setFragrancePct(edit(selectedWax.fragranceMax, 2))
  }

  const shownWax = selectedWax ? localizeWax(t, selectedWax) : null
  const foPct = num(fragrancePct)
  const foInRange =
    !!selectedWax &&
    Number.isFinite(foPct) &&
    foPct >= selectedWax.fragranceMin &&
    foPct <= selectedWax.fragranceMax
  const diameterIn = num(vesselDiameterIn)
  const diameterCm =
    Number.isFinite(diameterIn) && diameterIn > 0
      ? t('candle.diameterCm', { cm: show(diameterIn * 2.54, 1) })
      : ''
  const unitLabel = t(`unit.${unit}`)
  const wickHintText =
    result.totalWax <= 0
      ? t('warn.needWaxForWick')
      : formatWickHint(Number.isFinite(diameterIn) ? diameterIn : 0, selectedWax, t, intlLocale)
  const pourHintText = result.totalWax > 0 ? formatPourHint(selectedWax, t, intlLocale) : ''

  return (
    <div className="calc-panel candle-panel">
      <header className="panel-head">
        <div>
          <h2>{t('candle.title')}</h2>
          <p className="muted">{t('candle.subtitle')}</p>
        </div>
        <div className="head-actions">
          <label className="seg">
            <span className="sr-only">{t('unit.candleAria')}</span>
            <select value={unit} onChange={(e) => onUnitChange(e.target.value as WeightUnit)}>
              <option value="g">{t('unit.grams')}</option>
              <option value="oz">{t('unit.ounces')}</option>
              <option value="lb">{t('unit.pounds')}</option>
            </select>
          </label>
          <button type="button" className="ghost" onClick={resetDefaults}>
            {t('common.reset')}
          </button>
        </div>
      </header>

      <section className="card recipe-bar">
        <div className="recipe-bar-row">
          <label className="recipe-name-field">
            {t('common.recipeName')}
            <input
              type="text"
              placeholder={t('candle.placeholder')}
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              maxLength={120}
            />
          </label>
          <div className="recipe-actions">
            <button type="button" className="chip solid" onClick={handleSave}>
              {activeRecipeId ? t('common.update') : t('common.save')}
            </button>
            <button type="button" className="chip" onClick={() => setShowSaved((v) => !v)}>
              {showSaved ? t('common.hideSaved') : t('common.savedCount', { n: show(saved.length, 0) })}
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => importRef.current?.click()}
              title={t('common.loadTitle')}
            >
              {t('common.load')}
            </button>
            <button
              type="button"
              className="chip"
              onClick={handleShare}
              onContextMenu={(e) => {
                e.preventDefault()
                void handleShareLibrary()
              }}
              title={t('common.shareTitle')}
            >
              {t('common.share')}
            </button>
            <button type="button" className="chip" onClick={handleCopy} title={t('common.copyBatchTitle')}>
              {t('common.copy')}
            </button>
            <button type="button" className="chip" onClick={handlePrint}>
              {t('common.print')}
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept={RECIPE_FILE_ACCEPT}
            className="sr-only"
            aria-label={t('common.loadFileAria')}
            onChange={(e) => void handleLoadFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <label className="notes-field">
          {t('common.customNotes')}
          <textarea
            rows={3}
            maxLength={4000}
            placeholder={t('candle.notesPlaceholder')}
            value={recipeNotes}
            onChange={(e) => setRecipeNotes(e.target.value)}
          />
        </label>
        {activeRecipeId && <p className="hint recipe-slot-hint">{t('common.editingSlot')}</p>}
        {showSaved && (
          <div className="saved-list">
            {saved.length === 0 && <p className="hint">{t('candle.noSaved')}</p>}
            {saved.length > 0 && (
              <div className="saved-list-actions">
                <button
                  type="button"
                  className="chip"
                  onClick={() => void handleShareLibrary()}
                  title={t('common.shareLibraryTitle')}
                >
                  {t('common.shareLibrary')}
                </button>
              </div>
            )}
            {saved.map((r) => {
              const when = formatSavedAt(r.savedAt, intlLocale)
              return (
                <div
                  key={r.id}
                  className={'saved-item' + (r.id === activeRecipeId ? ' active' : '')}
                  aria-current={r.id === activeRecipeId ? 'true' : undefined}
                >
                  <button type="button" className="saved-load" onClick={() => loadRecipe(r)}>
                    <strong>{r.name}</strong>
                    <span>
                      {t('candle.savedMeta', {
                        wax: waxDisplayName(t, r.waxId, getWax(r.waxId)?.name || r.waxId),
                        count: show(r.vesselCount, 0),
                        fo: show(r.fragrancePct, 2),
                      })}
                      {when ? `${t('candle.metaSep')}${when}` : ''}
                    </span>
                    {r.notes ? <span className="notes-chip">{t('common.notes')}</span> : null}
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t('common.deleteAria', { name: r.name })}
                    onClick={() => handleDelete(r.id)}
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-title-row">
            <h3>{t('candle.waxVessels')}</h3>
            {selectedWax && (
              <button
                type="button"
                className="chip"
                onClick={() => onOpenWiki?.(waxWikiId(waxId))}
                title={t('candle.wikiTitle')}
              >
                {t('common.wiki')}
              </button>
            )}
          </div>
          <div className="field-grid">
            <label className="full">
              {t('candle.waxType')}
              <select value={waxId} onChange={(e) => onWaxChange(e.target.value)}>
                {WAXES.map((w) => (
                  <option key={w.id} value={w.id}>
                    {waxDisplayName(t, w.id, w.name)}
                  </option>
                ))}
              </select>
            </label>
            {shownWax && (
              <div className="hint full wax-meta">
                <p>
                  {t(`waxType.${shownWax.type}`)}
                  {t('candle.metaSep')}
                  {t('candle.foLoadMeta', {
                    min: show(shownWax.fragranceMin, 2),
                    max: show(shownWax.fragranceMax, 2),
                    typical: show(shownWax.fragranceTypical, 2),
                  })}
                  {shownWax.meltPointF
                    ? `${t('candle.metaSep')}${t('candle.meltBit', { temp: formatTempF(shownWax.meltPointF, intlLocale) })}`
                    : ''}
                  {shownWax.pourTempF
                    ? `${t('candle.metaSep')}${t('candle.pourBit', { temp: formatTempF(shownWax.pourTempF, intlLocale) })}`
                    : ''}
                </p>
                {shownWax.notes && <p>{shownWax.notes}</p>}
                {shownWax.cureDays && <p>{t('candle.cure', { text: shownWax.cureDays })}</p>}
                {shownWax.bestFor && (
                  <p className="tag-row">
                    {shownWax.bestFor.map((tag) => (
                      <span key={tag} className="mini-tag">
                        {displayTag(t, tag)}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            )}
            <label className="full">
              {t('candle.vesselPreset')}
              <select value={vesselPresetId} onChange={(e) => applyVesselPreset(e.target.value)}>
                {VESSEL_PRESETS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {vesselLabel(t, v.id, v.label)}
                    {v.fillOz > 0 ? t('vessel.ozSuffix', { oz: show(v.fillOz, 2) }) : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('candle.vesselCount')}
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                min="1"
                step="1"
                value={vesselCount}
                onChange={(e) => setVesselCount(e.target.value)}
              />
            </label>
            <label>
              {t('candle.diameter')}
              {diameterCm ? <span className="hint">{diameterCm}</span> : null}
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                min="0"
                step="0.25"
                value={vesselDiameterIn}
                onChange={(e) => setVesselDiameterIn(e.target.value)}
              />
            </label>
            <label className="check full">
              <input
                type="checkbox"
                checked={useTotalWax}
                onChange={(e) => setUseTotalWax(e.target.checked)}
              />
              {t('candle.enterTotal')}
            </label>
            {useTotalWax ? (
              <label className="full">
                {t('candle.totalWax', { unit: unitLabel })}
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  min="0"
                  step="any"
                  value={totalWax}
                  onChange={(e) => {
                    setTotalWax(e.target.value)
                    setVesselPresetId('custom')
                  }}
                />
              </label>
            ) : (
              <label className="full">
                {t('candle.waxPer', { unit: unitLabel })}
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  min="0"
                  step="any"
                  value={waxPerVessel}
                  onChange={(e) => {
                    setWaxPerVessel(e.target.value)
                    setVesselPresetId('custom')
                  }}
                />
              </label>
            )}
          </div>
        </section>

        <section className="card">
          <h3>{t('candle.fragranceDye')}</h3>
          <div className="field-grid">
            <label>
              {t('candle.fragranceLoad')}
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                min="0"
                max="20"
                step="0.1"
                value={fragrancePct}
                onChange={(e) => setFragrancePct(e.target.value)}
              />
            </label>
            <label>
              {t('candle.dyePerLb')}
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                min="0"
                max="10"
                step="0.25"
                value={dyeBlocksPerLb}
                onChange={(e) => setDyeBlocksPerLb(e.target.value)}
              />
            </label>
            <div className="full fo-quick">
              <button type="button" className="chip" onClick={setFoMin} disabled={!selectedWax}>
                {t('candle.minFo')}
              </button>
              <button type="button" className="chip" onClick={setFoTypical} disabled={!selectedWax}>
                {t('candle.typical')}
              </button>
              <button type="button" className="chip" onClick={setFoMax} disabled={!selectedWax}>
                {t('candle.maxFo')}
              </button>
              {selectedWax && (
                <span className={`fo-range-pill ${foInRange ? 'ok' : 'warn'}`}>
                  {foInRange ? t('candle.foInRange') : t('candle.foOut')}
                </span>
              )}
            </div>
            <p className="hint full">{t('candle.dyeHint')}</p>
          </div>
        </section>
      </div>

      <section className="card results-card">
        <div className="card-title-row">
          <h3>{t('candle.batchResults')}</h3>
          <div className="result-actions">
            <button type="button" className="chip" onClick={handleCopy}>
              {t('common.copy')}
            </button>
            <button type="button" className="chip" onClick={handlePrint}>
              {t('common.print')}
            </button>
          </div>
        </div>
        {result.warnings.length > 0 && (
          <ul className="warnings">
            {result.warnings.map((w) => (
              <li key={w}>{localizeRuntimeMessage(w, t, intlLocale)}</li>
            ))}
          </ul>
        )}
        <div className="stat-grid">
          <div className="stat hero">
            <span className="stat-label">{t('candle.fragranceOil')}</span>
            <span className="stat-value">
              {show(result.fragrance, 2)} <small>{unitLabel}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">{t('candle.totalWaxStat')}</span>
            <span className="stat-value">
              {show(result.totalWax, 2)} <small>{unitLabel}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">{t('candle.batchTotal')}</span>
            <span className="stat-value">
              {show(result.totalBatch, 2)} <small>{unitLabel}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">{t('candle.dyeBlocks')}</span>
            <span className="stat-value">{show(result.dyeBlocks, 2)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">{t('candle.waxPerStat')}</span>
            <span className="stat-value">
              {show(result.perVessel.wax, 2)} <small>{unitLabel}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">{t('candle.foPerStat')}</span>
            <span className="stat-value">
              {show(result.perVessel.fragrance, 2)} <small>{unitLabel}</small>
            </span>
          </div>
        </div>

        <div className="hint-blocks">
          <div className="hint-block">
            <h4>{t('candle.wickGuidance')}</h4>
            <p>{wickHintText}</p>
          </div>
          {pourHintText && (
            <div className="hint-block">
              <h4>{t('candle.pourNotes')}</h4>
              <p>{pourHintText}</p>
            </div>
          )}
        </div>

        {shownWax?.wickNotes && (
          <p className="meta-row" style={{ marginTop: '0.75rem' }}>
            <span>
              {t('candle.wickNote')} <strong>{shownWax.wickNotes}</strong>
            </span>
          </p>
        )}

        <p className="disclaimer">{t('candle.disclaimer')}</p>
      </section>
    </div>
  )
}
