//! Alien Purple: the shipped app's look as theme tokens, with a matching light form, a
//! high-contrast form for the system setting, and the choice persisted.

use remedy_ui::core::Color;
use remedy_ui::reactive::{Persist, Signal};
use remedy_ui::style::{StyleSheet, Theme};
use remedy_ui::themes::{self, Palette, high_contrast};

use super::Ctx;
use crate::library::{VERSION, keys};

/// The shipped app's palette (`src/index.css` `:root`).
pub const ALIEN_NIGHT: Palette = Palette {
    id: "alien-night",
    name: "Alien Purple",
    dark: true,
    bg: "#0a0614",
    panel: "#120a22",
    card: "#1a0f30",
    line: "#3d2763",
    accent: "#b44dff",
    text: "#f3eaff",
    muted: "#b9a4d8",
    faint: "#7d6a9e",
    accent_hover: "#d28bff",
    ok: "#7dffa8",
    danger: "#ff7a9a",
    warn: "#ffd27a",
};

/// Its daylight form, for people who prefer light screens.
pub const ALIEN_DAY: Palette = Palette {
    id: "alien-day",
    name: "Alien Daylight",
    dark: false,
    bg: "#faf6ff",
    panel: "#f3eaff",
    card: "#ffffff",
    line: "#d9c4f5",
    accent: "#7a2fd0",
    text: "#1a0a2e",
    muted: "#55436f",
    faint: "#7d6a9e",
    accent_hover: "#6b21a8",
    ok: "#14733f",
    danger: "#b4204a",
    warn: "#8a5a00",
};

/// The appearance choices, in the settings' order.
pub const CHOICES: [&str; 3] = ["Alien Purple (night)", "Alien Daylight", "Follow the system"];

/// The theme for a palette, with the shipped app's rounder corners.
pub fn theme_for(p: &Palette) -> Theme {
    let mut t = themes::theme(p);
    if p.dark {
        // Bright accent: dark text on it, as the app's active buttons have.
        t.colors.on_accent = Color::from_hex("#1a0a2e").unwrap_or(Color::BLACK);
    } else {
        t.colors.on_accent = Color::from_hex("#ffffff").unwrap_or(Color::WHITE);
    }
    t.radii.small = 10.0;
    t.radii.medium = 12.0;
    t.radii.large = 18.0;
    t
}

/// The widget style sheet: the Remedy sheet over these tokens.
pub fn sheet(t: &Theme) -> StyleSheet {
    themes::sheet(t)
}

/// The theme for a choice, the system's dark preference and its high-contrast setting.
pub fn resolve(choice: usize, system_dark: Option<bool>, high: bool) -> Theme {
    let p = match choice {
        1 => &ALIEN_DAY,
        2 if system_dark == Some(false) => &ALIEN_DAY,
        _ => &ALIEN_NIGHT,
    };
    let t = theme_for(p);
    if high { high_contrast(&t) } else { t }
}

/// The appearance choice, persisted.
pub fn choice_signal() -> Signal<usize> {
    Signal::new(0usize).persist(Persist::new(keys::APPEARANCE).version(VERSION))
}

/// Applies the chosen theme now and whenever the choice or the system changes.
pub fn follow_appearance(ctx: &Ctx) {
    let choice = ctx.appearance;
    let system: Signal<(Option<bool>, bool)> = Signal::new(ctx.app.appearance().unwrap_or((None, false)));
    ctx.app.on_appearance(move |dark, high| system.set((dark, high)));
    let app = ctx.app.clone();
    let _ = ctx.ui.root().bind(move || {
        let (dark, high) = system.get();
        app.set_theme(resolve(choice.get(), dark, high));
    });
}
