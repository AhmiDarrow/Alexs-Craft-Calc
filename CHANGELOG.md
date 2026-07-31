# Changelog

All notable changes to **Alex's Craft Calc** are documented here.

## [Unreleased]

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
