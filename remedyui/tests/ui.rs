//! The app headless, through the accessibility tree, as a screen reader meets it: the same
//! numbers as the shipped app, typing, both calculators, the wiki on F1, saving and the
//! first-run import.

use std::collections::BTreeMap;

use craft_calc::legacy::LegacyItems;
use craft_calc::ui::{self, LegacySource};
use remedy_ui::a11y::Role;
use remedy_ui::input::{Key, KeyEvent};
use remedy_ui::testing::TestApp;

fn temp(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("craftcalc-ui-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
}

fn start_in(dir: &std::path::Path, legacy: LegacySource) -> TestApp {
    let config = craft_calc::config().data_dir(dir.to_path_buf());
    let mut app = TestApp::new(config, move |app| ui::open(app, legacy));
    app.frames(2);
    app
}

fn none() -> LegacySource {
    LegacySource::Items(LegacyItems::default())
}

fn value(app: &TestApp, role: Role, name: &str) -> Option<String> {
    app.node(role, name).and_then(|n| n.value)
}

fn has_label(app: &TestApp, text: &str) -> bool {
    app.reader_view().iter().any(|n| n.name.as_deref() == Some(text))
}

/// Sets a number field's text as a screen reader would, then runs frames.
fn set_number(app: &mut TestApp, name: &str, nth: usize, text: &str) {
    let ui = app.ui().expect("window");
    let node = app
        .reader_view()
        .into_iter()
        .filter(|n| n.role == Role::SpinButton && n.name.as_deref() == Some(name))
        .nth(nth)
        .unwrap_or_else(|| panic!("no field {name} #{nth}"));
    assert!(ui.accessibility_set_value(node.id, text), "set {name}");
    app.frames(2);
}

#[test]
fn the_default_batch_shows_the_shipped_apps_numbers() {
    let dir = temp("default");
    let app = start_in(&dir, none());
    assert!(app.find(Role::Heading(2), "Soap Calculator").is_some());
    assert_eq!(value(&app, Role::Group, "NaOH (with SF)").as_deref(), Some("4.96"));
    for (label, v) in [
        ("Water", "11.64 oz"),
        ("Lye solution", "16.6 oz"),
        ("Fragrance", "1.06 oz"),
        ("Total oils", "35.27 oz"),
        ("Batch total", "52.93 oz"),
        ("Additives", "0 oz"),
    ] {
        assert_eq!(value(&app, Role::Group, label).as_deref(), Some(v), "{label}");
    }
    assert!(has_label(&app, "Pure lye 0% SF: 5.22 oz   Iodine: 58.4   INS: 153.9"));
    assert_eq!(value(&app, Role::Group, "Hardness").as_deref(), Some("41.6 — In ideal range"));
    assert!(has_label(&app, "Saturated : unsaturated ≈ 42:58 — a typical balanced bar sits near 40:60."));
    assert_eq!(value(&app, Role::SpinButton, "Total oils weight").as_deref(), Some("35.274"));
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn typing_follows_the_ceiling_and_locks_until_it_matches() {
    let dir = temp("typing");
    let mut app = start_in(&dir, none());
    // A new ceiling keeps each oil's % and recomputes its weight.
    set_number(&mut app, "Total oils weight", 0, "50");
    let weights: Vec<String> = app
        .reader_view()
        .into_iter()
        .filter(|n| n.role == Role::SpinButton && n.name.as_deref() == Some("Weight"))
        .filter_map(|n| n.value)
        .collect();
    assert_eq!(weights, ["20", "12.5", "12.5", "5"]);
    // One weight off: the results lock, as the shipped app's did.
    set_number(&mut app, "Weight", 0, "25");
    assert_eq!(value(&app, Role::Group, "NaOH (with SF)").as_deref(), Some("—"));
    assert!(
        app.reader_view().iter().any(|n| n.role == Role::Status
            && n.name.as_deref().is_some_and(|s| s.contains("10% over 100% — locked")))
    );
    // Back in balance: unlocked again.
    set_number(&mut app, "Percent of total", 0, "40");
    assert_ne!(value(&app, Role::Group, "NaOH (with SF)").as_deref(), Some("—"));
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn the_candle_calculator_and_back() {
    let dir = temp("candle");
    let mut app = start_in(&dir, none());
    assert!(app.press(Role::Tab, "✧ Candle"));
    app.frames(2);
    assert!(app.find(Role::Heading(2), "Candle Calculator").is_some());
    assert_eq!(value(&app, Role::Group, "Fragrance oil").as_deref(), Some("64 g"));
    assert_eq!(value(&app, Role::Group, "Total wax").as_deref(), Some("800 g"));
    assert_eq!(value(&app, Role::Group, "Dye blocks (est.)").as_deref(), Some("1.76 "));
    // The mode is remembered.
    drop(app);
    let app = start_in(&dir, none());
    assert!(app.find(Role::Heading(2), "Candle Calculator").is_some());
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn f1_opens_the_wiki_and_escape_closes_it() {
    let dir = temp("wiki");
    let mut app = start_in(&dir, none());
    app.key(KeyEvent::press(Key::F(1)));
    app.frames(2);
    assert!(app.find(Role::Dialog, "Craft wiki").is_some(), "wiki open");
    assert!(app.find(Role::Heading(2), "Welcome to Alex's Craft Calc").is_some());
    app.key(KeyEvent::press(Key::Escape));
    app.frames(2);
    assert!(app.find(Role::Dialog, "Craft wiki").is_none(), "wiki closed");
    // An oil's info button opens its article.
    assert!(app.press(Role::Button, "Wiki: Olive Oil"));
    app.frames(2);
    assert!(app.find(Role::Heading(2), "Olive Oil").is_some());
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn a_saved_recipe_is_there_after_a_restart() {
    let dir = temp("save");
    let mut app = start_in(&dir, none());
    assert!(app.press(Role::Button, "Save"));
    app.frames(2);
    assert!(app.find(Role::Button, "Saved (1)").is_some());
    assert!(app.find(Role::Button, "Update").is_some(), "editing the saved slot now");
    app.runner().app().persist_store().map(|s| s.flush());
    drop(app);
    let mut app = start_in(&dir, none());
    assert!(app.press(Role::Button, "Saved (1)"));
    app.frames(2);
    assert!(app.reader_view().iter().any(|n| {
        n.name.as_deref().is_some_and(|s| s.starts_with("Soap ") && s.contains("4 oils · NAOH · SF 5%"))
    }));
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn the_first_run_brings_over_the_previous_versions_library() {
    let text = std::fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/legacy-localstorage.json"
    ))
    .expect("fixture");
    let f: serde_json::Value = serde_json::from_str(&text).expect("json");
    let map: BTreeMap<String, String> = serde_json::from_value(f["localStorage"].clone()).expect("map");
    let dir = temp("import");
    let mut app = start_in(&dir, LegacySource::Items(LegacyItems::from_text("http://tauri.localhost", map)));
    // The shipped app was last in candle mode; it comes back there with its candles.
    assert!(app.find(Role::Heading(2), "Candle Calculator").is_some());
    assert!(app.find(Role::Button, "Saved (3)").is_some());
    assert!(app.press(Role::Tab, "✦ Soap"));
    app.frames(2);
    assert!(app.find(Role::Button, "Saved (3)").is_some());
    assert!(app.press(Role::Button, "Saved (3)"));
    app.frames(2);
    assert!(
        app.reader_view().iter().any(|n| n.name.as_deref().is_some_and(|s| s.starts_with("Oatmeal & honey")))
    );
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn recalculate_balances_the_oils_and_unlocks_the_results() {
    let dir = temp("recalc");
    let mut app = start_in(&dir, none());
    set_number(&mut app, "Weight", 0, "500");
    assert_eq!(value(&app, Role::Group, "NaOH (with SF)").as_deref(), Some("—"));
    // The button in the locked results card works too (the second one in reading order).
    let ui = app.ui().expect("window");
    let buttons: Vec<_> = app
        .reader_view()
        .into_iter()
        .filter(|n| n.role == Role::Button && n.name.as_deref() == Some("Recalculate"))
        .collect();
    assert_eq!(buttons.len(), 2, "one by the oils, one on the results");
    assert!(ui.accessibility_action(buttons[1].id, remedy_ui::a11y::Action::Click));
    app.frames(2);
    assert_ne!(value(&app, Role::Group, "NaOH (with SF)").as_deref(), Some("—"));
    assert!(
        app.reader_view()
            .iter()
            .any(|n| n.role == Role::Status && n.name.as_deref().is_some_and(|s| s.contains("Unlocked")))
    );
    let _ = std::fs::remove_dir_all(dir);
}
