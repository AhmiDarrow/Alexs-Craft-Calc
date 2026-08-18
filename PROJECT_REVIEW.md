# Project review — Alex's Craft Calc (alien-craft-calc)

**Date:** 2026-03-28  
**Version:** 1.0.8 (package.json · tauri.conf.json · releases)  
**Verify:** `npm test` — **PASS** (All calc tests passed)

---

## 1. What it is

**Alex's Craft Calc** — dual-mode craft calculator (soap cold-process lye + candle wax/fragrance) with an in-app Craft Wiki (F1), local recipe library, and multi-target packaging:

| Surface | Stack |
|--------|--------|
| Web / PWA | Vite 6 + React 19 + TypeScript |
| Desktop | Tauri 2 (Rust) → MSI + portable `.exe` |
| Mobile | Capacitor 8 → Android debug APK |

Repo: `AhmiDarrow/alexs-craft-calc` · branch `main` tracking `origin/main`.

---

## 2. Architecture (clean)

```
src/
  App.tsx              Mode shell (soap | candle) + wiki + toast
  components/          SoapCalculator, CandleCalculator, ModeToggle, Wiki, Toast
  lib/
    soapCalc.ts        Lye, water methods, quality bars, citric compensation
    candleCalc.ts      Wax / FO / dye / vessel math
    storage.ts         localStorage recipes + share/import packs
    calc.test.ts       Engine unit tests (tsx runner)
  data/                oils, additives, waxes, wiki content
src-tauri/             Tauri shell
android/               Capacitor project
scripts/               icons, encoding helpers
releases/              Local 1.0.0–1.0.8 APK/MSI artifacts
```

**Strengths**

- **Calc engines are pure** (`soapCalc` / `candleCalc`) — UI stays thin; tests hit real math.
- **Dual oil entry** (weight + % of fixed ceiling) with lock/unlock when totals mismatch — careful craft UX.
- **Quality profile** (hardness, cleansing, conditioning, bubbly, creamy, longevity, mildness, iodine, INS) with target bands.
- **Additives catalog** with usage % of oils + citric acid → extra lye compensation constants.
- **Storage** has caps (`MAX_SAVED_RECIPES = 60`), typed share packs (`SHARE_FORMAT` / `SHARE_VERSION`), merge import, native share fallbacks.
- **Offline-first** — no backend; recipes in `localStorage`; relative Vite `base` for file/capacitor schemes.
- **Docs** — solid README + CHANGELOG + F1 wiki data; release notes in `releases/README.md`.

---

## 3. Verify & ship state

| Check | Result |
|-------|--------|
| `npm test` (`tsx src/lib/calc.test.ts`) | Green |
| Version alignment | **1.0.8** in package + tauri.conf + release binaries |
| Git | `main...origin/main`; dirty: `src-tauri/Cargo.toml` (modified), untracked `$null`, `.remedy-build/` |

Ship scripts present: `tauri:build`, `android:apk`, `release:win`, `release:android`, `icons`.

---

## 4. Findings (severity-ranked)

### Major

1. **Test surface is engine-only**  
   `calc.test.ts` is thorough for soap/candle math, but there are **no component / storage / import-roundtrip tests**. Recipe save/load/merge and dual-mode oil ceiling logic live in large UI files and can regress silently.

2. **Giant UI components**  
   `SoapCalculator.tsx` and `CandleCalculator.tsx` own state, presets, save/load, formatting, and layout. Hard to unit-test and easy to break one path while fixing another. Natural split: hooks (`useSoapRecipe`, `useCandleRecipe`) + presentational panels.

3. **Working tree noise**  
   - Untracked `$null` at repo root (likely a bad redirect artifact) — should delete, not commit.  
   - `.remedy-build/` should stay gitignored.  
   - `src-tauri/Cargo.toml` modified vs origin — confirm intentional before next ship.

### Minor

4. **CSP is null** in `tauri.conf.json` (`app.security.csp: null`). Fine for a local offline calculator, but a tight default CSP is better hygiene for Tauri 2.

5. **`uid()` via `Math.random()`** in soap rows — fine for React keys; not for recipe IDs if anything ever treats them as unguessable (storage already uses its own ids).

6. **releases/README.md** still shows `1.0.0` example filenames while tree has through **1.0.8** (and missing MSI for some intermediate APK-only bumps). Doc drift only.

7. **No automated UI/e2e** (Playwright/Cypress) for mode toggle, wiki F1, or import file picker — acceptable at 1.0.x if manual smoke is disciplined.

### Nit

8. Scripts folder has one-off helpers (`fix-encoding.py`, `list-classes.py`) — fine; keep them out of user-facing docs.  
9. Wiki/content TODOs in prose are content notes, not code debt.  
10. `OilEntryMode` marked `@deprecated` but kept for saved-recipe compat — good; document migration once old packs are rare.

---

## 5. Security / safety (craft app)

- No `eval` / `dangerouslySetInnerHTML` found in app code paths reviewed.  
- `JSON.parse` confined to storage/import with typed result unions — good pattern; keep rejecting unknown `SHARE_FORMAT`.  
- Lye/KOH are real hazards — wiki safety articles + calculator warnings matter more than code; keep safety copy accurate.  
- No network recipe sync — reduces attack surface; backup is export/share files.

---

## 6. Suggested next work (priority)

1. **Delete root `$null`**; confirm/commit or discard `Cargo.toml` diff; ensure `.remedy-build/` ignored.  
2. **Add storage round-trip tests** (save → list → export pack → parse → merge) in `calc.test.ts` or `storage.test.ts`.  
3. **Extract soap/candle hooks** from the two mega-components (behavior-preserving).  
4. Optional: set a minimal Tauri CSP; add one Playwright smoke (open app → soap preset → non-zero lye).  
5. Refresh `releases/README.md` examples to 1.0.8.

---

## 7. Verdict

**Healthy 1.0.8 product.** Core math is tested and structured; packaging story (Win MSI + Android APK + PWA) is real and version-aligned. Main risks are **UI monolith size** and **missing storage/UI tests**, not broken engines. Safe to keep shipping incremental craft features; invest next in test belts around recipes and a light component split before large soap UX changes.
