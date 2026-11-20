//! No update may lose saved information: the shipped app's localStorage (written by its own
//! storage.ts, tools/gen-legacy.ts) comes over unchanged, lists the same recipes, survives a
//! restart, keeps what it cannot read, is never imported twice, and recipe files move both
//! ways between the two apps.

use std::collections::BTreeMap;

use craft_calc::legacy::{self, LegacyItems, MigrationRecord};
use craft_calc::library::{Backing, Library, keys};
use craft_calc::storage::{self, PackKind};
use remedy_ui::reactive::PersistStore;
use serde_json::Value;

fn fixture() -> Value {
    let text = std::fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/legacy-localstorage.json"
    ))
    .expect("fixture (npx tsx remedyui/tools/gen-legacy.ts)");
    serde_json::from_str(&text).expect("json")
}

fn items(map: &Value) -> LegacyItems {
    let m: BTreeMap<String, String> = serde_json::from_value(map.clone()).expect("map");
    LegacyItems::from_text("http://tauri.localhost", m)
}

fn temp_dir(name: &str) -> std::path::PathBuf {
    let d =
        std::env::temp_dir().join(format!("craftcalc-{name}-{}-{}", std::process::id(), storage::now_ms()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).expect("temp dir");
    d
}

/// Every stored value of the shipped app, parsed as JSON.
fn stored(f: &Value, key: &str) -> Vec<Value> {
    serde_json::from_str(f["localStorage"][key].as_str().unwrap_or("[]")).expect("stored list")
}

#[test]
fn every_recipe_comes_over_unchanged_and_lists_as_before() {
    let f = fixture();
    let lib = Library::new(Backing::memory());
    let rec = legacy::import(&lib, &items(&f["localStorage"]), "2026-11-19T00:00:00.000Z").expect("import");
    assert!(rec.verified);
    let soap_in = stored(&f, legacy::SOAP_KEY);
    let candle_in = stored(&f, legacy::CANDLE_KEY);
    assert_eq!(rec.soap, soap_in.len());
    assert_eq!(rec.candle, candle_in.len());
    // Byte-for-byte the same objects (as JSON values), in the same order.
    assert_eq!(lib.soap_raw(), soap_in);
    assert_eq!(lib.candle_raw(), candle_in);
    // The lists show exactly what the shipped app's lists showed.
    let ts_soap: Vec<storage::SoapRecipe> = serde_json::from_value(f["listSoap"].clone()).expect("ts list");
    let ts_candle: Vec<storage::CandleRecipe> =
        serde_json::from_value(f["listCandle"].clone()).expect("ts list");
    assert_eq!(lib.soap(), ts_soap);
    assert_eq!(lib.candle(), ts_candle);
    // Preferences.
    assert_eq!(lib.backing.load::<String>(keys::MODE).expect("mode").as_deref(), Some("candle"));
    assert_eq!(lib.backing.load::<String>(keys::LAST_WIKI).expect("wiki").as_deref(), Some("oil-castor"));
    // The backup holds the values exactly as read.
    let backup: Value = lib.backing.load(keys::BACKUP).expect("backup").expect("kept until verified");
    for k in legacy::KEYS {
        assert_eq!(backup["text"][k], f["localStorage"][k], "{k}");
    }
}

#[test]
fn nothing_unreadable_is_dropped() {
    let f = fixture();
    let lib = Library::new(Backing::memory());
    let rec = legacy::import(&lib, &items(&f["damaged"]), "2026-11-19T00:00:00.000Z").expect("import");
    let damaged_soap: Vec<Value> =
        serde_json::from_str(f["damaged"][legacy::SOAP_KEY].as_str().unwrap_or_default()).expect("soap");
    // Readable recipes are in the library; the broken entry and the number are kept apart.
    let readable: Vec<Value> = damaged_soap.iter().filter(|v| storage::is_soap_recipe(v)).cloned().collect();
    assert_eq!(lib.soap_raw(), readable);
    let unread = lib.unreadable();
    assert_eq!(rec.unreadable, unread.len());
    for v in damaged_soap.iter().filter(|v| !storage::is_soap_recipe(v)) {
        assert!(unread.iter().any(|u| u["value"] == *v), "kept {v}");
    }
    // Text that is not JSON is kept as text; preferences the app did not know are kept.
    assert!(unread.iter().any(|u| u["text"] == "{not json"));
    assert!(unread.iter().any(|u| u["text"].as_str().is_some_and(|t| t.contains("futurePref"))));
    assert_eq!(lib.backing.load::<String>(keys::LAST_WIKI).expect("wiki").as_deref(), Some("welcome"));
}

#[test]
fn the_import_survives_a_restart_and_runs_once() {
    let f = fixture();
    let dir = temp_dir("restart");
    let first = {
        let lib = Library::new(Backing::Store(PersistStore::open(dir.join("state")).expect("store")));
        let rec =
            legacy::import(&lib, &items(&f["localStorage"]), "2026-11-19T00:00:00.000Z").expect("import");
        lib.backing.flush().expect("flush");
        rec
    };
    // A fresh run reads everything back, does not import again, and then drops the backup.
    let lib = Library::new(Backing::Store(PersistStore::open(dir.join("state")).expect("store")));
    assert_eq!(lib.soap_raw(), stored(&f, legacy::SOAP_KEY));
    assert_eq!(lib.candle_raw(), stored(&f, legacy::CANDLE_KEY));
    let again = legacy::import(&lib, &items(&f["localStorage"]), "2026-11-20T00:00:00.000Z").expect("again");
    assert_eq!(again, first, "the record of the first import, not a second import");
    assert_eq!(lib.soap_raw().len(), stored(&f, legacy::SOAP_KEY).len(), "no duplicates");
    assert!(lib.backing.load::<Value>(keys::BACKUP).expect("backup").is_some());
    assert!(legacy::settle_backup(&lib).expect("settle"));
    lib.backing.flush().expect("flush");
    assert!(lib.backing.load::<Value>(keys::BACKUP).expect("backup").is_none());
    let rec: MigrationRecord = lib.backing.load(keys::MIGRATION).expect("record").expect("kept");
    assert!(rec.verified && rec.backup_removed);
    assert_eq!(lib.soap_raw(), stored(&f, legacy::SOAP_KEY), "recipes untouched by tidying");
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn recipes_saved_before_an_import_are_kept() {
    let f = fixture();
    let lib = Library::new(Backing::memory());
    let mine = serde_json::json!({ "name": "Made in the new app", "oils": [{ "oilId": "olive", "amount": 1000 }],
        "lyeType": "naoh", "superfatPct": 5, "waterMethod": "percent_oils", "waterAsPercentOfOils": 33,
        "lyeConcentrationPct": 33, "waterDiscountPct": 0, "fragrancePct": 0, "unit": "g" });
    let saved = lib.save_soap(&mine).expect("save");
    legacy::import(&lib, &items(&f["localStorage"]), "2026-11-19T00:00:00.000Z").expect("import");
    assert!(lib.soap().iter().any(|r| r.id == saved.recipe.id));
    assert_eq!(lib.soap().len(), stored(&f, legacy::SOAP_KEY).len() + 1);
}

#[test]
fn an_empty_or_absent_old_store_is_recorded_once() {
    let lib = Library::new(Backing::memory());
    let rec = legacy::import(&lib, &LegacyItems::default(), "2026-11-19T00:00:00.000Z").expect("import");
    assert!(rec.verified && rec.soap == 0 && rec.candle == 0);
    assert!(lib.soap_raw().is_empty());
}

#[test]
fn saving_never_drops_the_shipped_apps_unreadable_entries() {
    // The shipped app rewrote its list on every save and silently lost entries it could not
    // read. The library keeps them.
    let junk = serde_json::json!({ "name": "Broken", "oils": "none" });
    let lib = Library::new(Backing::memory());
    lib.backing.save(keys::SOAP, &vec![junk.clone()]).expect("seed");
    let r = serde_json::json!({ "name": "New", "oils": [], "lyeType": "naoh", "superfatPct": 5,
        "waterMethod": "percent_oils", "unit": "g" });
    lib.save_soap(&r).expect("save");
    assert!(lib.soap_raw().contains(&junk));
    // And there is no 60-recipe limit.
    for i in 0..75 {
        let mut r = r.clone();
        r["name"] = Value::String(format!("Recipe {i}"));
        lib.save_soap(&r).expect("save");
    }
    assert_eq!(lib.soap().len(), 76);
}

#[test]
fn library_files_round_trip_between_the_apps() {
    let f = fixture();
    let lib = Library::new(Backing::memory());
    legacy::import(&lib, &items(&f["localStorage"]), "2026-11-19T00:00:00.000Z").expect("import");
    let pack = storage::share_pack(PackKind::Library, &lib.soap(), &lib.candle());
    let json = storage::pack_to_json(&pack);
    // Read back by this app into an empty library: the same recipes (fresh ids, as the
    // shipped app gives imported recipes).
    let parsed = storage::parse_share_payload(&json).expect("parse");
    let fresh = Library::new(Backing::memory());
    fresh.merge(&parsed).expect("merge");
    let strip = |v: Vec<storage::SoapRecipe>| -> Vec<(String, Value)> {
        let mut out: Vec<(String, Value)> = v
            .into_iter()
            .map(|r| {
                let mut x = serde_json::to_value(&r).expect("ser");
                let o = x.as_object_mut().expect("obj");
                o.remove("id");
                o.remove("savedAt");
                (r.name, x)
            })
            .collect();
        out.sort_by(|a, b| a.0.cmp(&b.0));
        out
    };
    assert_eq!(strip(fresh.soap()), strip(lib.soap()));
    assert_eq!(fresh.candle().len(), lib.candle().len());
    // Read by the shipped app's own parser (TypeScript), when Node is here.
    let dir = temp_dir("pack");
    let file = dir.join("library.json");
    std::fs::write(&file, &json).expect("write");
    let repo = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
    let out = std::process::Command::new(if cfg!(windows) { "npx.cmd" } else { "npx" })
        .current_dir(&repo)
        .args(["--no-install", "tsx", "remedyui/tools/read-pack.ts"])
        .arg(&file)
        .output();
    match out {
        Ok(o) if o.status.success() => {
            let text = String::from_utf8_lossy(&o.stdout);
            let v: Value =
                serde_json::from_str(text.lines().last().unwrap_or("{}")).expect("read-pack output");
            assert_eq!(v["ok"], true, "{text}");
            assert_eq!(v["soap"].as_u64(), Some(lib.soap().len() as u64));
            assert_eq!(v["candle"].as_u64(), Some(lib.candle().len() as u64));
            let names: Vec<String> = serde_json::from_value(v["names"].clone()).expect("names");
            for r in lib.soap() {
                assert!(names.contains(&r.name), "{}", r.name);
            }
        }
        Ok(o) => panic!("the shipped app could not read the file: {}", String::from_utf8_lossy(&o.stderr)),
        Err(e) => eprintln!("node is not here ({e}); the shipped app's parser was not run"),
    }
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn a_real_chromium_store_from_the_shipped_app_imports_exactly() {
    // tests/fixtures/chrome-leveldb: the shipped app in headless Chrome (fresh profile), its
    // library put in through the page and one more recipe saved through its own Save button.
    let base = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    let expected: Value =
        serde_json::from_str(&std::fs::read_to_string(base.join("chrome-expected.json")).expect("expected"))
            .expect("json");
    let origin = expected["origin"].as_str().expect("origin").to_owned();
    // Read from a copy: the fixture stays as Chrome wrote it.
    let dir = temp_dir("chrome");
    for e in std::fs::read_dir(base.join("chrome-leveldb")).expect("fixture") {
        let e = e.expect("entry");
        std::fs::copy(e.path(), dir.join(e.file_name())).expect("copy");
    }
    let items = legacy::read_platform(Some((dir.clone(), vec![origin]))).expect("read").expect("found");
    for k in legacy::KEYS {
        assert_eq!(items.text.get(k).map(String::as_str), expected["localStorage"][k].as_str(), "{k}");
    }
    let lib = Library::new(Backing::memory());
    let rec = legacy::import(&lib, &items, "2026-11-19T00:00:00.000Z").expect("import");
    let soap: Vec<Value> =
        serde_json::from_str(expected["localStorage"][legacy::SOAP_KEY].as_str().expect("soap"))
            .expect("json");
    assert_eq!(lib.soap_raw(), soap);
    assert_eq!(rec.soap, soap.len());
    assert!(lib.soap().iter().any(|r| r.name == "Chrome-made bar"));
    assert_eq!(lib.backing.load::<String>(keys::MODE).expect("mode").as_deref(), Some("candle"));
    let _ = std::fs::remove_dir_all(&dir);
}
