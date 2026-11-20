//! Saved recipes and portable recipe files, ported from the shipped app's
//! `src/lib/storage.ts`: the same validation, normalisation, name matching and file format
//! (`alex-craft-calc-recipe` version 1), so files move both ways between the two apps.
//!
//! Recipes are kept as the JSON objects they were saved as (nothing a reader does not know is
//! dropped) and read through the same normalisation the shipped app applied when it listed
//! them. Unlike the shipped app, the library has no size limit: it kept the newest 60.

use std::cell::Cell;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};

use crate::js;

/// The recipe file format id.
pub const SHARE_FORMAT: &str = "alex-craft-calc-recipe";
/// The format id of the app's earliest builds, still accepted.
pub const LEGACY_SHARE_FORMAT: &str = "alien-craft-calc-recipe";
/// The recipe file format version.
pub const SHARE_VERSION: u32 = 1;
/// The app name written into recipe files.
pub const APP_NAME: &str = "Alex's Craft Calc";

/// An oil line of a saved soap recipe.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedOil {
    pub oil_id: String,
    pub amount: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pct: Option<f64>,
}

/// An additive line of a saved soap recipe (`amount` in `amount_unit`, else the recipe unit).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedAdditive {
    pub additive_id: String,
    pub amount: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub amount_unit: Option<String>,
}

/// A saved soap recipe, normalised.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoapRecipe {
    pub id: String,
    pub name: String,
    pub saved_at: String,
    pub oils: Vec<SavedOil>,
    pub lye_type: String,
    pub superfat_pct: f64,
    pub water_method: String,
    pub water_as_percent_of_oils: f64,
    pub lye_concentration_pct: f64,
    pub water_discount_pct: f64,
    pub fragrance_pct: f64,
    pub unit: String,
    pub oil_entry_mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_oils_weight: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub additives: Option<Vec<SavedAdditive>>,
}

/// A saved candle recipe, normalised.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CandleRecipe {
    pub id: String,
    pub name: String,
    pub saved_at: String,
    pub wax_id: String,
    pub vessel_count: f64,
    pub wax_per_vessel: f64,
    pub use_total_wax: bool,
    pub total_wax: f64,
    pub fragrance_pct: f64,
    pub dye_blocks_per_lb: f64,
    pub unit: String,
    pub vessel_diameter_in: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vessel_preset_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

/* ─── Clock and ids ───────────────────────────────────────────────────── */

/// Milliseconds since 1970 (`Date.now()`), on every platform including the web.
pub fn now_ms() -> u64 {
    use remedy_ui::core::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| u64::try_from(d.as_millis()).unwrap_or(u64::MAX))
}

/// `new Date(ms).toISOString()`.
pub fn iso_from_ms(ms: u64) -> String {
    let secs = (ms / 1000) as i64;
    let millis = ms % 1000;
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    let (y, m, d) = civil_from_days(days);
    format!("{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}.{millis:03}Z", rem / 3600, (rem % 3600) / 60, rem % 60)
}

/// Days since 1970-01-01 → (year, month, day) (Howard Hinnant's algorithm).
pub fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

fn days_from_civil(y: i64, m: u32, d: u32) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y.rem_euclid(400);
    let mp = if m > 2 { m - 3 } else { m + 9 } as i64;
    let doy = (153 * mp + 2) / 5 + i64::from(d) - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// Milliseconds since 1970 of a date-time string, for the forms `Date.parse` reads
/// reliably on every engine: ISO 8601 (`2025-03-04`, `2025-03-04T10:20`, with seconds,
/// fractions, `Z` or an offset). `None` where `Date.parse` gives `NaN` for those forms.
pub fn parse_date_ms(s: &str) -> Option<i64> {
    let b = s.as_bytes();
    let num = |from: usize, len: usize| -> Option<i64> {
        let part = s.get(from..from + len)?;
        part.bytes().all(|c| c.is_ascii_digit()).then(|| part.parse().ok())?
    };
    let (year, mut i) = if b.first().is_some_and(|c| *c == b'+' || *c == b'-') {
        let y = num(1, 6)?;
        (if b[0] == b'-' { -y } else { y }, 7)
    } else {
        (num(0, 4)?, 4)
    };
    let mut month = 1;
    let mut day = 1;
    if b.get(i) == Some(&b'-') {
        month = num(i + 1, 2)?;
        i += 3;
        if b.get(i) == Some(&b'-') {
            day = num(i + 1, 2)?;
            i += 3;
        }
    }
    if !(1..=12).contains(&month) || day < 1 || day > i64::from(days_in_month(year, month as u32)) {
        return None;
    }
    let date_only = i == s.len();
    let (mut h, mut mi, mut sec, mut ms) = (0i64, 0i64, 0i64, 0i64);
    let mut offset_min: i64 = 0;
    if !date_only {
        if b.get(i) != Some(&b'T') && b.get(i) != Some(&b't') && b.get(i) != Some(&b' ') {
            return None;
        }
        h = num(i + 1, 2)?;
        if b.get(i + 3) != Some(&b':') {
            return None;
        }
        mi = num(i + 4, 2)?;
        i += 6;
        if b.get(i) == Some(&b':') {
            sec = num(i + 1, 2)?;
            i += 3;
            if b.get(i) == Some(&b'.') || b.get(i) == Some(&b',') {
                let start = i + 1;
                let mut j = start;
                while j < b.len() && b[j].is_ascii_digit() {
                    j += 1;
                }
                if j == start {
                    return None;
                }
                let frac = &s[start..j.min(start + 3)];
                ms = format!("{frac:0<3}").parse().ok()?;
                i = j;
            }
        }
        match b.get(i) {
            None => {
                // A date-time without an offset is local time in JavaScript; it still
                // parses, which is all the app checks.
            }
            Some(b'Z' | b'z') if i + 1 == s.len() => {}
            Some(c @ (b'+' | b'-')) => {
                let oh = num(i + 1, 2)?;
                let om = if b.get(i + 3) == Some(&b':') { num(i + 4, 2)? } else { num(i + 3, 2)? };
                let end = if b.get(i + 3) == Some(&b':') { i + 6 } else { i + 5 };
                if end != s.len() {
                    return None;
                }
                offset_min = (oh * 60 + om) * if *c == b'+' { 1 } else { -1 };
            }
            _ => return None,
        }
        if h > 24 || mi > 59 || sec > 59 || (h == 24 && (mi | sec | ms) != 0) {
            return None;
        }
    }
    let days = days_from_civil(year, month as u32, day as u32);
    Some(((days * 24 + h) * 60 + mi - offset_min) * 60_000 + sec * 1000 + ms)
}

fn days_in_month(y: i64, m: u32) -> u32 {
    match m {
        2 if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    }
}

thread_local! {
    static SEED: Cell<u64> = Cell::new({
        use std::hash::{BuildHasher, Hasher};
        let mut h = std::collections::hash_map::RandomState::new().build_hasher();
        h.write_u64(now_ms());
        h.finish() | 1
    });
}

fn random_u64() -> u64 {
    SEED.with(|s| {
        // xorshift64*
        let mut x = s.get();
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        s.set(x);
        x.wrapping_mul(0x2545_F491_4F6C_DD1D)
    })
}

/// `Math.random().toString(36).slice(2, 7)`: five base-36 characters.
fn random_tag() -> String {
    let mut s = js::base36(random_u64() % 36u64.pow(5));
    while s.len() < 5 {
        s.insert(0, '0');
    }
    s
}

/// A new library id for a soap recipe (`soap-<time>-<random>`).
pub fn new_soap_id() -> String {
    format!("soap-{}-{}", js::base36(now_ms()), random_tag())
}

/// A new library id for a candle recipe.
pub fn new_candle_id() -> String {
    format!("candle-{}-{}", js::base36(now_ms()), random_tag())
}

/* ─── Validation and normalisation (exactly as storage.ts) ────────────── */

fn num(v: Option<&Value>) -> Option<f64> {
    v.and_then(Value::as_f64)
}

fn is_finite_num(v: Option<&Value>) -> bool {
    matches!(v, Some(Value::Number(n)) if n.as_f64().is_some_and(f64::is_finite))
}

fn str_of(v: Option<&Value>) -> Option<&str> {
    v.and_then(Value::as_str)
}

const AMOUNT_UNITS: [&str; 5] = ["g", "oz", "lb", "tsp", "tbsp"];

/// `isSoapRecipe`.
pub fn is_soap_recipe(v: &Value) -> bool {
    let Some(o) = v.as_object() else { return false };
    if str_of(o.get("name")).is_none() || !o.get("oils").is_some_and(Value::is_array) {
        return false;
    }
    if !matches!(str_of(o.get("lyeType")), Some("naoh" | "koh")) {
        return false;
    }
    if !is_finite_num(o.get("superfatPct")) {
        return false;
    }
    if !matches!(str_of(o.get("waterMethod")), Some("percent_oils" | "lye_concentration" | "discount")) {
        return false;
    }
    if !matches!(str_of(o.get("unit")), Some("g" | "oz" | "lb")) {
        return false;
    }
    if let Some(adds) = o.get("additives") {
        let Some(adds) = adds.as_array() else { return false };
        let ok = adds.iter().all(|a| {
            let Some(a) = a.as_object() else { return false };
            if !str_of(a.get("additiveId")).is_some_and(|s| !s.is_empty()) || !is_finite_num(a.get("amount"))
            {
                return false;
            }
            match a.get("amountUnit") {
                None => true,
                Some(u) => str_of(Some(u)).is_some_and(|u| AMOUNT_UNITS.contains(&u)),
            }
        });
        if !ok {
            return false;
        }
    }
    o.get("oils").and_then(Value::as_array).is_some_and(|oils| {
        oils.iter().all(|o| {
            o.as_object().is_some_and(|o| {
                str_of(o.get("oilId")).is_some_and(|s| !s.is_empty()) && is_finite_num(o.get("amount"))
            })
        })
    })
}

/// `isCandleRecipe`.
pub fn is_candle_recipe(v: &Value) -> bool {
    let Some(o) = v.as_object() else { return false };
    str_of(o.get("name")).is_some()
        && str_of(o.get("waxId")).is_some_and(|s| !s.is_empty())
        && is_finite_num(o.get("vesselCount"))
        && is_finite_num(o.get("waxPerVessel"))
        && o.get("useTotalWax").is_some_and(Value::is_boolean)
        && is_finite_num(o.get("totalWax"))
        && is_finite_num(o.get("fragrancePct"))
        && matches!(str_of(o.get("unit")), Some("g" | "oz" | "lb"))
}

fn valid_saved_at(v: Option<&Value>) -> Option<String> {
    let s = str_of(v)?;
    parse_date_ms(s).map(|_| s.to_owned())
}

fn trimmed_notes(v: Option<&Value>) -> Option<String> {
    let s = str_of(v)?;
    let t = js::trim(s);
    (!t.is_empty()).then(|| js::slice16(t, 4000))
}

/// `normalizeSoap(r, forceNewId)`. `r` is any object the shipped app could have held.
pub fn normalize_soap(r: &Value, force_new_id: bool) -> SoapRecipe {
    let empty = Map::new();
    let o = r.as_object().unwrap_or(&empty);
    let unit = str_of(o.get("unit")).filter(|u| matches!(*u, "oz" | "lb" | "g")).unwrap_or("g");
    let oil_entry_mode = str_of(o.get("oilEntryMode"))
        .filter(|m| matches!(*m, "percent" | "weight" | "dual"))
        .unwrap_or("dual");
    let total_oils_weight = num(o.get("totalOilsWeight")).filter(|w| w.is_finite() && *w > 0.0);
    let additives: Vec<SavedAdditive> = o
        .get("additives")
        .and_then(Value::as_array)
        .map(|a| a.as_slice())
        .unwrap_or_default()
        .iter()
        .filter_map(|a| {
            let a = a.as_object()?;
            let id = str_of(a.get("additiveId")).filter(|s| !s.is_empty())?;
            let amount = num(a.get("amount")).filter(|x| x.is_finite() && *x > 0.0)?;
            let amount_unit =
                str_of(a.get("amountUnit")).filter(|u| AMOUNT_UNITS.contains(u)).map(str::to_owned);
            Some(SavedAdditive { additive_id: js::slice16(id, 60), amount, amount_unit })
        })
        .collect();
    let id = match str_of(o.get("id")) {
        Some(id) if !force_new_id && !js::trim(id).is_empty() => js::slice16(js::trim(id), 80),
        _ => new_soap_id(),
    };
    let name = if js::truthy(o.get("name")) { js::value_to_string(&o["name"]) } else { String::new() };
    let name = js::slice16(js::trim(&name), 120);
    let oils = o
        .get("oils")
        .and_then(Value::as_array)
        .map(|a| a.as_slice())
        .unwrap_or_default()
        .iter()
        .filter_map(|x| {
            let x = x.as_object()?;
            let oil_id = str_of(x.get("oilId")).filter(|s| !s.is_empty())?;
            let amount = num(x.get("amount")).filter(|a| a.is_finite())?;
            Some(SavedOil {
                oil_id: oil_id.to_owned(),
                amount,
                pct: num(x.get("pct")).filter(|p| p.is_finite()),
            })
        })
        .collect();
    let superfat = js::to_number(o.get("superfatPct"));
    SoapRecipe {
        id,
        name: if name.is_empty() { "Imported soap".into() } else { name },
        saved_at: valid_saved_at(o.get("savedAt")).unwrap_or_else(|| iso_from_ms(now_ms())),
        oils,
        lye_type: if str_of(o.get("lyeType")) == Some("koh") { "koh" } else { "naoh" }.into(),
        superfat_pct: if superfat.is_finite() { superfat } else { 5.0 },
        water_method: str_of(o.get("waterMethod"))
            .filter(|m| matches!(*m, "lye_concentration" | "discount"))
            .unwrap_or("percent_oils")
            .into(),
        water_as_percent_of_oils: js::or(js::to_number(o.get("waterAsPercentOfOils")), 33.0),
        lye_concentration_pct: js::or(js::to_number(o.get("lyeConcentrationPct")), 33.0),
        water_discount_pct: js::or(js::to_number(o.get("waterDiscountPct")), 0.0),
        fragrance_pct: js::or(js::to_number(o.get("fragrancePct")), 0.0),
        unit: unit.into(),
        oil_entry_mode: oil_entry_mode.into(),
        total_oils_weight,
        notes: trimmed_notes(o.get("notes")),
        additives: (!additives.is_empty()).then_some(additives),
    }
}

/// `normalizeCandle(r, forceNewId)`.
pub fn normalize_candle(r: &Value, force_new_id: bool) -> CandleRecipe {
    let empty = Map::new();
    let o = r.as_object().unwrap_or(&empty);
    let unit = str_of(o.get("unit")).filter(|u| matches!(*u, "oz" | "lb" | "g")).unwrap_or("g");
    let id = match str_of(o.get("id")) {
        Some(id) if !force_new_id && !js::trim(id).is_empty() => js::slice16(js::trim(id), 80),
        _ => new_candle_id(),
    };
    let name = if js::truthy(o.get("name")) { js::value_to_string(&o["name"]) } else { String::new() };
    let name = js::slice16(js::trim(&name), 120);
    let wax_id = if js::truthy(o.get("waxId")) { js::value_to_string(&o["waxId"]) } else { "soy-111".into() };
    CandleRecipe {
        id,
        name: if name.is_empty() { "Imported candle".into() } else { name },
        saved_at: valid_saved_at(o.get("savedAt")).unwrap_or_else(|| iso_from_ms(now_ms())),
        wax_id,
        vessel_count: 1f64.max(js::or(js::to_number(o.get("vesselCount")).floor(), 1.0)),
        wax_per_vessel: js::or(js::to_number(o.get("waxPerVessel")), 0.0),
        use_total_wax: js::truthy(o.get("useTotalWax")),
        total_wax: js::or(js::to_number(o.get("totalWax")), 0.0),
        fragrance_pct: js::or(js::to_number(o.get("fragrancePct")), 0.0),
        dye_blocks_per_lb: js::or(js::to_number(o.get("dyeBlocksPerLb")), 0.0),
        unit: unit.into(),
        vessel_diameter_in: js::or(js::to_number(o.get("vesselDiameterIn")), 0.0),
        vessel_preset_id: str_of(o.get("vesselPresetId"))
            .filter(|s| !s.is_empty())
            .map(|s| js::slice16(s, 40)),
        notes: trimmed_notes(o.get("notes")),
    }
}

fn sort_desc<T>(items: &mut [T], saved_at: impl Fn(&T) -> &str) {
    // Array.prototype.sort is stable; ISO timestamps order the same by code point.
    items.sort_by(|a, b| saved_at(b).cmp(saved_at(a)));
}

/// `listSoapRecipes` over stored objects: the valid ones, normalised, newest first.
pub fn list_soap(raw: &[Value]) -> Vec<SoapRecipe> {
    let mut v: Vec<SoapRecipe> =
        raw.iter().filter(|r| is_soap_recipe(r)).map(|r| normalize_soap(r, false)).collect();
    sort_desc(&mut v, |r| &r.saved_at);
    v
}

/// `listCandleRecipes` over stored objects.
pub fn list_candle(raw: &[Value]) -> Vec<CandleRecipe> {
    let mut v: Vec<CandleRecipe> =
        raw.iter().filter(|r| is_candle_recipe(r)).map(|r| normalize_candle(r, false)).collect();
    sort_desc(&mut v, |r| &r.saved_at);
    v
}

fn name_key(name: &str) -> String {
    js::trim(name).to_lowercase()
}

/// `soapNameCollision`: another saved recipe already using this name.
pub fn soap_name_collision<'a>(
    list: &'a [SoapRecipe],
    name: &str,
    active_id: Option<&str>,
) -> Option<&'a SoapRecipe> {
    let key = name_key(name);
    if key.is_empty() {
        return None;
    }
    list.iter().find(|r| name_key(&r.name) == key && active_id.is_none_or(|a| a.is_empty() || r.id != a))
}

/// `candleNameCollision`.
pub fn candle_name_collision<'a>(
    list: &'a [CandleRecipe],
    name: &str,
    active_id: Option<&str>,
) -> Option<&'a CandleRecipe> {
    let key = name_key(name);
    if key.is_empty() {
        return None;
    }
    list.iter().find(|r| name_key(&r.name) == key && active_id.is_none_or(|a| a.is_empty() || r.id != a))
}

/// The outcome of a save.
#[derive(Clone, Debug, PartialEq)]
pub struct Saved<T> {
    pub recipe: T,
    pub overwritten: bool,
}

fn to_value<T: Serialize>(v: &T) -> Value {
    serde_json::to_value(v).unwrap_or(Value::Null)
}

/// `saveSoapRecipe` on a stored library: matches by id, then by name (case-insensitive),
/// else inserts. `recipe` holds the fields to save (its `id` may be missing). Returns the
/// new stored library: the shipped app's normalised list, plus any stored objects it could
/// not read, kept rather than dropped.
pub fn save_soap(raw: &[Value], recipe: &Value) -> (Vec<Value>, Saved<SoapRecipe>) {
    let mut all = list_soap(raw);
    let key = name_key(str_of(recipe.get("name")).unwrap_or(""));
    let mut idx = None;
    if let Some(id) = str_of(recipe.get("id")).filter(|s| !s.is_empty()) {
        idx = all.iter().position(|r| r.id == id);
    }
    if idx.is_none() && !key.is_empty() {
        idx = all.iter().position(|r| name_key(&r.name) == key);
    }
    let keep_id = match idx {
        Some(i) => all[i].id.clone(),
        None => str_of(recipe.get("id")).filter(|s| !s.is_empty()).map_or_else(new_soap_id, str::to_owned),
    };
    let mut fields = recipe.as_object().cloned().unwrap_or_default();
    fields.insert("id".into(), json!(keep_id));
    fields.insert("savedAt".into(), json!(iso_from_ms(now_ms())));
    let entry = normalize_soap(&Value::Object(fields), false);
    let overwritten = idx.is_some();
    match idx {
        Some(i) => all[i] = entry.clone(),
        None => all.insert(0, entry.clone()),
    }
    sort_desc(&mut all, |r| &r.saved_at);
    let mut out: Vec<Value> = all.iter().map(to_value).collect();
    out.extend(raw.iter().filter(|r| !is_soap_recipe(r)).cloned());
    (out, Saved { recipe: entry, overwritten })
}

/// `saveCandleRecipe` on a stored library.
pub fn save_candle(raw: &[Value], recipe: &Value) -> (Vec<Value>, Saved<CandleRecipe>) {
    let mut all = list_candle(raw);
    let key = name_key(str_of(recipe.get("name")).unwrap_or(""));
    let mut idx = None;
    if let Some(id) = str_of(recipe.get("id")).filter(|s| !s.is_empty()) {
        idx = all.iter().position(|r| r.id == id);
    }
    if idx.is_none() && !key.is_empty() {
        idx = all.iter().position(|r| name_key(&r.name) == key);
    }
    let keep_id = match idx {
        Some(i) => all[i].id.clone(),
        None => str_of(recipe.get("id")).filter(|s| !s.is_empty()).map_or_else(new_candle_id, str::to_owned),
    };
    let mut fields = recipe.as_object().cloned().unwrap_or_default();
    fields.insert("id".into(), json!(keep_id));
    fields.insert("savedAt".into(), json!(iso_from_ms(now_ms())));
    let entry = normalize_candle(&Value::Object(fields), false);
    let overwritten = idx.is_some();
    match idx {
        Some(i) => all[i] = entry.clone(),
        None => all.insert(0, entry.clone()),
    }
    sort_desc(&mut all, |r| &r.saved_at);
    let mut out: Vec<Value> = all.iter().map(to_value).collect();
    out.extend(raw.iter().filter(|r| !is_candle_recipe(r)).cloned());
    (out, Saved { recipe: entry, overwritten })
}

/// `deleteSoapRecipe`.
pub fn delete_soap(raw: &[Value], id: &str) -> Vec<Value> {
    let mut out: Vec<Value> =
        list_soap(raw).into_iter().filter(|r| r.id != id).map(|r| to_value(&r)).collect();
    out.extend(raw.iter().filter(|r| !is_soap_recipe(r)).cloned());
    out
}

/// `deleteCandleRecipe`.
pub fn delete_candle(raw: &[Value], id: &str) -> Vec<Value> {
    let mut out: Vec<Value> =
        list_candle(raw).into_iter().filter(|r| r.id != id).map(|r| to_value(&r)).collect();
    out.extend(raw.iter().filter(|r| !is_candle_recipe(r)).cloned());
    out
}

/* ─── Recipe files ────────────────────────────────────────────────────── */

/// What a recipe file holds.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum PackKind {
    Soap,
    Candle,
    Library,
}

impl PackKind {
    fn as_str(self) -> &'static str {
        match self {
            PackKind::Soap => "soap",
            PackKind::Candle => "candle",
            PackKind::Library => "library",
        }
    }
}

/// A portable recipe file (`RecipeSharePack`).
pub fn share_pack(kind: PackKind, soap: &[SoapRecipe], candle: &[CandleRecipe]) -> Value {
    let mut m = Map::new();
    m.insert("format".into(), json!(SHARE_FORMAT));
    m.insert("version".into(), json!(SHARE_VERSION));
    m.insert("app".into(), json!(APP_NAME));
    m.insert("exportedAt".into(), json!(iso_from_ms(now_ms())));
    m.insert("kind".into(), json!(kind.as_str()));
    if kind != PackKind::Candle {
        m.insert("soap".into(), Value::Array(soap.iter().map(to_value).collect()));
    }
    if kind != PackKind::Soap {
        m.insert("candle".into(), Value::Array(candle.iter().map(to_value).collect()));
    }
    Value::Object(m)
}

/// `packToJson`: two-space indented JSON.
pub fn pack_to_json(pack: &Value) -> String {
    serde_json::to_string_pretty(pack).unwrap_or_default()
}

/// `safeFilename`.
pub fn safe_filename(name: &str, fallback: &str) -> String {
    let base = if name.is_empty() { fallback } else { name };
    let cleaned: String = base
        .chars()
        .filter(|c| !matches!(c, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' | '\0'..='\u{1f}'))
        .collect();
    let mut out = String::new();
    let mut in_space = false;
    for c in cleaned.chars() {
        if js::is_js_space(c) {
            if !in_space {
                out.push('-');
            }
            in_space = true;
        } else {
            out.push(c);
            in_space = false;
        }
    }
    let out = js::slice16(&out, 48);
    if out.is_empty() { fallback.to_owned() } else { out }
}

/// The file name a pack is saved under (`packFilename`); `date` is `YYYY-MM-DD`.
pub fn pack_filename(kind: PackKind, soap: &[SoapRecipe], candle: &[CandleRecipe], date: &str) -> String {
    match kind {
        PackKind::Soap if !soap.is_empty() => {
            format!("{}.alex-soap.json", safe_filename(&soap[0].name, "soap-recipe"))
        }
        PackKind::Candle if !candle.is_empty() => {
            format!("{}.alex-candle.json", safe_filename(&candle[0].name, "candle-recipe"))
        }
        _ => format!("alex-craft-library-{date}.json"),
    }
}

/// A parsed recipe file (`ImportResult` when `ok`).
#[derive(Clone, Debug, PartialEq)]
pub struct Parsed {
    pub kind: PackKind,
    pub soap: Vec<SoapRecipe>,
    pub candle: Vec<CandleRecipe>,
    pub message: String,
}

/// `parseSharePayload`: a full pack, a bare soap or candle recipe, or an array of them.
/// Imported recipes get fresh ids so they never collide with the library's.
pub fn parse_share_payload(raw: &str) -> Result<Parsed, String> {
    let trimmed = js::trim(raw.strip_prefix('\u{FEFF}').unwrap_or(raw));
    if trimmed.is_empty() {
        return Err("File is empty".into());
    }
    let Ok(data) = serde_json::from_str::<Value>(trimmed) else {
        return Err("Not valid JSON".into());
    };
    if !data.is_object() && !data.is_array() {
        return Err("Invalid recipe file".into());
    }
    if let Some(o) = data.as_object()
        && matches!(str_of(o.get("format")), Some(SHARE_FORMAT | LEGACY_SHARE_FORMAT))
    {
        let soap: Vec<SoapRecipe> = o
            .get("soap")
            .and_then(Value::as_array)
            .map(|a| a.iter().filter(|r| is_soap_recipe(r)).map(|r| normalize_soap(r, true)).collect())
            .unwrap_or_default();
        let candle: Vec<CandleRecipe> = o
            .get("candle")
            .and_then(Value::as_array)
            .map(|a| a.iter().filter(|r| is_candle_recipe(r)).map(|r| normalize_candle(r, true)).collect())
            .unwrap_or_default();
        if soap.is_empty() && candle.is_empty() {
            return Err("Recipe file has no valid recipes".into());
        }
        let kind = if str_of(o.get("kind")) == Some("library") || (!soap.is_empty() && !candle.is_empty()) {
            PackKind::Library
        } else if !soap.is_empty() {
            PackKind::Soap
        } else {
            PackKind::Candle
        };
        let message = if kind == PackKind::Library {
            format!("Library: {} soap, {} candle", soap.len(), candle.len())
        } else if soap.len() == 1 && candle.is_empty() {
            format!("Soap “{}”", soap[0].name)
        } else if candle.len() == 1 && soap.is_empty() {
            format!("Candle “{}”", candle[0].name)
        } else {
            format!("{} recipes", soap.len() + candle.len())
        };
        return Ok(Parsed { kind, soap, candle, message });
    }
    if data.is_object() && is_soap_recipe(&data) {
        let soap = vec![normalize_soap(&data, true)];
        let message = format!("Soap “{}”", soap[0].name);
        return Ok(Parsed { kind: PackKind::Soap, soap, candle: Vec::new(), message });
    }
    if data.is_object() && is_candle_recipe(&data) {
        let candle = vec![normalize_candle(&data, true)];
        let message = format!("Candle “{}”", candle[0].name);
        return Ok(Parsed { kind: PackKind::Candle, soap: Vec::new(), candle, message });
    }
    if let Some(a) = data.as_array() {
        let soap: Vec<SoapRecipe> =
            a.iter().filter(|r| is_soap_recipe(r)).map(|r| normalize_soap(r, true)).collect();
        let candle: Vec<CandleRecipe> =
            a.iter().filter(|r| is_candle_recipe(r)).map(|r| normalize_candle(r, true)).collect();
        if soap.is_empty() && candle.is_empty() {
            return Err("No recognized recipes in file".into());
        }
        let kind = if !soap.is_empty() && !candle.is_empty() {
            PackKind::Library
        } else if !soap.is_empty() {
            PackKind::Soap
        } else {
            PackKind::Candle
        };
        let message = format!("Imported {} recipes", soap.len() + candle.len());
        return Ok(Parsed { kind, soap, candle, message });
    }
    Err("Unrecognized recipe format".into())
}

/// What a merge did (`MergeImportResult`).
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Merged {
    pub soap_saved: usize,
    pub candle_saved: usize,
    pub soap_updated: usize,
    pub candle_updated: usize,
    pub last_soap: Option<SoapRecipe>,
    pub last_candle: Option<CandleRecipe>,
}

/// `mergeImportedRecipes`: saves each recipe by name, so a re-import updates instead of
/// duplicating. Returns the new soap and candle libraries.
pub fn merge_imported(
    soap_raw: &[Value],
    candle_raw: &[Value],
    parsed: &Parsed,
) -> (Vec<Value>, Vec<Value>, Merged) {
    let mut merged = Merged::default();
    let mut soap = soap_raw.to_vec();
    for r in &parsed.soap {
        let mut v = to_value(r);
        if let Some(o) = v.as_object_mut() {
            o.remove("id");
        }
        let (next, saved) = save_soap(&soap, &v);
        soap = next;
        if saved.overwritten {
            merged.soap_updated += 1;
        } else {
            merged.soap_saved += 1;
        }
        merged.last_soap = Some(saved.recipe);
    }
    let mut candle = candle_raw.to_vec();
    for r in &parsed.candle {
        let mut v = to_value(r);
        if let Some(o) = v.as_object_mut() {
            o.remove("id");
        }
        let (next, saved) = save_candle(&candle, &v);
        candle = next;
        if saved.overwritten {
            merged.candle_updated += 1;
        } else {
            merged.candle_saved += 1;
        }
        merged.last_candle = Some(saved.recipe);
    }
    (soap, candle, merged)
}

/// `formatImportSummary`.
pub fn import_summary(m: &Merged) -> String {
    let mut parts = Vec::new();
    if m.soap_saved > 0 {
        parts.push(format!("{} new soap", m.soap_saved));
    }
    if m.soap_updated > 0 {
        parts.push(format!("{} updated soap", m.soap_updated));
    }
    if m.candle_saved > 0 {
        parts.push(format!("{} new candle", m.candle_saved));
    }
    if m.candle_updated > 0 {
        parts.push(format!("{} updated candle", m.candle_updated));
    }
    if parts.is_empty() {
        return "Nothing new to import".into();
    }
    format!("Imported {}", parts.join(", "))
}

/// `packShareText`: the message that goes with a shared file.
pub fn pack_share_text(
    kind: PackKind,
    soap: &[SoapRecipe],
    candle: &[CandleRecipe],
    plain: Option<&str>,
) -> String {
    if let Some(p) = plain.map(js::trim).filter(|p| !p.is_empty()) {
        return format!("{p}\n\n— Alex's Craft Calc recipe file attached (or use Load in the app).");
    }
    match kind {
        PackKind::Soap if !soap.is_empty() => {
            let r = &soap[0];
            format!(
                "Soap recipe “{}” · {} oils · {} · SF {}%\nOpen in Alex's Craft Calc → Load",
                r.name,
                r.oils.len(),
                r.lye_type.to_uppercase(),
                js::to_string(r.superfat_pct)
            )
        }
        PackKind::Candle if !candle.is_empty() => {
            let r = &candle[0];
            format!(
                "Candle recipe “{}” · {} vessels · {}% FO\nOpen in Alex's Craft Calc → Load",
                r.name,
                js::to_string(r.vessel_count),
                js::to_string(r.fragrance_pct)
            )
        }
        _ => "Alex's Craft Calc library backup — Load this file in the app to restore recipes.".into(),
    }
}
