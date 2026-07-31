/** Candle wax profiles — typical fragrance load ranges and notes. */
export interface Wax {
  id: string
  name: string
  type: 'soy' | 'paraffin' | 'beeswax' | 'coconut' | 'blend' | 'gel' | 'palm'
  /** Recommended fragrance load % of wax weight */
  fragranceMin: number
  fragranceMax: number
  fragranceTypical: number
  meltPointF?: number
  pourTempF?: number
  notes?: string
  /** Encyclopedia blurb */
  wiki?: string
  /** Best vessel styles */
  bestFor?: string[]
  /** Cure time guidance before judging throw */
  cureDays?: string
  /** Single vs multi wick tendency */
  wickNotes?: string
}

export const WAXES: Wax[] = [
  {
    id: 'soy-111',
    name: 'Soy Wax (container)',
    type: 'soy',
    fragranceMin: 6,
    fragranceMax: 10,
    fragranceTypical: 8,
    meltPointF: 120,
    pourTempF: 135,
    notes: 'Clean burn, creamy tops',
    cureDays: '1–2 weeks for full cold throw judgment',
    bestFor: ['jars', 'tins', 'teacups'],
    wickNotes: 'Often needs hotter wick than paraffin of same diameter',
    wiki: 'Hydrogenated soybean oil wax formulated for containers. Creamy tops, clean marketing story, milder hot throw than paraffin for some fragrances. Sensitive to pour temp and FO choice — too-hot pours can cause wet spots; too-cool can rough the top. Always test your exact brand (GG464, C3, 464-clones, etc. differ).',
  },
  {
    id: 'soy-pillar',
    name: 'Soy Wax (pillar/mold)',
    type: 'soy',
    fragranceMin: 5,
    fragranceMax: 8,
    fragranceTypical: 6,
    meltPointF: 140,
    pourTempF: 160,
    cureDays: '1–2 weeks',
    bestFor: ['pillars', 'melts', 'molds'],
    wickNotes: 'Higher melt point — match wick to avoid tunneling',
    wiki: 'Higher-melt soy or soy blends meant to stand alone without a jar. Lower FO ceilings than container soy. Requires clean unmolding technique and often stearic or palm additives in commercial pillar mixes. Test diameter carefully — pillars punish under-wicking.',
  },
  {
    id: 'parasoy',
    name: 'Para-Soy Blend',
    type: 'blend',
    fragranceMin: 8,
    fragranceMax: 12,
    fragranceTypical: 10,
    meltPointF: 125,
    pourTempF: 160,
    notes: 'Strong scent throw',
    cureDays: '3–7 days often enough to evaluate',
    bestFor: ['jars', 'retail strong-throw'],
    wickNotes: 'Often easier hot throw; still test burn',
    wiki: 'Paraffin + soy hybrid aiming for soy aesthetics with paraffin throw. Popular for strong FO performance and smoother tops. Check SDS/brand FO max — some tolerate 10–12% well. Disclose blend content if you market ingredients.',
  },
  {
    id: 'coconut-soy',
    name: 'Coconut-Soy Blend',
    type: 'blend',
    fragranceMin: 8,
    fragranceMax: 12,
    fragranceTypical: 10,
    meltPointF: 120,
    pourTempF: 145,
    cureDays: '1–2 weeks',
    bestFor: ['jars', 'luxury containers'],
    wickNotes: 'Soft pools — wick so full melt pool forms in 2–4 h',
    wiki: 'Creamy luxury blend with excellent scent throw for many FOs. Can be softer in warm rooms; match wick and vessel. Follow brand-specific pour and FO temps — coconut fractions vary widely between suppliers.',
  },
  {
    id: 'coconut-apricot',
    name: 'Coconut Apricot Wax',
    type: 'coconut',
    fragranceMin: 8,
    fragranceMax: 12,
    fragranceTypical: 10,
    meltPointF: 115,
    pourTempF: 160,
    cureDays: '5–14 days',
    bestFor: ['jars', 'decorative vessels'],
    wickNotes: 'Soft wax — avoid over-wicking (sooting)',
    wiki: 'Premium soft wax known for strong throw and smooth tops when poured correctly. Lower melt point means careful shipping in heat. Follow manufacturer FO and dye guidance; some colors migrate in very soft waxes.',
  },
  {
    id: 'beeswax',
    name: 'Beeswax',
    type: 'beeswax',
    fragranceMin: 0,
    fragranceMax: 6,
    fragranceTypical: 3,
    meltPointF: 145,
    pourTempF: 160,
    notes: 'Often unscented or lightly scented',
    cureDays: 'Ready sooner; honey scent is the star',
    bestFor: ['pillars', 'tapers', 'rolls', 'blends'],
    wickNotes: 'Needs substantial wicking; pure beeswax burns hot',
    wiki: 'Natural wax with inherent honey aroma. Pure beeswax candles are often unscented or lightly scented — FO load is limited and can fight the natural smell. Hard, high-melt, long-burning. Frequently blended with coconut or soy to soften and improve throw. Food-grade vs candle-grade filtering affects color and scent.',
  },
  {
    id: 'paraffin-container',
    name: 'Paraffin (container)',
    type: 'paraffin',
    fragranceMin: 6,
    fragranceMax: 10,
    fragranceTypical: 8,
    meltPointF: 130,
    pourTempF: 160,
    cureDays: '3–7 days typical',
    bestFor: ['jars', 'mass scent throw'],
    wickNotes: 'Classic CD/LX testing charts often based on paraffin',
    wiki: 'Petroleum-derived classic candle wax. Excellent hot throw and color pop; predictable for many wick charts. Choose container-grade melt points. Some makers blend with soy for marketing or aesthetics. Ventilate workspaces; follow FO flash-point rules when heating.',
  },
  {
    id: 'paraffin-pillar',
    name: 'Paraffin (pillar)',
    type: 'paraffin',
    fragranceMin: 5,
    fragranceMax: 8,
    fragranceTypical: 6,
    meltPointF: 140,
    pourTempF: 180,
    cureDays: '3–7 days',
    bestFor: ['pillars', 'votives', 'sculpted'],
    wickNotes: 'Match melt point and diameter; avoid mushrooming',
    wiki: 'Harder paraffin for freestanding forms. Lower FO % than container work. Requires good mold release and controlled cooling to reduce sinkholes — save some wax for top-offs. Core wicking must be straight and well-secured.',
  },
  {
    id: 'palm-wax',
    name: 'Palm Wax',
    type: 'palm',
    fragranceMin: 5,
    fragranceMax: 10,
    fragranceTypical: 8,
    meltPointF: 140,
    pourTempF: 180,
    notes: 'Crystalline tops',
    cureDays: '1 week',
    bestFor: ['pillars', 'decorative crystals', 'containers'],
    wickNotes: 'Crystalline structure can affect burn path — test',
    wiki: 'Known for feathery crystalline tops when poured hot into cooler molds/jars. Hard, opaque, unique aesthetic. Sourcing ethics (RSPO) matter to many customers. Follow brand crystal-forming instructions — pour temp is everything for the look.',
  },
  {
    id: 'gel',
    name: 'Gel Wax',
    type: 'gel',
    fragranceMin: 3,
    fragranceMax: 5,
    fragranceTypical: 4,
    meltPointF: 180,
    pourTempF: 200,
    notes: 'Use gel-safe fragrance only',
    cureDays: 'Bubbles settle over days',
    bestFor: ['clear vessels', 'embeds', 'novelty'],
    wickNotes: 'Special gel wicks; never treat like soy',
    wiki: 'Mineral-oil + resin gel. Crystal clear for embeds and novelty. ONLY gel-safe fragrances and dyes — wrong FO can cloud or create fire hazards. Higher working temps; bubble management is a skill. Not a beginner “first candle” wax. Follow supplier safety sheets strictly.',
  },
]

/** Approximate wax needed (oz) for common vessel volumes (fl oz fill). */
export const VESSEL_PRESETS: { id: string; label: string; fillOz: number; diameterIn?: number }[] = [
  { id: '4oz', label: '4 oz tin / jar', fillOz: 3.5, diameterIn: 2.0 },
  { id: '6oz', label: '6 oz jar', fillOz: 5.2, diameterIn: 2.5 },
  { id: '8oz', label: '8 oz jar', fillOz: 7.0, diameterIn: 2.75 },
  { id: '9oz', label: '9 oz jar', fillOz: 7.8, diameterIn: 3.0 },
  { id: '10oz', label: '10 oz jar', fillOz: 8.5, diameterIn: 3.1 },
  { id: '12oz', label: '12 oz jar', fillOz: 10.5, diameterIn: 3.5 },
  { id: '16oz', label: '16 oz jar', fillOz: 14.0, diameterIn: 3.75 },
  { id: 'pillar-3x4', label: 'Pillar 3×4"', fillOz: 12, diameterIn: 3.0 },
  { id: 'pillar-3x6', label: 'Pillar 3×6"', fillOz: 18, diameterIn: 3.0 },
  { id: 'votive', label: 'Votive', fillOz: 2.0, diameterIn: 1.75 },
  { id: 'tealight', label: 'Tealight', fillOz: 0.5, diameterIn: 1.5 },
  { id: 'custom', label: 'Custom weight', fillOz: 0 },
]

export function getWax(id: string) {
  return WAXES.find((w) => w.id === id)
}

export function getVessel(id: string) {
  return VESSEL_PRESETS.find((v) => v.id === id)
}
