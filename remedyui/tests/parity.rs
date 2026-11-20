//! The port against the shipped app: tests/fixtures/parity.json.gz holds the TypeScript
//! app's own outputs for thousands of inputs and scripted edits (tools/gen-parity.ts). Every
//! number must have the same bits and every shown string the same characters.

use std::io::Read as _;
use std::sync::OnceLock;

use craft_calc::candle::{self, CandleInput};
use craft_calc::candle_form::CandleForm;
use craft_calc::soap::{self, AmountUnit, Lye, OilLine, SoapInput, Unit, WaterMethod};
use craft_calc::soap_form::{PRESETS, SoapForm, fmt_num, quality_bar_pos};
use craft_calc::storage::{self, SoapRecipe};
use craft_calc::{data, js, wiki};
use serde_json::{Value, json};

fn fixture() -> &'static Value {
    static F: OnceLock<Value> = OnceLock::new();
    F.get_or_init(|| {
        let gz = std::fs::read(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/fixtures/parity.json.gz"))
            .expect("fixture (run npx tsx remedyui/tools/gen-parity.ts)");
        let mut text = String::new();
        flate2::read::GzDecoder::new(&gz[..]).read_to_string(&mut text).expect("gzip");
        serde_json::from_str(&text).expect("json")
    })
}

fn cases(name: &str) -> &'static [Value] {
    fixture()[name].as_array().map(Vec::as_slice).unwrap_or_else(|| panic!("no {name}"))
}

/// Deep equality with JavaScript's view of JSON: numbers by value (bits), a missing key the
/// same as `null` (or `false` for flags), and keys only the port has (`hint`) skipped.
fn same(ts: &Value, rs: &Value, path: &str) -> Result<(), String> {
    match (ts, rs) {
        (Value::Number(a), Value::Number(b)) => {
            let (a, b) = (a.as_f64().unwrap_or(f64::NAN), b.as_f64().unwrap_or(f64::NAN));
            if a == b || (a.is_nan() && b.is_nan()) {
                Ok(())
            } else {
                Err(format!("{path}: ts {} vs rust {}", js::to_string(a), js::to_string(b)))
            }
        }
        (Value::Null, Value::Number(b)) if !b.as_f64().is_some_and(f64::is_finite) => Ok(()),
        (Value::Object(a), Value::Object(b)) => {
            for (k, va) in a {
                let vb = b.get(k).unwrap_or(&Value::Null);
                same(va, vb, &format!("{path}.{k}"))?;
            }
            for (k, vb) in b {
                if a.contains_key(k) || k == "hint" || vb.is_null() || *vb == Value::Bool(false) {
                    continue;
                }
                return Err(format!("{path}.{k}: only in rust ({vb})"));
            }
            Ok(())
        }
        (Value::Array(a), Value::Array(b)) => {
            if a.len() != b.len() {
                return Err(format!("{path}: length ts {} vs rust {}", a.len(), b.len()));
            }
            for (i, (x, y)) in a.iter().zip(b).enumerate() {
                same(x, y, &format!("{path}[{i}]"))?;
            }
            Ok(())
        }
        (Value::Null, Value::Bool(false)) | (Value::Bool(false), Value::Null) => Ok(()),
        (a, b) if a == b => Ok(()),
        (a, b) => Err(format!("{path}: ts {a} vs rust {b}")),
    }
}

fn check(ts: &Value, rs: &Value, what: &str) {
    if let Err(e) = same(ts, rs, what) {
        panic!("{e}");
    }
}

fn f(v: &Value) -> f64 {
    v.as_f64().unwrap_or(f64::NAN)
}

#[test]
fn numbers_print_and_round_like_javascript() {
    for c in cases("numberCases") {
        let n = f(&c["n"]);
        assert_eq!(js::to_string(n), c["s"].as_str().unwrap_or_default(), "String({n:e})");
        check(&c["r0"], &json!(js::round(n)), "Math.round");
        check(&c["r2"], &json!(js::round_to(n, 2)), "round 2");
        if let Some(s) = c["f4"].as_str() {
            assert_eq!(js::to_fixed(n, 4), s, "({n:e}).toFixed(4)");
            assert_eq!(js::to_fixed(n, 2), c["f2"].as_str().unwrap_or_default(), "({n:e}).toFixed(2)");
        }
    }
    for c in cases("parseCases") {
        let s = c["s"].as_str().unwrap_or_default();
        assert_eq!(
            js::to_string(js::parse_float(s)),
            c["pf"].as_str().unwrap_or_default(),
            "parseFloat({s:?})"
        );
        assert_eq!(js::to_string(js::parse_int(s)), c["pi"].as_str().unwrap_or_default(), "parseInt({s:?})");
        assert_eq!(
            js::to_string(js::string_to_number(s)),
            c["num"].as_str().unwrap_or_default(),
            "Number({s:?})"
        );
    }
}

fn soap_input(v: &Value) -> SoapInput {
    serde_json::from_value(v.clone()).expect("soap input")
}

#[test]
fn soap_math_matches_every_case() {
    let all = cases("soapCases");
    assert!(all.len() > 2000);
    for (i, c) in all.iter().enumerate() {
        let r = soap::calculate(&soap_input(&c["input"]));
        check(&c["result"], &serde_json::to_value(&r).expect("ser"), &format!("soap[{i}]"));
    }
}

#[test]
fn quality_and_saturation_match() {
    for (i, c) in cases("satCases").iter().enumerate() {
        let oils: Vec<OilLine> = serde_json::from_value(c["oils"].clone()).expect("oils");
        let (sat, unsat) = soap::sat_ratio(&oils);
        check(&c["sat"], &json!({ "sat": sat, "unsat": unsat }), &format!("sat[{i}]"));
    }
    for (i, c) in cases("qualityCases").iter().enumerate() {
        let oils: Vec<OilLine> = serde_json::from_value(c["oils"].clone()).expect("oils");
        let q = soap::quality_profile(&oils, Some(f(&c["iodine"])), Some(f(&c["ins"])));
        check(&c["q"], &serde_json::to_value(&q).expect("ser"), &format!("quality[{i}]"));
    }
}

fn unit(v: &Value) -> Unit {
    Unit::parse(v.as_str().unwrap_or_default()).expect("unit")
}

fn amount_unit(v: &Value) -> AmountUnit {
    AmountUnit::parse(v.as_str().unwrap_or_default()).expect("unit")
}

#[test]
fn unit_and_ceiling_helpers_match() {
    for (i, c) in cases("helperCases").iter().enumerate() {
        let p = format!("helper[{i}]");
        let (v, total, pct) = (f(&c["v"]), f(&c["total"]), f(&c["pct"]));
        let id = c["id"].as_str().unwrap_or_default();
        let lines: Vec<OilLine> = serde_json::from_value(c["lines"].clone()).expect("lines");
        check(&c["convertWeight"], &json!(soap::convert_weight(v, unit(&c["from"]), unit(&c["to"]))), &p);
        check(
            &c["addInRecipe"],
            &json!(soap::additive_amount_in_recipe_unit(v, amount_unit(&c["af"]), unit(&c["to"]), id)),
            &p,
        );
        check(
            &c["convertAdd"],
            &json!(soap::convert_additive_amount_unit(v, amount_unit(&c["af"]), amount_unit(&c["at"]), id)),
            &p,
        );
        check(&c["pctOfCeiling"], &json!(soap::pct_of_ceiling(v, total)), &p);
        check(&c["amountFromCeilingPct"], &json!(soap::amount_from_ceiling_pct(pct, total)), &p);
        let pl: Vec<(String, f64)> = lines.iter().map(|l| (l.oil_id.clone(), l.amount / 10.0)).collect();
        check(
            &c["oilsFromPercents"],
            &serde_json::to_value(soap::oils_from_percents(total, &pl)).expect("ser"),
            &p,
        );
        let with_ids = |p: Vec<f64>| -> Value {
            Value::Array(lines.iter().zip(p).map(|(l, x)| json!({ "oilId": l.oil_id, "pct": x })).collect())
        };
        check(&c["percentsCeiling"], &with_ids(soap::percents_from_oils(&lines, Some(total))), &p);
        check(&c["percentsShare"], &with_ids(soap::percents_from_oils(&lines, None)), &p);
        let amounts: Vec<f64> = lines.iter().map(|l| l.amount).collect();
        check(&c["weightsMatch"], &json!(soap::weights_match_ceiling(&amounts, total)), &p);
        let tenths: Vec<f64> = lines.iter().map(|l| l.amount / 10.0).collect();
        check(&c["sumPct"], &json!(soap::sum_oil_percents(&tenths)), &p);
        check(
            &c["usage"],
            &json!(data::additive_usage_status(v / 100.0, data::Usage { min: 1.0, max: 3.0 })),
            &p,
        );
    }
}

#[test]
fn candle_math_matches_every_case() {
    for (i, c) in cases("candleCases").iter().enumerate() {
        let input: CandleInput = serde_json::from_value(c["input"].clone()).expect("candle input");
        let r = candle::calculate(&input);
        let mut ts = c["result"].clone();
        let wax_id = ts["wax"]["id"].clone();
        if let Some(o) = ts.as_object_mut() {
            o.remove("wax");
            o.insert("waxId".into(), wax_id);
        }
        check(&ts, &serde_json::to_value(&r).expect("ser"), &format!("candle[{i}]"));
    }
    for c in cases("wickCases") {
        let wax = c["waxId"].as_str().and_then(data::wax);
        assert_eq!(candle::suggest_wick(f(&c["d"]), wax), c["wick"].as_str().unwrap_or_default());
    }
}

#[test]
fn wiki_articles_search_and_text_match() {
    let built = serde_json::to_value(wiki::build_full_wiki()).expect("ser");
    check(&fixture()["wiki"], &built, "wiki");
    for c in cases("searchCases") {
        let ids: Vec<&str> = wiki::search(wiki::articles(), c["q"].as_str().unwrap_or_default())
            .iter()
            .map(|a| a.id.as_str())
            .collect();
        check(&c["ids"], &json!(ids), "search");
    }
    for (i, c) in cases("blockCases").iter().enumerate() {
        let blocks: Vec<Value> = wiki::blocks(c["body"].as_str().unwrap_or_default())
            .into_iter()
            .map(|b| match b {
                wiki::Block::Bullets(items) => json!({ "kind": "bullets", "items": items }),
                wiki::Block::Numbered(items) => json!({ "kind": "numbered", "items": items }),
                wiki::Block::Paragraph(lines) => json!({
                    "kind": "paragraph",
                    "lines": lines.iter().map(|l| l.iter().map(|s| json!({ "text": s.text, "bold": s.bold })).collect::<Vec<_>>()).collect::<Vec<_>>()
                }),
            })
            .collect();
        check(&c["blocks"], &json!(blocks), &format!("blocks[{i}]"));
    }
}

/// Removes `id`, and `savedAt` when both sides replaced it with the time of reading.
fn comparable(ts: &Value, rs: &Value, payload: &str) -> (Value, Value) {
    let (mut a, mut b) = (ts.clone(), rs.clone());
    for v in [&mut a, &mut b] {
        if let Some(o) = v.as_object_mut() {
            o.remove("id");
        }
    }
    let kept = |v: &Value| v["savedAt"].as_str().is_some_and(|s| payload.contains(&format!("\"{s}\"")));
    if !kept(&a) && !kept(&b) {
        for v in [&mut a, &mut b] {
            if let Some(o) = v.as_object_mut() {
                o.remove("savedAt");
            }
        }
    }
    (a, b)
}

#[test]
fn recipe_files_parse_like_the_shipped_app() {
    for (i, c) in cases("parseCases2").iter().enumerate() {
        let payload = c["payload"].as_str().unwrap_or_default();
        let r = storage::parse_share_payload(payload);
        let p = format!("parse[{i}] {payload:.120}");
        match (c["ok"].as_bool() == Some(true), r) {
            (false, Err(e)) => assert_eq!(e, c["error"].as_str().unwrap_or_default(), "{p}"),
            (true, Ok(parsed)) => {
                assert_eq!(parsed.message, c["message"].as_str().unwrap_or_default(), "{p}");
                let kind = match parsed.kind {
                    storage::PackKind::Soap => "soap",
                    storage::PackKind::Candle => "candle",
                    storage::PackKind::Library => "library",
                };
                assert_eq!(kind, c["kind"].as_str().unwrap_or_default(), "{p}");
                let ts_soap = c["soap"].as_array().cloned().unwrap_or_default();
                assert_eq!(ts_soap.len(), parsed.soap.len(), "{p}");
                for (t, r) in ts_soap.iter().zip(&parsed.soap) {
                    let (a, b) = comparable(t, &serde_json::to_value(r).expect("ser"), payload);
                    check(&a, &b, &p);
                }
                let ts_candle = c["candle"].as_array().cloned().unwrap_or_default();
                assert_eq!(ts_candle.len(), parsed.candle.len(), "{p}");
                for (t, r) in ts_candle.iter().zip(&parsed.candle) {
                    let (a, b) = comparable(t, &serde_json::to_value(r).expect("ser"), payload);
                    check(&a, &b, &p);
                }
            }
            (want, got) => panic!("{p}: ts ok={want}, rust {got:?}"),
        }
    }
    for c in cases("summaryCases") {
        let m = &c["m"];
        let n = |k: &str| m[k].as_u64().unwrap_or(0) as usize;
        let merged = storage::Merged {
            soap_saved: n("soapSaved"),
            candle_saved: n("candleSaved"),
            soap_updated: n("soapUpdated"),
            candle_updated: n("candleUpdated"),
            ..Default::default()
        };
        assert_eq!(storage::import_summary(&merged), c["s"].as_str().unwrap_or_default());
    }
}

fn soap_snapshot(m: &SoapForm, toast: &str) -> Value {
    let result = m.result();
    let quality: Vec<Value> = m
        .quality(&result)
        .iter()
        .map(|q| {
            let mut v = serde_json::to_value(q).expect("ser");
            v["bar"] = json!(quality_bar_pos(q.value, q.min, q.max));
            v
        })
        .collect();
    json!({
        "rows": m.rows.iter().map(|r| json!({ "oilId": r.oil_id, "amount": r.amount, "pct": r.pct })).collect::<Vec<_>>(),
        "additiveRows": m.additive_rows.iter().map(|r| json!({ "additiveId": r.additive_id, "amount": r.amount, "amountUnit": r.amount_unit.as_str() })).collect::<Vec<_>>(),
        "totalOilsWeight": m.total_oils_weight,
        "unit": m.unit.as_str(),
        "recipeName": m.recipe_name,
        "superfatPct": m.superfat_pct,
        "fragrancePct": m.fragrance_pct,
        "lyeType": m.lye_type.as_str(),
        "waterMethod": m.water_method.as_str(),
        "lockWarnings": m.lock_warnings(),
        "statusHint": m.status_hint(),
        "result": serde_json::to_value(&result).expect("ser"),
        "quality": quality,
        "sat": m.sat_ratio(&result).map(|(s, u)| json!({ "sat": s, "unsat": u })),
        "text": m.format_recipe_text(),
        "toast": toast,
        "additiveViews": m.additive_rows.iter().map(|r| { let v = m.additive_row_view(r); json!({ "status": v.status, "label": v.label, "meta": v.meta }) }).collect::<Vec<_>>(),
        "overMax": m.rows.iter().map(|r| m.row_over_max(r)).collect::<Vec<_>>(),
    })
}

fn s(v: &Value) -> &str {
    v.as_str().unwrap_or_default()
}

fn idx(v: &Value) -> usize {
    v.as_u64().unwrap_or(0) as usize
}

#[test]
fn soap_form_edits_replay_identically() {
    for (n, script) in cases("soapScripts").iter().enumerate() {
        let mut m = SoapForm::new();
        for (step, st) in script.as_array().map(Vec::as_slice).unwrap_or_default().iter().enumerate() {
            let a = &st["action"];
            let row = |m: &SoapForm| m.rows[idx(&a[1])].key;
            let arow = |m: &SoapForm| m.additive_rows[idx(&a[1])].key;
            let toast: String = match s(&a[0]) {
                "start" => String::new(),
                "weight" => {
                    let k = row(&m);
                    m.update_row_weight(k, s(&a[2]));
                    String::new()
                }
                "pct" => {
                    let k = row(&m);
                    m.update_row_pct(k, s(&a[2]));
                    String::new()
                }
                "oil" => {
                    let k = row(&m);
                    m.update_row_oil(k, s(&a[2]));
                    String::new()
                }
                "addRow" => {
                    m.add_row();
                    String::new()
                }
                "removeRow" => {
                    let k = row(&m);
                    m.remove_row(k);
                    String::new()
                }
                "addAdditive" => {
                    m.add_additive_row(s(&a[1]));
                    String::new()
                }
                "additiveAmount" => {
                    let k = arow(&m);
                    m.update_additive_amount(k, s(&a[2]));
                    String::new()
                }
                "additiveUnit" => {
                    let k = arow(&m);
                    m.update_additive_amount_unit(k, amount_unit(&a[2]));
                    String::new()
                }
                "removeAdditive" => {
                    let k = arow(&m);
                    m.remove_additive_row(k);
                    String::new()
                }
                "total" => {
                    m.on_total_oils_change(s(&a[1]));
                    String::new()
                }
                "applyPercents" => m.apply_percents_to_ceiling(),
                "scale" => m.scale_weights_to_ceiling(),
                "unit" => {
                    m.on_unit_change(unit(&a[1]));
                    String::new()
                }
                "preset" => m.apply_preset(&PRESETS[idx(&a[1])]),
                "custom" => m.start_custom_recipe(),
                "reset" => m.reset_defaults(),
                "lye" => {
                    m.lye_type = if s(&a[1]) == "koh" { Lye::Koh } else { Lye::Naoh };
                    String::new()
                }
                "superfat" => {
                    m.superfat_pct = s(&a[1]).into();
                    String::new()
                }
                "fragrance" => {
                    m.fragrance_pct = s(&a[1]).into();
                    String::new()
                }
                "water" => {
                    m.water_method = WaterMethod::parse(s(&a[1])).unwrap_or_default();
                    String::new()
                }
                "waterPct" => {
                    m.water_as_percent_of_oils = s(&a[1]).into();
                    String::new()
                }
                "lyeConc" => {
                    m.lye_concentration_pct = s(&a[1]).into();
                    String::new()
                }
                "discount" => {
                    m.water_discount_pct = s(&a[1]).into();
                    String::new()
                }
                "notes" => {
                    m.recipe_notes = s(&a[1]).into();
                    String::new()
                }
                other => panic!("unknown action {other}"),
            };
            check(&st["state"], &soap_snapshot(&m, &toast), &format!("soapScript[{n}] step {step} {a}"));
        }
    }
}

#[test]
fn loading_saved_soap_recipes_matches() {
    for (i, c) in cases("loadCases").iter().enumerate() {
        let recipe: SoapRecipe = serde_json::from_value(c["recipe"].clone()).expect("recipe");
        let mut m = SoapForm::new();
        m.on_unit_change(unit(&c["unitBefore"]));
        let toast = m.load_recipe(&recipe);
        check(&c["state"], &soap_snapshot(&m, &toast), &format!("load[{i}]"));
    }
}

#[test]
fn candle_form_edits_replay_identically() {
    for (n, script) in cases("candleScripts").iter().enumerate() {
        let mut m = CandleForm::new();
        for (step, st) in script.as_array().map(Vec::as_slice).unwrap_or_default().iter().enumerate() {
            let a = &st["action"];
            match s(&a[0]) {
                "start" => {}
                "wax" => m.on_wax_change(s(&a[1])),
                "preset" => m.apply_vessel_preset(s(&a[1])),
                "unit" => m.on_unit_change(unit(&a[1])),
                "count" => m.vessel_count = s(&a[1]).into(),
                "perVessel" => {
                    m.wax_per_vessel = s(&a[1]).into();
                    m.vessel_preset_id = "custom".into();
                }
                "useTotal" => m.use_total_wax = a[1].as_bool() == Some(true),
                "total" => {
                    m.total_wax = s(&a[1]).into();
                    m.vessel_preset_id = "custom".into();
                }
                "fo" => m.fragrance_pct = s(&a[1]).into(),
                "dye" => m.dye_blocks_per_lb = s(&a[1]).into(),
                "diameter" => m.vessel_diameter_in = s(&a[1]).into(),
                "foPreset" => m.set_fo(match s(&a[1]) {
                    "min" => craft_calc::candle_form::FoPreset::Min,
                    "max" => craft_calc::candle_form::FoPreset::Max,
                    _ => craft_calc::candle_form::FoPreset::Typical,
                }),
                "name" => m.recipe_name = s(&a[1]).into(),
                other => panic!("unknown action {other}"),
            }
            let mut result = serde_json::to_value(m.result()).expect("ser");
            let mut ts = st["state"].clone();
            let wax_id = ts["result"]["wax"]["id"].clone();
            if let Some(o) = ts["result"].as_object_mut() {
                o.remove("wax");
                o.insert("waxId".into(), wax_id);
            }
            if let Some(o) = result.as_object_mut() {
                o.entry("waxId").or_insert(Value::Null);
            }
            let rs = json!({
                "waxId": m.wax_id, "vesselCount": m.vessel_count, "waxPerVessel": m.wax_per_vessel,
                "useTotalWax": m.use_total_wax, "totalWax": m.total_wax, "fragrancePct": m.fragrance_pct,
                "dyeBlocksPerLb": m.dye_blocks_per_lb, "unit": m.unit.as_str(), "vesselDiameterIn": m.vessel_diameter_in,
                "vesselPresetId": m.vessel_preset_id, "result": result, "text": m.format_recipe_text(), "foInRange": m.fo_in_range(),
            });
            check(&ts, &rs, &format!("candleScript[{n}] step {step} {a}"));
        }
    }
}

#[test]
fn fmt_num_matches_the_component() {
    assert_eq!(fmt_num(35.27396194958003, 4), "35.274");
    assert_eq!(fmt_num(f64::NAN, 2), "0");
}
