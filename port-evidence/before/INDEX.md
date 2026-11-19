# Before screenshots: Alex's Craft Calc (React, v1.0.10)

The app is dark-only (purple theme) and English-only: there is no light theme and there are no translations.
Web shots: built `dist/` served by `vite preview` on 127.0.0.1, headless Chrome with a fresh temporary profile (localStorage cleared), full-page captures except the wiki overlay shots (viewport only). 1280x900 at scale 1; 390x844 at deviceScaleFactor 2 (mobile emulation, so PNGs are 780 px wide).
Only recipe name used: "Lavender everyday bar".

Each web file exists as `web-1280x900-<screen>.png` and `web-390x844-<screen>.png`.

| screen | state shown |
|---|---|
| soap-default | First load, Soap tab, default recipe (Olive/Coconut/Palm/Castor), results unlocked |
| soap-saved-open | Recipe name "Lavender everyday bar" saved, Saved (1) list open |
| soap-additives | Saved list closed; one additive row (Colloidal oatmeal, else first clay) with amount 10 |
| soap-locked | First oil % raised by 7 (total 107%), results locked with warnings |
| soap-custom-empty | "Custom" preset clicked, empty recipe |
| candle-default | Candle tab, default values |
| candle-total-wax | "Enter total wax instead of per vessel" ticked |
| wiki-list | F1 wiki overlay, article list view |
| wiki-article | Wiki "Olive Oil" article open (search "olive") |
| wiki-search | Wiki search for "wick" |
| toast | Candle tab, immediately after clicking Copy: "Results copied" toast |

Android (Capacitor debug APK, emulator AVD freespeak-headless, API 34, 1080x2400, 3G status bar, 1:28-1:29 clock):

| file | state shown |
|---|---|
| android-1080x2400-soap-default.png | Soap tab on first launch (fresh install) |
| android-1080x2400-candle-default.png | Candle tab after tapping the Candle tab |
| android-1080x2400-wiki-list.png | Craft wiki overlay list after tapping Wiki |
