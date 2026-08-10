import {
  amountFromCeilingPct,
  calculateSoap,
  convertWeight,
  defaultSoapInput,
  emptyLockedResult,
  isPercentTotalLocked,
  oilsFromPercents,
  pctOfCeiling,
  percentsFromOils,
  sumOilPercents,
  weightsMatchCeiling,
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
    unit: 'g',
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
    unit: 'g',
    oils: [{ oilId: 'olive', amount: 1000 }],
    superfatPct: 5,
    fragrancePct: 0,
  })
  nearly(r.lyeWithSuperfat, 135 * 0.95)
}

// Everyday bar mix sanity (default unit is oz; same mass as 1000 g bar)
{
  const d = defaultSoapInput()
  assert(d.unit === 'oz', 'default soap unit is ounces')
  const r = calculateSoap(d)
  nearly(r.totalOils, convertWeight(1000, 'g', 'oz'), 0.02)
  assert(r.lyeWithSuperfat > 0, 'lye > 0')
  assert(r.water > 0, 'water > 0')
  // SAP is mass/mass — pure lye in oz equals gram-recipe pure lye converted to oz
  const pureG =
    250 * 0.183 + 400 * 0.135 + 250 * 0.142 + 100 * 0.128
  nearly(r.pureLye, convertWeight(pureG, 'g', 'oz'), 0.02)
  nearly(r.lyeWithSuperfat, convertWeight(pureG * 0.95, 'g', 'oz'), 0.02)
}

// KOH factor
{
  const na = calculateSoap({
    ...defaultSoapInput(),
    unit: 'g',
    oils: [{ oilId: 'coconut', amount: 100 }],
    lyeType: 'naoh',
    superfatPct: 0,
    fragrancePct: 0,
  })
  const ko = calculateSoap({
    ...defaultSoapInput(),
    unit: 'g',
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
    unit: 'g',
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

// Percent ↔ weight helpers + 100% lock gate + ceiling model
{
  const ceiling = 1000
  const oils = oilsFromPercents(ceiling, [
    { oilId: 'olive', pct: 40 },
    { oilId: 'coconut', pct: 25 },
    { oilId: 'palm', pct: 25 },
    { oilId: 'castor', pct: 10 },
  ])
  nearly(oils[0].amount, 400)
  nearly(oils[1].amount, 250)
  nearly(oils[3].amount, 100)
  // % of ceiling (not share-of-sum of a partial batch)
  const back = percentsFromOils(oils, ceiling)
  nearly(sumOilPercents(back.map((b) => b.pct)), 100, 0.01)
  nearly(pctOfCeiling(400, ceiling), 40)
  nearly(amountFromCeilingPct(25, ceiling), 250)
  assert(weightsMatchCeiling(oils.map((o) => o.amount), ceiling), 'weights match ceiling')
  assert(!weightsMatchCeiling([400, 250], ceiling), 'partial weights fail ceiling')
  // Editing one oil does not imply renormalizing others — 40% alone is not 100%
  const oneOil = percentsFromOils([{ oilId: 'olive', amount: 400 }], ceiling)
  nearly(oneOil[0].pct, 40)
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
  const totalOz = byWeight.totalOils
  const byPctOils = oilsFromPercents(totalOz, [
    { oilId: 'olive', pct: 40 },
    { oilId: 'coconut', pct: 25 },
    { oilId: 'palm', pct: 25 },
    { oilId: 'castor', pct: 10 },
  ])
  const byPct = calculateSoap({ ...defaultSoapInput(), oils: byPctOils })
  nearly(byPct.pureLye, byWeight.pureLye, 0.05)
  nearly(byPct.totalOils, totalOz, 0.05)
  // Ceiling % round-trip on default oz batch
  const ceilingPcts = percentsFromOils(byPctOils, totalOz)
  nearly(sumOilPercents(ceilingPcts.map((p) => p.pct)), 100, 0.05)
}

// Quality profile — 7 soapcalc-style qualities with ideal ranges + sat:unsat ratio
{
  const { computeQualityProfile, computeSatRatio } = await import('./soapCalc')
  const byKey = (m: { key: string; value: number | null }[]) =>
    Object.fromEntries(m.map((x) => [x.key, x.value]))
  const q = (oils: { oilId: string; amount: number }[]) =>
    computeQualityProfile(oils, 60, 150)

  // 100% coconut: high cleansing + bubbly + hardness, low conditioning
  const coconut = byKey(q([{ oilId: 'coconut', amount: 100 }]))
  assert(coconut.cleansing != null && coconut.cleansing > 22, 'coconut cleansing high')
  assert(coconut.bubbly != null && coconut.bubbly > 46, 'coconut bubbly high')
  assert(coconut.hardness != null && coconut.hardness > 54, 'coconut hardness high')
  assert(coconut.conditioning != null && coconut.conditioning < 44, 'coconut conditioning low')

  // 100% olive: high conditioning + mildness, low hardness/cleansing
  const olive = byKey(q([{ oilId: 'olive', amount: 100 }]))
  assert(olive.conditioning != null && olive.conditioning > 69, 'olive conditioning high')
  assert(olive.mildness != null && olive.mildness >= 40, 'olive mildness high')
  assert(olive.hardness != null && olive.hardness < 29, 'olive hardness low')
  assert(olive.cleansing != null && olive.cleansing < 12, 'olive cleansing low')

  // Everyday Bar lands every quality inside its ideal range
  const everyday = byKey(
    q([
      { oilId: 'olive', amount: 400 },
      { oilId: 'coconut', amount: 250 },
      { oilId: 'palm', amount: 250 },
      { oilId: 'castor', amount: 100 },
    ]),
  )
  const EXPECT: [string, number, number][] = [
    ['hardness', 29, 54],
    ['cleansing', 12, 22],
    ['conditioning', 44, 69],
    ['bubbly', 14, 46],
    ['creamy', 16, 48],
    ['longevity', 18, 47],
    ['mildness', 40, 70],
  ]
  for (const [key, min, max] of EXPECT) {
    const v = everyday[key] as number
    assert(v != null && v >= min && v <= max, `everyday ${key} ${v} in ${min}-${max}`)
  }
  // Iodine / INS pass through untouched
  assert(everyday.ins === 150, 'ins passthrough')
  assert(everyday.iodine === 60, 'iodine passthrough')

  // Saturated : unsaturated ratio — castile mostly unsaturated, coconut mostly saturated
  const oliveRatio = computeSatRatio([{ oilId: 'olive', amount: 100 }])
  assert(oliveRatio.unsat > oliveRatio.sat, 'olive mostly unsaturated')
  const cocoRatio = computeSatRatio([{ oilId: 'coconut', amount: 100 }])
  assert(cocoRatio.sat > cocoRatio.unsat, 'coconut mostly saturated')
}

// Additives: % of oils, usage status, batch total, warnings
{
  const r = calculateSoap({
    ...defaultSoapInput(),
    unit: 'g',
    oils: [{ oilId: 'olive', amount: 1000 }],
    superfatPct: 5,
    fragrancePct: 0,
    waterMethod: 'percent_oils',
    waterAsPercentOfOils: 33,
    additives: [
      { additiveId: 'colloidal-oats', amount: 20 }, // 2% → ok (1–4)
      { additiveId: 'kaolin', amount: 40 }, // 4% → high (>3)
      { additiveId: 'honey', amount: 2 }, // 0.2% → low (<0.5)
    ],
  })
  nearly(r.additiveTotal, 62)
  nearly(r.totalBatch, 1000 + 135 * 0.95 + 330 + 62, 0.05)
  const oats = r.additives.find((a) => a.additiveId === 'colloidal-oats')
  assert(oats != null && oats.status === 'ok', 'oats within range')
  nearly(oats?.pctOfOils ?? 0, 2, 0.01)
  const kaolin = r.additives.find((a) => a.additiveId === 'kaolin')
  assert(kaolin != null && kaolin.status === 'high', 'kaolin above range')
  const honey = r.additives.find((a) => a.additiveId === 'honey')
  assert(honey != null && honey.status === 'low', 'honey below range')
  assert(r.warnings.some((w) => w.includes('above recommended')), 'high usage warning')
  assert(r.warnings.some((w) => w.includes('below recommended')), 'low usage warning')
  // Locked result carries empty additive fields
  const locked = emptyLockedResult(['x'])
  assert(locked.additives.length === 0 && locked.additiveTotal === 0, 'locked additives empty')
}

// Citric acid lye compensation (0.624 g NaOH / 0.88 g KOH per gram)
{
  const base = calculateSoap({
    ...defaultSoapInput(),
    unit: 'g',
    oils: [{ oilId: 'olive', amount: 1000 }],
    superfatPct: 0,
    fragrancePct: 0,
    waterMethod: 'percent_oils',
    waterAsPercentOfOils: 33,
  })
  const withCitric = calculateSoap({
    ...defaultSoapInput(),
    unit: 'g',
    oils: [{ oilId: 'olive', amount: 1000 }],
    superfatPct: 0,
    fragrancePct: 0,
    waterMethod: 'percent_oils',
    waterAsPercentOfOils: 33,
    additives: [{ additiveId: 'citric-acid', amount: 20 }],
  })
  nearly(withCitric.pureLye, base.pureLye + 20 * 0.624, 0.02)
  nearly(withCitric.lyeWithSuperfat, base.lyeWithSuperfat + 20 * 0.624, 0.02)
  assert(withCitric.warnings.some((w) => w.includes('Citric acid')), 'citric compensation warning')
  // KOH compensation factor 0.88 per gram
  const kohBase = calculateSoap({
    ...defaultSoapInput(),
    unit: 'g',
    oils: [{ oilId: 'coconut', amount: 100 }],
    lyeType: 'koh',
    superfatPct: 0,
    fragrancePct: 0,
  })
  const kohCitric = calculateSoap({
    ...defaultSoapInput(),
    unit: 'g',
    oils: [{ oilId: 'coconut', amount: 100 }],
    lyeType: 'koh',
    superfatPct: 0,
    fragrancePct: 0,
    additives: [{ additiveId: 'citric-acid', amount: 10 }],
  })
  nearly(kohCitric.pureLye, kohBase.pureLye + 10 * 0.88, 0.02)
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
    oilEntryMode: 'dual',
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
    assert(soapParsed.soap?.[0]?.oilEntryMode === 'dual', 'dual entry mode')
    assert(soapParsed.soap?.[0]?.totalOilsWeight === 2.2, 'total oils ceiling')
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
    notes: 'CD-10 wick, 2nd pour top-off',
  })
  const candleParsed = parseSharePayload(packToJson(candlePack))
  assert(candleParsed.ok, 'candle parse ok')
  if (candleParsed.ok) {
    assert(candleParsed.kind === 'candle', 'candle kind')
    assert(candleParsed.candle?.[0]?.waxId === 'soy-111', 'wax id')
    assert(candleParsed.candle?.[0]?.notes?.includes('CD-10'), 'candle notes')
  }

  // Additive round-trip through share pack (oats survive normalize + parse)
  const addPack = buildSoapSharePack({
    id: 'soap-add-test',
    name: 'Additive bar',
    savedAt: new Date().toISOString(),
    oils: [{ oilId: 'olive', amount: 1000, pct: 100 }],
    lyeType: 'naoh',
    superfatPct: 5,
    waterMethod: 'percent_oils',
    waterAsPercentOfOils: 33,
    lyeConcentrationPct: 33,
    waterDiscountPct: 0,
    fragrancePct: 3,
    unit: 'g',
    additives: [{ additiveId: 'colloidal-oats', amount: 20 }],
  })
  const addParsed = parseSharePayload(packToJson(addPack))
  assert(addParsed.ok, 'additive pack parses')
  if (addParsed.ok) {
    assert(
      addParsed.soap?.[0]?.additives?.[0]?.additiveId === 'colloidal-oats',
      'additive id round-trip',
    )
    assert(addParsed.soap?.[0]?.additives?.[0]?.amount === 20, 'additive amount round-trip')
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

  // formatImportSummary + merge return shape (no localStorage required for summary)
  const {
    formatImportSummary,
    formatSavedAt,
    canNativeShare,
    shareRecipes,
    loadRecipesFromFile,
  } = await import('./storage')
  assert(
    formatImportSummary({ soapSaved: 1, candleSaved: 0, soapUpdated: 1, candleUpdated: 0 }).includes(
      'new soap',
    ),
    'import summary new soap',
  )
  assert(
    formatImportSummary({ soapSaved: 0, candleSaved: 0, soapUpdated: 0, candleUpdated: 0 }).includes(
      'Nothing',
    ),
    'import summary empty',
  )
  assert(formatSavedAt('not-a-date') === '', 'bad date empty')
  assert(formatSavedAt(new Date().toISOString()).length > 0, 'good date formats')

  // Node/test env has no navigator.share — canNativeShare is false
  assert(canNativeShare() === false, 'no native share in node test env')

  // shareRecipes without DOM download/clipboard still returns a structured result
  const shareResult = await shareRecipes(soapPack, { plainText: 'Test castile batch' })
  assert(typeof shareResult.ok === 'boolean', 'share result ok flag')
  assert(
    shareResult.mode === 'download' ||
      shareResult.mode === 'copied' ||
      shareResult.mode === 'failed' ||
      shareResult.mode === 'native-file' ||
      shareResult.mode === 'native-text' ||
      shareResult.mode === 'cancelled',
    'share mode enum',
  )
  assert(typeof shareResult.message === 'string' && shareResult.message.length > 0, 'share message')

  // loadRecipesFromFile rejects empty / bad files without throwing
  const emptyFile = new File([''], 'empty.json', { type: 'application/json' })
  const emptyLoad = await loadRecipesFromFile(emptyFile)
  assert(!emptyLoad.ok, 'empty file load fails')
  if (!emptyLoad.ok) assert(emptyLoad.error.length > 0, 'empty load error text')

  const badFile = new File(['{not json'], 'bad.json', { type: 'application/json' })
  const badLoad = await loadRecipesFromFile(badFile)
  assert(!badLoad.ok, 'bad json load fails')
}

await testSharePacks()
console.log('All calc tests passed.')
