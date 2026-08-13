# Changelog

All notable changes to **Alex's Craft Calc** are documented here.

## [Unreleased]

## [1.0.8] — 2026-08-13

### Fixed
- **Soap calc hardening** — non-finite oil amounts, superfat, water, and fragrance no longer poison batch totals (NaN/Infinity rejected; clamps use safe fallbacks)
- **Candle calc hardening** — non-finite wax, fragrance load, vessel count, and wick diameter return a safe zero result instead of NaN
- **Percent / ceiling helpers** — `weightsMatchCeiling` and `isPercentTotalLocked` reject non-finite inputs so NaN cannot unlock results
- **Soap UI** — changing units converts additive weights; presets and Custom clear leftover additives

### Tests
- Adversarial coverage: empty/zero/negative oils, NaN/∞ oils and clamps, unknown oil ids, candle NaN paths, wick NaN diameter, import garbage / null amounts / prototype-pollution keys

## [1.0.7] — 2026-08-10

### Added
- **21 new oils/butters** in the soap catalog with SAP values and wiki blurbs
- Mobile polish pass across calculator chrome and oil entry

### Fixed
- Fatty-acid quality profile audit fixes
- Additives support polish (catalog, usage status, recipe I/O)

## [1.0.6] — 2026-08-10

### Added
- **Soap quality profile** — live fatty-acid breakdown (palmitic, stearic, oleic, linoleic, linolenic, ricinoleic, lauric/myristic) with per-acid good ranges and low/OK/high status, so you can see where a recipe sits and adjust toward a target bar
- **Additives & add-ins support** — new card between oils and lye/water for ground oats, clays, honey, milks, salts, botanicals, silk, chelators, colorants, antioxidants (18-item catalog)
  - Each additive shows recommended % of oils, spoon measure (PPO), phase to add, benefits, cautions, and live OK/low/high usage status
  - Results table + batch stat; additives saved/loaded/shared with recipes; out-of-range usage warnings
  - **Citric acid lye compensation** — adding citric acid automatically adds the extra NaOH/KOH it consumes (+0.624 g NaOH / +0.88 g KOH per gram)
- **Wiki expansion** — new articles: soap additives & add-ins guide, fatty-acid quality guide, lye calculation corrections, plus per-product reference depth

### Fixed
- **Lye calculations** — NaOH purity corrected to 100% and KOH to 90% (industrial grades); per-oil SAP values now take priority over the generic average; water-as-% is computed off total oil weight (soapcalc parity); NaOH↔KOH conversion now uses the molecular-weight ratio (1.403) instead of a flat factor
- **Quality ranges** aligned to soapcalc.net published bands (hardness, cleansing, conditioning, creaminess, longevity, iodine) with null-safe statuses

### Tests
- New coverage: lye purity, NaOH↔KOH conversion, water %-of-oils, fatty-acid profile math, additive usage status/warnings, citric-acid lye compensation (NaOH + KOH), storage round-trip with additives

## [1.0.5] — 2026-08-09

### Changed
- **Unified recipe I/O** — toolbar is now **Save / Saved / Load / Share** (plus Copy · Print)
- Removed separate **Import · Export · Export all** buttons; same portable JSON still works via Load / Share
- **Load** picks a recipe file or library backup and merges into Saved (opens single recipes in the editor)
- **Share** uses the phone/OS share sheet when available; otherwise downloads the portable file
  - Right-click / long-press Share → share full library
  - Saved list includes **Share library**

### Added
- `loadRecipesFromFile` / `shareRecipes` helpers in storage (native file → native text → download → clipboard fallbacks)
- Wiki + tests updated for Load / Share flows

## [1.0.4] — 2026-08-09

### Fixed
- **Import → Save** no longer creates a duplicate library slot (single-file import keeps the stable recipe id)
- Soap **presets** clear the active library slot so Save creates a new recipe instead of overwriting the loaded one
- Candle **Print** uses a clean batch sheet pop-up (parity with soap) and toasts if the popup is blocked
- App mode preference read/write is safer when `localStorage` is restricted

### Improved
- Save/load polish (soap + candle): notes chip on saved rows, active-slot styling, clearer recipe-slot hints, import summary toasts, write-error handling
- Toast tones (ok / warn / err) with longer dwell for long messages
- Mode toggle ↔ calculator tabpanel accessibility wiring
- Focus-visible styles on saved-load controls
- Candle recipe name `maxLength` 120 (parity with soap)

### Changed
- Soap oils: **weight and % both always editable** against a fixed **Total oils ceiling**
- Typing one oil’s weight or % updates **only that oil** — other oils and the ceiling are never auto-rewritten
- Results unlock when oil % = 100% **and** oil weights sum to Total oils
- Removed By weight / By % mode toggle (dual entry is the default)
- Optional **Scale weights to total** and **Apply % to weights** helpers

## [1.0.3] — 2026-07-31

### Changed
- Soap **default unit is ounces (oz)** for Total oils weight and oil amounts (same mass as the classic 1000 g everyday bar)
- Unit tabs still fully selectable: **g · oz · lb** — switching converts weights live

### Fixed
- **Mobile oil dropdowns** — oil rows stack full-width on phones so selects are no longer clipped or hard to open
- Safer small-screen padding / overflow on soap cards

## [1.0.2] — 2026-07-31

### Added
- Soap **unit tabs** g · oz · lb with live weight conversion
- Dedicated **Total oils weight** field (batch size)
- Oil entry modes: **By weight** (live %) and **By %** (weights from total)
- **% mode lock** — lye/water results stay locked until oil % totals 100% (with warning)
- **Custom** preset chip — blank recipe with **no oils/butters preloaded**
- **Custom recipe notes** field (saved and exported with the recipe)

### Fixed
- **Mobile wiki Back**: phone system Back / browser Back leaves the wiki (article → list → calculator) instead of exiting the app

### Docs
- Wiki soap UI + units articles updated for the weight-of-oils workflow
- README soap feature list refreshed

## [1.0.1] — 2026-07-31

### Improved
- **Mobile Craft Wiki** is one full page at a time (list ↔ article) instead of a split pane that felt cut in half on phones
- Esc hierarchy on phone: article → list → close wiki
- Wiki keyboard help article documents the phone navigation model
- **App icon**: Alien Purple handmade soap bar (ComfyUI) wired through PWA, favicon, header brand, Tauri desktop, and Android launcher

### Docs / CI
- GitHub Actions CI (install, test, production build) on push/PR to `main`
- README notes mobile wiki navigation

## [1.0.0] — 2026-07-31

### Added
- Dual-mode **Soap** and **Candle** calculators (Alien Purple UI)
- F1 Craft Wiki — 75 articles (app help + oils + waxes + process + safety)
- Recipe save/load, export/import, export-all library backup
- Vessel presets, scale/copy/print, oil/wax encyclopedia deep-links
- Installable PWA; Tauri Windows desktop (EXE/MSI); Capacitor Android APK
