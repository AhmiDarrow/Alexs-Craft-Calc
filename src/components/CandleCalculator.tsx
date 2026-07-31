import { useCallback, useMemo, useRef, useState } from 'react'
import { VESSEL_PRESETS, WAXES, getWax } from '../data/waxes'
import {
  calculateCandle,
  defaultCandleInput,
  fromOz,
  type CandleInput,
  type WeightUnit,
} from '../lib/candleCalc'
import {
  copyText,
  currentCandleSnapshot,
  deleteCandleRecipe,
  downloadSharePack,
  exportCandlePack,
  exportLibraryPack,
  importRecipesFromText,
  listCandleRecipes,
  mergeImportedRecipes,
  saveCandleRecipe,
  type SavedCandleRecipe,
} from '../lib/storage'
import { waxWikiId } from './Wiki'

interface CandleCalculatorProps {
  onOpenWiki?: (articleId?: string) => void
  onToast?: (msg: string) => void
}

export function CandleCalculator({ onOpenWiki, onToast }: CandleCalculatorProps) {
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
  const [saved, setSaved] = useState<SavedCandleRecipe[]>(() => listCandleRecipes())
  const [showSaved, setShowSaved] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  const selectedWax = getWax(waxId)

  const input: CandleInput = useMemo(
    () => ({
      waxId,
      vesselCount: parseInt(vesselCount, 10) || 1,
      waxPerVessel: parseFloat(waxPerVessel) || 0,
      useTotalWax,
      totalWax: parseFloat(totalWax) || 0,
      fragrancePct: parseFloat(fragrancePct) || 0,
      dyeBlocksPerLb: parseFloat(dyeBlocksPerLb) || 0,
      unit,
      vesselDiameterIn: parseFloat(vesselDiameterIn) || 0,
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

  const refreshSaved = useCallback(() => setSaved(listCandleRecipes()), [])

  function onWaxChange(id: string) {
    setWaxId(id)
    const w = getWax(id)
    if (w) setFragrancePct(String(w.fragranceTypical))
  }

  function applyVesselPreset(id: string) {
    setVesselPresetId(id)
    const p = VESSEL_PRESETS.find((v) => v.id === id)
    if (!p || p.fillOz <= 0) return
    // fillOz is approximate wax fill weight in oz
    const waxInUnit = fromOz(p.fillOz, unit)
    setUseTotalWax(false)
    setWaxPerVessel(String(Math.round(waxInUnit * 100) / 100))
    // rough diameter defaults by vessel class
    if (id.startsWith('pillar-3')) setVesselDiameterIn('3')
    else if (id === 'tealight') setVesselDiameterIn('1.5')
    else if (id === 'votive') setVesselDiameterIn('1.75')
    else if (id === '4oz') setVesselDiameterIn('2.5')
    else if (id === '6oz') setVesselDiameterIn('2.75')
    else if (id === '8oz' || id === '9oz') setVesselDiameterIn('3')
    else if (id === '10oz' || id === '12oz') setVesselDiameterIn('3.25')
    else if (id === '16oz') setVesselDiameterIn('3.5')
  }

  function onUnitChange(next: WeightUnit) {
    if (next === unit) return
    const convert = (val: string) => {
      const n = parseFloat(val)
      if (!Number.isFinite(n)) return val
      const oz = unit === 'oz' ? n : unit === 'g' ? n / 28.349523125 : n * 16
      const out = next === 'oz' ? oz : next === 'g' ? oz * 28.349523125 : oz / 16
      return String(Math.round(out * 100) / 100)
    }
    setWaxPerVessel(convert(waxPerVessel))
    setTotalWax(convert(totalWax))
    setUnit(next)
  }

  function resetDefaults() {
    const d = defaultCandleInput()
    setWaxId(d.waxId)
    setVesselCount(String(d.vesselCount))
    setWaxPerVessel(String(d.waxPerVessel))
    setUseTotalWax(d.useTotalWax)
    setTotalWax(String(d.totalWax))
    setFragrancePct(String(d.fragrancePct))
    setDyeBlocksPerLb(String(d.dyeBlocksPerLb))
    setUnit(d.unit)
    setVesselDiameterIn(String(d.vesselDiameterIn))
    setVesselPresetId('custom')
  }

  function handleSave() {
    const name = recipeName.trim() || `${selectedWax?.name || 'Candle'} ×${vesselCount}`
    saveCandleRecipe({
      name,
      waxId,
      vesselCount: parseInt(vesselCount, 10) || 1,
      waxPerVessel: parseFloat(waxPerVessel) || 0,
      useTotalWax,
      totalWax: parseFloat(totalWax) || 0,
      fragrancePct: parseFloat(fragrancePct) || 0,
      dyeBlocksPerLb: parseFloat(dyeBlocksPerLb) || 0,
      unit,
      vesselDiameterIn: parseFloat(vesselDiameterIn) || 0,
      vesselPresetId,
    })
    setRecipeName(name)
    refreshSaved()
    onToast?.(`Saved “${name}”`)
  }

  function loadRecipe(r: SavedCandleRecipe) {
    setWaxId(r.waxId)
    setVesselCount(String(r.vesselCount))
    setWaxPerVessel(String(r.waxPerVessel))
    setUseTotalWax(r.useTotalWax)
    setTotalWax(String(r.totalWax))
    setFragrancePct(String(r.fragrancePct))
    setDyeBlocksPerLb(String(r.dyeBlocksPerLb))
    setUnit(r.unit)
    setVesselDiameterIn(String(r.vesselDiameterIn))
    setVesselPresetId(r.vesselPresetId || 'custom')
    setRecipeName(r.name)
    setShowSaved(false)
    onToast?.(`Loaded “${r.name}”`)
  }

  function handleDelete(id: string) {
    deleteCandleRecipe(id)
    refreshSaved()
    onToast?.('Recipe deleted')
  }

  const currentCandleRecipe = useCallback((): SavedCandleRecipe => {
    return currentCandleSnapshot({
      name: recipeName.trim() || `${selectedWax?.name || 'Candle'} ×${vesselCount}`,
      waxId,
      vesselCount: parseInt(vesselCount, 10) || 1,
      waxPerVessel: parseFloat(waxPerVessel) || 0,
      useTotalWax,
      totalWax: parseFloat(totalWax) || 0,
      fragrancePct: parseFloat(fragrancePct) || 0,
      dyeBlocksPerLb: parseFloat(dyeBlocksPerLb) || 0,
      unit,
      vesselDiameterIn: parseFloat(vesselDiameterIn) || 0,
      vesselPresetId,
    })
  }, [
    recipeName,
    selectedWax?.name,
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
  ])

  async function handleCopy() {
    const lines = [
      `Alex's Craft Calc — Candle`,
      recipeName ? `Name: ${recipeName}` : null,
      `Wax: ${selectedWax?.name || waxId}`,
      `Vessels: ${vesselCount}`,
      useTotalWax ? `Total wax: ${result.totalWax} ${unit}` : `Wax / vessel: ${result.perVessel.wax} ${unit}`,
      `FO load: ${fragrancePct}% → ${result.fragrance} ${unit} total`,
      `FO / vessel: ${result.perVessel.fragrance} ${unit}`,
      `Batch total: ${result.totalBatch} ${unit}`,
      `Dye blocks est.: ${result.dyeBlocks}`,
      `Diameter: ${vesselDiameterIn}"`,
      `Wick: ${result.wickHint}`,
      result.pourHint ? `Pour: ${result.pourHint}` : null,
      result.warnings.length ? `Warnings: ${result.warnings.join(' | ')}` : null,
    ].filter(Boolean)
    const ok = await copyText(lines.join('\n'))
    onToast?.(ok ? 'Results copied' : 'Copy failed')
  }

  function handlePrint() {
    window.print()
  }

  function handleExportCurrent() {
    const recipe = currentCandleRecipe()
    downloadSharePack(exportCandlePack(recipe))
    onToast?.(`Exported “${recipe.name}” (.alex-candle.json)`)
  }

  function handleExportLibrary() {
    const pack = exportLibraryPack()
    const n = (pack.soap?.length || 0) + (pack.candle?.length || 0)
    if (n === 0) {
      onToast?.('No saved recipes to export')
      return
    }
    downloadSharePack(pack)
    onToast?.(`Exported library (${pack.soap?.length || 0} soap, ${pack.candle?.length || 0} candle)`)
  }

  async function handleImportFile(file: File | null) {
    if (!file) return
    try {
      const text = await file.text()
      const parsed = importRecipesFromText(text)
      if (!parsed.ok) {
        onToast?.(parsed.error)
        return
      }
      if (
        parsed.candle?.[0] &&
        parsed.kind === 'candle' &&
        parsed.candleCount === 1 &&
        parsed.soapCount === 0
      ) {
        loadRecipe(parsed.candle[0])
      }
      const merged = mergeImportedRecipes(parsed)
      refreshSaved()
      const parts = [
        merged.soapSaved ? `${merged.soapSaved} soap` : null,
        merged.candleSaved ? `${merged.candleSaved} candle` : null,
      ].filter(Boolean)
      onToast?.(
        parts.length
          ? `Imported ${parts.join(' + ')} recipe${merged.soapSaved + merged.candleSaved === 1 ? '' : 's'}`
          : 'Nothing new to import',
      )
    } catch {
      onToast?.('Could not read that file')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  function setFoTypical() {
    if (selectedWax) setFragrancePct(String(selectedWax.fragranceTypical))
  }

  function setFoMin() {
    if (selectedWax) setFragrancePct(String(selectedWax.fragranceMin))
  }

  function setFoMax() {
    if (selectedWax) setFragrancePct(String(selectedWax.fragranceMax))
  }

  const u = unit
  const foInRange =
    selectedWax &&
    parseFloat(fragrancePct) >= selectedWax.fragranceMin &&
    parseFloat(fragrancePct) <= selectedWax.fragranceMax

  return (
    <div className="calc-panel candle-panel">
      <header className="panel-head">
        <div>
          <h2>Candle Calculator</h2>
          <p className="muted">Wax, fragrance load, dye guide & wick hints — live.</p>
        </div>
        <div className="head-actions">
          <label className="seg">
            <span className="sr-only">Unit</span>
            <select value={unit} onChange={(e) => onUnitChange(e.target.value as WeightUnit)}>
              <option value="g">grams</option>
              <option value="oz">ounces</option>
              <option value="lb">pounds</option>
            </select>
          </label>
          <button type="button" className="ghost" onClick={resetDefaults}>
            Reset
          </button>
        </div>
      </header>

      <section className="card recipe-bar">
        <div className="recipe-bar-row">
          <label className="recipe-name-field">
            Recipe name
            <input
              type="text"
              placeholder="e.g. Lavender 8oz soy run"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              maxLength={80}
            />
          </label>
          <div className="recipe-actions">
            <button type="button" className="chip solid" onClick={handleSave}>
              Save
            </button>
            <button type="button" className="chip" onClick={() => setShowSaved((v) => !v)}>
              {showSaved ? 'Hide saved' : `Saved (${saved.length})`}
            </button>
            <button type="button" className="chip" onClick={handleCopy} title="Copy batch text">
              Copy
            </button>
            <button type="button" className="chip" onClick={handlePrint}>
              Print
            </button>
            <button type="button" className="chip" onClick={handleExportCurrent} title="Download .alex-candle.json">
              Export
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => importRef.current?.click()}
              title="Import recipe JSON"
            >
              Import
            </button>
            <button
              type="button"
              className="chip"
              onClick={handleExportLibrary}
              title="Export all saved soap + candle recipes"
            >
              Export all
            </button>
          </div>
          <input
            ref={importRef}
            type="file"
            accept=".json,.acc.json,application/json,text/plain"
            className="sr-only"
            aria-label="Import recipe file"
            onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
          />
        </div>
        {showSaved && (
          <div className="saved-list">
            {saved.length === 0 && <p className="hint">No saved candle recipes yet.</p>}
            {saved.map((r) => (
              <div key={r.id} className="saved-item">
                <button type="button" className="saved-load" onClick={() => loadRecipe(r)}>
                  <strong>{r.name}</strong>
                  <span>
                    {getWax(r.waxId)?.name || r.waxId} · {r.vesselCount} vessels · {r.fragrancePct}% FO
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Delete ${r.name}`}
                  onClick={() => handleDelete(r.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-title-row">
            <h3>Wax & vessels</h3>
            {selectedWax && (
              <button
                type="button"
                className="chip"
                onClick={() => onOpenWiki?.(waxWikiId(waxId))}
                title="Open wax in wiki"
              >
                Wiki
              </button>
            )}
          </div>
          <div className="field-grid">
            <label className="full">
              Wax type
              <select value={waxId} onChange={(e) => onWaxChange(e.target.value)}>
                {WAXES.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedWax && (
              <div className="hint full wax-meta">
                <p>
                  FO load {selectedWax.fragranceMin}–{selectedWax.fragranceMax}% · typical{' '}
                  {selectedWax.fragranceTypical}%
                  {selectedWax.meltPointF ? ` · melt ~${selectedWax.meltPointF}°F` : ''}
                  {selectedWax.pourTempF ? ` · pour ~${selectedWax.pourTempF}°F` : ''}
                </p>
                {selectedWax.notes && <p>{selectedWax.notes}</p>}
                {selectedWax.cureDays && <p>Cure: {selectedWax.cureDays}</p>}
                {selectedWax.bestFor && (
                  <p className="tag-row">
                    {selectedWax.bestFor.map((t) => (
                      <span key={t} className="mini-tag">
                        {t}
                      </span>
                    ))}
                  </p>
                )}
              </div>
            )}
            <label className="full">
              Vessel preset
              <select
                value={vesselPresetId}
                onChange={(e) => applyVesselPreset(e.target.value)}
              >
                {VESSEL_PRESETS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                    {v.fillOz > 0 ? ` (~${v.fillOz} oz wax)` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Number of vessels
              <input
                type="number"
                min="1"
                step="1"
                value={vesselCount}
                onChange={(e) => setVesselCount(e.target.value)}
              />
            </label>
            <label>
              Vessel diameter (in)
              <input
                type="number"
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
              Enter total wax instead of per vessel
            </label>
            {useTotalWax ? (
              <label className="full">
                Total wax ({u})
                <input
                  type="number"
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
                Wax per vessel ({u})
                <input
                  type="number"
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
          <h3>Fragrance & dye</h3>
          <div className="field-grid">
            <label>
              Fragrance load %
              <input
                type="number"
                min="0"
                max="20"
                step="0.1"
                value={fragrancePct}
                onChange={(e) => setFragrancePct(e.target.value)}
              />
            </label>
            <label>
              Dye blocks per lb wax
              <input
                type="number"
                min="0"
                max="10"
                step="0.25"
                value={dyeBlocksPerLb}
                onChange={(e) => setDyeBlocksPerLb(e.target.value)}
              />
            </label>
            <div className="full fo-quick">
              <button type="button" className="chip" onClick={setFoMin} disabled={!selectedWax}>
                Min FO
              </button>
              <button type="button" className="chip" onClick={setFoTypical} disabled={!selectedWax}>
                Typical
              </button>
              <button type="button" className="chip" onClick={setFoMax} disabled={!selectedWax}>
                Max FO
              </button>
              {selectedWax && (
                <span className={`fo-range-pill ${foInRange ? 'ok' : 'warn'}`}>
                  {foInRange ? 'In range' : 'Outside typical band'}
                </span>
              )}
            </div>
            <p className="hint full">
              Dye is a rough guide only — pigments vary wildly. Start light and test burn. FO % is of
              wax weight (not total batch).
            </p>
          </div>
        </section>
      </div>

      <section className="card results-card">
        <div className="card-title-row">
          <h3>Batch results</h3>
          <div className="result-actions">
            <button type="button" className="chip" onClick={handleCopy}>
              Copy
            </button>
            <button type="button" className="chip" onClick={handlePrint}>
              Print
            </button>
          </div>
        </div>
        {result.warnings.length > 0 && (
          <ul className="warnings">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <div className="stat-grid">
          <div className="stat hero">
            <span className="stat-label">Fragrance oil</span>
            <span className="stat-value">
              {result.fragrance} <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Total wax</span>
            <span className="stat-value">
              {result.totalWax} <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Batch total</span>
            <span className="stat-value">
              {result.totalBatch} <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Dye blocks (est.)</span>
            <span className="stat-value">{result.dyeBlocks}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Wax / vessel</span>
            <span className="stat-value">
              {result.perVessel.wax} <small>{u}</small>
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">FO / vessel</span>
            <span className="stat-value">
              {result.perVessel.fragrance} <small>{u}</small>
            </span>
          </div>
        </div>

        <div className="hint-blocks">
          <div className="hint-block">
            <h4>Wick guidance</h4>
            <p>{result.wickHint}</p>
          </div>
          {result.pourHint && (
            <div className="hint-block">
              <h4>Pour notes</h4>
              <p>{result.pourHint}</p>
            </div>
          )}
        </div>

        {selectedWax?.wickNotes && (
          <p className="meta-row" style={{ marginTop: '0.75rem' }}>
            <span>
              Wick note: <strong>{selectedWax.wickNotes}</strong>
            </span>
          </p>
        )}

        <p className="disclaimer">
          Always test-burn. Fragrance load limits depend on your FO flash point and wax brand. Follow
          FO supplier max usage rates. This calculator is for craft planning only.
        </p>
      </section>
    </div>
  )
}
