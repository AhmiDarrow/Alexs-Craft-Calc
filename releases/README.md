# Local release artifacts

Built on this machine for everyday install. Binaries are gitignored; GitHub Releases carry the public downloads.

Current app version: **1.0.9** (see root `package.json` / `src-tauri/tauri.conf.json`).

| File | What |
|------|------|
| `Alexs-Craft-Calc.exe` | Portable Windows desktop (Tauri) |
| `Alexs-Craft-Calc-1.0.9-x64.msi` | Windows installer (latest) |
| `Alexs-Craft-Calc-1.0.9-debug.apk` | Android debug APK (sideload, latest) |
| `Alexs-Craft-Calc-1.0.x-*.msi` / `*-debug.apk` | Prior local builds kept for rollback |

Rebuild:

```bash
npm run tauri:build
npm run android:apk
```

Copy fresh artifacts into this folder after a release build if you want them on disk next to the README.
