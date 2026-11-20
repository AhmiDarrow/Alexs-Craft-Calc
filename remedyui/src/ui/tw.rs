//! The widgets, with the app's own text shown in the chosen language: every label, heading,
//! tooltip and option goes through [`tr`] (what people type does not). The screens use this
//! module as `w`; the window is built again when the language changes.

pub use remedy_ui::widgets::*;

use remedy_ui::reactive::Signal;
use remedy_ui::view::{IntoProp, Prop};
use remedy_ui::{El, Ui};

use crate::i18n::tr;

/// `p` translated: a fixed text once, a bound one each time it changes.
pub fn trp(p: impl IntoProp<String>) -> Prop<String> {
    match p.into_prop() {
        Prop::Value(s) => Prop::Value(tr(&s)),
        Prop::Dynamic(f) => Prop::Dynamic(std::rc::Rc::new(move || tr(&f()))),
    }
}

#[track_caller]
pub fn text(ui: &Ui, s: impl IntoProp<String>) -> El {
    remedy_ui::widgets::text(ui, trp(s))
}

#[track_caller]
pub fn heading(ui: &Ui, level: u8, s: impl IntoProp<String>) -> El {
    remedy_ui::widgets::heading(ui, level, trp(s))
}

#[track_caller]
pub fn link(ui: &Ui, s: impl IntoProp<String>, on_activate: impl Fn() + 'static) -> El {
    remedy_ui::widgets::link(ui, trp(s), on_activate)
}

#[track_caller]
pub fn button(ui: &Ui, label: impl IntoProp<String>, on_press: impl Fn() + 'static) -> El {
    remedy_ui::widgets::button(ui, trp(label), on_press)
}

#[track_caller]
pub fn icon_button(ui: &Ui, glyph: Icon, label: impl IntoProp<String>, on_press: impl Fn() + 'static) -> El {
    remedy_ui::widgets::icon_button(ui, glyph, trp(label), on_press)
}

#[track_caller]
pub fn badge(ui: &Ui, s: impl IntoProp<String>) -> El {
    remedy_ui::widgets::badge(ui, trp(s))
}

#[track_caller]
pub fn check(ui: &Ui, s: impl IntoProp<String>, value: Signal<bool>) -> El {
    remedy_ui::widgets::check(ui, trp(s), value)
}

pub fn tooltip(target: &El, s: impl IntoProp<String>) {
    remedy_ui::widgets::tooltip(target, trp(s))
}

#[track_caller]
pub fn field(ui: &Ui, label: impl Into<String>, control: El) -> El {
    remedy_ui::widgets::field(ui, tr(&label.into()), control)
}

#[track_caller]
pub fn text_input(ui: &Ui, label: impl Into<String>) -> remedy_ui::view::TextField {
    remedy_ui::widgets::text_input(ui, tr(&label.into()))
}

#[track_caller]
pub fn text_area(ui: &Ui, label: impl Into<String>) -> remedy_ui::view::TextField {
    remedy_ui::widgets::text_area(ui, tr(&label.into()))
}

#[track_caller]
pub fn search(ui: &Ui, label: impl Into<String>, on_change: impl Fn(String) + 'static) -> El {
    remedy_ui::widgets::search(ui, tr(&label.into()), on_change)
}

#[track_caller]
pub fn select(ui: &Ui, label: impl Into<String>, options: Vec<String>, selected: Signal<usize>) -> El {
    let options = options.iter().map(|o| tr(o)).collect();
    remedy_ui::widgets::select(ui, tr(&label.into()), options, selected)
}

#[track_caller]
pub fn segmented(ui: &Ui, label: impl Into<String>, options: &[&str], selected: Signal<usize>) -> El {
    let options: Vec<String> = options.iter().map(|o| tr(o)).collect();
    let refs: Vec<&str> = options.iter().map(String::as_str).collect();
    remedy_ui::widgets::segmented(ui, tr(&label.into()), &refs, selected)
}

#[track_caller]
pub fn toast(ui: &Ui, message: impl Into<String>, duration: std::time::Duration) -> El {
    remedy_ui::widgets::toast(ui, tr(&message.into()), duration)
}

#[track_caller]
pub fn dialog(
    ui: &Ui,
    title: impl Into<String>,
    message: impl Into<String>,
    buttons: Vec<DialogButton>,
) -> Modal {
    remedy_ui::widgets::dialog(ui, tr(&title.into()), tr(&message.into()), buttons)
}
