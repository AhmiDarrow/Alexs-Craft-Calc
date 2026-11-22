# ✦ Alex's Craft Calc

<p align="center">
  <img src="public/brand-mark.svg" alt="Alex's Craft Calc" width="96" height="96" />
</p>

<p align="center">
  <strong>Soap and candle math in one offline app.</strong><br/>
  Cold-process lye · wax and fragrance · craft wiki · Windows · Android · Web
</p>

<p align="center">
  <a href="https://github.com/AhmiDarrow/Alexs-Craft-Calc/releases/latest"><img alt="version" src="https://img.shields.io/github/v/release/AhmiDarrow/Alexs-Craft-Calc?style=for-the-badge&color=a855f7&label=version" /></a>
  <a href="#safety"><img alt="offline" src="https://img.shields.io/badge/runs-offline-0f172a?style=for-the-badge" /></a>
  <a href="#download"><img alt="platforms" src="https://img.shields.io/badge/Windows%20·%20Android%20·%20Web-1e1b4b?style=for-the-badge" /></a>
  <a href="#privacy"><img alt="local first" src="https://img.shields.io/badge/local%20first-no%20account-312e81?style=for-the-badge" /></a>
</p>

---

Switch between **Soap** and **Candle** in one app. Press **F1** any time for the **Craft Wiki**, which has help for the app plus a full encyclopedia of oils, waxes, process and safety.

> Built for makers who weigh twice and pour once. All the math stays on your device.

Since 2.0 the app is built with [RemedyUI](https://github.com/AhmiDarrow/RemedyUI), a native Rust UI, so it's one fast build for Windows, Android and the web.

## Download

Grab the [latest release](https://github.com/AhmiDarrow/Alexs-Craft-Calc/releases/latest).

| Platform | File |
|:--|:--|
| **Android** (arm64) | `alexs-craft-calc_<version>_arm64-v8a.apk`. Installs over earlier 2.x versions and keeps your recipes. |
| **Windows** | `alexs-craft-calc_<version>_x64-setup.exe`, or the portable zip. They're unsigned, so SmartScreen may ask first. |
| **Web** | `alexs-craft-calc_<version>_web.zip`. Serve it over HTTPS or localhost, and it installs as an offline app. |

**Updates:** when a new version is out, the app shows a single "Update available" notice. On Android, tap **Update**, watch the progress bar, then tap **Install**. Your recipes are kept, and it never nags or updates on its own.

Coming from 1.x on Android? See the [2.1.0 notes](https://github.com/AhmiDarrow/Alexs-Craft-Calc/releases/tag/remedyui-v2.1.0) to bring your recipes over.

## ✧ Highlights

| | |
|:--|:--|
| **Soap** | 51 oils and butters · weight or % entry · NaOH or KOH · superfat · water 3 ways · fatty-acid profile · 23 additives (citric acid compensates the lye) |
| **Candle** | 10 wax profiles · 12 vessel presets · fragrance-load guidance · dye estimate · wick starting points |
| **Wiki** | About 100 articles: 39 craft and help pages plus every oil and wax · search · links from the calculators · phone Back steps through it |
| **Recipes** | Save, load and share portable JSON · full library backup and import · copy · print batch sheets |
| **Everywhere** | 12 languages, following your system language with a picker to change it · dark Alien Purple and light Alien Daylight themes, or follow the system |

## Soap calculator

- **51 oils and butters** with standard NaOH SAP values and encyclopedia notes
- Units **g · oz · lb** (oz by default) with a **Total oils** ceiling
- Weight **and** % are editable per oil, and editing one oil leaves the others alone
- Results unlock once oil % adds up to 100% and the weights match Total oils
- Helpers: Scale weights to total · Apply % to weights
- NaOH for bars or KOH for liquid soap
- Superfat %, three water methods (% of oils, lye concentration, water discount), fragrance %
- Live fatty-acid quality profile, iodine and INS
- Additives with usage %, phase and cautions
- Presets: Custom · Castile-ish · Everyday Bar · Creamy Shea · Palm-free · Luxury Butter

## Candle calculator

- **10 wax profiles**: soy, para-soy, coconut blends, beeswax, paraffin, palm and gel
- **12 vessel presets** with diameter hints, per-vessel or total wax entry
- Fragrance load with min, typical and max guidance
- Dye estimate, wick starting points by jar diameter, and pour and melt temperatures
- Units g · oz · lb

## Recipes: save, load, share

| Action | What it does |
|--------|----------------|
| **Save** | Stores or updates the recipe in your library on this device |
| **Load** | Opens a friend's `.alex-soap.json` / `.alex-candle.json` or a full library backup and merges it into Saved |
| **Share** | Opens the share sheet with the recipe file. Long-press (or right-click) to share your whole library. |
| **Copy / Print** | Copies the batch as text or prints a batch sheet |

The file format is `alex-craft-calc-recipe` v1, and exports from older versions still load.

## Privacy

No account and no cloud. Recipes stay on your device, and the only network call is the one-time check for a newer release on GitHub.

## Build from source

The app lives in [`remedyui/`](./remedyui) and is built with the RemedyUI toolchain (`cargo remedy`).

```bash
cd remedyui
cargo test                                  # calculator and data tests
cargo remedy package --target windows       # setup exe + portable zip (on Windows)
cargo remedy package --target android       # APK (needs the Android SDK/NDK)
cargo remedy package --target web           # offline web build
```

Settings such as the app id, icon and Android permissions are in [`remedyui/remedy.toml`](./remedyui/remedy.toml). The Android app keeps the id `com.alexscraft.calc`, so it updates earlier installs in place, but only when signed with the same key.

The older 1.x React/Tauri/Capacitor app is still in the repo root (`src/`, `src-tauri/`, `android/`) for reference.

## Safety

- Always add **lye to water**, never water to lye, and wear PPE.
- Check SAP values against your supplier's COA.
- Fragrance limits depend on IFRA and the wax brand, so test-burn your candles.
- This tool is for craft planning, not lab certification.

## Changelog

See **[CHANGELOG.md](./CHANGELOG.md)**.

---

"Hope this helps" - Ahmi
