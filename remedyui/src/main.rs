//! Alex's Craft Calc.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(e) = remedy_ui::run(craft_calc::config(), craft_calc::app) {
        #[cfg(not(target_arch = "wasm32"))]
        {
            eprintln!("Alex's Craft Calc: {e}");
            std::process::exit(1);
        }
        #[cfg(target_arch = "wasm32")]
        web_sys::console::error_1(&e.to_string().into());
    }
}
