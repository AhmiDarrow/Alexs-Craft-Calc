//! Cold-process soap math, ported operation for operation from the shipped app's
//! `src/lib/soapCalc.ts` so every result has the same bits (tests/parity.rs checks it).

use serde::{Deserialize, Serialize};

use crate::data::{self, FATTY_ACIDS};
use crate::js;

const G_PER_OZ: f64 = 28.349523125;
const G_PER_LB: f64 = 453.59237;

/// Grams of NaOH a gram of citric acid consumes.
pub const CITRIC_NAOH_COMP: f64 = 0.624;

/// Grams of 90% KOH a gram of citric acid consumes (`0.88 / KOH_PURITY`).
pub fn citric_koh_comp() -> f64 {
    0.88 / data::data().koh_purity
}

/// How close the oil % total must be to 100 before the lye math unlocks.
pub const PCT_TOTAL_EPS: f64 = 0.05;

/// Recipe weight unit.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Unit {
    #[default]
    G,
    Oz,
    Lb,
}

impl Unit {
    /// The unit as written in the app and in saved files.
    pub fn as_str(self) -> &'static str {
        match self {
            Unit::G => "g",
            Unit::Oz => "oz",
            Unit::Lb => "lb",
        }
    }

    /// Reads `g`, `oz` or `lb`.
    pub fn parse(s: &str) -> Option<Unit> {
        match s {
            "g" => Some(Unit::G),
            "oz" => Some(Unit::Oz),
            "lb" => Some(Unit::Lb),
            _ => None,
        }
    }

    /// Every unit, in the app's order.
    pub const ALL: [Unit; 3] = [Unit::G, Unit::Oz, Unit::Lb];
}

/// An additive's entry unit: a weight or a kitchen spoon.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AmountUnit {
    G,
    Oz,
    Lb,
    Tsp,
    Tbsp,
}

impl AmountUnit {
    /// The unit as written.
    pub fn as_str(self) -> &'static str {
        match self {
            AmountUnit::G => "g",
            AmountUnit::Oz => "oz",
            AmountUnit::Lb => "lb",
            AmountUnit::Tsp => "tsp",
            AmountUnit::Tbsp => "tbsp",
        }
    }

    /// Reads a unit name.
    pub fn parse(s: &str) -> Option<AmountUnit> {
        match s {
            "g" => Some(AmountUnit::G),
            "oz" => Some(AmountUnit::Oz),
            "lb" => Some(AmountUnit::Lb),
            "tsp" => Some(AmountUnit::Tsp),
            "tbsp" => Some(AmountUnit::Tbsp),
            _ => None,
        }
    }

    /// A spoon measure.
    pub fn is_volume(self) -> bool {
        matches!(self, AmountUnit::Tsp | AmountUnit::Tbsp)
    }

    /// The weight unit, if it is one.
    pub fn weight(self) -> Option<Unit> {
        match self {
            AmountUnit::G => Some(Unit::G),
            AmountUnit::Oz => Some(Unit::Oz),
            AmountUnit::Lb => Some(Unit::Lb),
            _ => None,
        }
    }

    /// Every unit, in the app's order.
    pub const ALL: [AmountUnit; 5] =
        [AmountUnit::G, AmountUnit::Oz, AmountUnit::Lb, AmountUnit::Tsp, AmountUnit::Tbsp];
}

impl From<Unit> for AmountUnit {
    fn from(u: Unit) -> Self {
        match u {
            Unit::G => AmountUnit::G,
            Unit::Oz => AmountUnit::Oz,
            Unit::Lb => AmountUnit::Lb,
        }
    }
}

/// NaOH (bars) or KOH (liquid soap).
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Lye {
    #[default]
    Naoh,
    Koh,
}

impl Lye {
    /// `naoh` or `koh`.
    pub fn as_str(self) -> &'static str {
        match self {
            Lye::Naoh => "naoh",
            Lye::Koh => "koh",
        }
    }

    /// `NaOH` or `KOH`.
    pub fn label(self) -> &'static str {
        match self {
            Lye::Naoh => "NaOH",
            Lye::Koh => "KOH",
        }
    }
}

/// How the water amount is chosen.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WaterMethod {
    #[default]
    PercentOils,
    LyeConcentration,
    Discount,
}

impl WaterMethod {
    /// The method's saved name.
    pub fn as_str(self) -> &'static str {
        match self {
            WaterMethod::PercentOils => "percent_oils",
            WaterMethod::LyeConcentration => "lye_concentration",
            WaterMethod::Discount => "discount",
        }
    }

    /// Reads a saved name.
    pub fn parse(s: &str) -> Option<WaterMethod> {
        match s {
            "percent_oils" => Some(WaterMethod::PercentOils),
            "lye_concentration" => Some(WaterMethod::LyeConcentration),
            "discount" => Some(WaterMethod::Discount),
            _ => None,
        }
    }

    /// Every method, in the app's order.
    pub const ALL: [WaterMethod; 3] =
        [WaterMethod::PercentOils, WaterMethod::LyeConcentration, WaterMethod::Discount];
}

/// One oil and its weight in the recipe unit.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OilLine {
    pub oil_id: String,
    pub amount: f64,
}

/// One additive and its weight in the recipe unit.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdditiveLine {
    pub additive_id: String,
    pub amount: f64,
}

/// What the soap math needs.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoapInput {
    pub oils: Vec<OilLine>,
    #[serde(default)]
    pub additives: Vec<AdditiveLine>,
    pub lye_type: Lye,
    pub superfat_pct: f64,
    pub water_method: WaterMethod,
    pub water_as_percent_of_oils: f64,
    pub lye_concentration_pct: f64,
    pub water_discount_pct: f64,
    pub fragrance_pct: f64,
    pub unit: Unit,
}

/// One oil in the result.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OilBreakdown {
    pub oil_id: String,
    pub name: String,
    pub amount: f64,
    pub pct: f64,
    pub sap_used: f64,
}

/// An additive in the result, with its usage check.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdditiveResult {
    pub additive_id: String,
    pub name: String,
    pub amount: f64,
    pub pct_of_oils: f64,
    pub usage_min: f64,
    pub usage_max: f64,
    /// `ok`, `low` or `high`.
    pub status: String,
}

/// A quality-profile metric.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct QualityMetric {
    pub key: String,
    pub label: String,
    pub value: Option<f64>,
    pub min: f64,
    pub max: f64,
    /// `low`, `good` or `high`.
    pub status: String,
    pub hint: String,
}

/// The soap math's result.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoapResult {
    pub total_oils: f64,
    pub pure_lye: f64,
    pub lye_with_superfat: f64,
    pub water: f64,
    pub fragrance: f64,
    pub total_batch: f64,
    pub lye_solution: f64,
    pub oil_breakdown: Vec<OilBreakdown>,
    pub weighted_iodine: Option<f64>,
    pub weighted_ins: Option<f64>,
    pub quality: Vec<QualityMetric>,
    pub additives: Vec<AdditiveResult>,
    pub additive_total: f64,
    pub warnings: Vec<String>,
    /// Results are blanked on purpose (oils do not match the Total oils ceiling).
    #[serde(default)]
    pub locked: bool,
}

fn status_for(value: Option<f64>, min: f64, max: f64) -> &'static str {
    match value {
        None => "low",
        Some(v) if !v.is_finite() => "low",
        Some(v) if v < min => "low",
        Some(v) if v > max => "high",
        Some(_) => "good",
    }
}

/// The weighted fatty-acid profile, in [`FATTY_ACIDS`] order, and the total weight.
fn accumulate_fatty_acids(oils: &[OilLine]) -> ([f64; 11], f64) {
    let mut fa = [0f64; 11];
    let mut total = 0.0;
    for line in oils {
        // `if (!line.oilId || line.amount <= 0) continue` — NaN is not skipped there.
        if line.oil_id.is_empty() || line.amount <= 0.0 {
            continue;
        }
        let profile = data::fatty_acids(&line.oil_id);
        total += line.amount;
        for (i, k) in FATTY_ACIDS.iter().enumerate() {
            if let Some(v) = profile.and_then(|p| p.get(*k)).copied()
                && v.is_finite()
            {
                fa[i] += v * line.amount;
            }
        }
    }
    if total > 0.0 {
        for v in &mut fa {
            *v /= total;
        }
    }
    (fa, total)
}

fn fa_index(name: &str) -> usize {
    FATTY_ACIDS.iter().position(|k| *k == name).unwrap_or(0)
}

/// `computeQualityProfile`.
pub fn quality_profile(
    oils: &[OilLine],
    weighted_iodine: Option<f64>,
    weighted_ins: Option<f64>,
) -> Vec<QualityMetric> {
    let (fa, _) = accumulate_fatty_acids(oils);
    let group = |keys: &[&str]| keys.iter().fold(0.0, |s, k| s + fa[fa_index(k)]);
    data::data()
        .qualities
        .iter()
        .map(|d| {
            let value = match d.key.as_str() {
                "hardness" => {
                    Some(group(&["caprylic", "capric", "lauric", "myristic", "palmitic", "stearic"]))
                }
                "cleansing" | "bubbly" => Some(group(&["caprylic", "capric", "lauric", "myristic"])),
                "conditioning" | "mildness" => {
                    Some(group(&["oleic", "linoleic", "linolenic", "ricinoleic", "palmitoleic"]))
                }
                "creamy" => Some(group(&["palmitic", "stearic", "ricinoleic"])),
                "longevity" => Some(group(&["palmitic", "stearic"])),
                "iodine" => weighted_iodine,
                "ins" => weighted_ins,
                _ => None,
            };
            let rounded = value.map(|v| js::round_to(v, 1));
            QualityMetric {
                key: d.key.clone(),
                label: d.label.clone(),
                value: rounded,
                min: d.min,
                max: d.max,
                status: status_for(rounded, d.min, d.max).into(),
                hint: d.hint.clone(),
            }
        })
        .collect()
}

/// `computeSatRatio`: saturated : unsaturated, in whole percent.
pub fn sat_ratio(oils: &[OilLine]) -> (f64, f64) {
    let (fa, _) = accumulate_fatty_acids(oils);
    let f = |k: &str| fa[fa_index(k)];
    let sat = f("caprylic") + f("capric") + f("lauric") + f("myristic") + f("palmitic") + f("stearic");
    let unsat = f("ricinoleic") + f("oleic") + f("linoleic") + f("linolenic") + f("palmitoleic");
    let sum = sat + unsat;
    if !(sum > 0.0) {
        return (0.0, 0.0);
    }
    (js::round((sat / sum) * 100.0), js::round((unsat / sum) * 100.0))
}

fn round(n: f64, places: i32) -> f64 {
    js::round_to(n, places)
}

fn to_grams(value: f64, unit: Unit) -> f64 {
    match unit {
        Unit::G => value,
        Unit::Oz => value * G_PER_OZ,
        Unit::Lb => value * G_PER_LB,
    }
}

fn from_grams(grams: f64, unit: Unit) -> f64 {
    match unit {
        Unit::G => grams,
        Unit::Oz => grams / G_PER_OZ,
        Unit::Lb => grams / G_PER_LB,
    }
}

/// `convertWeight`.
pub fn convert_weight(value: f64, from: Unit, to: Unit) -> f64 {
    if from == to || !value.is_finite() {
        return value;
    }
    from_grams(to_grams(value, from), to)
}

/// `additiveAmountInRecipeUnit`.
pub fn additive_amount_in_recipe_unit(amount: f64, unit: AmountUnit, recipe: Unit, additive_id: &str) -> f64 {
    if !amount.is_finite() || amount <= 0.0 {
        return 0.0;
    }
    match unit.weight() {
        None => {
            let g_per_tsp = data::additive_grams_per_tsp(additive_id);
            let grams = if unit == AmountUnit::Tbsp { amount * g_per_tsp * 3.0 } else { amount * g_per_tsp };
            convert_weight(grams, Unit::G, recipe)
        }
        Some(w) => convert_weight(amount, w, recipe),
    }
}

/// `convertAdditiveAmountUnit`: the same mass in another entry unit.
pub fn convert_additive_amount_unit(amount: f64, from: AmountUnit, to: AmountUnit, additive_id: &str) -> f64 {
    if !amount.is_finite() || from == to {
        return amount;
    }
    let grams = match from.weight() {
        None => {
            amount
                * data::additive_grams_per_tsp(additive_id)
                * if from == AmountUnit::Tbsp { 3.0 } else { 1.0 }
        }
        Some(w) => to_grams(amount, w),
    };
    match to.weight() {
        None => {
            let g_per_tsp = data::additive_grams_per_tsp(additive_id);
            let denom = g_per_tsp * if to == AmountUnit::Tbsp { 3.0 } else { 1.0 };
            if denom > 0.0 { grams / denom } else { 0.0 }
        }
        Some(w) => from_grams(grams, w),
    }
}

/// `sumOilPercents`.
pub fn sum_oil_percents(pcts: &[f64]) -> f64 {
    pcts.iter().fold(0.0, |s, p| s + if p.is_finite() { *p } else { 0.0 })
}

/// `isPercentTotalLocked` (true when the total is 100% within the tolerance).
pub fn is_percent_total_locked(sum: f64) -> bool {
    sum.is_finite() && (sum - 100.0).abs() <= PCT_TOTAL_EPS
}

/// `oilsFromPercents`.
pub fn oils_from_percents(total_oils: f64, lines: &[(String, f64)]) -> Vec<OilLine> {
    if !(total_oils > 0.0) {
        return lines.iter().map(|(id, _)| OilLine { oil_id: id.clone(), amount: 0.0 }).collect();
    }
    lines
        .iter()
        .map(|(id, pct)| OilLine {
            oil_id: id.clone(),
            amount: round(total_oils * ((if pct.is_finite() { *pct } else { 0.0 }) / 100.0), 4),
        })
        .collect()
}

/// `pctOfCeiling`.
pub fn pct_of_ceiling(amount: f64, total_oils: f64) -> f64 {
    if !(total_oils > 0.0) || !amount.is_finite() || amount <= 0.0 {
        return 0.0;
    }
    round((amount / total_oils) * 100.0, 4)
}

/// `amountFromCeilingPct`.
pub fn amount_from_ceiling_pct(pct: f64, total_oils: f64) -> f64 {
    if !(total_oils > 0.0) || !pct.is_finite() || pct <= 0.0 {
        return 0.0;
    }
    round(total_oils * (pct / 100.0), 4)
}

/// `percentsFromOils`.
pub fn percents_from_oils(lines: &[OilLine], ceiling: Option<f64>) -> Vec<f64> {
    let safe = |a: f64| if a.is_finite() && a > 0.0 { a } else { 0.0 };
    if let Some(c) = ceiling
        && c > 0.0
    {
        return lines.iter().map(|l| pct_of_ceiling(safe(l.amount), c)).collect();
    }
    let total = lines.iter().fold(0.0, |s, l| s + safe(l.amount));
    if !(total > 0.0) {
        return lines.iter().map(|_| 0.0).collect();
    }
    lines.iter().map(|l| round((safe(l.amount) / total) * 100.0, 4)).collect()
}

/// `weightsMatchCeiling`.
pub fn weights_match_ceiling(amounts: &[f64], ceiling: f64) -> bool {
    if !(ceiling > 0.0) || !ceiling.is_finite() {
        return false;
    }
    if amounts.iter().any(|a| !a.is_finite()) {
        return false;
    }
    let sum = amounts.iter().fold(0.0, |s, a| s + if *a > 0.0 { *a } else { 0.0 });
    (sum - ceiling).abs() <= (ceiling * (PCT_TOTAL_EPS / 100.0)).max(1e-6)
}

/// `emptyLockedResult`.
pub fn empty_locked_result(warnings: Vec<String>) -> SoapResult {
    SoapResult {
        total_oils: 0.0,
        pure_lye: 0.0,
        lye_with_superfat: 0.0,
        water: 0.0,
        fragrance: 0.0,
        total_batch: 0.0,
        lye_solution: 0.0,
        oil_breakdown: Vec::new(),
        weighted_iodine: None,
        weighted_ins: None,
        quality: Vec::new(),
        additives: Vec::new(),
        additive_total: 0.0,
        warnings,
        locked: true,
    }
}

fn clamp(n: f64, lo: f64, hi: f64, fallback: f64) -> f64 {
    if n.is_finite() { lo.max(hi.min(n)) } else { fallback }
}

/// `calculateSoap`.
pub fn calculate(input: &SoapInput) -> SoapResult {
    let d = data::data();
    let mut warnings: Vec<String> = Vec::new();
    let mut breakdown: Vec<OilBreakdown> = Vec::new();
    let mut total_oils = 0.0;
    let mut pure_lye = 0.0;
    let (mut iodine_sum, mut ins_sum, mut iodine_weight, mut ins_weight) = (0.0, 0.0, 0.0, 0.0);

    for line in &input.oils {
        if line.oil_id.is_empty() || !line.amount.is_finite() || line.amount <= 0.0 {
            continue;
        }
        let Some(oil) = data::oil(&line.oil_id) else {
            warnings.push(format!("Unknown oil id: {}", line.oil_id));
            continue;
        };
        let amount = line.amount;
        total_oils += amount;
        let sap = match input.lye_type {
            Lye::Naoh => oil.sap_naoh,
            Lye::Koh => (oil.sap_naoh * d.koh_factor) / d.koh_purity,
        };
        pure_lye += amount * sap;
        breakdown.push(OilBreakdown {
            oil_id: oil.id.clone(),
            name: oil.name.clone(),
            amount,
            pct: 0.0,
            sap_used: sap,
        });
        if let Some(i) = oil.iodine {
            iodine_sum += i * amount;
            iodine_weight += amount;
        }
        if let Some(i) = oil.ins {
            ins_sum += i * amount;
            ins_weight += amount;
        }
    }

    if total_oils <= 0.0 {
        let mut r = empty_locked_result(vec!["Add at least one oil with a weight greater than zero.".into()]);
        r.locked = false;
        return r;
    }

    for b in &mut breakdown {
        b.pct = round((b.amount / total_oils) * 100.0, 1);
        b.amount = round(b.amount, 2);
    }

    let mut additives: Vec<AdditiveResult> = Vec::new();
    for a in &input.additives {
        if a.additive_id.is_empty() || !a.amount.is_finite() || a.amount <= 0.0 {
            continue;
        }
        let add = data::additive(&a.additive_id);
        let pct_of_oils = if total_oils > 0.0 { (a.amount / total_oils) * 100.0 } else { 0.0 };
        let min = add.map_or(0.0, |x| x.usage_pct.min);
        let max = add.map_or(100.0, |x| x.usage_pct.max);
        let mut status = "ok";
        if add.is_some() && pct_of_oils < min - 1e-9 {
            status = "low";
        } else if add.is_some() && pct_of_oils > max + 1e-9 {
            status = "high";
        }
        if let Some(add) = add {
            if pct_of_oils < min {
                warnings.push(format!(
                    "{}: below recommended usage ({}% vs {}–{}% of oils).",
                    add.name,
                    js::to_string(round(pct_of_oils, 1)),
                    js::to_string(min),
                    js::to_string(max)
                ));
            } else if pct_of_oils > max {
                warnings.push(format!(
                    "{}: above recommended usage ({}% vs {}–{}% of oils).",
                    add.name,
                    js::to_string(round(pct_of_oils, 1)),
                    js::to_string(min),
                    js::to_string(max)
                ));
            }
        }
        additives.push(AdditiveResult {
            additive_id: a.additive_id.clone(),
            name: add.map_or_else(|| a.additive_id.clone(), |x| x.name.clone()),
            amount: round(a.amount, 2),
            pct_of_oils: round(pct_of_oils, 2),
            usage_min: min,
            usage_max: max,
            status: status.into(),
        });
    }

    let citric_amount =
        additives.iter().filter(|a| a.additive_id == "citric-acid").fold(0.0, |s, a| s + a.amount);
    let citric_lye_comp = citric_amount
        * match input.lye_type {
            Lye::Naoh => CITRIC_NAOH_COMP,
            Lye::Koh => citric_koh_comp(),
        };
    if citric_lye_comp > 0.0 {
        warnings.push(format!(
            "Citric acid: added {} {} of {} to compensate for the acid.",
            js::to_string(round(citric_lye_comp, 2)),
            input.unit.as_str(),
            input.lye_type.label()
        ));
    }

    let sf = clamp(input.superfat_pct, 0.0, 20.0, 5.0) / 100.0;
    let lye_with_superfat = pure_lye * (1.0 - sf) + citric_lye_comp;

    let water = match input.water_method {
        WaterMethod::PercentOils => {
            let pct = clamp(input.water_as_percent_of_oils, 20.0, 45.0, 33.0) / 100.0;
            total_oils * pct
        }
        WaterMethod::LyeConcentration => {
            let conc = clamp(input.lye_concentration_pct, 25.0, 50.0, 33.0) / 100.0;
            lye_with_superfat * ((1.0 - conc) / conc)
        }
        WaterMethod::Discount => {
            let full = total_oils * 0.38;
            let disc = clamp(input.water_discount_pct, 0.0, 40.0, 0.0) / 100.0;
            full * (1.0 - disc)
        }
    };

    let fragrance = total_oils * (clamp(input.fragrance_pct, 0.0, 10.0, 0.0) / 100.0);
    let lye_solution = lye_with_superfat + water;
    let additive_total = additives.iter().fold(0.0, |s, a| s + a.amount);
    let total_batch = total_oils + lye_with_superfat + water + fragrance + additive_total;

    let coconutish = breakdown
        .iter()
        .filter(|b| {
            ["coconut", "palm-kernel", "babassu", "coconut-fractionated"].contains(&b.oil_id.as_str())
        })
        .fold(0.0, |s, b| s + b.pct);
    if coconutish > 40.0 {
        warnings.push(
            "High lauric oils (>40%) can be drying — consider higher superfat or more conditioning oils."
                .into(),
        );
    }
    if sf < 0.03 {
        warnings.push("Superfat under 3% leaves little buffer for measurement error.".into());
    }
    if sf > 0.1 {
        warnings.push("Superfat over 10% may soften the bar and shorten shelf life.".into());
    }

    let weighted_iodine = (iodine_weight > 0.0).then(|| round(iodine_sum / iodine_weight, 1));
    let weighted_ins = (ins_weight > 0.0).then(|| round(ins_sum / ins_weight, 1));
    let quality = quality_profile(&input.oils, weighted_iodine, weighted_ins);

    if weighted_iodine.is_some_and(|i| i > 70.0) {
        warnings.push("High iodine value — bar may go rancid faster; cure well and store cool.".into());
    }

    SoapResult {
        total_oils: round(total_oils, 2),
        pure_lye: round(pure_lye + citric_lye_comp, 2),
        lye_with_superfat: round(lye_with_superfat, 2),
        water: round(water, 2),
        fragrance: round(fragrance, 2),
        total_batch: round(total_batch, 2),
        lye_solution: round(lye_solution, 2),
        oil_breakdown: breakdown,
        weighted_iodine,
        weighted_ins,
        quality,
        additives,
        additive_total,
        warnings,
        locked: false,
    }
}

/// `defaultSoapInput`: the everyday bar (1000 g of oils) in ounces.
pub fn default_input() -> SoapInput {
    let oz = |g: f64| round(from_grams(g, Unit::Oz), 4);
    SoapInput {
        oils: vec![
            OilLine { oil_id: "olive".into(), amount: oz(400.0) },
            OilLine { oil_id: "coconut".into(), amount: oz(250.0) },
            OilLine { oil_id: "palm".into(), amount: oz(250.0) },
            OilLine { oil_id: "castor".into(), amount: oz(100.0) },
        ],
        additives: Vec::new(),
        lye_type: Lye::Naoh,
        superfat_pct: 5.0,
        water_method: WaterMethod::PercentOils,
        water_as_percent_of_oils: 33.0,
        lye_concentration_pct: 33.0,
        water_discount_pct: 0.0,
        fragrance_pct: 3.0,
        unit: Unit::Oz,
    }
}
