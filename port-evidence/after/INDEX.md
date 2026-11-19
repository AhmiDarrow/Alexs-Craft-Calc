# After: Alex's Craft Calc on RemedyUI 1.0

Side by side with `../before/` (the shipped React app). Windows shots are the native window
(debug build, captured with PrintWindow); web shots are the packaged page served on
127.0.0.1 in headless Chrome and Firefox with fresh profiles; data in every shot is test
data in temporary folders.

| File | What it shows | Compare with |
|---|---|---|
| `win-1280x900-soap-default.png` | Soap calculator on first run, Alien Purple (night) | `before/web-1280x900-soap-default.png` |
| `win-1280x2700-soap-results.png` | The whole soap page: oils, additives, lye, water, results (4.96 / 11.64 / 16.6 / 1.06 / 35.27 / 52.93 oz, pure lye 5.22, iodine 58.4, INS 153.9), quality profile with balanced bars, 42:58, oil breakdown, footer with the new Appearance choice — the same numbers as the before shot | `before/web-1280x900-soap-default.png` |
| `win-1280x900-soap-light.png` | The new Alien Daylight appearance | — (the shipped app was dark only) |
| `win-400x860-soap-narrow.png` | Phone width: rows wrap, nothing cut | `before/web-390x844-soap-default.png` |
| `win-1280x1040-candle-default.png` | Candle calculator (window clamped to the screen height) | `before/web-1280x900-candle-default.png` |
| `win-1280x900-wiki-article.png` | Wiki opened at the Olive Oil article (deep link from an oil's info button), list beside article | `before/web-1280x900-wiki-article.png` |
| `win-400x860-wiki-list.png` | Wiki on a narrow window: one page at a time, the list | `before/web-390x844-wiki-list.png` |
| `web-chrome-1280x900-import.png` | Web build in Chrome after the first-run import of the shipped PWA's localStorage on the same origin: candle mode restored, Saved (3), toast "Brought over 3 soap and 3 candle recipes…" | `before/web-1280x900-candle-default.png` |
| `web-firefox-1280x900-import.png` | The same in Firefox | — |
| `android-1080x2400-after-upgrade.png` | Android emulator, after installing the RemedyUI APK over the Capacitor app with saved recipes (same package, same key): candle mode and the library came over | `before/android-1080x2400-candle-default.png` |

The shipped app is English only, so there is no translated run; numbers are written the
locale's way (decimal separator, grouping) by the forms pack.
