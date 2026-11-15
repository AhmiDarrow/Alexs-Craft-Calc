import { formatEditable, reformatEditable } from './format'
import { matchLocale, resolveStoredLocale } from './locales'
import { translate } from './translate'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(matchLocale(['de-DE', 'en']) === 'de', 'de-DE → de')
assert(matchLocale(['pt-PT']) === 'pt-BR', 'pt-PT → pt-BR')
assert(matchLocale(['pt']) === 'pt-BR', 'pt → pt-BR')
assert(matchLocale(['zh-Hans-CN']) === 'zh-CN', 'zh-Hans → zh-CN')
assert(matchLocale(['zh-TW', 'en-US']) === 'en', 'zh-TW skips to en')
assert(matchLocale(['zh-HK']) === 'en', 'zh-HK stays English')
assert(matchLocale(['ja-JP']) === 'ja', 'ja-JP → ja')
assert(matchLocale(['es-MX']) === 'es', 'es-MX → es')
assert(matchLocale(['xx']) === 'en', 'unknown → en')
assert(matchLocale([]) === 'en', 'empty → en')

const fresh = resolveStoredLocale(null, ['fr-FR'])
assert(fresh.locale === 'fr', 'first run uses OS language')
assert(fresh.persist != null && JSON.parse(fresh.persist).locale === 'fr', 'first run persists locale')

const kept = resolveStoredLocale(JSON.stringify({ lastWikiId: 'welcome', locale: 'ja' }), ['de'])
assert(kept.locale === 'ja' && kept.persist == null, 'saved locale wins and is not rewritten')

const merged = resolveStoredLocale(JSON.stringify({ lastWikiId: 'welcome' }), ['es-ES'])
assert(merged.locale === 'es', 'missing locale adopts OS language')
const mergedJson = JSON.parse(merged.persist || '{}') as { lastWikiId?: string; locale?: string }
assert(mergedJson.lastWikiId === 'welcome' && mergedJson.locale === 'es', 'merge keeps lastWikiId')

const corrupt = resolveStoredLocale('{nope', ['de'])
assert(corrupt.locale === 'de' && corrupt.persist == null, 'corrupt prefs are not overwritten')

const english = { 'greet': 'Hello {name}', 'blank': '   ', 'only': 'Only' }
const spanish = { 'greet': 'Hola {name}', 'blank': '  ', 'only': '' }
assert(translate(spanish, english, 'greet', { name: 'Ana' }) === 'Hola Ana', 'uses translation')
assert(translate(spanish, english, 'only') === 'Only', 'blank falls back to English')
assert(translate(spanish, english, 'missing') === 'missing', 'missing key stays visible')
assert(translate(english, english, 'greet', {}) === 'Hello {name}', 'missing var keeps placeholder')

assert(formatEditable(35.274, 'de', 3) === '35,274', 'de editable uses comma')
assert(formatEditable(1, 'de', 3) === '1', 'trailing zeros trimmed')
assert(formatEditable(1000, 'en', 0) === '1000', 'no grouping in inputs')
assert(reformatEditable('35,274', 'de', 'en', 3) === '35.274', 'switch back to dot')
assert(reformatEditable('', 'en', 'de', 2) === '', 'empty stays empty')
assert(reformatEditable('abc', 'en', 'de', 2) === 'abc', 'junk stays junk')

console.log('locale.test ok')
