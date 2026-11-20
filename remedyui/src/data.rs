//! The craft reference data: oils, fatty acids, additives, waxes, vessels and the wiki's
//! hand-written articles. It is exported from the shipped app's `src/data/*.ts` by
//! `tools/export-data.ts`, so both apps read the same numbers.

use std::collections::BTreeMap;
use std::sync::OnceLock;

use serde::Deserialize;

/// A soap oil or butter.
#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Oil {
    pub id: String,
    pub name: String,
    pub category: String,
    pub sap_naoh: f64,
    pub iodine: Option<f64>,
    pub ins: Option<f64>,
    pub notes: Option<String>,
    pub max_pct: Option<f64>,
    pub wiki: Option<String>,
    pub traits: Option<Vec<String>>,
    pub hardness: Option<String>,
    pub conditioning: Option<String>,
    pub lather: Option<String>,
}

/// The fatty acids of the quality profile, in the order the app sums them.
pub const FATTY_ACIDS: [&str; 11] = [
    "caprylic",
    "capric",
    "lauric",
    "myristic",
    "palmitic",
    "stearic",
    "ricinoleic",
    "oleic",
    "linoleic",
    "linolenic",
    "palmitoleic",
];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct OilsFile {
    koh_factor: f64,
    koh_purity: f64,
    oils: Vec<Oil>,
    fatty_acids: BTreeMap<String, BTreeMap<String, f64>>,
}

/// Typical usage as % of total oils.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
pub struct Usage {
    pub min: f64,
    pub max: f64,
}

/// A soap additive (clay, oats, milk, salt…).
#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Additive {
    pub id: String,
    pub name: String,
    pub category: String,
    pub usage_pct: Usage,
    pub ppo: Option<String>,
    pub g_per_tsp: Option<f64>,
    pub phase: String,
    pub benefits: String,
    pub cautions: Option<String>,
    pub water_note: Option<String>,
    pub lye_note: Option<String>,
    pub wiki: String,
}

/// An additive category and its label.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct Category {
    pub id: String,
    pub label: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AdditivesFile {
    default_g_per_tsp: f64,
    categories: Vec<Category>,
    additives: Vec<Additive>,
}

/// A candle wax profile.
#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Wax {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub fragrance_min: f64,
    pub fragrance_max: f64,
    pub fragrance_typical: f64,
    pub melt_point_f: Option<f64>,
    pub pour_temp_f: Option<f64>,
    pub notes: Option<String>,
    pub wiki: Option<String>,
    pub best_for: Option<Vec<String>>,
    pub cure_days: Option<String>,
    pub wick_notes: Option<String>,
}

/// A vessel preset (approximate wax fill).
#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Vessel {
    pub id: String,
    pub label: String,
    pub fill_oz: f64,
    pub diameter_in: Option<f64>,
}

#[derive(Deserialize)]
struct WaxesFile {
    waxes: Vec<Wax>,
    vessels: Vec<Vessel>,
}

/// A wiki category.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct WikiCategory {
    pub id: String,
    pub label: String,
    pub icon: String,
}

/// A section of a wiki article.
#[derive(Clone, Debug, Deserialize, PartialEq, serde::Serialize)]
pub struct WikiSection {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub heading: Option<String>,
    pub body: String,
}

/// A wiki article.
#[derive(Clone, Debug, Deserialize, PartialEq, serde::Serialize)]
pub struct WikiArticle {
    pub id: String,
    pub title: String,
    pub category: String,
    pub tags: Vec<String>,
    pub summary: String,
    pub sections: Vec<WikiSection>,
}

/// A quality-profile metric and its balanced-bar range.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct QualityDef {
    pub key: String,
    pub label: String,
    pub min: f64,
    pub max: f64,
    pub hint: String,
}

#[derive(Deserialize)]
struct QualityFile {
    qualities: Vec<QualityDef>,
}

#[derive(Deserialize)]
struct WikiFile {
    categories: Vec<WikiCategory>,
    articles: Vec<WikiArticle>,
}

/// Every table the app reads.
pub struct Data {
    pub koh_factor: f64,
    pub koh_purity: f64,
    pub oils: Vec<Oil>,
    pub fatty_acids: BTreeMap<String, BTreeMap<String, f64>>,
    pub default_g_per_tsp: f64,
    pub additive_categories: Vec<Category>,
    pub additives: Vec<Additive>,
    pub waxes: Vec<Wax>,
    pub vessels: Vec<Vessel>,
    pub wiki_categories: Vec<WikiCategory>,
    pub wiki_articles: Vec<WikiArticle>,
    pub qualities: Vec<QualityDef>,
}

fn parse<T: serde::de::DeserializeOwned>(name: &str, text: &str) -> T {
    match serde_json::from_str(text) {
        Ok(v) => v,
        // The files are compiled in and checked by tests; a broken one is a build defect.
        Err(e) => panic!("data/{name} is not valid: {e}"),
    }
}

/// The data, read once.
pub fn data() -> &'static Data {
    static DATA: OnceLock<Data> = OnceLock::new();
    DATA.get_or_init(|| {
        let o: OilsFile = parse("oils.json", include_str!("../data/oils.json"));
        let a: AdditivesFile = parse("additives.json", include_str!("../data/additives.json"));
        let w: WaxesFile = parse("waxes.json", include_str!("../data/waxes.json"));
        let k: WikiFile = parse("wiki.json", include_str!("../data/wiki.json"));
        let q: QualityFile = parse("quality.json", include_str!("../data/quality.json"));
        Data {
            koh_factor: o.koh_factor,
            koh_purity: o.koh_purity,
            oils: o.oils,
            fatty_acids: o.fatty_acids,
            default_g_per_tsp: a.default_g_per_tsp,
            additive_categories: a.categories,
            additives: a.additives,
            waxes: w.waxes,
            vessels: w.vessels,
            wiki_categories: k.categories,
            wiki_articles: k.articles,
            qualities: q.qualities,
        }
    })
}

/// `getOil(id)`.
pub fn oil(id: &str) -> Option<&'static Oil> {
    data().oils.iter().find(|o| o.id == id)
}

/// `getAdditive(id)`.
pub fn additive(id: &str) -> Option<&'static Additive> {
    data().additives.iter().find(|a| a.id == id)
}

/// `getWax(id)`.
pub fn wax(id: &str) -> Option<&'static Wax> {
    data().waxes.iter().find(|w| w.id == id)
}

/// `getVessel(id)`.
pub fn vessel(id: &str) -> Option<&'static Vessel> {
    data().vessels.iter().find(|v| v.id == id)
}

/// The fatty-acid profile of an oil (empty when unknown).
pub fn fatty_acids(id: &str) -> Option<&'static BTreeMap<String, f64>> {
    data().fatty_acids.get(id)
}

/// `additiveGramsPerTsp(id)`.
pub fn additive_grams_per_tsp(id: &str) -> f64 {
    match additive(id).and_then(|a| a.g_per_tsp) {
        Some(g) if g.is_finite() && g > 0.0 => g,
        _ => data().default_g_per_tsp,
    }
}

/// `additiveUsageStatus(pct, usage)`: `low`, `good`, `high` or `n/a`.
pub fn additive_usage_status(pct_of_oils: f64, usage: Usage) -> &'static str {
    if !pct_of_oils.is_finite() || pct_of_oils <= 0.0 {
        return "n/a";
    }
    if pct_of_oils < usage.min {
        return "low";
    }
    if pct_of_oils > usage.max {
        return "high";
    }
    "good"
}
