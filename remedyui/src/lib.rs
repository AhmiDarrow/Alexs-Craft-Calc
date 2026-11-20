#![allow(clippy::neg_cmp_op_on_partial_ord)] // `!(x > 0.0)` is JavaScript's NaN-aware test, kept as written in the shipped app.
//! Alex's Craft Calc on RemedyUI: cold-process soap and candle calculators with the craft
//! wiki (F1), for Windows, Android and the web.
//!
//! The math (`soap`, `candle`), the forms' behaviour (`soap_form`, `candle_form`), the saved
//! recipes and recipe files (`storage`) and the wiki (`wiki`) are ported from the shipped
//! React app line for line and checked against it (tests/parity.rs). `library` keeps the
//! recipes; `legacy` brings over what the web-view versions saved, once, losslessly.

pub mod candle;
pub mod candle_form;
pub mod data;
pub mod i18n;
pub mod js;
pub mod legacy;
pub mod library;
pub mod soap;
pub mod soap_form;
pub mod storage;
pub mod ui;
pub mod wiki;

use remedy_ui::{App, AppConfig};

/// The app's configuration: its name (which names its data folder), the Alien Purple theme.
pub fn config() -> AppConfig {
    let theme = ui::theme::theme_for(&ui::theme::ALIEN_NIGHT);
    #[allow(unused_mut)]
    let mut config =
        AppConfig::new("Alex's Craft Calc").edition(remedy_ui::Edition::E2026).theme(theme, ui::theme::sheet);
    #[cfg(not(target_arch = "wasm32"))]
    if let Some(dir) = std::env::var_os("CRAFTCALC_DATA_DIR") {
        // Tests and evidence runs keep their data apart from a person's real library.
        config = config.data_dir(dir);
    }
    config
}

/// The app: what every platform runs.
pub fn app(app: &App) {
    #[cfg(not(target_arch = "wasm32"))]
    let start = ui::Start::from_args(std::env::args().skip(1));
    #[cfg(target_arch = "wasm32")]
    let start = ui::Start::default();
    ui::open_at(app, ui::LegacySource::from_env(), start);
}

/// Android starts the app here, in the activity's thread.
#[cfg(target_os = "android")]
fn start_on_android() {
    if let Err(e) = remedy_ui::run(config(), app) {
        remedy_ui::android::log(&format!("Alex's Craft Calc: {e}"));
    }
}

#[cfg(target_os = "android")]
remedy_ui::android::main!(start_on_android);
