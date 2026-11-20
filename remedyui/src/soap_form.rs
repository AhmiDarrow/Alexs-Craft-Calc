//! The soap calculator's form: every field as the text the person typed (as the React
//! component kept it), and every handler of `SoapCalculator.tsx` ported line for line, so
//! the same edits give the same fields, lock state and results. The UI binds widgets to it;
//! tests drive it directly (tests/parity.rs replays scripted edits against the original).

use serde_json::{Map, Value, json};

use crate::data;
use crate::js;
use crate::soap::{
    self, AdditiveLine, AmountUnit, Lye, OilLine, QualityMetric, SoapInput, SoapResult, Unit, WaterMethod,
};
use crate::storage::SoapRecipe;

/// A preset oil formula (grams).
pub struct Preset {
    pub name: &'static str,
    pub oils: &'static [(&'static str, f64)],
}

/// The presets offered beside Custom.
pub const PRESETS: [Preset; 5] = [
    Preset { name: "Castile-ish", oils: &[("olive", 1000.0)] },
    Preset {
        name: "Everyday Bar",
        oils: &[("olive", 400.0), ("coconut", 250.0), ("palm", 250.0), ("castor", 100.0)],
    },
    Preset {
        name: "Creamy Shea",
        oils: &[
            ("olive", 350.0),
            ("coconut", 250.0),
            ("shea", 200.0),
            ("rice-bran", 150.0),
            ("castor", 50.0),
        ],
    },
    Preset {
        name: "Palm-free",
        oils: &[("olive", 400.0), ("coconut", 250.0), ("tallow", 250.0), ("castor", 50.0), ("shea", 50.0)],
    },
    Preset {
        name: "Luxury Butter",
        oils: &[
            ("olive", 300.0),
            ("coconut", 200.0),
            ("shea", 150.0),
            ("cocoa", 150.0),
            ("avocado", 150.0),
            ("castor", 50.0),
        ],
    },
];

/// `fmtNum(n, places)`: rounded the JavaScript way and written as `String(n)` writes it.
pub fn fmt_num(n: f64, places: i32) -> String {
    if !n.is_finite() {
        return "0".into();
    }
    js::to_string(js::round(n * js::pow10(places)) / js::pow10(places))
}

/// Where a quality value sits on its bar: the ideal band always spans 25–75%.
pub fn quality_bar_pos(value: Option<f64>, min: f64, max: f64) -> f64 {
    let span = max - min;
    match value {
        Some(v) if span > 0.0 && v.is_finite() => 0f64.max(100f64.min(25.0 + ((v - min) / span) * 50.0)),
        _ => 0.0,
    }
}

/// An oil row: the oil and the weight and % as typed.
#[derive(Clone, Debug, PartialEq)]
pub struct OilRow {
    pub key: u64,
    pub oil_id: String,
    pub amount: String,
    pub pct: String,
}

/// An additive row.
#[derive(Clone, Debug, PartialEq)]
pub struct AdditiveRow {
    pub key: u64,
    pub additive_id: String,
    pub amount: String,
    pub amount_unit: AmountUnit,
}

/// The soap form.
#[derive(Clone, Debug, PartialEq)]
pub struct SoapForm {
    pub rows: Vec<OilRow>,
    pub lye_type: Lye,
    pub superfat_pct: String,
    pub water_method: WaterMethod,
    pub water_as_percent_of_oils: String,
    pub lye_concentration_pct: String,
    pub water_discount_pct: String,
    pub fragrance_pct: String,
    pub unit: Unit,
    /// The recipe ceiling: never rewritten when oils change.
    pub total_oils_weight: String,
    pub recipe_name: String,
    pub recipe_notes: String,
    pub additive_rows: Vec<AdditiveRow>,
    /// The library slot being edited (Save updates it).
    pub active_recipe_id: Option<String>,
    /// The saved list is open.
    pub show_saved: bool,
    next_key: u64,
}

/// How a row's additive amount compares with its usage range, for the row's status chip.
#[derive(Clone, Debug, PartialEq)]
pub struct AdditiveRowView {
    /// `ok`, `low`, `high` or `n/a`.
    pub status: &'static str,
    pub label: String,
    pub title: String,
    pub meta: Vec<String>,
}

fn pf(s: &str) -> f64 {
    js::parse_float(s)
}

fn pf0(s: &str) -> f64 {
    js::or(pf(s), 0.0)
}

impl Default for SoapForm {
    fn default() -> Self {
        Self::new()
    }
}

impl SoapForm {
    /// The form as the app opens: the everyday bar in ounces.
    pub fn new() -> SoapForm {
        let d = soap::default_input();
        let ceiling = d.oils.iter().fold(0.0, |s, o| s + o.amount);
        let mut f = SoapForm {
            rows: Vec::new(),
            lye_type: Lye::Naoh,
            superfat_pct: "5".into(),
            water_method: WaterMethod::PercentOils,
            water_as_percent_of_oils: "33".into(),
            lye_concentration_pct: "33".into(),
            water_discount_pct: "0".into(),
            fragrance_pct: "3".into(),
            unit: Unit::Oz,
            total_oils_weight: fmt_num(ceiling, 4),
            recipe_name: String::new(),
            recipe_notes: String::new(),
            additive_rows: Vec::new(),
            active_recipe_id: None,
            show_saved: false,
            next_key: 1,
        };
        f.rows = f.rows_from_weight_oils(&d.oils, ceiling);
        f
    }

    fn key(&mut self) -> u64 {
        self.next_key += 1;
        self.next_key
    }

    fn rows_from_weight_oils(&mut self, oils: &[OilLine], ceiling: f64) -> Vec<OilRow> {
        let pcts = soap::percents_from_oils(oils, (ceiling > 0.0).then_some(ceiling));
        oils.iter()
            .enumerate()
            .map(|(i, o)| OilRow {
                key: self.key(),
                oil_id: o.oil_id.clone(),
                amount: js::to_string(o.amount),
                pct: fmt_num(pcts.get(i).copied().unwrap_or(0.0), 2),
            })
            .collect()
    }

    fn rows_from_percent_oils(&mut self, lines: &[(String, f64)], ceiling: f64) -> Vec<OilRow> {
        let oils = soap::oils_from_percents(ceiling, lines);
        oils.iter()
            .enumerate()
            .map(|(i, o)| OilRow {
                key: self.key(),
                oil_id: o.oil_id.clone(),
                amount: fmt_num(o.amount, 4),
                pct: fmt_num(lines.get(i).map_or(0.0, |l| l.1), 2),
            })
            .collect()
    }

    /// The unit's label.
    pub fn u(&self) -> &'static str {
        self.unit.as_str()
    }

    /// `parsedTotalOils`.
    pub fn parsed_total_oils(&self) -> f64 {
        pf0(&self.total_oils_weight)
    }

    /// The sum of the oil weights (rows with an oil chosen).
    pub fn weight_sum(&self) -> f64 {
        self.rows.iter().fold(0.0, |s, r| {
            if r.oil_id.is_empty() {
                return s;
            }
            let a = pf(&r.amount);
            s + if a.is_finite() && a > 0.0 { a } else { 0.0 }
        })
    }

    /// The sum of the oil percentages.
    pub fn pct_sum(&self) -> f64 {
        let p: Vec<f64> = self.rows.iter().filter(|r| !r.oil_id.is_empty()).map(|r| pf0(&r.pct)).collect();
        soap::sum_oil_percents(&p)
    }

    /// The percentages total 100.
    pub fn pct_ok(&self) -> bool {
        soap::is_percent_total_locked(self.pct_sum())
    }

    /// How far the percentages are from 100.
    pub fn pct_delta(&self) -> f64 {
        js::round((self.pct_sum() - 100.0) * 100.0) / 100.0
    }

    /// The weights add up to the ceiling.
    pub fn weights_ok(&self) -> bool {
        let t = self.parsed_total_oils();
        let amounts: Vec<f64> =
            self.rows.iter().filter(|r| !r.oil_id.is_empty()).map(|r| pf0(&r.amount)).collect();
        t > 0.0 && soap::weights_match_ceiling(&amounts, t)
    }

    /// How far the weights are from the ceiling.
    pub fn weight_delta(&self) -> f64 {
        js::round((self.weight_sum() - self.parsed_total_oils()) * 10000.0) / 10000.0
    }

    /// The oils as typed, for the lye math.
    pub fn resolved_oils(&self) -> Vec<OilLine> {
        self.rows
            .iter()
            .filter(|r| !r.oil_id.is_empty())
            .map(|r| OilLine { oil_id: r.oil_id.clone(), amount: pf0(&r.amount) })
            .collect()
    }

    /// The soap math's input.
    pub fn input(&self) -> SoapInput {
        SoapInput {
            oils: self.resolved_oils(),
            lye_type: self.lye_type,
            superfat_pct: pf0(&self.superfat_pct),
            water_method: self.water_method,
            water_as_percent_of_oils: pf0(&self.water_as_percent_of_oils),
            lye_concentration_pct: js::or(pf(&self.lye_concentration_pct), 33.0),
            water_discount_pct: pf0(&self.water_discount_pct),
            fragrance_pct: pf0(&self.fragrance_pct),
            unit: self.unit,
            additives: self
                .additive_rows
                .iter()
                .filter(|r| !r.additive_id.is_empty() && pf0(&r.amount) > 0.0)
                .map(|r| AdditiveLine {
                    additive_id: r.additive_id.clone(),
                    amount: soap::additive_amount_in_recipe_unit(
                        pf0(&r.amount),
                        r.amount_unit,
                        self.unit,
                        &r.additive_id,
                    ),
                })
                .collect(),
        }
    }

    /// Why results are locked (empty when they are not).
    pub fn lock_warnings(&self) -> Vec<String> {
        let mut w = Vec::new();
        let t = self.parsed_total_oils();
        if !(t > 0.0) {
            w.push("Enter a Total oils weight — that is the recipe ceiling.".to_owned());
        }
        let pct_sum = self.pct_sum();
        if !self.pct_ok() {
            w.push(if pct_sum == 0.0 {
                "Enter oil weights or percentages that total 100% of Total oils.".to_owned()
            } else {
                format!(
                    "Oil percentages must total 100% of Total oils before results unlock (currently {}%).",
                    fmt_num(pct_sum, 2)
                )
            });
        } else if !self.weights_ok() {
            let u = self.u();
            w.push(format!(
                "Oil weights must add up to Total oils ({} {u}) — currently {} {u}.",
                fmt_num(t, 4),
                fmt_num(self.weight_sum(), 4)
            ));
        }
        w
    }

    /// The batch results (locked while oils do not match the ceiling).
    pub fn result(&self) -> SoapResult {
        let lock = self.lock_warnings();
        if !lock.is_empty() {
            return soap::empty_locked_result(lock);
        }
        soap::calculate(&self.input())
    }

    /// The quality profile shown with unlocked results.
    pub fn quality(&self, result: &SoapResult) -> Vec<QualityMetric> {
        if result.locked {
            return Vec::new();
        }
        soap::quality_profile(&self.resolved_oils(), result.weighted_iodine, result.weighted_ins)
    }

    /// Saturated : unsaturated, with unlocked results.
    pub fn sat_ratio(&self, result: &SoapResult) -> Option<(f64, f64)> {
        (!result.locked).then(|| soap::sat_ratio(&self.resolved_oils()))
    }

    /// Weight edited: only that row's % follows, from the ceiling.
    pub fn update_row_weight(&mut self, key: u64, amount: &str) {
        let t = self.parsed_total_oils();
        if let Some(r) = self.rows.iter_mut().find(|r| r.key == key) {
            let a = pf(amount);
            let pct = if t > 0.0 && a.is_finite() {
                soap::pct_of_ceiling(if a > 0.0 { a } else { 0.0 }, t)
            } else {
                0.0
            };
            r.amount = amount.to_owned();
            r.pct = fmt_num(pct, 2);
        }
    }

    /// % edited: only that row's weight follows, from the ceiling.
    pub fn update_row_pct(&mut self, key: u64, pct: &str) {
        let t = self.parsed_total_oils();
        if let Some(r) = self.rows.iter_mut().find(|r| r.key == key) {
            let p = pf(pct);
            let amount = if t > 0.0 && p.is_finite() {
                soap::amount_from_ceiling_pct(if p > 0.0 { p } else { 0.0 }, t)
            } else {
                0.0
            };
            r.pct = pct.to_owned();
            r.amount = fmt_num(amount, 4);
        }
    }

    /// Oil chosen for a row.
    pub fn update_row_oil(&mut self, key: u64, oil_id: &str) {
        if let Some(r) = self.rows.iter_mut().find(|r| r.key == key) {
            r.oil_id = oil_id.to_owned();
        }
    }

    /// `+ Add oil`.
    pub fn add_row(&mut self) -> u64 {
        let key = self.key();
        self.rows.push(OilRow { key, oil_id: String::new(), amount: "0".into(), pct: "0".into() });
        key
    }

    /// `+ Additive` (or a pick from the add list).
    pub fn add_additive_row(&mut self, additive_id: &str) -> u64 {
        let key = self.key();
        self.additive_rows.push(AdditiveRow {
            key,
            additive_id: additive_id.to_owned(),
            amount: String::new(),
            amount_unit: self.unit.into(),
        });
        key
    }

    /// Additive chosen (the typed amount stays).
    pub fn update_additive_id(&mut self, key: u64, additive_id: &str) {
        if let Some(r) = self.additive_rows.iter_mut().find(|r| r.key == key) {
            r.additive_id = additive_id.to_owned();
        }
    }

    /// Additive amount typed.
    pub fn update_additive_amount(&mut self, key: u64, amount: &str) {
        if let Some(r) = self.additive_rows.iter_mut().find(|r| r.key == key) {
            r.amount = amount.to_owned();
        }
    }

    /// Additive entry unit changed: the same mass in the new unit.
    pub fn update_additive_amount_unit(&mut self, key: u64, next: AmountUnit) {
        if let Some(r) = self.additive_rows.iter_mut().find(|r| r.key == key) {
            if r.amount_unit == next {
                return;
            }
            let n = pf(&r.amount);
            if !n.is_finite() || js::trim(&r.amount).is_empty() {
                r.amount_unit = next;
                return;
            }
            let converted = soap::convert_additive_amount_unit(n, r.amount_unit, next, &r.additive_id);
            r.amount_unit = next;
            r.amount = fmt_num(converted, if next.is_volume() { 3 } else { 4 });
        }
    }

    /// Removes an additive row.
    pub fn remove_additive_row(&mut self, key: u64) {
        self.additive_rows.retain(|r| r.key != key);
    }

    /// Removes an oil row (other oils and the ceiling stay).
    pub fn remove_row(&mut self, key: u64) {
        self.rows.retain(|r| r.key != key);
    }

    /// A preset (authored in grams) in the current unit. Returns the toast.
    pub fn apply_preset(&mut self, preset: &Preset) -> String {
        let converted: Vec<OilLine> = preset
            .oils
            .iter()
            .map(|(id, g)| OilLine {
                oil_id: (*id).to_owned(),
                amount: soap::convert_weight(*g, Unit::G, self.unit),
            })
            .collect();
        let total = converted.iter().fold(0.0, |s, o| s + o.amount);
        self.total_oils_weight = fmt_num(total, 4);
        self.rows = self.rows_from_weight_oils(&converted, total);
        self.additive_rows.clear();
        self.recipe_name = preset.name.to_owned();
        self.active_recipe_id = None;
        format!("{} loaded", preset.name)
    }

    /// Custom: an empty recipe that keeps the unit, lye, water and ceiling.
    pub fn start_custom_recipe(&mut self) -> String {
        let t = self.parsed_total_oils();
        let total = if t > 0.0 {
            t
        } else {
            match self.unit {
                Unit::Lb => 2.0,
                Unit::Oz => 32.0,
                Unit::G => 1000.0,
            }
        };
        self.rows.clear();
        self.additive_rows.clear();
        self.total_oils_weight = fmt_num(total, 4);
        self.recipe_name = "Custom".into();
        self.recipe_notes.clear();
        self.active_recipe_id = None;
        self.show_saved = false;
        "Custom — empty recipe. Add oils; Total oils is the ceiling".into()
    }

    /// Total oils edited: each oil keeps its % and its weight follows the new ceiling.
    pub fn on_total_oils_change(&mut self, value: &str) {
        let prev = self.parsed_total_oils();
        let next = pf0(value);
        self.total_oils_weight = value.to_owned();
        if !(next > 0.0) {
            return;
        }
        for r in &mut self.rows {
            let pct = pf(&r.pct);
            let mut use_pct = if pct.is_finite() { pct } else { 0.0 };
            if !(use_pct > 0.0) && prev > 0.0 {
                use_pct = soap::pct_of_ceiling(pf0(&r.amount), prev);
            }
            r.pct = fmt_num(use_pct, 2);
            r.amount =
                fmt_num(soap::amount_from_ceiling_pct(if use_pct > 0.0 { use_pct } else { 0.0 }, next), 4);
        }
    }

    /// Apply % to weights. Returns the toast.
    pub fn apply_percents_to_ceiling(&mut self) -> String {
        let target = pf(&self.total_oils_weight);
        if target == 0.0 || target.is_nan() || target <= 0.0 {
            return "Enter a Total oils weight first".into();
        }
        if !self.pct_ok() {
            return "Oil % must total 100% before applying".into();
        }
        for r in &mut self.rows {
            let pct = pf0(&r.pct);
            r.amount = fmt_num(soap::amount_from_ceiling_pct(pct, target), 4);
            r.pct = fmt_num(pct, 2);
        }
        "Weights set from % × Total oils".into()
    }

    /// Scale weights to total (keeps ratios). Returns the toast.
    pub fn scale_weights_to_ceiling(&mut self) -> String {
        let target = pf(&self.total_oils_weight);
        if target == 0.0 || target.is_nan() || target <= 0.0 {
            return "Enter a Total oils weight first".into();
        }
        let current = self.rows.iter().fold(0.0, |s, r| s + pf0(&r.amount));
        if !(current > 0.0) {
            return "Add oil weights before scaling".into();
        }
        let factor = target / current;
        for r in &mut self.rows {
            let amount = pf0(&r.amount) * factor;
            r.amount = fmt_num(amount, 4);
            r.pct = fmt_num(soap::pct_of_ceiling(amount, target), 2);
        }
        format!("Scaled oils to Total oils ({} {})", fmt_num(target, 4), self.u())
    }

    /// Recalculate: brings the oils into balance with the ceiling so the results unlock, by
    /// the fix that fits what was typed. Returns the toast.
    pub fn recalculate(&mut self) -> String {
        if self.recipe_balanced() {
            return "Results are up to date".into();
        }
        let sum = self.weight_sum();
        if !(self.parsed_total_oils() > 0.0) {
            if !(sum > 0.0) {
                return "Enter a Total oils weight or some oil weights first".into();
            }
            // No ceiling yet: the oils as typed become the batch.
            self.total_oils_weight = fmt_num(sum, 4);
            for r in self.rows.iter_mut().filter(|r| !r.oil_id.is_empty()) {
                r.pct = fmt_num(soap::pct_of_ceiling(pf0(&r.amount), sum), 2);
            }
            return format!("Total oils set to the oil weights ({} {})", fmt_num(sum, 4), self.u());
        }
        if self.pct_ok() { self.apply_percents_to_ceiling() } else { self.scale_weights_to_ceiling() }
    }

    /// Reset. Returns the toast.
    pub fn reset_defaults(&mut self) -> String {
        let d = soap::default_input();
        let total = d.oils.iter().fold(0.0, |s, o| s + o.amount);
        self.lye_type = d.lye_type;
        self.superfat_pct = js::to_string(d.superfat_pct);
        self.water_method = d.water_method;
        self.water_as_percent_of_oils = js::to_string(d.water_as_percent_of_oils);
        self.lye_concentration_pct = js::to_string(d.lye_concentration_pct);
        self.water_discount_pct = js::to_string(d.water_discount_pct);
        self.fragrance_pct = js::to_string(d.fragrance_pct);
        self.unit = d.unit;
        self.total_oils_weight = fmt_num(total, 4);
        self.rows = self.rows_from_weight_oils(&d.oils, total);
        self.recipe_name.clear();
        self.recipe_notes.clear();
        self.additive_rows.clear();
        self.active_recipe_id = None;
        "Soap calculator reset".into()
    }

    /// Unit changed: weights, the ceiling and weight-entered additives convert.
    pub fn on_unit_change(&mut self, next: Unit) {
        if next == self.unit {
            return;
        }
        let unit = self.unit;
        let st = pf(&self.total_oils_weight);
        let next_ceiling =
            if st.is_finite() && st > 0.0 { soap::convert_weight(st, unit, next) } else { 0.0 };
        for r in &mut self.rows {
            let n = pf(&r.amount);
            if !n.is_finite() {
                continue;
            }
            let amount = soap::convert_weight(n, unit, next);
            r.amount = fmt_num(amount, 4);
            r.pct =
                fmt_num(soap::pct_of_ceiling(amount, if next_ceiling > 0.0 { next_ceiling } else { 0.0 }), 2);
        }
        for r in &mut self.additive_rows {
            let Some(w) = r.amount_unit.weight() else { continue };
            let n = pf(&r.amount);
            if !n.is_finite() || js::trim(&r.amount).is_empty() {
                r.amount_unit = next.into();
                continue;
            }
            r.amount_unit = next.into();
            r.amount = fmt_num(soap::convert_weight(n, w, next), 4);
        }
        if next_ceiling > 0.0 {
            self.total_oils_weight = fmt_num(next_ceiling, 4);
        }
        self.unit = next;
    }

    /// The fields Save writes (`SoapSavePayload`), with `default_name` used when the name is
    /// blank (`Soap <date>`).
    pub fn save_payload(&self, default_name: &str) -> Value {
        let name = match js::trim(&self.recipe_name) {
            "" => default_name.to_owned(),
            n => n.to_owned(),
        };
        let oils: Vec<Value> = self
            .rows
            .iter()
            .filter(|r| !r.oil_id.is_empty())
            .map(|r| json!({ "oilId": r.oil_id, "amount": pf0(&r.amount), "pct": pf0(&r.pct) }))
            .collect();
        let additives: Vec<Value> = self
            .additive_rows
            .iter()
            .filter(|r| !r.additive_id.is_empty() && pf0(&r.amount) > 0.0)
            .map(|r| json!({ "additiveId": r.additive_id, "amount": pf0(&r.amount), "amountUnit": r.amount_unit.as_str() }))
            .collect();
        let t = self.parsed_total_oils();
        let mut m = Map::new();
        m.insert("name".into(), json!(name));
        m.insert("oils".into(), Value::Array(oils));
        m.insert("lyeType".into(), json!(self.lye_type.as_str()));
        m.insert("superfatPct".into(), json!(pf0(&self.superfat_pct)));
        m.insert("waterMethod".into(), json!(self.water_method.as_str()));
        m.insert("waterAsPercentOfOils".into(), json!(pf0(&self.water_as_percent_of_oils)));
        m.insert("lyeConcentrationPct".into(), json!(js::or(pf(&self.lye_concentration_pct), 33.0)));
        m.insert("waterDiscountPct".into(), json!(pf0(&self.water_discount_pct)));
        m.insert("fragrancePct".into(), json!(pf0(&self.fragrance_pct)));
        m.insert("unit".into(), json!(self.unit.as_str()));
        m.insert("oilEntryMode".into(), json!("dual"));
        if t > 0.0 {
            m.insert("totalOilsWeight".into(), json!(t));
        }
        let notes = js::trim(&self.recipe_notes);
        if !notes.is_empty() {
            m.insert("notes".into(), json!(notes));
        }
        m.insert("additives".into(), Value::Array(additives));
        if let Some(id) = &self.active_recipe_id {
            m.insert("id".into(), json!(id));
        }
        Value::Object(m)
    }

    /// Loads a saved recipe into the form. Returns the toast.
    pub fn load_recipe(&mut self, r: &SoapRecipe) -> String {
        let next_unit = Unit::parse(&r.unit).unwrap_or(Unit::Oz);
        let total_from_recipe = match r.total_oils_weight {
            Some(t) if t > 0.0 => t,
            _ => r.oils.iter().fold(0.0, |s, o| s + if o.amount > 0.0 { o.amount } else { 0.0 }),
        };
        let prefer_pct = r.oil_entry_mode == "percent";
        let next_rows = if prefer_pct && total_from_recipe > 0.0 {
            let lines: Vec<(String, f64)> = r
                .oils
                .iter()
                .map(|o| {
                    let pct = match o.pct {
                        Some(p) if p > 0.0 => p,
                        _ => soap::pct_of_ceiling(o.amount, total_from_recipe),
                    };
                    (o.oil_id.clone(), pct)
                })
                .collect();
            self.rows_from_percent_oils(&lines, total_from_recipe)
        } else {
            let mut rows: Vec<OilRow> = Vec::new();
            for o in &r.oils {
                let amount = if o.amount > 0.0 { o.amount } else { 0.0 };
                let pct = match o.pct {
                    Some(p) if p > 0.0 => p,
                    _ if total_from_recipe > 0.0 => soap::pct_of_ceiling(amount, total_from_recipe),
                    _ => 0.0,
                };
                let key = self.key();
                rows.push(OilRow {
                    key,
                    oil_id: o.oil_id.clone(),
                    amount: js::to_string(amount),
                    pct: fmt_num(pct, 2),
                });
            }
            if total_from_recipe > 0.0
                && rows.iter().all(|row| !(pf(&row.amount) > 0.0))
                && rows.iter().any(|row| pf(&row.pct) > 0.0)
            {
                let lines: Vec<(String, f64)> =
                    rows.iter().map(|row| (row.oil_id.clone(), pf0(&row.pct))).collect();
                rows = self.rows_from_percent_oils(&lines, total_from_recipe);
            }
            rows
        };
        self.total_oils_weight = if total_from_recipe > 0.0 {
            fmt_num(total_from_recipe, 4)
        } else {
            fmt_num(
                match self.unit {
                    Unit::Lb => 2.0,
                    Unit::Oz => 32.0,
                    Unit::G => 1000.0,
                },
                4,
            )
        };
        self.rows = next_rows;
        self.lye_type = if r.lye_type == "koh" { Lye::Koh } else { Lye::Naoh };
        self.superfat_pct = js::to_string(r.superfat_pct);
        self.water_method = WaterMethod::parse(&r.water_method).unwrap_or_default();
        self.water_as_percent_of_oils = js::to_string(r.water_as_percent_of_oils);
        self.lye_concentration_pct = js::to_string(r.lye_concentration_pct);
        self.water_discount_pct = js::to_string(r.water_discount_pct);
        self.fragrance_pct = js::to_string(r.fragrance_pct);
        self.unit = next_unit;
        self.recipe_name = r.name.clone();
        self.recipe_notes = r.notes.clone().unwrap_or_default();
        let adds = r.additives.clone().unwrap_or_default();
        self.additive_rows = adds
            .iter()
            .map(|a| {
                let key = self.key();
                AdditiveRow {
                    key,
                    additive_id: a.additive_id.clone(),
                    amount: js::to_string(a.amount),
                    amount_unit: a
                        .amount_unit
                        .as_deref()
                        .and_then(AmountUnit::parse)
                        .unwrap_or(next_unit.into()),
                }
            })
            .collect();
        self.active_recipe_id = Some(r.id.clone());
        self.show_saved = false;
        format!("Loaded “{}”", r.name)
    }

    /// The plain-text batch sheet (Copy, Share, Print).
    pub fn format_recipe_text(&self) -> String {
        let result = self.result();
        let u = self.u();
        let lye_name = self.lye_type.label();
        let oil_lines: Vec<String> = self
            .rows
            .iter()
            .filter(|r| !r.oil_id.is_empty())
            .map(|r| {
                let name = data::oil(&r.oil_id).map_or(r.oil_id.as_str(), |o| o.name.as_str());
                format!("  • {name}: {} {u} ({}%)", fmt_num(pf0(&r.amount), 4), fmt_num(pf0(&r.pct), 2))
            })
            .collect();
        let mut lines: Vec<String> = vec![
            format!(
                "Alex's Craft Calc — Soap Recipe{}",
                if self.recipe_name.is_empty() { String::new() } else { format!(": {}", self.recipe_name) }
            ),
            format!(
                "Unit: {u} · Lye: {lye_name} · Superfat: {}% · FO: {}%",
                self.superfat_pct, self.fragrance_pct
            ),
            format!("Water method: {}", self.water_method.as_str()),
            format!(
                "Total oils ceiling: {} {u}",
                js::to_string(js::or(self.parsed_total_oils(), result.total_oils))
            ),
            format!(
                "Oil weight sum: {} {u} · Oil % sum: {}%",
                fmt_num(self.weight_sum(), 4),
                fmt_num(self.pct_sum(), 2)
            ),
            String::new(),
            "Oils:".into(),
        ];
        lines.extend(oil_lines);
        let adds: Vec<&AdditiveRow> =
            self.additive_rows.iter().filter(|r| !r.additive_id.is_empty() && pf0(&r.amount) > 0.0).collect();
        if !adds.is_empty() {
            lines.push(String::new());
            lines.push("Additives:".into());
            for r in adds {
                let name = data::additive(&r.additive_id).map_or(r.additive_id.as_str(), |a| a.name.as_str());
                let amt = pf0(&r.amount);
                let as_recipe =
                    soap::additive_amount_in_recipe_unit(amt, r.amount_unit, self.unit, &r.additive_id);
                let spoon = if r.amount_unit.is_volume() && as_recipe > 0.0 {
                    format!(" (≈ {} {u})", fmt_num(as_recipe, 3))
                } else {
                    String::new()
                };
                lines.push(format!("  • {name}: {} {}{spoon}", fmt_num(amt, 4), r.amount_unit.as_str()));
            }
        }
        lines.push(String::new());
        if result.locked {
            lines.push("Results locked — oil weights/% must match Total oils ceiling (100%).".into());
        } else {
            let s = js::to_string;
            let block = [
                format!("Total oils: {} {u}", s(result.total_oils)),
                format!("{lye_name} (with SF): {} {u}", s(result.lye_with_superfat)),
                format!("Pure lye 0% SF: {} {u}", s(result.pure_lye)),
                format!("Water: {} {u}", s(result.water)),
                format!("Lye solution: {} {u}", s(result.lye_solution)),
                format!("Fragrance: {} {u}", s(result.fragrance)),
                format!("Batch total: {} {u}", s(result.total_batch)),
                result.weighted_iodine.map(|v| format!("Weighted iodine: {}", s(v))).unwrap_or_default(),
                result.weighted_ins.map(|v| format!("Weighted INS: {}", s(v))).unwrap_or_default(),
            ];
            lines.push(block.into_iter().filter(|l| !l.is_empty()).collect::<Vec<_>>().join("\n"));
        }
        let notes = js::trim(&self.recipe_notes);
        lines.push(if notes.is_empty() { String::new() } else { format!("\nNotes:\n{notes}") });
        lines.push(String::new());
        lines.push("Always add lye to water. Wear PPE. Verify SAP with supplier COA.".into());
        lines.into_iter().filter(|l| !l.is_empty()).collect::<Vec<_>>().join("\n")
    }

    /// Oils match the ceiling and total 100%.
    pub fn recipe_balanced(&self) -> bool {
        self.pct_ok() && self.weights_ok() && self.parsed_total_oils() > 0.0
    }

    /// The status line's hint.
    pub fn status_hint(&self) -> String {
        let u = self.u();
        if self.recipe_balanced() {
            return "Unlocked — matches Total oils ceiling".into();
        }
        if self.parsed_total_oils() == 0.0 {
            return "Set Total oils ceiling".into();
        }
        if !self.pct_ok() {
            let d = self.pct_delta();
            return if d > 0.0 {
                format!("{}% over 100% — locked", fmt_num(d, 2))
            } else {
                format!("{}% short of 100% — locked", fmt_num(d.abs(), 2))
            };
        }
        let d = self.weight_delta();
        if d > 0.0 {
            format!("{} {u} over ceiling — locked", fmt_num(d, 4))
        } else {
            format!("{} {u} under ceiling — locked", fmt_num(d.abs(), 4))
        }
    }

    /// The status line's totals: `Oil %: 100% · Weights: 35.274 oz / 35.274 oz`.
    pub fn status_totals(&self) -> String {
        let u = self.u();
        format!(
            "Oil %: {}% · Weights: {} {u} / {} {u}",
            fmt_num(self.pct_sum(), 2),
            fmt_num(self.weight_sum(), 4),
            fmt_num(self.parsed_total_oils(), 4)
        )
    }

    /// A row's oil goes over its typical maximum.
    pub fn row_over_max(&self, row: &OilRow) -> bool {
        let p = pf0(&row.pct);
        data::oil(&row.oil_id).and_then(|o| o.max_pct).is_some_and(|m| p > 0.0 && p > m + 0.05)
    }

    /// The usage chip and details of an additive row.
    pub fn additive_row_view(&self, row: &AdditiveRow) -> AdditiveRowView {
        let add = data::additive(&row.additive_id);
        let amt = pf0(&row.amount);
        let in_recipe = if !row.additive_id.is_empty() && amt > 0.0 {
            soap::additive_amount_in_recipe_unit(amt, row.amount_unit, self.unit, &row.additive_id)
        } else {
            0.0
        };
        let t = self.parsed_total_oils();
        let pct = if t > 0.0 && in_recipe > 0.0 { (in_recipe / t) * 100.0 } else { 0.0 };
        let usage = add.map_or("n/a", |a| data::additive_usage_status(pct, a.usage_pct));
        let s = js::to_string;
        let (label, title) = match (usage, add) {
            ("good", Some(a)) => (
                format!("OK · {}–{}%", s(a.usage_pct.min), s(a.usage_pct.max)),
                format!("Within recommended {}–{}% of oils", s(a.usage_pct.min), s(a.usage_pct.max)),
            ),
            ("low", Some(a)) => (
                format!("Low · {}–{}%", s(a.usage_pct.min), s(a.usage_pct.max)),
                format!("Below recommended {}–{}% of oils", s(a.usage_pct.min), s(a.usage_pct.max)),
            ),
            ("high", Some(a)) => (
                format!("High · max {}%", s(a.usage_pct.max)),
                format!("Above recommended {}–{}% of oils", s(a.usage_pct.min), s(a.usage_pct.max)),
            ),
            _ => ("—".into(), "Enter an amount to check usage".into()),
        };
        let mut meta = Vec::new();
        if let Some(p) = add.and_then(|a| a.ppo.clone()).filter(|p| !p.is_empty()) {
            meta.push(format!("{p} PPO"));
        }
        if let Some(a) = add.filter(|a| !a.phase.is_empty()) {
            meta.push(a.phase.clone());
        }
        if in_recipe > 0.0 && row.amount_unit.is_volume() {
            meta.push(format!("≈ {} {}", fmt_num(in_recipe, 3), self.u()));
        }
        if pct > 0.0 {
            meta.push(format!("{}% of oils", fmt_num(pct, 2)));
        }
        AdditiveRowView { status: if usage == "good" { "ok" } else { usage }, label, title, meta }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recalculate_picks_the_fix_that_fits() {
        let mut f = SoapForm::new();
        assert_eq!(f.recalculate(), "Results are up to date");
        let k = f.rows[0].key;
        f.update_row_weight(k, "999");
        assert!(!f.recipe_balanced());
        f.recalculate();
        assert!(f.recipe_balanced(), "scaled to the ceiling");
        // No ceiling: the oils as typed become the batch.
        f.total_oils_weight = String::new();
        f.recalculate();
        assert!(f.recipe_balanced(), "ceiling from the weights");
        f.rows.clear();
        f.total_oils_weight = String::new();
        assert!(f.recalculate().starts_with("Enter"));
    }
}
