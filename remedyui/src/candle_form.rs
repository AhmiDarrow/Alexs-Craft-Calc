//! The candle calculator's form, ported line for line from `CandleCalculator.tsx`.

use serde_json::{Map, Value, json};

use crate::candle::{self, CandleInput, CandleResult};
use crate::data;
use crate::js;
use crate::soap::Unit;
use crate::storage::CandleRecipe;

/// The candle form: fields as typed.
#[derive(Clone, Debug, PartialEq)]
pub struct CandleForm {
    pub wax_id: String,
    pub vessel_count: String,
    pub wax_per_vessel: String,
    pub use_total_wax: bool,
    pub total_wax: String,
    pub fragrance_pct: String,
    pub dye_blocks_per_lb: String,
    pub unit: Unit,
    pub vessel_diameter_in: String,
    pub vessel_preset_id: String,
    pub recipe_name: String,
    pub recipe_notes: String,
    pub active_recipe_id: Option<String>,
    pub show_saved: bool,
}

fn pf0(s: &str) -> f64 {
    js::or(js::parse_float(s), 0.0)
}

impl Default for CandleForm {
    fn default() -> Self {
        Self::new()
    }
}

impl CandleForm {
    /// The form as the app opens.
    pub fn new() -> CandleForm {
        CandleForm {
            wax_id: "soy-111".into(),
            vessel_count: "4".into(),
            wax_per_vessel: "200".into(),
            use_total_wax: false,
            total_wax: "800".into(),
            fragrance_pct: "8".into(),
            dye_blocks_per_lb: "1".into(),
            unit: Unit::G,
            vessel_diameter_in: "3".into(),
            vessel_preset_id: "custom".into(),
            recipe_name: String::new(),
            recipe_notes: String::new(),
            active_recipe_id: None,
            show_saved: false,
        }
    }

    /// The candle math's input.
    pub fn input(&self) -> CandleInput {
        CandleInput {
            wax_id: self.wax_id.clone(),
            vessel_count: js::or(js::parse_int(&self.vessel_count), 1.0),
            wax_per_vessel: pf0(&self.wax_per_vessel),
            use_total_wax: self.use_total_wax,
            total_wax: pf0(&self.total_wax),
            fragrance_pct: pf0(&self.fragrance_pct),
            dye_blocks_per_lb: pf0(&self.dye_blocks_per_lb),
            unit: self.unit,
            vessel_diameter_in: pf0(&self.vessel_diameter_in),
        }
    }

    /// The batch results.
    pub fn result(&self) -> CandleResult {
        candle::calculate(&self.input())
    }

    /// Wax chosen: the fragrance load moves to its typical value.
    pub fn on_wax_change(&mut self, id: &str) {
        self.wax_id = id.to_owned();
        if let Some(w) = data::wax(id) {
            self.fragrance_pct = js::to_string(w.fragrance_typical);
        }
    }

    /// A vessel preset: wax per vessel and a typical diameter.
    pub fn apply_vessel_preset(&mut self, id: &str) {
        self.vessel_preset_id = id.to_owned();
        let Some(p) = data::vessel(id) else { return };
        if p.fill_oz <= 0.0 {
            return;
        }
        let wax = candle::from_oz(p.fill_oz, self.unit);
        self.use_total_wax = false;
        self.wax_per_vessel = js::to_string(js::round(wax * 100.0) / 100.0);
        let d = if id.starts_with("pillar-3") {
            Some("3")
        } else {
            match id {
                "tealight" => Some("1.5"),
                "votive" => Some("1.75"),
                "4oz" => Some("2.5"),
                "6oz" => Some("2.75"),
                "8oz" | "9oz" => Some("3"),
                "10oz" | "12oz" => Some("3.25"),
                "16oz" => Some("3.5"),
                _ => None,
            }
        };
        if let Some(d) = d {
            self.vessel_diameter_in = d.into();
        }
    }

    /// Unit changed: the wax amounts convert, to two decimals.
    pub fn on_unit_change(&mut self, next: Unit) {
        if next == self.unit {
            return;
        }
        let unit = self.unit;
        let convert = |val: &str| -> String {
            let n = js::parse_float(val);
            if !n.is_finite() {
                return val.to_owned();
            }
            let oz = match unit {
                Unit::Oz => n,
                Unit::G => n / 28.349523125,
                Unit::Lb => n * 16.0,
            };
            let out = match next {
                Unit::Oz => oz,
                Unit::G => oz * 28.349523125,
                Unit::Lb => oz / 16.0,
            };
            js::to_string(js::round(out * 100.0) / 100.0)
        };
        self.wax_per_vessel = convert(&self.wax_per_vessel);
        self.total_wax = convert(&self.total_wax);
        self.unit = next;
    }

    /// Reset. Returns the toast.
    pub fn reset_defaults(&mut self) -> String {
        let show = self.show_saved;
        *self = CandleForm::new();
        self.show_saved = show;
        "Candle calculator reset".into()
    }

    /// The name Save uses when none is typed (`Soy Wax (container) ×4`).
    pub fn default_name(&self) -> String {
        format!("{} ×{}", data::wax(&self.wax_id).map_or("Candle", |w| w.name.as_str()), self.vessel_count)
    }

    /// The fields Save writes.
    pub fn save_payload(&self) -> Value {
        let name = match js::trim(&self.recipe_name) {
            "" => self.default_name(),
            n => n.to_owned(),
        };
        let mut m = Map::new();
        m.insert("name".into(), json!(name));
        m.insert("waxId".into(), json!(self.wax_id));
        m.insert("vesselCount".into(), json!(js::or(js::parse_int(&self.vessel_count), 1.0)));
        m.insert("waxPerVessel".into(), json!(pf0(&self.wax_per_vessel)));
        m.insert("useTotalWax".into(), json!(self.use_total_wax));
        m.insert("totalWax".into(), json!(pf0(&self.total_wax)));
        m.insert("fragrancePct".into(), json!(pf0(&self.fragrance_pct)));
        m.insert("dyeBlocksPerLb".into(), json!(pf0(&self.dye_blocks_per_lb)));
        m.insert("unit".into(), json!(self.unit.as_str()));
        m.insert("vesselDiameterIn".into(), json!(pf0(&self.vessel_diameter_in)));
        m.insert("vesselPresetId".into(), json!(self.vessel_preset_id));
        let notes = js::trim(&self.recipe_notes);
        if !notes.is_empty() {
            m.insert("notes".into(), json!(notes));
        }
        if let Some(id) = &self.active_recipe_id {
            m.insert("id".into(), json!(id));
        }
        Value::Object(m)
    }

    /// Loads a saved recipe. Returns the toast.
    pub fn load_recipe(&mut self, r: &CandleRecipe) -> String {
        self.wax_id = r.wax_id.clone();
        self.vessel_count = js::to_string(r.vessel_count);
        self.wax_per_vessel = js::to_string(r.wax_per_vessel);
        self.use_total_wax = r.use_total_wax;
        self.total_wax = js::to_string(r.total_wax);
        self.fragrance_pct = js::to_string(r.fragrance_pct);
        self.dye_blocks_per_lb = js::to_string(r.dye_blocks_per_lb);
        self.unit = Unit::parse(&r.unit).unwrap_or(Unit::G);
        self.vessel_diameter_in = js::to_string(r.vessel_diameter_in);
        self.vessel_preset_id = r.vessel_preset_id.clone().unwrap_or_else(|| "custom".into());
        self.recipe_name = r.name.clone();
        self.recipe_notes = r.notes.clone().unwrap_or_default();
        self.active_recipe_id = Some(r.id.clone());
        self.show_saved = false;
        format!("Loaded “{}”", r.name)
    }

    /// The plain-text batch sheet.
    pub fn format_recipe_text(&self) -> String {
        let r = self.result();
        let u = self.unit.as_str();
        let s = js::to_string;
        let wax_name = data::wax(&self.wax_id).map_or(self.wax_id.as_str(), |w| w.name.as_str());
        let lines = [
            Some("Alex's Craft Calc — Candle".to_owned()),
            (!self.recipe_name.is_empty()).then(|| format!("Name: {}", self.recipe_name)),
            Some(format!("Wax: {wax_name}")),
            Some(format!("Vessels: {}", self.vessel_count)),
            Some(if self.use_total_wax {
                format!("Total wax: {} {u}", s(r.total_wax))
            } else {
                format!("Wax / vessel: {} {u}", s(r.per_vessel.wax))
            }),
            Some(format!("FO load: {}% → {} {u} total", self.fragrance_pct, s(r.fragrance))),
            Some(format!("FO / vessel: {} {u}", s(r.per_vessel.fragrance))),
            Some(format!("Batch total: {} {u}", s(r.total_batch))),
            Some(format!("Dye blocks est.: {}", s(r.dye_blocks))),
            Some(format!("Diameter: {}\"", self.vessel_diameter_in)),
            Some(format!("Wick: {}", r.wick_hint)),
            (!r.pour_hint.is_empty()).then(|| format!("Pour: {}", r.pour_hint)),
            (!r.warnings.is_empty()).then(|| format!("Warnings: {}", r.warnings.join(" | "))),
            {
                let n = js::trim(&self.recipe_notes);
                (!n.is_empty()).then(|| format!("Notes:\n{n}"))
            },
        ];
        lines.into_iter().flatten().filter(|l| !l.is_empty()).collect::<Vec<_>>().join("\n")
    }

    /// The fragrance load is inside the wax's band.
    pub fn fo_in_range(&self) -> bool {
        let p = js::parse_float(&self.fragrance_pct);
        data::wax(&self.wax_id).is_some_and(|w| p >= w.fragrance_min && p <= w.fragrance_max)
    }

    /// Sets the fragrance load to the wax's minimum, typical or maximum.
    pub fn set_fo(&mut self, which: FoPreset) {
        if let Some(w) = data::wax(&self.wax_id) {
            self.fragrance_pct = js::to_string(match which {
                FoPreset::Min => w.fragrance_min,
                FoPreset::Typical => w.fragrance_typical,
                FoPreset::Max => w.fragrance_max,
            });
        }
    }
}

/// The quick fragrance buttons.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FoPreset {
    Min,
    Typical,
    Max,
}
