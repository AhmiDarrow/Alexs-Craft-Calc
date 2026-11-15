import packageJson from '../../package.json' with { type: 'json' }
import { bundledAppVersion, readAppVersion } from './appVersion.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(bundledAppVersion === packageJson.version, 'bundle version is package.json, not a UI literal')
const runtime = await readAppVersion()
assert(runtime === packageJson.version, `runtime version ${runtime} matches package.json outside native shells`)

console.log('appVersion.test ok')
