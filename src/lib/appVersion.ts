import packageJson from '../../package.json' with { type: 'json' }

/** Version shipped in this frontend bundle. Native shells may report their own. */
export const bundledAppVersion = packageJson.version

type AndroidVersionBridge = { getVersionName?: () => string }

interface NativeWindow {
  AlexCraftApp?: AndroidVersionBridge
  Capacitor?: { isNativePlatform?: () => boolean }
}

function nativeWindow(): NativeWindow | null {
  if (typeof window === 'undefined') return null
  return window as unknown as NativeWindow
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function readAndroidBridge(): string {
  const bridge = nativeWindow()?.AlexCraftApp
  if (!bridge || typeof bridge.getVersionName !== 'function') return ''
  try {
    return String(bridge.getVersionName() || '').trim()
  } catch {
    return ''
  }
}

function isAndroidShell(): boolean {
  try {
    return nativeWindow()?.Capacitor?.isNativePlatform?.() === true
  } catch {
    return false
  }
}

async function androidVersion(): Promise<string> {
  const immediate = readAndroidBridge()
  if (immediate) return immediate
  if (!isAndroidShell()) return ''
  // The Java bridge is attached at activity start. Give a slow WebView a moment.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50))
    const version = readAndroidBridge()
    if (version) return version
  }
  return ''
}

/**
 * Version of the running app.
 * Android reads `versionName` from the installed package.
 * Windows (Tauri) reads the shell version.
 * PWA and dev fall back to the bundle version from package.json.
 */
export async function readAppVersion(): Promise<string> {
  const fromAndroid = await androidVersion()
  if (fromAndroid) return fromAndroid
  if (isTauri()) {
    try {
      const { getVersion } = await import('@tauri-apps/api/app')
      const version = (await getVersion()).trim()
      if (version) return version
    } catch {
      /* shell command unavailable — the bundle version matches this build */
    }
  }
  return bundledAppVersion
}
