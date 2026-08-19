# ✦ Alex's Craft Calc

<p align="center">
  <img src="public/brand-mark.svg" alt="Alex's Craft Calc" width="96" height="96" />
</p>

<p align="center">
  <strong>Soap + candle math in one beautiful offline app.</strong><br/>
  Cold-process lye · wax & fragrance · full craft wiki · Windows · Android · PWA
</p>

<p align="center">
  <a href="https://github.com/AhmiDarrow/Alexs-Craft-Calc/releases/tag/v1.0.9"><img alt="version" src="https://img.shields.io/badge/version-1.0.9-a855f7?style=for-the-badge" /></a>
  <a href="#safety"><img alt="offline" src="https://img.shields.io/badge/runs-offline-0f172a?style=for-the-badge" /></a>
  <a href="#native-builds"><img alt="platforms" src="https://img.shields.io/badge/Windows%20·%20Android%20·%20PWA-1e1b4b?style=for-the-badge" /></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/local%20first-no%20account-312e81?style=for-the-badge" /></a>
</p>

---

Toggle **Soap ⇄ Candle** in one installable app. Press **F1** anytime for the **Craft Wiki** — app help plus a real encyclopedia of oils, waxes, process, and safety.

> Built for makers who weigh twice and pour once. All math stays on your machine.

## ✧ Highlights

| | |
|:--|:--|
| **Soap** | 51 oils/butters · dual weight/% entry · NaOH/KOH · superfat · water 3 ways · FA quality profile · 23 additives (incl. citric lye compensation) |
| **Candle** | 10 wax profiles · vessel presets · FO load guidance · dye estimate · wick starting points |
| **Wiki** | 100 articles (static + full oil/wax encyclopedia) · search · deep-links from calculators · phone Back stack |
| **Recipes** | Save / load / share portable JSON · library backup · copy · print batch sheets |
| **Ship** | Tauri Windows EXE/MSI · Capacitor Android APK · installable offline PWA |

## Soap calculator

- **51 oils & butters** with industry-standard NaOH SAP values + craft encyclopedia blurbs
- **Weight of oils:** unit tabs **g · oz · lb** (default **oz**) + dedicated **Total oils ceiling**
- **Dual entry:** weight **and** % always editable per oil — edit one oil only; others stay put
- Total oils is the recipe ceiling (never auto-rewritten when you type oil weights)
- Results unlock when oil % = 100% **and** weights sum to Total oils
- Helpers: Scale weights to total · Apply % to weights
- NaOH (bar) or KOH (liquid) — KOH from NaOH via molecular-weight ratio
- Superfat % with live lye adjustment
- Water methods: % of oils · lye concentration · water discount
- Fragrance % of oils
- **Fatty-acid quality profile** — live breakdown with good-range status
- **Additives & add-ins** — clays, oats, milks, salts, botanicals, chelators, colorants, antioxidants (usage % + phase + cautions; citric acid auto-compensates lye)
- Weighted iodine & INS + hardness body hint
- Presets: **Custom** · Castile-ish · Everyday Bar · Creamy Shea · Palm-free · Luxury Butter
- Custom recipe notes · Save / load / delete · Load portable JSON · Share · Copy · Print
- Per-oil wiki deep-links (ⓘ)

## Candle calculator

- **10 wax profiles** (soy, para-soy, coconut blends, beeswax, paraffin, palm, gel)
- Vessel presets (tins, jars, pillars, tealight…) with diameter hints
- Per-vessel or total wax entry
- Fragrance load % with min/max guidance + in-range pill
- Dye block estimate · wick starting-point by jar diameter
- Pour / melt temperature notes
- Units: g · oz · lb (converts wax weights)
- Save / load · Copy · Print · Load / Share (same portable format as soap)

## Craft Wiki (F1)

- **~100 articles**: app manual + soap craft + candle craft + safety + reference + every oil & wax
- Categories, search, tags
- Keyboard: **F1** toggle · **Esc** close · **Ctrl+/** focus search
- Deep-link from calculators into the matching oil/wax page
- **Phone:** one full page at a time — **← All articles**, Esc, or system **Back** returns article → list → calculator (does not exit the app first)

## Recipe save / load / share

| Action | What it does |
|--------|----------------|
| **Save** | Store or update the active recipe in the local library |
| **Load** | Friend’s `.alex-soap.json` / `.alex-candle.json` or full library backup → merges into Saved |
| **Share** | OS share sheet on phone when available; otherwise downloads the portable file (right-click / long-press Share for full library) |

Format: `alex-craft-calc-recipe` v1 (round-trips cleanly; older export files still Load).  
Name collision without an active slot → confirm before overwrite.

## App shell

- Dark craft UI with brand art
- Soap ⇄ Candle mode toggle (remembered)
- Installable PWA (Windows desktop + phone home screen)
- Works **offline** after first load
- Toasts, floating help, mobile-safe layout
- **No account, no cloud** — all math runs locally

## Quick start

### Windows (everyday)

1. Double-click **`START.bat`** in this folder  
   *(first run builds if needed, then opens a local server)*
2. Browser opens **http://localhost:4173**
3. Optional: Chrome/Edge → **Install Alex's Craft Calc** for a desktop app window
4. Press **F1** for the craft wiki

### Dev

```bash
npm install
npm run dev
```

### Production web

```bash
npm run build
npm start
```

### Tests

```bash
npm test
```

## Mobile (PWA)

1. On the same Wi‑Fi, open `http://<your-pc-ip>:4173` from the phone  
   or deploy the `dist/` folder to any static host / tunnel.
2. Safari/Chrome → **Add to Home Screen**
3. Tap **?** or **F1 / Wiki** for the knowledge base.

## Releases (CI)

Installers are built **on GitHub**, not on your laptop.

```bash
# bump version in package.json + src-tauri + android/app/build.gradle, then:
git tag v1.0.9
git push origin v1.0.9
```

| Workflow | When | Output |
|----------|------|--------|
| [CI](.github/workflows/ci.yml) | PR / push to `main` | `npm test` + typecheck |
| [Release](.github/workflows/release.yml) | tag `v*` (or manual dispatch) | Windows MSI/NSIS + Android debug APK on the [GitHub Release](https://github.com/AhmiDarrow/Alexs-Craft-Calc/releases) |

Re-run a tag build anytime: **Actions → Release → Run workflow** (pass the tag, e.g. `v1.0.9`).

### Local native builds (optional)

Only if you need to debug packaging offline.

**Windows (Tauri)** — Rust + MSVC Build Tools + WebView2:

```bash
npm install
npm run tauri:build
```

**Android (Capacitor)** — JDK 21 + Android SDK:

```bash
npm run android:apk
```

See [`releases/README.md`](./releases/README.md) for paths and notes.

## Project layout

```
src/           React UI + calc engines + F1 wiki
src-tauri/     Tauri 2 Windows desktop shell
android/       Capacitor Android project
public/        Icons, brand mark, PWA assets
releases/      Local packaged EXE / MSI / APK notes
START.bat      One-click web launcher
```

## Safety

- Always add **lye to water**, never water to lye. Wear PPE.
- Verify SAP values with your oil supplier COA.
- Fragrance limits vary by IFRA and wax brand — test burn candles.
- This tool is for craft planning, not lab certification.

## Changelog

See **[CHANGELOG.md](./CHANGELOG.md)** — current release **v1.0.9**.

## Downloads

GitHub Releases: [v1.0.9](https://github.com/AhmiDarrow/Alexs-Craft-Calc/releases/tag/v1.0.9)

---

<p align="center">
  <sub>Built for Ahmi · Alex's Craft Calc <strong>v1.0.9</strong> · local-first craft math</sub>
</p>
