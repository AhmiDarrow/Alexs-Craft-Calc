import { formatEditable } from '../i18n/format'
import { countOf, parseUserDecimal } from './parseDecimal'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

function eq(raw: string, locale: string, expected: number) {
  const n = parseUserDecimal(raw, locale)
  if (!Number.isFinite(n) || Math.abs(n - expected) > 1e-9) {
    throw new Error(`${locale} ${JSON.stringify(raw)} → ${n}, expected ${expected}`)
  }
}

eq('1,000', 'en', 1000)
eq('1.500', 'en', 1.5)
eq('1,000', 'de', 1)
eq('1.000', 'de', 1000)
eq('1.5', 'de', 1.5)
eq('1,5', 'de', 1.5)
eq('1.234,56', 'de', 1234.56)
eq('1,234.56', 'en', 1234.56)
eq('1 234,56', 'de', 1234.56)
eq("1'234.5", 'en', 1234.5)
eq('-1,5', 'de', -1.5)
eq('35.274', 'en', 35.274)
assert(Number.isNaN(parseUserDecimal('', 'en')), 'empty is NaN')
assert(Number.isNaN(parseUserDecimal('abc', 'de')), 'junk is NaN')
assert(Number.isNaN(parseUserDecimal('1,2,3', 'de')), 'bad commas are NaN')
assert(Number.isNaN(parseUserDecimal('1.2.3', 'en')), 'bad dots are NaN')

const deText = formatEditable(35.274, 'de', 3)
assert(deText === '35,274', 'formatEditable de')
eq(deText, 'de', 35.274)

assert(countOf('', 'en') === 1, 'empty count is 1')
assert(countOf('2,9', 'de') === 2, 'count floors')
assert(countOf('0', 'en') === 1, 'zero count is 1')
assert(parseUserDecimal('1,000') === 1000, 'default locale is English')

console.log('parseDecimal.test ok')
