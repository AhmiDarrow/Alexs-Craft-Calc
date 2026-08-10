/** Soap additives catalog — everything added to a batch beyond oils / lye / water / fragrance.
 *  Usage rates are % of total oils (industry convention). PPO = "per pound of oils" (≈454 g)
 *  spoon measure for quick kitchen measuring. Rates are published craft guidance — always
 *  test small batches; naturals vary by source and grind.
 */

export type AdditiveCategory =
  | 'clay'
  | 'exfoliant'
  | 'botanical'
  | 'liquid'
  | 'milk'
  | 'salt'
  | 'silk'
  | 'chelator'
  | 'colorant'
  | 'preservative'
  | 'other'

export const ADDITIVE_CATEGORY_LABELS: Record<AdditiveCategory, string> = {
  clay: 'Clays',
  exfoliant: 'Exfoliants',
  botanical: 'Botanicals',
  liquid: 'Liquids & sugars',
  milk: 'Milks',
  salt: 'Salts',
  silk: 'Silk & proteins',
  chelator: 'Chelators',
  colorant: 'Colorants',
  preservative: 'Antioxidants',
  other: 'Other',
}

export interface Additive {
  id: string
  name: string
  category: AdditiveCategory
  /** Typical usage range as % of total oils (industry convention). */
  usagePct: { min: number; max: number }
  /** Quick spoon measure per pound of oils (≈454 g), for bench-side measuring. */
  ppo?: string
  /** When to add during the process. */
  phase: string
  /** What it does in the finished bar. */
  benefits: string
  cautions?: string
  /** Liquid / water absorption or lye interaction notes. */
  waterNote?: string
  /** Lye math note (only citric acid actually changes lye amounts). */
  lyeNote?: string
  /** Craft encyclopedia blurb (also rendered as the wiki article body). */
  wiki: string
}

export const ADDITIVES: Additive[] = [
  {
    id: 'colloidal-oats',
    name: 'Ground Oats (colloidal)',
    category: 'exfoliant',
    usagePct: { min: 1, max: 4 },
    ppo: '1–3 tbsp',
    phase: 'At trace',
    benefits:
      'Gentle exfoliation plus soothing skin feel — beta-glucan in oats calms itchy, dry, or sensitive skin and leaves a creamy, soft bar.',
    cautions:
      'Must be very finely ground — coarse oatmeal feels scratchy in the shower. Above ~5% the bar can soften and the batter thickens.',
    waterNote: 'Fine oats absorb water and thicken trace — add at light trace and stir, or disperse in a little oil first.',
    wiki: 'Colloidal (finely ground) oatmeal is one of the gentlest additives in cold-process soap. The beta-glucan and avenanthramides are soothing and anti-inflammatory, which is why oats appear in sensitive-skin and eczema-friendly bars. Grind rolled oats to a powder in a blender (sift if needed) before adding. Keep to about 1–4% of oils so the bar stays smooth and hard. Sprinkle a little on top of the loaf instead for a decorative finish with zero scratchiness.',
  },
  {
    id: 'kaolin',
    name: 'Kaolin Clay',
    category: 'clay',
    usagePct: { min: 0.5, max: 3 },
    ppo: '1–2 tsp',
    phase: 'At trace (or dispersed in oil)',
    benefits:
      'Silky, slippery bar with a smooth glide. Gentle for sensitive skin, reduces the “drag” of a plain bar, and helps lighten or brighten colors.',
    cautions: 'None significant at normal rates; over 3–4% it can mute lather and slightly dry skin.',
    waterNote: 'Clays absorb water and thicken batter — disperse in a little oil or water before adding, or blend at light trace.',
    wiki: 'Kaolin is the gentlest clay — a fine white powder that gives soap a silky, cosmetic feel. It is popular in facial and sensitive-skin bars because it is very mild and adds slip without pulling moisture. Because it absorbs oils and water, disperse it in a little liquid or oil first and add at light trace. Kaolin also brightens colors and can be used to matte or lighten a design. Typical use is 1–2 tsp per pound of oils.',
  },
  {
    id: 'bentonite',
    name: 'Bentonite Clay',
    category: 'clay',
    usagePct: { min: 0.5, max: 3 },
    ppo: '1–2 tsp',
    phase: 'At trace',
    benefits:
      'Draw-out, “detox” feel with a creamy lather — a favorite in oily-skin and mud-style bars.',
    cautions:
      'Strongly absorbing; can be drying at higher rates. Slightly dulls fragrance. Gray-green tint unless white-bentonite grade is used.',
    waterNote: 'Absorbs more water than kaolin — always disperse in liquid first; batter thickens noticeably.',
    wiki: 'Bentonite is a swelling clay famous for drawing oils and impurities from skin. In cold-process soap it adds a creamy, dense lather and a slightly “clean” feel that oily-skin users love. It is one of the most water-hungry additives — dissolve it in a little water or oil before adding, and expect the batter to thicken. Keep it modest (0.5–3% of oils) so the bar does not become drying, and note that bentonite can mute fragrance oils.',
  },
  {
    id: 'french-green',
    name: 'French Green Clay (illite)',
    category: 'clay',
    usagePct: { min: 0.5, max: 3 },
    ppo: '1–2 tsp',
    phase: 'At trace',
    benefits:
      'Gentle detox with a soft sage-green tint — good for oily and combination skin bars.',
    cautions: 'Green color can shift in high-pH batter; test your batch.',
    waterNote: 'Disperse in oil or water first; thickens trace like other clays.',
    wiki: 'French green clay (illite) is a classic spa clay with a beautiful natural green color. It gently absorbs excess oil, which makes it popular in facial and oily-skin bars. The green comes from iron oxides and decomposed plant matter, and it can morph slightly in the high-pH lye environment — test a small batch if the exact shade matters. Use 1–2 tsp per pound of oils, added at trace.',
  },
  {
    id: 'rhassoul',
    name: 'Rhassoul Clay (Moroccan)',
    category: 'clay',
    usagePct: { min: 0.5, max: 3 },
    ppo: '1–2 tsp',
    phase: 'At trace',
    benefits:
      'Silky, slip-rich bar with real draw-out power — beloved for oily skin and a luxurious feel.',
    cautions: 'Can be drying at high rates; adds a tan/brown tint.',
    waterNote: 'Disperse before adding; absorbs water.',
    wiki: 'Rhassoul (ghassoul) clay from Morocco is prized for its high mineral content and exceptional silky slip. It draws out oils and impurities while leaving skin soft, and it adds a wonderfully smooth feel to bars. Its tan color can warm up a design. Standard use is 1–2 tsp per pound of oils, added at trace after dispersing in a little oil or water.',
  },
  {
    id: 'pink-clay',
    name: 'Pink Clay (kaolin + iron oxide)',
    category: 'clay',
    usagePct: { min: 0.5, max: 3 },
    ppo: '1–2 tsp',
    phase: 'At trace',
    benefits: 'Soft blush-pink tint with kaolin’s gentle, silky feel.',
    cautions: 'Natural pink can fade or shift in lye; test.',
    wiki: 'Pink clay is mostly kaolin tinted with natural iron oxides. It gives soap a soft rose or blush color while keeping kaolin’s mild, silky character — a lovely choice for floral or romantic bars. Use 1–2 tsp per pound of oils at trace. The pink can lighten in the lye environment, so test a small batch for exact shade.',
  },
  {
    id: 'activated-charcoal',
    name: 'Activated Charcoal',
    category: 'colorant',
    usagePct: { min: 0.3, max: 1.5 },
    ppo: '¼–1 tsp',
    phase: 'At trace (sift first)',
    benefits:
      'Deep black colorant with a draw-out feel — the signature of “detox” bars.',
    cautions:
      'Powder is messy and stains clothes/counters — wear a mask when handling the dust. Can mute other colors.',
    waterNote: 'Sift into a little oil and disperse before adding to avoid black clumps.',
    wiki: 'Activated charcoal turns soap a true, dramatic black and is the classic detox-bar additive. It is very concentrated: a quarter to one teaspoon per pound of oils is plenty. Always sift it into a little oil or water and stir into a smooth slurry before adding at trace — otherwise you get stubborn black clumps. It can mute bright colors and gray out pastels, so design accordingly. Handle the fine powder carefully; it stains.',
  },
  {
    id: 'honey',
    name: 'Honey',
    category: 'liquid',
    usagePct: { min: 0.5, max: 5 },
    ppo: '1 tsp–1 tbsp',
    phase: 'At trace (dissolved first)',
    benefits:
      'Humectant that draws moisture to skin, boosts bubbles, and adds a subtle golden tint and mild scent.',
    cautions:
      'Honey + lye heat up — it can push the batch into gel fast or even overheat in the mold (“soap volcano”). Start at 1 tsp PPO.',
    waterNote: 'Dissolve honey in a little warm water (not lye) before adding to avoid clumps.',
    wiki: 'Honey is a natural humectant: it pulls moisture into the skin, and soapmakers love the extra bubbles and golden glow it gives a bar. The catch is temperature — honey makes the batter heat up, so a high-honey batch can gel aggressively or overflow the mold. Start conservative (1 tsp per pound of oils), add at trace dissolved in a little warm water, and keep an eye on the mold. Many makers pair honey with oats or milk for a classic “breakfast” bar.',
  },
  {
    id: 'sugar',
    name: 'Sugar (granulated)',
    category: 'liquid',
    usagePct: { min: 0.5, max: 2 },
    ppo: '1 tsp',
    phase: 'Dissolved in lye water',
    benefits: 'Boosts rich, stable lather — especially helpful in high-oleic (castile-style) bars.',
    cautions: 'Sugar in lye water heats up; dissolve in water before the lye or add to cooled lye water.',
    waterNote: 'Do not pour sugar straight into hot lye — it can scorch and darken.',
    wiki: 'Plain table sugar is a quiet workhorse additive: dissolved in the water phase it increases lather, giving castile and other high-oleic bars a much fluffier, more stable suds. Use about 1 tsp per pound of oils. Dissolve it in the water before you add the lye (or stir into cooled lye water) — dropping sugar into hot lye solution can scorch it and brown the batch.',
  },
  {
    id: 'sodium-lactate',
    name: 'Sodium Lactate',
    category: 'other',
    usagePct: { min: 1, max: 3 },
    ppo: '1 tsp',
    phase: 'Added to cooled lye solution',
    benefits:
      'Hardens bars noticeably, speeds unmolding, and gives cleaner cuts — a lifesaver for high-soft-oil recipes.',
    cautions: 'Can speed trace slightly; measure accurately.',
    wiki: 'Sodium lactate is a liquid salt of lactic acid sold specifically for soapmaking. A teaspoon per pound of oils makes bars harder and easier to unmold and cut — the go-to fix for soft, slow-curing recipes heavy in olive or other conditioning oils. Add it to the cooled lye solution before mixing. It can slightly accelerate trace, so have your mold ready.',
  },
  {
    id: 'salt',
    name: 'Salt (sea / table)',
    category: 'salt',
    usagePct: { min: 1, max: 4 },
    ppo: '1–2 tbsp',
    phase: 'Dissolved in water (brine) or at trace',
    benefits:
      'Hardens the bar and produces a dense, creamy lather — the heart of classic brine and salt bars.',
    cautions:
      'Accelerates trace strongly; can be drying at high rates. True salt bars run 25–50%+ salt with 20% superfat — a different style than this gentle range.',
    waterNote: 'Dissolve salt in the water phase before lye, or add at trace; undissolved crystals stay gritty.',
    wiki: 'Salt hardens soap and gives it that dense, creamy, almost lotion-like lather. At gentle rates (1–2 tbsp per pound of oils) it is a texture upgrade for any bar. True “salt bars” are a different beast: 25–50% salt and high superfat (often 20%), which this gentle range is not. Salt accelerates trace, so work quickly, and dissolve it in the water phase before adding lye to avoid a gritty bar.',
  },
  {
    id: 'goat-milk-powder',
    name: 'Goat Milk Powder',
    category: 'milk',
    usagePct: { min: 2, max: 5 },
    ppo: '1 tbsp',
    phase: 'Dissolved in water before lye (or at trace)',
    benefits:
      'Creamy, gentle bar with a soft lotion feel — lactic acid in milk is naturally mild on skin.',
    cautions:
      'Milk can scorch or turn orange/brown if the lye solution overheats — keep it cool and add lye slowly. Adds a faint sweet-milk scent.',
    waterNote: 'Dissolve powder in the water first; some makers freeze the milk and add lye slowly to avoid heat.',
    wiki: 'Goat milk makes famously creamy, gentle bars — the lactic acid and fats in milk soften skin, and the finished bar feels luxurious. Powdered goat milk is the easy route: dissolve it in your water phase before adding lye, and keep the solution cool so the milk does not scorch (the classic trick is freezing the milk and adding lye slowly). Typical use is about 1 tbsp per pound of oils. The bar may have a subtle milky scent and a slightly creamier color.',
  },
  {
    id: 'silk',
    name: 'Silk Fibers (sericin)',
    category: 'silk',
    usagePct: { min: 0.05, max: 0.2 },
    ppo: 'a pinch (¼ tsp)',
    phase: 'Dissolved in lye water',
    benefits:
      'Gives bars a silky, glossy, almost powdery skin feel — the protein sericin coats the bar surface.',
    cautions: 'Takes time to dissolve in lye water; a pinch goes a long way.',
    waterNote: 'Stir silk fibers into the water before the lye and give them time to dissolve completely.',
    wiki: 'Real silk fibers (or silk protein) add an unmistakable silky, smooth glide to soap — the sericin protein creates a soft, slightly glossy surface. You only need a pinch (about ¼ tsp per pound of oils): dissolve the fibers in the water phase before adding lye and let them break down fully. It is the classic “luxury bar” trick and costs almost nothing per batch.',
  },
  {
    id: 'coffee-grounds',
    name: 'Used Coffee Grounds',
    category: 'exfoliant',
    usagePct: { min: 1, max: 3 },
    ppo: '1–2 tbsp',
    phase: 'At trace (or pressed into the top)',
    benefits:
      'Real exfoliation with a speckled look and a hint of coffee scent — the classic morning-scrub bar.',
    cautions: 'Coarse grounds feel sharp — grind fine. Grounds can clog drains; use a tub drain screen.',
    wiki: 'Used coffee grounds are the classic exfoliating additive: they scrub, leave a charming speckle, and carry a faint coffee aroma. Dry and finely grind them before use — coarse bits feel like gravel in the shower. Add 1–2 tbsp per pound of oils at trace, or press grounds into the top of the loaf for a decorative scrub layer. Note that grounds in the batter can darken it slightly.',
  },
  {
    id: 'poppy-seeds',
    name: 'Poppy Seeds',
    category: 'exfoliant',
    usagePct: { min: 0.5, max: 2 },
    ppo: '1–2 tsp',
    phase: 'At trace',
    benefits: 'Gentle, uniform exfoliation with a distinctive dotted look.',
    cautions: 'Some find seeds slightly sharp; stir well or they sink unevenly.',
    wiki: 'Poppy seeds give soap a gentle, even scrub and that signature polka-dot look. They are small and smooth enough for most skin. Use 1–2 tsp per pound of oils, stirred in at trace; they can settle, so give the batter a final mix right before pouring. For a softer scrub, grind them lightly first.',
  },
  {
    id: 'lavender-buds',
    name: 'Lavender Buds',
    category: 'botanical',
    usagePct: { min: 0.5, max: 2 },
    ppo: '1–2 tsp',
    phase: 'At trace (or sprinkled on top)',
    benefits: 'Pretty botanical decoration with light exfoliation and a whisper of lavender.',
    cautions:
      'Buds can turn brown or bleed color in the batter; sharp edges may irritate — crush lightly or use on top only.',
    wiki: 'Lavender buds are the prettiest botanical garnish: sprinkle them on top of the loaf for a rustic look, or stir them in for gentle exfoliation. In the batter they can darken to brown over time, so many makers press buds only into the top. Use 1–2 tsp per pound of oils and crush them lightly if you want them less prickly.',
  },
  {
    id: 'calendula',
    name: 'Calendula Petals',
    category: 'botanical',
    usagePct: { min: 0.5, max: 2 },
    ppo: '1–2 tsp',
    phase: 'At trace (or sprinkled on top)',
    benefits: 'Traditional soothing herb — lovely orange-gold flecks in the bar.',
    cautions: 'Petals can morph greenish in high-pH batter; test for exact color.',
    wiki: 'Calendula (marigold) petals are a centuries-old skin-soothing herb and a beautiful addition to soap — tiny orange-gold flecks scattered through the bar. Stir 1–2 tsp per pound of oils at trace, or sprinkle on top. Like many botanicals, the petals can shift color (often toward green or brown) in the lye environment, so test a small batch if the look matters.',
  },
  {
    id: 'turmeric',
    name: 'Turmeric Powder',
    category: 'colorant',
    usagePct: { min: 0.2, max: 1 },
    ppo: '¼–1 tsp',
    phase: 'At trace (dispersed in oil)',
    benefits:
      'Warm yellow-orange natural colorant with antioxidant curcumin — “golden milk” bars.',
    cautions: 'Can morph to orange or red-brown in lye; stains skin and cloths while wet.',
    waterNote: 'Disperse in a little oil first to avoid streaks.',
    wiki: 'Turmeric gives soap a sunny yellow-orange that deepens over time — in the lye environment it often shifts toward orange or terracotta, which is part of its charm. It also brings curcumin, a natural antioxidant. Use ¼–1 tsp per pound of oils, dispersed in oil first to avoid streaks, and remember it stains hands, towels, and molds while the batter is wet. Pair with a little white clay for a softer tone.',
  },
  {
    id: 'spirulina',
    name: 'Spirulina Powder',
    category: 'colorant',
    usagePct: { min: 0.2, max: 1 },
    ppo: '¼–1 tsp',
    phase: 'At trace',
    benefits: 'Vivid natural green colorant with trace minerals and a nutrient-rich story.',
    cautions: 'Green can morph grayish or blue-green in lye; expensive — use sparingly.',
    wiki: 'Spirulina is a blue-green algae that gives soap a striking natural green. A quarter to one teaspoon per pound of oils is plenty. The color is a bit temperamental in high-pH batter — it can shift toward gray or blue-green depending on the recipe and cure — so test your batch. It adds trace minerals and a lovely “green beauty” angle to the label.',
  },
  {
    id: 'citric-acid',
    name: 'Citric Acid',
    category: 'chelator',
    usagePct: { min: 0.5, max: 2 },
    ppo: '1–2 tsp',
    phase: 'Dissolved in water BEFORE the lye',
    benefits:
      'Chelating agent: binds minerals in hard water so your soap makes rich, creamy lather instead of soap scum — also helps prevent rancidity and brightens the bar.',
    cautions:
      'Never add citric acid to the lye solution — it fizzes violently. Dissolve it in the water first, then add the lye.',
    lyeNote:
      'Citric acid neutralizes lye: every 1 g of citric acid consumes ~0.624 g NaOH (0.88 g KOH). This calculator adds that extra lye automatically.',
    wiki: 'Citric acid is the pro move for hard-water areas: it chelates (binds) calcium and magnesium so they cannot form soap scum, which means richer lather, cleaner rinsing, and less “bathtub ring.” Use 1–2% of oil weight. Critical rule: dissolve the citric acid in the water phase first, then add the lye — dropping it into lye solution fizzes and splashes dangerously. And because citric acid consumes lye, you must add compensating lye: 0.624 g NaOH per gram of citric acid (0.88 g KOH). This calculator does that math for you automatically and tells you the adjusted amount.',
  },
  {
    id: 'titanium-dioxide',
    name: 'Titanium Dioxide (TiO₂)',
    category: 'colorant',
    usagePct: { min: 0.2, max: 1 },
    ppo: '¼–1 tsp',
    phase: 'Dispersed in oil (not water)',
    benefits: 'Bright white colorant and opacifier — makes a clean white base for vivid swirls.',
    cautions: 'Disperse in oil or glycerin first; it does not mix into water. Can be slightly drying at high rates.',
    wiki: 'Titanium dioxide is the standard white pigment in soapmaking: it makes bars bright white and opaque, and it is the base for most pastel swirls. It must be dispersed in a little oil (or glycerin) into a smooth slurry before adding — dumped into water it just clumps. Use ¼–1 tsp per pound of oils. In the U.S. the FD&C-grade is generally regarded as safe for rinse-off cosmetics; buy from a soapmaking supplier.',
  },
  {
    id: 'mica',
    name: 'Skin-safe Mica',
    category: 'colorant',
    usagePct: { min: 0.1, max: 1 },
    ppo: '⅛–1 tsp',
    phase: 'At trace',
    benefits: 'Shimmer, pearl, and vivid colors — the modern soapmaker’s palette.',
    cautions: 'Only use cosmetic/skin-safe mica (never craft-store mica). Some colors morph or migrate; test.',
    waterNote: 'Disperse in a little oil to avoid streaks and speckles.',
    wiki: 'Micah is a mineral pigment ground with oxides for color — the workhorse of modern soap design. A tiny amount (⅛–1 tsp per pound of oils) gives shimmer or solid color. Always buy mica labeled safe for cosmetics: some craft micas contain pigments not approved for skin. Color shift is batch-specific — reds and oranges can morph in lye — so test before committing a full batch.',
  },
  {
    id: 'rosemary-extract',
    name: 'Rosemary Oleoresin (ROE)',
    category: 'preservative',
    usagePct: { min: 0.05, max: 0.5 },
    ppo: 'a few drops (¼ tsp max)',
    phase: 'Added to the oils (or at trace)',
    benefits:
      'Natural antioxidant that slows rancidity (DOS) and extends shelf life — cheap insurance for high-iodine recipes.',
    cautions: 'A tiny amount is all you need; too much can slightly discolor or scent the bar.',
    wiki: 'Rosemary oleoresin extract (ROE) is the natural soapmaker’s shelf-life insurance: it is a potent antioxidant that slows the oxidation (dreaded orange spots / DOS) that can attack high-oleic or high-iodine recipes. Add just a few drops — about ¼ tsp per pound of oils at most — to the warm oils before mixing, or stir in at trace. It is nearly invisible and tastes/smells like nothing in the finished bar.',
  },
]

export function getAdditive(id: string): Additive | undefined {
  return ADDITIVES.find((a) => a.id === id)
}

export function additiveCategoryLabel(category: AdditiveCategory): string {
  return ADDITIVE_CATEGORY_LABELS[category] ?? category
}

/** Status of one additive amount vs its typical usage range (% of oils). */
export function additiveUsageStatus(
  pctOfOils: number,
  usage: { min: number; max: number },
): 'low' | 'good' | 'high' | 'n/a' {
  if (!Number.isFinite(pctOfOils) || pctOfOils <= 0) return 'n/a'
  if (pctOfOils < usage.min) return 'low'
  if (pctOfOils > usage.max) return 'high'
  return 'good'
}
