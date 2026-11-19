# Alex's Craft Calc → RemedyUI port checklist

The shipped app (React PWA + Tauri 2 on Windows + Capacitor 8 on Android, v1.0.10) and its
RemedyUI 1.0 port in `remedyui/` (branch `remedyui`). Every item of the shipped app, and where
the port has it. "Parity" means checked against the shipped app's own TypeScript on the same
inputs (`remedyui/tests/parity.rs`, fixture from `remedyui/tools/gen-parity.ts`).

## Shell
- [x] Brand header: brand mark, "Alex's Craft Calc", tagline "Soap · Candle · Precision in purple"
- [x] Banner art strip
- [x] Soap ⇄ Candle mode toggle (tab list), remembered across runs (`alien-craft-mode` → `mode`)
- [x] F1 Wiki button; F1 and Ctrl+/ toggle the wiki (app commands, so they can be rebound)
- [x] Footer: craft-math line with F1 link, safety disclaimer
- [x] Floating "?" help button → the header's F1 Wiki button and the F1 footer link do the same (one entry per screen instead of two)
- [x] Toasts with tone (errors in the error style) and length-based dwell time (2.4 / 3.2 / 4.2 s)
- [x] Works offline (native app; web build has an offline service worker)
- [x] New: Appearance choice (Alien Purple night — the shipped look —, Alien Daylight, follow the system) and the system's high-contrast setting

## Soap calculator
- [x] Units g / oz / lb; converting weights, ceiling and weight-entered additives (parity)
- [x] Help (opens "app-soap-ui"), Reset (parity)
- [x] Recipe name (120 chars), custom notes (4000 chars)
- [x] Save / Update (library slot by id, else by name), overwrite confirmation dialog on a name clash
- [x] Saved (n) / Hide saved list: load, delete, meta line (oils · lye · SF · ceiling · saved time), notes tag, active slot marked
- [x] Load: recipe / library / bare recipe / array files, merged by name (parity of the parser)
- [x] Share: platform share sheet with the recipe file (Android chooser, Windows share window, browser `navigator.share`), falling back to saving the file, then to the clipboard; context menu "Share full library"; "Share library" in the saved list
- [x] Copy (batch text, parity of the text), Copy results
- [x] Print: the same print sheet; in a browser it prints through the print dialog, elsewhere it is saved as a page to print (RemedyUI has no native printing yet — see report)
- [x] Total oils ceiling; editing it keeps each oil's % (parity)
- [x] Scale weights to total; Apply % to weights (parity, toasts)
- [x] Presets: Custom (empty), Castile-ish, Everyday Bar, Creamy Shea, Palm-free, Luxury Butter (parity)
- [x] Oil rows: oil choice (all oils), wiki info button with the oil's note as tooltip, weight and % both live (parity), over-max % flagged, remove
- [x] Empty custom state with "+ Add first oil"; "+ Add oil"
- [x] Status line: Oil % · weights / ceiling, unlocked / over / short / under messages (parity)
- [x] Results lock until oils match the ceiling (parity of every lock warning)
- [x] Additives: pick list (all categories), info button, amount with g/oz/lb/tsp/tbsp (spoon conversion, parity), usage chip OK/Low/High with tooltip, meta line (PPO, phase, ≈ weight, % of oils), remove, "+ Additive"
- [x] Lye & superfat: NaOH / KOH, superfat %, fragrance %; Superfat guide, Lye safety links
- [x] Water: % of oils / lye concentration / discount, the matching field, "Water methods explained"
- [x] Results: NaOH/KOH with SF, water, lye solution, fragrance, total oils, batch total, additives; pure lye 0% SF, iodine, INS (parity, same digits)
- [x] Warnings list (parity)
- [x] Quality profile: nine metrics with balanced-bar track and marker, hints outside range, "How to read this" (parity incl. bar position)
- [x] Saturated : unsaturated ratio (parity)
- [x] Oil breakdown with wiki links; additive breakdown with usage status (parity)
- [x] Exact decimal inputs (forms pack), shown without trailing zeros, in the locale's way of writing numbers

## Candle calculator
- [x] Unit grams / ounces / pounds with conversion to 2 decimals (parity)
- [x] Reset (parity)
- [x] Recipe name, notes, Save/Update, Saved list, Load, Share, Copy, Print (as soap)
- [x] Wax type (all waxes) → typical FO % (parity); Wiki button; wax meta (FO band, melt, pour, notes, cure, best for)
- [x] Vessel presets with fill and diameter defaults (parity)
- [x] Number of vessels, vessel diameter
- [x] Total wax instead of per vessel (check), total / per-vessel field
- [x] Fragrance load %, dye blocks per lb; Min FO / Typical / Max FO; In range / Outside typical band
- [x] Results: fragrance oil, total wax, batch total, dye blocks, wax / vessel, FO / vessel (parity)
- [x] Wick guidance, pour notes, wick note, warnings (parity)

## Wiki (F1)
- [x] Hand-written articles + one per oil + one per wax (parity of every generated article)
- [x] Search (every word, parity), categories (All + 8), grouped list with counts, search results group, empty-search hint
- [x] Article: category badge, title, summary, tags (click searches), sections with paragraphs, bold, bullet and numbered lists (parity of the text format), disclaimer
- [x] Last article read remembered (`alien-craft-prefs.lastWikiId` → `wiki-last`)
- [x] Deep links from info buttons and guide links open the article
- [x] Narrow windows (< 780 px, phones): one page at a time, "← All articles", Escape / Android Back step article → list → calculator
- [x] Escape / Close / F1 close it

## Data
- [x] localStorage keys `alien-craft-soap-recipes`, `alien-craft-candle-recipes`, `alien-craft-prefs`, `alien-craft-mode` imported once on first run, unchanged, verified, backed up until verified (Windows: Tauri's WebView2 store; Android: the Capacitor WebView store of the same package; web: the same origin's localStorage)
- [x] Entries the shipped app could not read are kept (it dropped them on its next save)
- [x] No 60-recipe limit (the shipped app silently dropped the oldest)
- [x] Recipe file format `alex-craft-calc-recipe` v1 (and the legacy `alien-craft-calc-recipe`), both ways between the apps
- [x] Versioned store (`PersistStore`, version 1) for later migrations

## Platforms
- [x] Windows (native window, persisted size and place)
- [x] Android (native activity, same package `com.alexscraft.calc`)
- [x] Web (installable page, local only)
- [x] Keyboard: everything reachable by Tab; F1, Ctrl+/, Escape, Back; number fields step with arrows
- [x] Screen readers: every control named; results announced as groups with values; status line as a status
