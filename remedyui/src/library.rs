//! The recipe library and preferences, kept in the app's persist store (a folder on the
//! desktop and Android, the page's storage on the web), versioned so later shapes migrate.
//!
//! Recipes are stored as the JSON objects they were saved as. Nothing is ever dropped:
//! objects the shipped app could not read (it skipped them when listing and lost them on its
//! next save) are kept apart in `library-unreadable`.

use remedy_ui::reactive::{Persist, PersistStore};
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

use crate::storage::{self, CandleRecipe, Merged, Parsed, Saved, SoapRecipe};

/// Store keys.
pub mod keys {
    /// Saved soap recipes (array of recipe objects).
    pub const SOAP: &str = "library-soap";
    /// Saved candle recipes.
    pub const CANDLE: &str = "library-candle";
    /// Stored objects no reader understood, with where they came from.
    pub const UNREADABLE: &str = "library-unreadable";
    /// Soap or candle, the mode last shown.
    pub const MODE: &str = "mode";
    /// The wiki article last read.
    pub const LAST_WIKI: &str = "wiki-last";
    /// The colour theme chosen.
    pub const APPEARANCE: &str = "appearance";
    /// The language chosen (empty: the system's).
    pub const LOCALE: &str = "locale";
    /// What the import of the web-view version's storage did.
    pub const MIGRATION: &str = "migration-webstorage";
    /// The web-view version's storage as it was read, kept until the import is verified.
    pub const BACKUP: &str = "migration-webstorage-backup";
    /// Last Android update version the person already acted on (Later, or the installer started).
    pub const UPDATE_NOTICE: &str = "update-notice";
}

/// The version of every value this app writes.
pub const VERSION: u32 = 1;

/// Where values live: the app's persist store, or memory (tests, or a platform with no
/// storage, where the app says so).
#[derive(Clone)]
pub enum Backing {
    Store(PersistStore),
    Memory(std::rc::Rc<std::cell::RefCell<std::collections::BTreeMap<String, Value>>>),
}

impl std::fmt::Debug for Backing {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Backing::Store(_) => f.write_str("Backing::Store"),
            Backing::Memory(_) => f.write_str("Backing::Memory"),
        }
    }
}

impl Backing {
    /// An empty in-memory backing.
    pub fn memory() -> Backing {
        Backing::Memory(std::rc::Rc::default())
    }

    /// Reads `key`.
    pub fn load<T: DeserializeOwned>(&self, key: &str) -> Result<Option<T>, String> {
        match self {
            Backing::Store(s) => s.load(&Persist::new(key).version(VERSION)).map_err(|e| e.to_string()),
            Backing::Memory(m) => match m.borrow().get(key) {
                Some(v) => serde_json::from_value(v.clone()).map(Some).map_err(|e| e.to_string()),
                None => Ok(None),
            },
        }
    }

    /// Writes `key`.
    pub fn save<T: Serialize + ?Sized>(&self, key: &str, value: &T) -> Result<(), String> {
        match self {
            Backing::Store(s) => {
                s.save(&Persist::new(key).version(VERSION), value).map_err(|e| e.to_string())
            }
            Backing::Memory(m) => {
                let v = serde_json::to_value(value).map_err(|e| e.to_string())?;
                m.borrow_mut().insert(key.to_owned(), v);
                Ok(())
            }
        }
    }

    /// Forgets `key`.
    pub fn remove(&self, key: &str) -> Result<(), String> {
        match self {
            Backing::Store(s) => s.remove(key).map_err(|e| e.to_string()),
            Backing::Memory(m) => {
                m.borrow_mut().remove(key);
                Ok(())
            }
        }
    }

    /// Waits until everything is written (a store) and reports what failed.
    pub fn flush(&self) -> Result<(), String> {
        match self {
            Backing::Store(s) => {
                s.flush().map_err(|e| e.to_string())?;
                let errors = s.take_errors();
                if errors.is_empty() { Ok(()) } else { Err(errors.join("; ")) }
            }
            Backing::Memory(_) => Ok(()),
        }
    }
}

/// The library: saved soap and candle recipes.
#[derive(Clone, Debug)]
pub struct Library {
    pub backing: Backing,
}

impl Library {
    /// The library in `backing`.
    pub fn new(backing: Backing) -> Library {
        Library { backing }
    }

    fn raw(&self, key: &str) -> Vec<Value> {
        self.backing.load::<Vec<Value>>(key).ok().flatten().unwrap_or_default()
    }

    /// The stored soap objects.
    pub fn soap_raw(&self) -> Vec<Value> {
        self.raw(keys::SOAP)
    }

    /// The stored candle objects.
    pub fn candle_raw(&self) -> Vec<Value> {
        self.raw(keys::CANDLE)
    }

    /// The objects kept apart as unreadable.
    pub fn unreadable(&self) -> Vec<Value> {
        self.raw(keys::UNREADABLE)
    }

    /// Saved soap recipes, newest first.
    pub fn soap(&self) -> Vec<SoapRecipe> {
        storage::list_soap(&self.soap_raw())
    }

    /// Saved candle recipes, newest first.
    pub fn candle(&self) -> Vec<CandleRecipe> {
        storage::list_candle(&self.candle_raw())
    }

    /// Saves a soap recipe (by id, then by name). An error means nothing was written.
    pub fn save_soap(&self, fields: &Value) -> Result<Saved<SoapRecipe>, String> {
        let (next, saved) = storage::save_soap(&self.soap_raw(), fields);
        self.backing.save(keys::SOAP, &next).map_err(|e| format!("Could not save: {e}"))?;
        Ok(saved)
    }

    /// Saves a candle recipe.
    pub fn save_candle(&self, fields: &Value) -> Result<Saved<CandleRecipe>, String> {
        let (next, saved) = storage::save_candle(&self.candle_raw(), fields);
        self.backing.save(keys::CANDLE, &next).map_err(|e| format!("Could not save: {e}"))?;
        Ok(saved)
    }

    /// Deletes a soap recipe.
    pub fn delete_soap(&self, id: &str) -> Result<(), String> {
        self.backing.save(keys::SOAP, &storage::delete_soap(&self.soap_raw(), id))
    }

    /// Deletes a candle recipe.
    pub fn delete_candle(&self, id: &str) -> Result<(), String> {
        self.backing.save(keys::CANDLE, &storage::delete_candle(&self.candle_raw(), id))
    }

    /// Merges a parsed recipe file into the library (Load).
    pub fn merge(&self, parsed: &Parsed) -> Result<Merged, String> {
        let (soap, candle, merged) = storage::merge_imported(&self.soap_raw(), &self.candle_raw(), parsed);
        if !parsed.soap.is_empty() {
            self.backing.save(keys::SOAP, &soap)?;
        }
        if !parsed.candle.is_empty() {
            self.backing.save(keys::CANDLE, &candle)?;
        }
        Ok(merged)
    }
}
