# Release artifacts

**Preferred path:** push a version tag and let GitHub Actions build + attach installers.

```bash
# versions aligned in package.json + src-tauri/* + android/app/build.gradle
git tag v1.0.9
git push origin v1.0.9
```

Workflow: [`.github/workflows/release.yml`](../.github/workflows/release.yml)

| Trigger | What you get on the GitHub Release |
|---------|-------------------------------------|
| `git push origin v*` | Windows MSI + NSIS (Tauri) · Android debug APK |
| PR / push to `main` | CI only (tests + typecheck) — [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |

Assets land on: https://github.com/AhmiDarrow/Alexs-Craft-Calc/releases

## Local builds (optional)

Only needed if you want binaries without waiting on CI, or to debug packaging.

| Artifact | Command | Typical output |
|----------|---------|----------------|
| Windows EXE / MSI | `npm run tauri:build` | `src-tauri/target/release/` + `bundle/msi`, `bundle/nsis` |
| Android debug APK | `npm run android:apk` | `android/app/build/outputs/apk/debug/app-debug.apk` |
| Web / PWA | `npm run build` | `dist/` |

Copy into this folder only for local stash — **do not commit binaries** (see root `.gitignore`). Publish via the tag release pipeline.

Current app version: **1.0.9**
