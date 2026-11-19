//! Candle math, ported operation for operation from the shipped app's
//! `src/lib/candleCalc.ts` (tests/parity.rs checks every result).

use serde::{Deserialize, Serialize};

use crate::data::{self, Wax};
use crate::js;
use crate::soap::Unit;

/// What the candle math needs.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CandleInput {
    pub wax_id: String,
    pub vessel_count: f64,
    pub wax_per_vessel: f64,
    pub use_total_wax: bool,
    pub total_wax: f64,
    pub fragrance_pct: f64,
    pub dye_blocks_per_lb: f64,
    pub unit: Unit,
    pub vessel_diameter_in: f64,
}

/// Per-vessel amounts.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct PerVessel {
    pub wax: f64,
    pub fragrance: f64,
    pub total: f64,
}

/// The candle math's result.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CandleResult {
    pub wax_id: Option<String>,
    pub total_wax: f64,
    pub fragrance: f64,
    pub dye_blocks: f64,
    pub total_batch: f64,
    pub per_vessel: PerVessel,
    pub wick_hint: String,
    pub pour_hint: String,
    pub warnings: Vec<String>,
}

fn round(n: f64, places: i32) -> f64 {
    js::round_to(n, places)
}

/// `toOz`.
pub fn to_oz(value: f64, unit: Unit) -> f64 {
    match unit {
        Unit::Oz => value,
        Unit::G => value / 28.349523125,
        Unit::Lb => value * 16.0,
    }
}

/// `fromOz`.
pub fn from_oz(value_oz: f64, unit: Unit) -> f64 {
    match unit {
        Unit::Oz => value_oz,
        Unit::G => value_oz * 28.349523125,
        Unit::Lb => value_oz / 16.0,
    }
}

/// `calculateCandle`.
pub fn calculate(input: &CandleInput) -> CandleResult {
    let mut warnings = Vec::new();
    let wax = data::wax(&input.wax_id);
    let raw_count = if input.vessel_count.is_finite() { input.vessel_count } else { 1.0 };
    let count = 1f64.max(js::or(raw_count.floor(), 1.0));

    let total_wax = if input.use_total_wax {
        if input.total_wax.is_finite() { 0f64.max(input.total_wax) } else { 0.0 }
    } else {
        let per = if input.wax_per_vessel.is_finite() { 0f64.max(input.wax_per_vessel) } else { 0.0 };
        per * count
    };

    if !total_wax.is_finite() || total_wax <= 0.0 {
        return CandleResult {
            wax_id: wax.map(|w| w.id.clone()),
            total_wax: 0.0,
            fragrance: 0.0,
            dye_blocks: 0.0,
            total_batch: 0.0,
            per_vessel: PerVessel { wax: 0.0, fragrance: 0.0, total: 0.0 },
            wick_hint: "Enter wax weight to get wick guidance.".into(),
            pour_hint: String::new(),
            warnings: vec!["Enter a wax weight greater than zero.".into()],
        };
    }

    let mut fo_pct = if input.fragrance_pct.is_finite() { input.fragrance_pct } else { 0.0 };
    if let Some(w) = wax {
        if fo_pct < w.fragrance_min {
            warnings.push(format!(
                "Fragrance {}% is below typical min ({}%) for {} — scent may be weak.",
                js::to_string(fo_pct),
                js::to_string(w.fragrance_min),
                w.name
            ));
        }
        if fo_pct > w.fragrance_max {
            warnings.push(format!(
                "Fragrance {}% exceeds typical max ({}%) for {} — risk of sweating / poor burn.",
                js::to_string(fo_pct),
                js::to_string(w.fragrance_max),
                w.name
            ));
        }
    }
    fo_pct = 0f64.max(15f64.min(fo_pct));

    let fragrance = total_wax * (fo_pct / 100.0);
    let total_batch = total_wax + fragrance;

    let total_oz = to_oz(total_wax, input.unit);
    let lbs = total_oz / 16.0;
    let dye_per_lb =
        if input.dye_blocks_per_lb.is_finite() { 0f64.max(input.dye_blocks_per_lb) } else { 0.0 };
    let dye_blocks = round(lbs * dye_per_lb, 2);

    let per_wax = total_wax / count;
    let per_fo = fragrance / count;

    let wick_hint = suggest_wick(input.vessel_diameter_in, wax);
    let mut pour_hint = String::new();
    if let Some(w) = wax {
        if let Some(p) = w.pour_temp_f
            && p != 0.0
        {
            pour_hint = format!("Typical pour ~{}°F", js::to_string(p));
            if let Some(m) = w.melt_point_f
                && m != 0.0
            {
                pour_hint.push_str(&format!(" · melt point ~{}°F", js::to_string(m)));
            }
        }
        if let Some(n) = w.notes.as_deref().filter(|n| !n.is_empty()) {
            pour_hint = if pour_hint.is_empty() { n.to_owned() } else { format!("{pour_hint} · {n}") };
        }
    }

    CandleResult {
        wax_id: wax.map(|w| w.id.clone()),
        total_wax: round(total_wax, 2),
        fragrance: round(fragrance, 2),
        dye_blocks,
        total_batch: round(total_batch, 2),
        per_vessel: PerVessel {
            wax: round(per_wax, 2),
            fragrance: round(per_fo, 2),
            total: round(per_wax + per_fo, 2),
        },
        wick_hint,
        pour_hint,
        warnings,
    }
}

/// `suggestWick`: a rough single-wick starting point by jar diameter.
pub fn suggest_wick(diameter_in: f64, wax: Option<&Wax>) -> String {
    if !diameter_in.is_finite() || diameter_in <= 0.0 {
        return "Set vessel diameter for a rough single-wick starting point (always test burn).".into();
    }
    let d = diameter_in;
    let series = "ECO / CD / LX family";
    let size = if d < 1.5 {
        "ECO 0.5–1 or CD 2–3"
    } else if d < 2.0 {
        "ECO 1–2 or CD 3–4"
    } else if d < 2.5 {
        "ECO 2–4 or CD 5–6"
    } else if d < 3.0 {
        "ECO 4–6 or CD 7–8"
    } else if d < 3.5 {
        "ECO 6–8 or CD 10–12 (or dual wick)"
    } else if d < 4.0 {
        "Dual wick ECO 4–6 or CD 6–8 each"
    } else {
        "Multi-wick recommended — test carefully"
    };
    let wax_note = wax.map(|w| format!(" for {}", w.name)).unwrap_or_default();
    format!("Ø {}\"{wax_note}: try {size} ({series}). Always perform a full test burn.", js::to_string(d))
}

/// `defaultCandleInput`.
pub fn default_input() -> CandleInput {
    CandleInput {
        wax_id: "soy-111".into(),
        vessel_count: 4.0,
        wax_per_vessel: 200.0,
        use_total_wax: false,
        total_wax: 800.0,
        fragrance_pct: 8.0,
        dye_blocks_per_lb: 1.0,
        unit: Unit::G,
        vessel_diameter_in: 3.0,
    }
}
