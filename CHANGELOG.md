# Changelog

All notable changes to **Alex's Craft Calc** are documented here.

## [Unreleased]

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
