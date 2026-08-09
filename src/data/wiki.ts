/** Craft wiki — app help + general soap/candle knowledge (F1). */

export type WikiCategory =
  | 'start'
  | 'app'
  | 'soap'
  | 'oils'
  | 'candle'
  | 'waxes'
  | 'safety'
  | 'reference'

export interface WikiArticle {
  id: string
  title: string
  category: WikiCategory
  /** Search keywords */
  tags: string[]
  /** Short blurb in nav */
  summary: string
  /** Markdown-ish plain sections rendered by Wiki */
  sections: { heading?: string; body: string }[]
}

export const WIKI_CATEGORIES: { id: WikiCategory; label: string; icon: string }[] = [
  { id: 'start', label: 'Start here', icon: '✦' },
  { id: 'app', label: 'Using the app', icon: '◈' },
  { id: 'soap', label: 'Soap craft', icon: '◆' },
  { id: 'oils', label: 'Oils & butters', icon: '◇' },
  { id: 'candle', label: 'Candle craft', icon: '✧' },
  { id: 'waxes', label: 'Wax guide', icon: '◎' },
  { id: 'safety', label: 'Safety', icon: '⚠' },
  { id: 'reference', label: 'Reference', icon: '☰' },
]

export const WIKI_ARTICLES: WikiArticle[] = [
  // ── Start ──────────────────────────────────────────
  {
    id: 'welcome',
    title: 'Welcome to Alex\'s Craft Calc',
    category: 'start',
    tags: ['intro', 'overview', 'f1', 'help'],
    summary: 'What this app is and how to get around.',
    sections: [
      {
        body: 'Alex\'s Craft Calc is a dual-mode craft calculator for cold-process soap and container/pillar candles. Toggle Soap ⇄ Candle in the header. Press F1 anytime (or tap the ? Help button) to open this wiki — part app manual, part craft encyclopedia.',
      },
      {
        heading: 'What you can do',
        body: '• Soap: build oil recipes, compute NaOH or KOH, water three ways, superfat, fragrance, iodine/INS, and save recipes.\n• Candle: pick a wax profile, size vessels, set FO load %, dye estimate, wick starting points, vessel presets.\n• Wiki: oils, waxes, safety, process theory, and app tips — searchable.\n• Offline PWA: install to desktop or phone home screen.',
      },
      {
        heading: 'Keyboard',
        body: 'F1 — open / close wiki\nEsc — on phone: back to article list, then close; on desktop: close wiki\nPhone system Back / gesture — same stack as Esc: article → article list → calculator (does not leave the app while the wiki is open)\n? button — same as F1 on touch devices\n\nPhone wiki is one full page at a time: browse/search the list, tap an article to read it full-screen, then ← All articles, Esc, or system Back to go back. No split panes.',
      },
    ],
  },
  {
    id: 'quick-start-soap',
    title: 'Quick start: first soap batch',
    category: 'start',
    tags: ['beginner', 'soap', 'first batch', 'tutorial'],
    summary: 'From empty scale to a balanced beginner bar.',
    sections: [
      {
        body: '1. Stay on Soap mode.\n2. Load the Everyday Bar preset (olive / coconut / palm / castor).\n3. Set total oils to the size you want (scale all amounts, or use Scale batch).\n4. Superfat 5%, water ~33% of oils (or lye concentration 33%).\n5. Fragrance 3% of oils for most soap FOs (check IFRA).\n6. Read NaOH needed — weigh carefully.\n7. Save recipe with a name you’ll recognize later.',
      },
      {
        heading: 'Process sketch',
        body: 'Suit up (goggles, gloves, long sleeves). Weigh water into a heat-safe pitcher. Weigh lye separately. Add lye to water outdoors or under ventilation — never water into lye. Cool lye solution and oils to roughly 100–120°F (recipe-dependent). Combine, stick-blend to trace, add FO/color, pour mold, insulate or CPOP as preferred, unmold, cut, cure 4–6 weeks.',
      },
    ],
  },
  {
    id: 'quick-start-candle',
    title: 'Quick start: first candle batch',
    category: 'start',
    tags: ['beginner', 'candle', 'first batch', 'tutorial'],
    summary: 'Wax, FO, wick — a sane first jar run.',
    sections: [
      {
        body: '1. Switch to Candle mode.\n2. Choose Soy Wax (container) or your brand’s closest profile.\n3. Pick a vessel preset (e.g. 8 oz jar) or enter wax per vessel.\n4. Set vessel count and diameter for wick hints.\n5. FO load starts at the wax typical (often 8%) — stay inside min/max.\n6. Melt wax, cool to FO temp per brand, stir FO 2 minutes, pour, wick centered.\n7. Cure days before judging cold throw (soy often 1–2 weeks).',
      },
      {
        heading: 'Golden rule',
        body: 'Every FO + wax + vessel + wick combo is its own system. The calculator sizes materials; test burns decide the real recipe.',
      },
    ],
  },

  // ── App ────────────────────────────────────────────
  {
    id: 'app-soap-ui',
    title: 'Soap calculator controls',
    category: 'app',
    tags: ['ui', 'soap', 'presets', 'water', 'superfat', 'save'],
    summary: 'Every control on the soap side explained.',
    sections: [
      {
        heading: 'Weight of oils',
        body: 'Pick g, oz, or lb with the unit tabs. Enter a dedicated Total oils weight — this is the recipe ceiling (combined oil batch size). It does not change when you type individual oils.\n\nEach oil row has both Weight and % of total always editable:\n• Type a weight → that oil’s % updates from weight ÷ Total oils. Other oils stay put.\n• Type a % → that oil’s weight updates from % × Total oils. Other oils stay put.\n\nOptional helpers: Scale weights to total (keeps ratios) and Apply % to weights. Lye/water results stay locked until oil % totals 100% and oil weights sum to the Total oils ceiling.',
      },
      {
        heading: 'Oils table',
        body: 'Add rows for each oil/butter. Weight and % are both live against the Total oils ceiling — the app never auto-rewrites your other oils after you enter a weight. Tap the info chip on an oil (or open wiki for that oil) for encyclopedia notes. SAP used in results is NaOH or KOH depending on lye type. Custom recipe notes sit under the recipe toolbar for batch reminders, FO blend, mold, cure plan, etc.',
      },
      {
        heading: 'Lye & superfat',
        body: 'NaOH = bar soap. KOH = liquid soap (app uses KOH = NaOH SAP x 1.4027). Superfat % leaves that fraction of oils unsaponified - typical bars 4-8%. Pure lye (0% SF) is shown in meta for checking.',
      },
      {
        heading: 'Water methods',
        body: '% of oils - simple classic (e.g. 33% water relative to oil weight).\nLye concentration - water from lye / (lye+water); 33% concentration is a common full-water starting point; higher concentration = less water, faster cure, thicker trace.\nWater discount - legacy style off ~38% full water.',
      },
      {
        heading: 'Recipes, export & import',
        body: 'Save stores the full recipe (oils, mode, total oils, notes, units) in this browser. Load restores it. Copy batch puts a text summary on the clipboard. Print opens a clean batch sheet.\n\nExport downloads a portable .alex-soap.json file friends can Import. Export all dumps every saved soap + candle recipe into one library file - great for backup or moving phones/PCs.',
      },
    ]
  },
  {
    id: 'app-candle-ui',
    title: 'Candle calculator controls',
    category: 'app',
    tags: ['ui', 'candle', 'vessels', 'fragrance', 'wick'],
    summary: 'Wax, vessels, FO, dye, wick hints.',
    sections: [
      {
        heading: 'Wax & vessels',
        body: 'Pick a wax profile for FO range and pour notes. Vessel presets fill approximate wax weight from common jar sizes (fill weight, not label volume). Toggle total wax vs per-vessel entry. Diameter drives single-wick starting hints only.',
      },
      {
        heading: 'Fragrance & dye',
        body: 'FO % is percent of wax weight (industry norm for candles). Warnings fire below/above the profile’s typical band. Dye blocks/lb is a rough chip guide — pigments differ; start light.',
      },
      {
        heading: 'Results, export & import',
        body: 'Total FO, wax, per-vessel splits, dye estimate, wick paragraph, pour/melt notes. Save / copy / print work like the soap side. Export produces a portable .alex-candle.json (or full library via Export all). Import loads a friend’s file or your backup — single candle recipes also apply to the calculator immediately.',
      },
    ],
  },
  {
    id: 'app-install',
    title: 'Install, offline & mobile',
    category: 'app',
    tags: ['pwa', 'install', 'offline', 'windows', 'phone'],
    summary: 'Desktop app window and phone home screen.',
    sections: [
      {
        body: 'This is a Progressive Web App. In Chrome or Edge on Windows: open the app → ⋮ menu → Install Alex\'s Craft Calc. You get a standalone window and cached shell for offline use after the first visit.\n\nPhone (same Wi‑Fi as the PC running the server, or any hosted URL): open the site → Share / menu → Add to Home Screen.\n\nRecipes save in localStorage on that device/browser — export via Copy if you need a backup.',
      },
    ],
  },
  {
    id: 'app-units',
    title: 'Units & precision',
    category: 'app',
    tags: ['grams', 'ounces', 'pounds', 'scale'],
    summary: 'g / oz / lb and how to weigh.',
    sections: [
      {
        body: 'Soap and candle both support grams, ounces, and pounds. Switching the unit tabs converts oil weights and the total-oils field so the recipe stays the same mass. Math is linear in whatever unit you pick — do not mix units inside one batch by hand.\n\nUse a scale that resolves 0.1 g (or 0.01 oz) for lye. Volume cups are not accurate enough for lye or FO. When a supplier gives SAP as KOH numbers, convert or use their NaOH table - this app database is NaOH-based reference values.',
      },
    ],
  },

  // ── Soap craft ─────────────────────────────────────
  {
    id: 'soap-saponification',
    title: 'Saponification explained',
    category: 'soap',
    tags: ['saponification', 'chemistry', 'lye', 'sap'],
    summary: 'How oils + lye become soap.',
    sections: [
      {
        body: 'Saponification is the chemical reaction between triglycerides (oils/fats) and a strong alkali (NaOH or KOH). Each oil needs a characteristic amount of lye to convert fully — that ratio is the SAP value. This calculator multiplies each oil’s weight by its NaOH SAP (or × 1.4027 for KOH), sums them, then reduces by your superfat %.',
      },
      {
        heading: 'Why SAP tables differ',
        body: 'Natural oils vary by cultivar, season, and refining. Published SAP values are averages. Serious makers verify with supplier COAs or titrate. Treat app numbers as planning defaults, not lab certificates.',
      },
    ],
  },
  {
    id: 'soap-superfat',
    title: 'Superfat & lye discount',
    category: 'soap',
    tags: ['superfat', 'lye discount', 'mildness'],
    summary: 'Why we leave leftover oils.',
    sections: [
      {
        body: 'Superfat (lye discount) deliberately underdoses lye so a percentage of oils remain unsaponified. Benefits: insurance against measurement error, milder skin feel, room for luxurious butters. Costs: too much softens bars, can invite DOS (dreaded orange spots) or shorter shelf life, and greasy feel.\n\nCommon ranges:\n• Everyday bars: 4–6%\n• High-coconut/salt bars: 8–15%+\n• Liquid soap: often cooked to neutrality then diluted; superfat strategy differs\n• Laundry soap: sometimes 0–2%',
      },
    ],
  },
  {
    id: 'soap-water',
    title: 'Water, concentration & trace',
    category: 'soap',
    tags: ['water', 'concentration', 'trace', 'discount'],
    summary: 'How water amount changes the batch.',
    sections: [
      {
        body: 'Water does not become soap — it is the reaction medium and evaporates during cure. More water = thinner batter, slower trace, longer cure to hard bar. Less water (higher lye concentration or discount) = thicker faster, risk of false trace with hard fats, shorter cure, sometimes soda ash tradeoffs.',
      },
      {
        heading: 'Practical starting points',
        body: '• Beginners: 33–38% water as % of oils, or ~33% lye concentration.\n• Advanced swirls needing time: slightly more water, cooler temps, slow oils.\n• Fast movers (milk, sugar, high coconut): consider full water and low temps.\n• HP / fluid liquid soap: different water math after cook.',
      },
    ],
  },
  {
    id: 'soap-trace',
    title: 'Trace, temperature & additives',
    category: 'soap',
    tags: ['trace', 'temperature', 'stick blender', 'additives'],
    summary: 'Reading batter and controlling speed.',
    sections: [
      {
        body: 'Trace is when oils and lye emulsion thicken enough that drizzled batter leaves a brief mark. Light trace pours and swirls; thick trace molds texture and drops.\n\nSpeed up: stick blender pulses, heat, sugars (honey, milk solids), some FOs, high lauric oils.\nSlow down: cool temps, hand stir, high olive/rice bran, some floral FOs that accelerate — know your FO.\n\nAdd clays, activated charcoal, and most powders at light trace. Stick-blend titanium dioxide carefully to avoid clumps. Always check FO and essential oil vendor acceleration notes.',
      },
    ],
  },
  {
    id: 'soap-cure',
    title: 'Cure, hardness & soda ash',
    category: 'soap',
    tags: ['cure', 'hardness', 'soda ash', 'gel'],
    summary: 'What happens after unmolding.',
    sections: [
      {
        body: 'Cure is mostly water loss plus crystalline finishing of the soap matrix. Bars usually need 4–6 weeks (castile much longer) in airy, dry, indirect light conditions, flipped occasionally.\n\nGel phase (through the middle) can deepen colors; force gel with light heat or prevent with chill for swirl clarity — both valid.\n\nSoda ash is sodium carbonate on the surface from CO₂ — cosmetic. Steam, spritz alcohol early, or plan a plane/wash. Not the same as lye-heavy soap (which feels grabby and fails zap/pH checks).',
      },
    ],
  },
  {
    id: 'soap-iodine-ins',
    title: 'Iodine value & INS',
    category: 'soap',
    tags: ['iodine', 'ins', 'hardness', 'rancidity', 'dos'],
    summary: 'Reading the quality numbers on results.',
    sections: [
      {
        body: 'Iodine value estimates unsaturation — higher iodine tends toward softer bars and faster oxidation (DOS risk). Very high blend iodine (>70-ish weighted) is a yellow flag for shelf life; balance with hard fats and antioxidants (rosemary oleoresin, careful storage).\n\nINS (iodine to SAP number style index) is a traditional soaper heuristic for hardness/conditioning balance. Many aim roughly 136–165 for bar feel, but excellent soaps exist outside that band. Use as a compass, not a law.',
      },
    ],
  },
  {
    id: 'soap-liquid',
    title: 'Liquid soap (KOH) basics',
    category: 'soap',
    tags: ['liquid soap', 'koh', 'paste', 'dilution'],
    summary: 'How the KOH path differs from bars.',
    sections: [
      {
        body: 'Liquid soap uses potassium hydroxide. This app computes KOH from NaOH SAP × 1.4027. Process is often hot-process to a paste, neutralized (e.g. slight boric or citric solutions per your method), then diluted with distilled water to a usable viscosity.\n\nSuperfat in liquid soap is handled carefully — excess oils can cloud or separate. Dilution ratios vary (often paste:water around 1:1 to 1:2 by weight as a starting experiment). Preservatives may be needed once water activity and use pattern demand them — research modern liquid soap preservation; this wiki is not a micro lab.',
      },
    ],
  },
  {
    id: 'soap-fragrance',
    title: 'Fragrance & essential oils in soap',
    category: 'soap',
    tags: ['fragrance', 'essential oil', 'ifra', 'ppd'],
    summary: 'Usage rates, IFRA, and behavior in CP.',
    sections: [
      {
        body: 'Soap FO is usually calculated as % of total oil weight. Many soapers land 3–6% depending on FO strength and IFRA category limits for leave-on vs rinse-off. Essential oils can need lower rates and have phototoxicity or sensitization limits (citrus folds, cinnamon, etc.).\n\nPPD (parts per diem / dermal limits) and IFRA categories are legal/safety frameworks from FO suppliers — always read the document for that SKU. Some FOs ricing, accelerate, or discolor (vanillin → brown). Test small.',
      },
    ],
  },
  {
    id: 'soap-palm-free',
    title: 'Palm-free formulating',
    category: 'soap',
    tags: ['palm free', 'tallow', 'stearic', 'sustainability'],
    summary: 'Replacing palm’s hardness and cream.',
    sections: [
      {
        body: 'Palm brings palmitic hardness and creamy bubbles. Palm-free builders often use: tallow or lard, cocoa/mango butters, stearic acid (careful usage), higher rice bran/olive with longer cure, or commercial palm-free hard oil blends.\n\nExpect reformulation — simply deleting palm and redistributing % usually softens the bar. Watch iodine and cure time. Babassu or coconut can restore some bubbles but increase dryness if pushed too high.',
      },
    ],
  },

  // ── Oils hub ───────────────────────────────────────
  {
    id: 'oils-overview',
    title: 'Oils & butters overview',
    category: 'oils',
    tags: ['oils', 'butters', 'fatty acids', 'database'],
    summary: 'How to read the oil encyclopedia.',
    sections: [
      {
        body: 'Every oil in the calculator has SAP (NaOH), optional iodine & INS, category, suggested max %, hardness/conditioning/lather tags, and a wiki blurb. Open any oil article from this category list or search by name (olive, shea, castor…).\n\nFatty-acid intuition:\n• Lauric/myristic (coconut, palm kernel, babassu) — hard, bubbly, cleansing\n• Palmitic/stearic (palm, tallow, cocoa) — hard, stable, creamy\n• Oleic (olive, avocado, high-oleic oils) — conditioning, slower trace\n• Linoleic/linolenic (grapeseed, hemp, safflower) — silky, softer, higher rancidity risk',
      },
      {
        heading: 'Balanced starter profile',
        body: 'Many teaching recipes look like: 25–40% soft conditioning oil, 20–30% hard bubbly (coconut family), 20–30% hard creamy (palm/tallow/butter), 5% castor for bubbles. Adjust for climate, scent, and skin goals.',
      },
    ],
  },
  {
    id: 'oils-lauric',
    title: 'Lauric oils: coconut family',
    category: 'oils',
    tags: ['coconut', 'babassu', 'palm kernel', 'lauric', 'drying'],
    summary: 'Bubbles, hardness, and the dryness tradeoff.',
    sections: [
      {
        body: 'Coconut, palm kernel, babassu, and fractionated coconut sit in the lauric camp. They saponify to very hard, white, high-lather soap. Skin strip risk rises as their combined % climbs — especially with low superfat.\n\nGuidelines many soapers use: keep combined lauric oils near or under ~30% for face/body bars; higher for laundry, shaving with care, or salt bars with generous superfat. Fractionated coconut has a very high SAP — weigh meticulously.',
      },
    ],
  },
  {
    id: 'oils-butters',
    title: 'Butters: shea, cocoa, mango',
    category: 'oils',
    tags: ['shea', 'cocoa', 'mango', 'butter', 'luxury'],
    summary: 'When and how much butter to use.',
    sections: [
      {
        body: 'Shea: conditioning, creamy, can slow trace and add “slime” lather in a good way; often 5–20%. Unrefined has scent/color.\nCocoa: hardness + snappy bar, chocolate aroma if unrefined; 5–15% common. Helps palm-free hardness.\nMango: between shea and cocoa for many soapers; elegant skin feel.\n\nButters can seize with some FRs and need full melt. Too much butter without enough bubbly oils makes a hard but weak-lather bar.',
      },
    ],
  },
  {
    id: 'oils-castor-jojoba',
    title: 'Castor, jojoba & specialty',
    category: 'oils',
    tags: ['castor', 'jojoba', 'neem', 'meadowfoam', 'beeswax'],
    summary: 'Small-dose power players.',
    sections: [
      {
        body: 'Castor (ricinoleic) boosts fluffy lather and humectant feel — 2–8% is the sweet spot; higher gets sticky.\nJojoba is a liquid wax ester, low SAP, luxurious; expensive — often 1–5% or in superfats.\nNeem: medicinal reputation, strong odor; low %.\nMeadowfoam: stable, silky, premium.\nBeeswax: hardens and adds drag; low SAP; 1–3% typical or bars feel waxy.\nArgan/macadamia/apricot: conditioning accents in the soft-oil slot.',
      },
    ],
  },

  // ── Candle craft ───────────────────────────────────
  {
    id: 'candle-basics',
    title: 'Candle making fundamentals',
    category: 'candle',
    tags: ['basics', 'process', 'melt', 'pour'],
    summary: 'The loop: melt, scent, wick, pour, test.',
    sections: [
      {
        body: 'Core loop: choose wax system → size wax to vessel fill weight → select wick family → melt gently → add FO at recommended temp → mix thoroughly → pour at pour temp → finish tops → cure → test burn → adjust wick/FO/pour.\n\nHeat wax in a dedicated melter or double boiler with a thermometer. Never leave melting wax unattended. Keep FO away from open flame; know flash points.',
      },
    ],
  },
  {
    id: 'candle-fragrance-load',
    title: 'Fragrance load & throw',
    category: 'candle',
    tags: ['fragrance', 'cold throw', 'hot throw', 'load', 'sweating'],
    summary: 'Why % FO is not “more is better”.',
    sections: [
      {
        body: 'Fragrance load is FO weight ÷ wax weight × 100. Cold throw = scent of unlit candle; hot throw = scent while burning. Excess FO can sweat, clog wicks, soot, or violate IFRA.\n\nStay inside your wax brand’s tested max and the FO supplier’s candle category limit (use the lower of the two). Cure time matters — soy especially needs days to weeks before you judge throw. Mix FO long enough (often ~2 minutes) for even binding.',
      },
    ],
  },
  {
    id: 'candle-wicking',
    title: 'Wick theory & test burns',
    category: 'candle',
    tags: ['wick', 'test burn', 'tunneling', 'mushrooming'],
    summary: 'Diameter is only the first guess.',
    sections: [
      {
        body: 'Wick size depends on wax blend, FO (some make flames lazy), colorants, vessel diameter and shape, and ambient conditions. App hints by diameter are starting points for ECO/CD-like families — not prescriptions.\n\nTest burn: trim to ~¼", burn on level surface, aim for full melt pool to the edge in ~2–4 hours for many containers without a raging flame. Tunneling → hotter wick or correct FO/wax. Mushrooming/sooting → smaller wick, FO issues, or drafts.\n\nWide vessels often need dual or triple wicks rather than one huge wick.',
      },
    ],
  },
  {
    id: 'candle-vessels-tops',
    title: 'Vessels, tops & defects',
    category: 'candle',
    tags: ['wet spots', 'frosting', 'sinkholes', 'jump lines', 'vessels'],
    summary: 'Cosmetic issues and practical fixes.',
    sections: [
      {
        body: 'Wet spots (soy glass adhesion): temperature, glass prep, and expectations — often cosmetic.\nFrosting (soy crystal bloom): natural for many soy lines; texture or color choices hide it.\nSinkholes / craters: pour temp, cool rate; poke relief holes and top-off pours while warm.\nJump lines: pour hotter or insulated cool.\n\nWeigh wax for fill height rather than trusting jar “oz” labels — fluid oz ≠ wax weight oz. Vessel presets in the app use approximate fill weights.',
      },
    ],
  },
  {
    id: 'candle-safety-use',
    title: 'Candle burn safety (end user)',
    category: 'candle',
    tags: ['burn safety', 'label', 'fire'],
    summary: 'What belongs on every retail candle.',
    sections: [
      {
        body: 'Label basics people actually read: never leave burning candle unattended; keep away from kids/pets/drafts/curtains; trim wick; don’t burn to the extreme bottom; max burn session (e.g. 4 hours); surface must be heat-safe.\n\nAs a maker: document batch codes, FO lot numbers, and test results. Glass can fail from thermal shock — quality vessels matter.',
      },
    ],
  },

  // ── Waxes hub ─────────────────────────────────────
  {
    id: 'waxes-overview',
    title: 'Wax types compared',
    category: 'waxes',
    tags: ['soy', 'paraffin', 'beeswax', 'coconut', 'gel', 'palm', 'blend'],
    summary: 'Pick a system before you pick a scent.',
    sections: [
      {
        body: 'Soy — plant marketing, creamy, often milder throw, frosting/wet spots common, wick carefully.\nParaffin — strong throw, predictable, various melt points for container vs pillar.\nPara-soy / coconut blends — aim for hybrid performance; follow that brand’s FO max.\nBeeswax — high melt, honey scent, low FO ceiling, excellent pillars/tapers.\nPalm wax — crystalline tops, ethical sourcing questions, unique aesthetic.\nGel — mineral oil polymer; gel-safe FO only; different wick and safety profile.\n\nOpen individual wax articles for pour temps and FO bands used in the calculator.',
      },
    ],
  },
  {
    id: 'waxes-cure',
    title: 'Cure times by wax family',
    category: 'waxes',
    tags: ['cure', 'wait', 'throw'],
    summary: 'When to trust your nose.',
    sections: [
      {
        body: 'Rough cure before final judgment:\n• Many paraffins / para-soy: 3–7 days\n• Soy & coconut-soy: 7–14 days (some FOs longer)\n• Beeswax: evaluate early for burn; scent is subtle\n• Gel: per brand, often shorter cosmetic set, still test burn\n\nHot throw testing requires a real burn cycle, not only sniffing the jar cold.',
      },
    ],
  },

  // ── Safety ─────────────────────────────────────────
  {
    id: 'safety-lye',
    title: 'Lye safety (NaOH / KOH)',
    category: 'safety',
    tags: ['lye', 'naoh', 'koh', 'ppe', 'chemical burn'],
    summary: 'Non-negotiable handling rules.',
    sections: [
      {
        body: 'Sodium hydroxide and potassium hydroxide cause severe chemical burns and eye damage. Work like a chemist on purpose.\n\n• PPE: side-shield goggles or face shield, gloves, long sleeves, closed shoes; apron smart.\n• Always add lye to water — never water to lye (volcanic splash risk).\n• Mix in heat-safe, lye-safe containers (HDPE, stainless, etc. — know your plastic).\n• Fumes on mixing: ventilate; don’t bend your face over the pitcher.\n• Vinegar is not a first-aid magic wash for eyes — flush with water and seek medical help. Weak acid neutralization on skin is debated; priority is copious water and medical care for serious exposure.\n• Store lye locked, labeled, dry, away from aluminum and kids/pets.\n• Clean tools dedicated to soap; keep food separate.',
      },
    ],
  },
  {
    id: 'safety-process',
    title: 'Soap room & process safety',
    category: 'safety',
    tags: ['workspace', 'children', 'pets', 'cleanup'],
    summary: 'Batch day discipline.',
    sections: [
      {
        body: 'Clear the space of kids, pets, and clutter. No drinking cups that look like lye water. Label pitchers. Keep paper towels and a plan for spills (contain, then careful cleanup with PPE).\n\nFresh soap batter is still caustic until saponification advances — treat molded soap with respect for 24–48+ hours. Zap test / pH habits vary by maker; uncured bars are not mild facial cleansers.\n\nDispose of lye water per local hazardous guidance — not casually down storm drains.',
      },
    ],
  },
  {
    id: 'safety-candle-shop',
    title: 'Candle studio safety',
    category: 'safety',
    tags: ['fire', 'wax fire', 'ventilation', 'fo'],
    summary: 'Heat, wax, and fragrance hazards.',
    sections: [
      {
        body: 'Wax fires: never quench with water — it can splatter burning wax. Lid/smother and call emergency services if needed. Keep a rated extinguisher.\n\nThermostat control beats “guess the microwave.” FO is flammable — add off direct flame, know flash points, ventilate strong scents. Dye and FO staining is real; protect surfaces.\n\nErgonomics: repetitive pouring and heavy pour pots — plan lifts. Label everything that isn’t water.',
      },
    ],
  },

  // ── Reference ──────────────────────────────────────
  {
    id: 'ref-formulas',
    title: 'Formulas used by this app',
    category: 'reference',
    tags: ['math', 'formula', 'sap', 'koh factor'],
    summary: 'Transparent calculator math.',
    sections: [
      {
        body: 'Soap pure lye (NaOH) = Σ (oil_weight × sap_naoh)\nSoap pure lye (KOH) = Σ (oil_weight × sap_naoh × 1.4027)\nLye with superfat = pure_lye × (1 − superfat%/100)\nWater (% oils) = total_oils × (water%/100)\nWater (concentration c) = lye_with_sf × (1−c)/c\nWater (discount d) = total_oils × 0.38 × (1−d/100)\nSoap FO = total_oils × (fo%/100)\n\nCandle FO = total_wax × (fo%/100)\nDye blocks ≈ (wax_lb) × (blocks_per_lb)\n\nWeighted iodine/INS = weight-average of oils that have values.',
      },
    ],
  },
  {
    id: 'ref-glossary',
    title: 'Glossary',
    category: 'reference',
    tags: ['glossary', 'dictionary', 'terms'],
    summary: 'CP, HP, trace, throw, SAP, and friends.',
    sections: [
      {
        body: 'CP — cold process soap\nHP — hot process soap\nTrace — emulsified batter thickness stage\nSAP — saponification value\nSF — superfat\nDOS — dreaded orange spots (oxidation)\nFO — fragrance oil\nEO — essential oil\nIFRA — International Fragrance Association usage standards\nCold/hot throw — unlit vs lit candle scent\nMelt pool — liquid wax disc while burning\nTunnelling — wax left on walls from weak wick\nCPOP — cold process oven process\nGel phase — heated gel through soap loaf\nINS / iodine — traditional quality heuristics\nPKO — palm kernel oil\n',
      },
    ],
  },
  {
    id: 'ref-troubleshooting-soap',
    title: 'Soap troubleshooting',
    category: 'reference',
    tags: ['troubleshooting', 'seize', 'separation', 'soft bar'],
    summary: 'Common failures and likely causes.',
    sections: [
      {
        body: 'Seize / rice / apple sauce — FO reaction, temp, or over-blending; work fast or switch FO; soap on.\nSeparation — incomplete emulsion; stick blend more; worst cases may need rebatch.\nSoft bar after cure — high soft oils, high SF, high water, humid cure; reformulate harder, longer cure.\nGrabby / lye-heavy feel — weighing error or bad SAP; do not use on skin; rebatch with care or discard safely.\nDOS — high unsaturation, metals, heat/light; add ROE next time, store cool, check oils.\n partial gel / glycerin rivers — thermal; cosmetic or adjust insulation.',
      },
    ],
  },
  {
    id: 'ref-troubleshooting-candle',
    title: 'Candle troubleshooting',
    category: 'reference',
    tags: ['troubleshooting', 'soot', 'sweat', 'weak throw'],
    summary: 'Burn and appearance fixes.',
    sections: [
      {
        body: 'Weak hot throw — cure longer, wick up carefully, FO quality/load, vessel diameter, room size.\nSoot / huge flame — wick down, trim, drafts, FO overload.\nSweating FO — load too high for wax, temp swing storage, FO compatibility.\nSinkholes — top-off, pour temp, wick poke while setting.\nCrack tops — cool slower, pour temp, or gentle warm room.\nWick drowns — wick too small or FO clogging; try different wick series.',
      },
    ],
  },
  {
    id: 'ref-disclaimer',
    title: 'Disclaimer',
    category: 'reference',
    tags: ['disclaimer', 'legal', 'liability'],
    summary: 'Craft planning tool — not lab certification.',
    sections: [
      {
        body: 'Alex\'s Craft Calc provides educational craft math and general information. SAP values, FO ranges, wick hints, and wiki articles are starting points compiled for makers — not a substitute for supplier COAs, IFRA docs, SDS, local regulations, or professional lab testing. You are responsible for safe handling of lye, hot wax, and fragrances, and for the safety of products you give or sell. When in doubt, test small and verify with primary sources.',
      },
    ],
  },
]

/** Build per-oil articles from the oil database. */
export function oilArticlesFromDb(
  oils: {
    id: string
    name: string
    category: string
    sapNaoh: number
    iodine?: number
    ins?: number
    notes?: string
    maxPct?: number
    hardness?: string
    conditioning?: string
    lather?: string
    traits?: string[]
    wiki?: string
  }[],
): WikiArticle[] {
  return oils.map((o) => ({
    id: `oil-${o.id}`,
    title: o.name,
    category: 'oils' as const,
    tags: [o.name.toLowerCase(), o.id, o.category, ...(o.traits ?? []), 'oil', 'sap'],
    summary: o.notes || o.wiki?.slice(0, 90) || `${o.name} soap oil profile`,
    sections: [
      {
        body:
          o.wiki ||
          `${o.name} is available in the soap calculator. Verify SAP with your supplier.`,
      },
      {
        heading: 'Calculator specs',
        body: [
          `NaOH SAP: ${o.sapNaoh} g/g (KOH ≈ ${(o.sapNaoh * 1.4027).toFixed(4)})`,
          o.iodine != null ? `Iodine value: ${o.iodine}` : null,
          o.ins != null ? `INS: ${o.ins}` : null,
          o.maxPct != null ? `Typical max in a balanced bar: ~${o.maxPct}%` : null,
          o.hardness ? `Hardness contribution: ${o.hardness}` : null,
          o.conditioning ? `Conditioning: ${o.conditioning}` : null,
          o.lather ? `Lather character: ${o.lather}` : null,
          o.traits?.length ? `Traits: ${o.traits.join(', ')}` : null,
          o.notes ? `Short note: ${o.notes}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  }))
}

/** Build per-wax articles from the wax database. */
export function waxArticlesFromDb(
  waxes: {
    id: string
    name: string
    type: string
    fragranceMin: number
    fragranceMax: number
    fragranceTypical: number
    meltPointF?: number
    pourTempF?: number
    notes?: string
    wiki?: string
    bestFor?: string[]
    cureDays?: string
    wickNotes?: string
  }[],
): WikiArticle[] {
  return waxes.map((w) => ({
    id: `wax-${w.id}`,
    title: w.name,
    category: 'waxes' as const,
    tags: [w.name.toLowerCase(), w.id, w.type, 'wax', 'candle', 'fo'],
    summary: w.notes || w.wiki?.slice(0, 90) || `${w.name} candle profile`,
    sections: [
      {
        body:
          w.wiki ||
          `${w.name} profile used for fragrance range and pour hints in the candle calculator.`,
      },
      {
        heading: 'Calculator specs',
        body: [
          `Type: ${w.type}`,
          `Fragrance load band: ${w.fragranceMin}–${w.fragranceMax}% (typical ${w.fragranceTypical}%)`,
          w.meltPointF != null ? `Melt point ~${w.meltPointF}°F` : null,
          w.pourTempF != null ? `Pour temp ~${w.pourTempF}°F` : null,
          w.cureDays ? `Cure guidance: ${w.cureDays}` : null,
          w.bestFor?.length ? `Best for: ${w.bestFor.join(', ')}` : null,
          w.wickNotes ? `Wick notes: ${w.wickNotes}` : null,
          w.notes ? `Short note: ${w.notes}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  }))
}

export function buildFullWiki(
  oils: Parameters<typeof oilArticlesFromDb>[0],
  waxes: Parameters<typeof waxArticlesFromDb>[0],
): WikiArticle[] {
  const dynamic = [...oilArticlesFromDb(oils), ...waxArticlesFromDb(waxes)]
  // Static first, then dynamic encyclopedias
  return [...WIKI_ARTICLES, ...dynamic]
}

export function searchWiki(articles: WikiArticle[], query: string): WikiArticle[] {
  const q = query.trim().toLowerCase()
  if (!q) return articles
  const parts = q.split(/\s+/).filter(Boolean)
  return articles.filter((a) => {
    const hay = [a.title, a.summary, a.id, a.category, ...a.tags, ...a.sections.map((s) => s.body)]
      .join(' ')
      .toLowerCase()
    return parts.every((p) => hay.includes(p))
  })
}
