# Alex's Craft Calc

**Beautiful Alien Purple soap & candle calculator** for Windows desktop and mobile.

Toggle between **Soap** (cold-process lye) and **Candle** (wax + fragrance) in one installable app.

Press **F1** anytime for the full **Craft Wiki** — app help plus a real encyclopedia of oils, waxes, process, and safety.

## Features

### Soap calculator
- 30 oils/butters with industry-standard NaOH SAP values + craft encyclopedia blurbs
- NaOH (bar) or KOH (liquid) — KOH = NaOH × 1.4027
- Superfat % with live lye adjustment
- Water methods: % of oils · lye concentration · water discount
- Fragrance % of oils
- Weighted iodine & INS + hardness body hint
- Presets: Castile-ish · Everyday Bar · Creamy Shea · Palm-free · Luxury Butter
- Scale batch to a target oil weight
- Unit switch g ⇄ oz converts amounts
- Save / load / delete recipes (local)
- **Export · Import · Export all** (portable JSON)
- Copy recipe · Print batch sheet
- Per-oil wiki deep-links (ⓘ)

### Candle calculator
- 10 wax profiles (soy, para-soy, coconut blends, beeswax, paraffin, palm, gel)
- Vessel presets (tins, jars, pillars, tealight…) with diameter hints
- Per-vessel or total wax entry
- Fragrance load % with min/max guidance + in-range pill
- Dye block estimate
- Wick starting-point by jar diameter
- Pour / melt temperature notes
- Units: g · oz · lb (converts wax weights)
- Save / load recipes · Copy batch text
- **Export · Import · Export all** (same portable format as soap)

### Craft Wiki (F1)
- **75 articles**: app manual + soap craft + candle craft + safety + reference
- Full oil encyclopedia (all 30 oils) and wax guide (all profiles)
- Categories, search, tags, keyboard: **F1** toggle · **Esc** close · **Ctrl+/**
- Deep-link from calculators into the matching oil/wax page
- **Phone:** one full page at a time (list ↔ article) — no split panes; **← All articles** or Esc goes back

### Recipe export / import
- **Export** — downloads `.alex-soap.json` / `.alex-candle.json` for one recipe
- **Import** — load a friend’s file or your backup (also accepts bare recipe objects)
- **Export all** — full soap + candle library dump for backup / device moves
- Format: `alex-craft-calc-recipe` v1 (round-trips cleanly)

### App
- Alien Purple dark UI + ComfyUI brand art
- Soap ⇄ Candle mode toggle (remembered)
- Installable PWA (Windows desktop + phone home screen)
- Works offline after first load
- Toasts, floating help, mobile-safe layout
- No account, no cloud — all math runs locally

## Quick start (everyday use)

### Windows
1. Double-click **`START.bat`** in this folder  
   *(first run builds if needed, then opens a local server)*
2. Browser opens **http://localhost:4173**
3. Optional: Chrome/Edge menu → **Install Alex's Craft Calc** for a desktop app window
4. Press **F1** for the craft wiki

### Dev mode
```bash
cd C:\Users\Administrator\Projects\alien-craft-calc
npm install
npm run dev
```

### Production build
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
2. Safari/Chrome → **Add to Home Screen** for a full-screen app icon.
3. Tap **?** or **F1 / Wiki** for the knowledge base.

## Native builds

### Windows desktop (Tauri)
Requires Rust + MSVC Build Tools + WebView2.

```bash
npm install
npm run tauri:build
```

Outputs:
- `src-tauri/target/release/alexs-craft-calc.exe` — portable desktop app
- `src-tauri/target/release/bundle/msi/*_x64_en-US.msi` — installer

Or from a release folder after packaging: `releases/Alexs-Craft-Calc.exe` / `.msi`.

### Android APK (Capacitor)
Requires **JDK 21**, Android SDK (`platform-tools`, `platforms;android-35+`, `build-tools`).

```bash
# set JAVA_HOME to JDK 21 and ANDROID_HOME to your SDK root
npm run build
npx cap sync android
cd android
./gradlew assembleDebug          # Windows: gradlew.bat assembleDebug
```

APK path: `android/app/build/outputs/apk/debug/app-debug.apk`  
(sideload / debug-signed — fine for personal everyday use)

```bash
npm run android:apk              # build web + sync + debug APK (Windows)
```

## Project layout
```
src/                    React UI + calc engines + F1 wiki
src-tauri/              Tauri 2 Windows desktop shell
android/                Capacitor Android project
public/                 Icons, brand mark, PWA assets
releases/               Local packaged EXE / MSI / APK (gitignored binaries)
START.bat               One-click web launcher
```

## Safety
- Always add **lye to water**, never water to lye. Wear PPE.
- Verify SAP values with your oil supplier COA.
- Fragrance limits vary by IFRA and wax brand — test burn candles.
- This tool is for craft planning, not lab certification.

## Color
Alien Purple — void blacks, amethyst gradients, neon violet accents.

---
Built for Ahmi · Alex's Craft Calc v1.1
