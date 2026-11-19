//! First run: bring over what the web-view versions saved (the Tauri app on Windows, the
//! Capacitor app on Android, the PWA in a browser), losslessly and once.
//!
//! The shipped app kept everything in its web view's `localStorage` under four keys. The
//! import never changes that store. It
//! 1. keeps a backup of the four values exactly as read (`migration-webstorage-backup`),
//! 2. adds every recipe object to the library unchanged, and keeps anything it cannot read
//!    (bad JSON, objects that are not recipes) apart instead of dropping it,
//! 3. carries over the last mode and the last wiki article,
//! 4. writes everything, reads it back and checks that each value arrived unchanged, and
//!    only then records the import as verified. A failed check records nothing, so the
//!    next start tries again; the backup is removed on a later start, once the library has
//!    been read back by a fresh run.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::library::{Library, keys};
use crate::storage::{is_candle_recipe, is_soap_recipe};

/// The shipped app's localStorage keys.
pub const SOAP_KEY: &str = "alien-craft-soap-recipes";
/// Candle recipes.
pub const CANDLE_KEY: &str = "alien-craft-candle-recipes";
/// Preferences (`{ lastWikiId }`).
pub const PREFS_KEY: &str = "alien-craft-prefs";
/// `soap` or `candle`.
pub const MODE_KEY: &str = "alien-craft-mode";
/// Every key the shipped app wrote.
pub const KEYS: [&str; 4] = [SOAP_KEY, CANDLE_KEY, PREFS_KEY, MODE_KEY];

/// The Tauri bundle identifier and Capacitor app id of the shipped app.
pub const APP_ID: &str = "com.alexscraft.calc";

/// What the import did, kept in the store.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationRecord {
    pub version: u32,
    /// Where the values came from (an origin, or "none").
    pub source: String,
    pub imported_at: String,
    pub soap: usize,
    pub candle: usize,
    pub unreadable: usize,
    pub verified: bool,
    pub backup_removed: bool,
}

/// What the web view held under the app's keys: text values, and values with unpaired
/// UTF-16 surrogates (which only UTF-16 can hold) as code units.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct LegacyItems {
    pub source: String,
    pub text: BTreeMap<String, String>,
    pub utf16: Vec<(Vec<u16>, Vec<u16>)>,
}

impl LegacyItems {
    /// Items from plain text values.
    pub fn from_text(source: &str, items: impl IntoIterator<Item = (String, String)>) -> LegacyItems {
        LegacyItems {
            source: source.to_owned(),
            text: items.into_iter().filter(|(k, _)| KEYS.contains(&k.as_str())).collect(),
            utf16: Vec::new(),
        }
    }

    fn is_empty(&self) -> bool {
        self.text.is_empty() && self.utf16.is_empty()
    }
}

/// Imports `items` into the library, once. Returns the record (an earlier one when the
/// import already happened). On error nothing is recorded, so it is tried again later.
pub fn import(lib: &Library, items: &LegacyItems, now_iso: &str) -> Result<MigrationRecord, String> {
    let b = &lib.backing;
    if let Some(done) = b.load::<MigrationRecord>(keys::MIGRATION)? {
        return Ok(done);
    }
    if items.is_empty() {
        let rec = MigrationRecord {
            version: 1,
            source: if items.source.is_empty() { "none".into() } else { items.source.clone() },
            imported_at: now_iso.into(),
            verified: true,
            backup_removed: true,
            ..Default::default()
        };
        b.save(keys::MIGRATION, &rec)?;
        b.flush()?;
        return Ok(rec);
    }

    // 1. The backup, exactly as read.
    let backup = json!({
        "source": items.source,
        "text": items.text,
        "utf16": items.utf16.iter().map(|(k, v)| json!({ "key": k, "value": v })).collect::<Vec<_>>(),
    });
    b.save(keys::BACKUP, &backup)?;
    b.flush()?;

    // 2. Recipes, unchanged; anything unreadable kept apart.
    let mut unreadable = lib.unreadable();
    let unreadable_before = unreadable.len();
    let mut take = |key: &str, valid: fn(&Value) -> bool| -> Vec<Value> {
        let Some(raw) = items.text.get(key) else { return Vec::new() };
        match serde_json::from_str::<Value>(raw) {
            Ok(Value::Array(list)) => {
                let mut ok = Vec::new();
                for v in list {
                    if valid(&v) {
                        ok.push(v);
                    } else {
                        unreadable.push(json!({ "from": key, "value": v }));
                    }
                }
                ok
            }
            Ok(other) => {
                unreadable.push(json!({ "from": key, "value": other }));
                Vec::new()
            }
            Err(_) => {
                unreadable.push(json!({ "from": key, "text": raw }));
                Vec::new()
            }
        }
    };
    let soap_in = take(SOAP_KEY, is_soap_recipe);
    let candle_in = take(CANDLE_KEY, is_candle_recipe);
    for (k, v) in &items.utf16 {
        unreadable.push(json!({ "fromUtf16": k, "valueUtf16": v }));
    }
    let merge = |existing: Vec<Value>, incoming: &[Value]| -> Vec<Value> {
        let mut out = existing;
        for v in incoming {
            if !out.contains(v) {
                out.push(v.clone());
            }
        }
        out
    };
    let soap = merge(lib.soap_raw(), &soap_in);
    let candle = merge(lib.candle_raw(), &candle_in);

    // 3. Preferences, read the way the shipped app read them.
    let mode = if items.text.get(MODE_KEY).map(String::as_str) == Some("candle") { "candle" } else { "soap" };
    let last_wiki =
        items.text.get(PREFS_KEY).and_then(|p| serde_json::from_str::<Value>(p).ok()).and_then(|p| {
            p.as_object()
                .and_then(|o| o.get("lastWikiId"))
                .and_then(Value::as_str)
                .map(|s| crate::js::slice16(s, 120))
        });
    if let Some(p) = items.text.get(PREFS_KEY)
        && serde_json::from_str::<Value>(p)
            .ok()
            .and_then(|v| v.as_object().cloned())
            .is_none_or(|o| o.keys().any(|k| k != "lastWikiId"))
    {
        // Preferences the app did not know (or bad JSON) are kept, not dropped.
        unreadable.push(json!({ "from": PREFS_KEY, "text": p }));
    }

    // 4. Write, read back, check, record.
    b.save(keys::SOAP, &soap)?;
    b.save(keys::CANDLE, &candle)?;
    if unreadable.len() != unreadable_before {
        b.save(keys::UNREADABLE, &unreadable)?;
    }
    if items.text.contains_key(MODE_KEY) {
        b.save(keys::MODE, &mode)?;
    }
    if let Some(w) = &last_wiki {
        b.save(keys::LAST_WIKI, w)?;
    }
    b.flush()?;

    let soap_back = lib.soap_raw();
    let candle_back = lib.candle_raw();
    let unread_back = lib.unreadable();
    let all_there = soap_in.iter().all(|v| soap_back.contains(v))
        && candle_in.iter().all(|v| candle_back.contains(v))
        && unreadable.iter().all(|v| unread_back.contains(v))
        && (!items.text.contains_key(MODE_KEY) || b.load::<String>(keys::MODE)?.as_deref() == Some(mode))
        && last_wiki
            .as_ref()
            .is_none_or(|w| b.load::<String>(keys::LAST_WIKI).ok().flatten().as_ref() == Some(w));
    if !all_there {
        return Err("the imported recipes did not read back unchanged; the old data is untouched and the import will be tried again".into());
    }
    let rec = MigrationRecord {
        version: 1,
        source: items.source.clone(),
        imported_at: now_iso.into(),
        soap: soap_in.len(),
        candle: candle_in.len(),
        unreadable: unreadable.len() - unreadable_before,
        verified: true,
        backup_removed: false,
    };
    b.save(keys::MIGRATION, &rec)?;
    b.flush()?;
    Ok(rec)
}

/// On a later start: once a fresh run has read the library back (it lists without error and
/// still holds every recipe the import brought, unless the person deleted some since — the
/// record keeps the counts), the backup is no longer needed and is removed.
pub fn settle_backup(lib: &Library) -> Result<bool, String> {
    let b = &lib.backing;
    let Some(mut rec) = b.load::<MigrationRecord>(keys::MIGRATION)? else { return Ok(false) };
    if !rec.verified || rec.backup_removed {
        return Ok(false);
    }
    // Reading both libraries is the verification: a store that cannot be read errors here.
    b.load::<Vec<Value>>(keys::SOAP)?;
    b.load::<Vec<Value>>(keys::CANDLE)?;
    b.remove(keys::BACKUP)?;
    rec.backup_removed = true;
    b.save(keys::MIGRATION, &rec)?;
    b.flush()?;
    Ok(true)
}

/// Reads the shipped app's storage on this platform. `override_dir` (tests, owners moving a
/// store by hand) names a Chromium `Local Storage/leveldb` folder to read instead, with
/// `origins` to look for. `Ok(None)` when there is nothing here.
pub fn read_platform(
    override_dir: Option<(std::path::PathBuf, Vec<String>)>,
) -> Result<Option<LegacyItems>, String> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        use remedy_ui::webstorage::{ChromiumStorage, WebStorageError};
        let (dir, origins): (Option<std::path::PathBuf>, Vec<String>) = match override_dir {
            Some((d, o)) => (Some(d), o),
            None => default_location(),
        };
        let Some(dir) = dir else { return Ok(None) };
        let store = match ChromiumStorage::read_dir(&dir) {
            Ok(s) => s,
            Err(WebStorageError::NotFound { .. }) => return Ok(None),
            Err(e) => return Err(e.to_string()),
        };
        let o: Vec<&str> = origins.iter().map(String::as_str).collect();
        let Some(ls) = store.first_of(&o).map_err(|e| e.to_string())? else { return Ok(None) };
        let mut items = LegacyItems::from_text(&ls.origin, ls.items.clone());
        for u in &ls.unpaired {
            if KEYS.iter().any(|k| k.encode_utf16().eq(u.key.iter().copied())) {
                items.utf16.push((u.key.clone(), u.value.clone()));
            }
        }
        Ok(Some(items))
    }
    #[cfg(target_arch = "wasm32")]
    {
        let _ = override_dir;
        let ls = remedy_ui::webstorage::browser_local_storage().map_err(|e| e.to_string())?;
        let mut items = LegacyItems::from_text(&ls.origin, ls.items.clone());
        for u in &ls.unpaired {
            if KEYS.iter().any(|k| k.encode_utf16().eq(u.key.iter().copied())) {
                items.utf16.push((u.key.clone(), u.value.clone()));
            }
        }
        Ok(Some(items))
    }
}

/// Where the shipped app kept its storage on this platform, and its origins.
#[cfg(not(target_arch = "wasm32"))]
fn default_location() -> (Option<std::path::PathBuf>, Vec<String>) {
    use remedy_ui::webstorage;
    #[cfg(target_os = "android")]
    {
        let dir = remedy_ui::android::data_dir().and_then(webstorage::android_webview_dir_from_files_dir);
        (dir, webstorage::CAPACITOR_ORIGINS.iter().map(|s| (*s).to_owned()).collect())
    }
    #[cfg(not(target_os = "android"))]
    {
        (
            webstorage::tauri_windows_dir(APP_ID),
            webstorage::TAURI_WINDOWS_ORIGINS.iter().map(|s| (*s).to_owned()).collect(),
        )
    }
}

/// The counts a person sees after the import.
pub fn summary(rec: &MigrationRecord) -> Option<String> {
    if rec.soap + rec.candle == 0 {
        return None;
    }
    Some(format!(
        "Brought over {} soap and {} candle recipes from the previous version",
        rec.soap, rec.candle
    ))
}
