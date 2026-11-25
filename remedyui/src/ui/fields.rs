//! Controls bound to the forms' text fields: exact decimal inputs (the forms pack's number
//! input, shown without trailing zeros), text inputs and choices.

use std::cell::Cell;
use std::cmp::Ordering;
use std::rc::Rc;

use super::tw as w;
use remedy_ui::forms::{self, NumberOptions};
use remedy_ui::i18n::Decimal;
use remedy_ui::reactive::{Signal, untrack};
use remedy_ui::{El, Ui};

/// Fraction digits a field keeps: enough for every number the shipped app wrote
/// (`String(n)` has at most 17 significant digits, at most 23 after the point below 1).
pub const PRECISION: u8 = 24;

/// The field's options: a range, a step, and free decimals shown without trailing zeros.
pub fn opts(min: Option<f64>, max: Option<f64>, step: &str) -> NumberOptions {
    let mut o = NumberOptions::default().precision(PRECISION).min_fraction_digits(0);
    o = o.step(Decimal::parse(step).unwrap_or(Decimal::ONE));
    if let Some(m) = min.and_then(|m| Decimal::from_f64(m, 4)) {
        o = o.min(m);
    }
    if let Some(m) = max.and_then(|m| Decimal::from_f64(m, 4)) {
        o = o.max(m);
    }
    o
}

/// The decimal a form's text holds (the shipped app's strings are plain decimals).
pub fn parse_dec(s: &str) -> Option<Decimal> {
    Decimal::parse(crate::js::trim(s)).ok()
}

fn same(a: Decimal, b: Decimal) -> bool {
    a.cmp(&b) == Ordering::Equal
}

/// A number field bound to a form's text: `get` reads the text (tracked), `set` gets what
/// the person typed. The form's own changes (a % following a weight) show in the field; the
/// person's typing reaches the form only when the number changed.
pub fn decimal(
    ui: &Ui,
    label: impl Into<String>,
    options: NumberOptions,
    get: impl Fn() -> String + 'static,
    set: impl Fn(String) + 'static,
) -> El {
    let get = Rc::new(get);
    let initial = untrack(|| get());
    let value = Signal::new(parse_dec(&initial).unwrap_or(Decimal::ZERO));
    // The limits are for typing. The form's own numbers can pass them (a weight over the total
    // oils makes its % pass 100), and the engine moves a value inside its limits, which would
    // rewrite what was typed; so the limits stretch to hold the number shown.
    let (min, max) = (options.min, options.max);
    let el = forms::number_input_within(ui, crate::i18n::tr(&label.into()), value, options, move || {
        let v = value.get_untracked().ok();
        let low = min.map(|m| v.filter(|v| *v < m).unwrap_or(m));
        let high = max.map(|m| v.filter(|v| *v > m).unwrap_or(m));
        (low, high)
    });
    let g = get.clone();
    let el = el.bind(move || {
        let text = g();
        if let Some(d) = parse_dec(&text)
            && value.get_untracked().map_or(true, |v| !same(v, d))
        {
            value.set(d);
        }
    });
    let first = Cell::new(true);
    el.bind(move || {
        let d = value.get();
        if first.replace(false) {
            return;
        }
        let cur = untrack(|| get());
        if parse_dec(&cur).is_none_or(|c| !same(c, d)) {
            set(d.to_string());
        }
    })
}

/// A one-line text input bound to a form's text.
pub fn text(
    ui: &Ui,
    label: &str,
    placeholder: &str,
    multi: bool,
    get: impl Fn() -> String + 'static,
    set: impl Fn(String) + 'static,
) -> El {
    let field = if multi { w::text_area(ui, label) } else { w::text_input(ui, label) }
        .placeholder(crate::i18n::tr(placeholder));
    let get = Rc::new(get);
    field.set_value(&untrack(|| get()));
    let f2 = field.clone();
    let field = field.on_change(move || set(f2.value()));
    let f3 = field.clone();
    let el = field.el();
    let e2 = el.clone();
    let el = el.bind(move || {
        let v = get();
        if !e2.is_focused() && untrack(|| f3.value()) != v {
            f3.set_value(&v);
        }
    });
    w::field(ui, label, el)
}

/// A choice among `options` bound to an index the form keeps (`get`, `set`).
pub fn choice(
    ui: &Ui,
    label: &str,
    options: Vec<String>,
    get: impl Fn() -> usize + 'static,
    set: impl Fn(usize) + 'static,
) -> El {
    let sel = Signal::new(untrack(&get));
    let el = w::select(ui, label, options, sel).bind(move || {
        let i = get();
        sel.set_if_changed(i);
    });
    let first = Cell::new(true);
    el.bind(move || {
        let i = sel.get();
        if first.replace(false) {
            return;
        }
        set(i);
    })
}

/// Changes the value in `s` and returns what `f` returned (a toast, mostly).
pub fn act<T: 'static, R>(s: Signal<T>, f: impl FnOnce(&mut T) -> R) -> Option<R> {
    let mut out = None;
    s.update(|v| out = Some(f(v)));
    out
}
