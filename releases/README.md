# Local release artifacts

Built on this machine for everyday install. Binaries are gitignored; GitHub Releases carry the public downloads.

| File | What |
|------|------|
| `Alexs-Craft-Calc.exe` | Portable Windows desktop (Tauri) |
| `Alexs-Craft-Calc-1.0.0-x64.msi` | Windows installer |
| `Alexs-Craft-Calc-1.0.0-debug.apk` | Android debug APK (sideload) |

Rebuild:

```bash
npm run tauri:build
npm run android:apk
```
