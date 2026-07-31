import {
  calculateSoap,
  convertWeight,
  defaultSoapInput,
  emptyLockedResult,
  isPercentTotalLocked,
  oilsFromPercents,
  percentsFromOils,
  sumOilPercents,
} from './soapCalc'
import { calculateCandle, defaultCandleInput, suggestWick } from './candleCalc'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function nearly(a: number, b: number, eps = 0.05) {
  assert(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b} (eps ${eps})`)
}

// Classic 1000g olive castile @ 0% SF → NaOH = 1000 * 0.135 = 135g
{
  const r = calculateSoap({
    ...defaultSoapInput(),
    oils: [{ oilId: 'olive', amount: 1000 }],
    superfatPct: 0,
    waterMethod: 'percent_oils',
    waterAsPercentOfOils: 33,
    fragrancePct: 0,
  })
  nearly(r.pureLye, 135)
  nearly(r.lyeWithSuperfat, 135)
  nearly(r.water, 330)
  nearly(r.totalOils, 1000)
}

// 5% superfat reduces lye
{
  const r = calculateSoap({
    ...defaultSoapInput(),
    oils: [{ oilId: 'olive', amount: 1000 }],
    superfatPct: 5,
    fragrancePct: 0,
  })
  nearly(r.lyeWithSuperfat, 135 * 0.95)
}

// Everyday bar mix sanity
{
  const r = calculateSoap(defaultSoapInput())
  assert(r.totalOils === 1000, 'default oils total 1000')
  assert(r.lyeWithSuperfat > 0, 'lye > 0')
  assert(r.water > 0, 'water > 0')
  // coconut 250 * 0.183 + olive 400 * 0.135 + palm 250 * 0.142 + castor 100 * 0.128
  const pure =
    250 * 0.183 + 400 * 0.135 + 250 * 0.142 + 100 * 0.128
  nearly(r.pureLye, pure)
  nearly(r.lyeWithSuperfat, pure * 0.95)
}

// KOH factor
{
  const na = calculateSoap({
    ...defaultSoapInput(),
    oils: [{ oilId: 'coconut', amount: 100 }],
    lyeType: 'naoh',
    superfatPct: 0,
    fragrancePct: 0,
  })
  const ko = calculateSoap({
    ...defaultSoapInput(),
    oils: [{ oilId: 'coconut', amount: 100 }],
    lyeType: 'koh',
    superfatPct: 0,
    fragrancePct: 0,
  })
  nearly(ko.pureLye, na.pureLye * 1.4027, 0.02)
}

// Lye concentration water
{
  const r = calculateSoap({
    ...defaultSoapInput(),
    oils: [{ oilId: 'olive', amount: 1000 }],
    superfatPct: 0,
    waterMethod: 'lye_concentration',
    lyeConcentrationPct: 33,
    fragrancePct: 0,
  })
  // water = lye * (1-0.33)/0.33
  nearly(r.water, 135 * (0.67 / 0.33), 0.1)
}

// Candle FO
{
  const r = calculateCandle({
    ...defaultCandleInput(),
    waxId: 'soy-111',
    vesselCount: 4,
    waxPerVessel: 200,
    useTotalWax: false,
    fragrancePct: 8,
    unit: 'g',
  })
  nearly(r.totalWax, 800)
  nearly(r.fragrance, 64)
  nearly(r.perVessel.wax, 200)
  nearly(r.perVessel.fragrance, 16)
}

// Wick hint non-empty
{
  const hint = suggestWick(3, null)
  assert(hint.includes('3'), 'diameter in hint')
}

// Weight unit conversion g ↔ oz ↔ lb
{
  nearly(convertWeight(453.59237, 'g', 'lb'), 1, 0.0001)
  nearly(convertWeight(1, 'lb', 'oz'), 16, 0.0001)
  nearly(convertWeight(16, 'oz', 'g'), 453.59237, 0.01)
  nearly(convertWeight(1000, 'g', 'g'), 1000)
}

// Percent ↔ weight helpers + 100% lock gate
{
  const oils = oilsFromPercents(1000, [
    { oilId: 'olive', pct: 40 },
    { oilId: 'coconut', pct: 25 },
    { oilId: 'palm', pct: 25 },
    { oilId: 'castor', pct: 10 },
  ])
  nearly(oils[0].amount, 400)
  nearly(oils[1].amount, 250)
  nearly(oils[3].amount, 100)
  const back = percentsFromOils(oils)
  nearly(sumOilPercents(back.map((b) => b.pct)), 100, 0.01)
  assert(isPercentTotalLocked(100), '100 locks open')
  assert(isPercentTotalLocked(99.97), 'within eps locks open')
  assert(!isPercentTotalLocked(99.9), 'short stays locked')
  assert(!isPercentTotalLocked(100.1), 'over stays locked')
  const locked = emptyLockedResult(['Oil percentages must total 100%.'])
  assert(locked.locked === true, 'locked flag')
  assert(locked.lyeWithSuperfat === 0, 'no lye while locked')
}

// Percent-derived recipe matches weight recipe lye
{
  const byWeight = calculateSoap(defaultSoapInput())
  const byPctOils = oilsFromPercents(1000, [
    { oilId: 'olive', pct: 40 },
    { oilId: 'coconut', pct: 25 },
    { oilId: 'palm', pct: 25 },
    { oilId: 'castor', pct: 10 },
  ])
  const byPct = calculateSoap({ ...defaultSoapInput(), oils: byPctOils })
  nearly(byPct.pureLye, byWeight.pureLye, 0.05)
  nearly(byPct.totalOils, 1000)
}

// Recipe export pack round-trip (no DOM / localStorage required)
async function testSharePacks() {
  const {
    buildSoapSharePack,
    buildCandleSharePack,
    packToJson,
    parseSharePayload,
    SHARE_FORMAT,
  } = await import('./storage')

  const soapPack = buildSoapSharePack({
    id: 'soap-test',
    name: 'Test Castile',
    savedAt: new Date().toISOString(),
    oils: [{ oilId: 'olive', amount: 1000, pct: 100 }],
    lyeType: 'naoh',
    superfatPct: 5,
    waterMethod: 'percent_oils',
    waterAsPercentOfOils: 33,
    lyeConcentrationPct: 33,
    waterDiscountPct: 0,
    fragrancePct: 3,
    unit: 'lb',
    oilEntryMode: 'percent',
    totalOilsWeight: 2.2,
    notes: 'Custom lavender batch notes',
  })
  assert(soapPack.format === SHARE_FORMAT, 'soap pack format')
  assert(soapPack.app.includes('Alex'), 'branded pack')
  const soapParsed = parseSharePayload(packToJson(soapPack))
  assert(soapParsed.ok, 'soap parse ok')
  if (soapParsed.ok) {
    assert(soapParsed.kind === 'soap', 'soap kind')
    assert(soapParsed.soapCount === 1, 'one soap')
    assert(soapParsed.soap?.[0]?.oils[0]?.oilId === 'olive', 'olive oil')
    assert(soapParsed.soap?.[0]?.superfatPct === 5, 'sf 5')
    assert(soapParsed.soap?.[0]?.unit === 'lb', 'lb unit round-trip')
    assert(soapParsed.soap?.[0]?.oilEntryMode === 'percent', 'entry mode')
    assert(soapParsed.soap?.[0]?.totalOilsWeight === 2.2, 'total oils')
    assert(soapParsed.soap?.[0]?.notes?.includes('lavender'), 'notes field')
  }

  const candlePack = buildCandleSharePack({
    id: 'candle-test',
    name: 'Soy 8oz',
    savedAt: new Date().toISOString(),
    waxId: 'soy-111',
    vesselCount: 4,
    waxPerVessel: 200,
    useTotalWax: false,
    totalWax: 800,
    fragrancePct: 8,
    dyeBlocksPerLb: 1,
    unit: 'g',
    vesselDiameterIn: 3,
  })
  const candleParsed = parseSharePayload(packToJson(candlePack))
  assert(candleParsed.ok, 'candle parse ok')
  if (candleParsed.ok) {
    assert(candleParsed.kind === 'candle', 'candle kind')
    assert(candleParsed.candle?.[0]?.waxId === 'soy-111', 'wax id')
  }

  // Bare recipe object (friend pasted without wrapper)
  const bare = parseSharePayload(
    JSON.stringify({
      name: 'Bare bar',
      oils: [{ oilId: 'coconut', amount: 500 }],
      lyeType: 'naoh',
      superfatPct: 6,
      waterMethod: 'percent_oils',
      waterAsPercentOfOils: 33,
      lyeConcentrationPct: 33,
      waterDiscountPct: 0,
      fragrancePct: 0,
      unit: 'g',
    }),
  )
  assert(bare.ok, 'bare soap ok')
  if (bare.ok) assert(bare.soap?.[0]?.name === 'Bare bar', 'bare name')

  const bad = parseSharePayload('{not json')
  assert(!bad.ok, 'invalid json rejected')
}

await testSharePacks()
console.log('All calc tests passed.')
