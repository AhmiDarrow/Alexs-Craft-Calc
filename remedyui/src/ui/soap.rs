//! The soap calculator screen.

use std::rc::Rc;

use super::tw::{self as w, MenuItem};
use remedy_ui::a11y::{Role, Semantics};
use remedy_ui::core::{CornerRadii, Insets, Rect};
use remedy_ui::layout::{Align, Length};
use remedy_ui::paint::Brush;
use remedy_ui::reactive::{Memo, Signal};
use remedy_ui::style::States;
use remedy_ui::{El, show};
use serde_json::Value;

use super::fields::{self, opts};
use super::{Ctx, card_head, stat};
use crate::data;
use crate::js;
use crate::soap::{AmountUnit, Lye, SoapResult, Unit, WaterMethod};
use crate::soap_form::{PRESETS, SoapForm, fmt_num, quality_bar_pos};
use crate::storage::{self, PackKind};

/// The soap form and its results, shared by the screen's parts.
#[derive(Clone, Copy)]
struct S {
    form: Signal<SoapForm>,
    result: Memo<SoapResult>,
    row_keys: Signal<Vec<u64>>,
    add_keys: Signal<Vec<u64>>,
}

fn today() -> String {
    let ms = storage::now_ms();
    let days = (ms / 86_400_000) as i64;
    let (y, m, d) = storage::civil_from_days(days);
    format!("{m}/{d}/{y}")
}

/// The screen.
pub fn screen(ctx: &Ctx) -> El {
    let ui = &ctx.ui;
    let form = ctx.soap;
    let result = Memo::new(move || form.with(SoapForm::result));
    let row_keys = Signal::new(Vec::<u64>::new());
    let add_keys = Signal::new(Vec::<u64>::new());
    let s = S { form, result, row_keys, add_keys };
    let unit = ui.theme().spacing.unit;
    w::column(ui)
        .gap(unit * 3.0)
        .fill_width()
        .bind(move || {
            let (rk, ak) = form.with(|f| {
                (
                    f.rows.iter().map(|r| r.key).collect::<Vec<_>>(),
                    f.additive_rows.iter().map(|r| r.key).collect::<Vec<_>>(),
                )
            });
            row_keys.set_if_changed(rk);
            add_keys.set_if_changed(ak);
        })
        .child(head(ctx, s))
        .child(recipe_card(ctx, s))
        .child(oils_card(ctx, s))
        .child(additives_card(ctx, s))
        .child(
            w::wrap(ui)
                .gap(unit * 3.0)
                .fill_width()
                .child(lye_card(ctx, s).layout(|l| {
                    l.grow = 1.0;
                    l.width = Length::Auto;
                    l.basis = Length::Px(300.0);
                    l.min_width = Length::Px(300.0_f32.min(160.0));
                    l.shrink = 1.0;
                }))
                .child(water_card(ctx, s).layout(|l| {
                    l.grow = 1.0;
                    l.width = Length::Auto;
                    l.basis = Length::Px(300.0);
                    l.min_width = Length::Px(300.0_f32.min(160.0));
                    l.shrink = 1.0;
                })),
        )
        .child(results_card(ctx, s))
}

fn head(ctx: &Ctx, s: S) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let form = s.form;
    let unit_sel = Signal::new(1usize);
    let units = w::segmented(ui, "Weight unit", &["g", "oz", "lb"], unit_sel)
        .bind(move || {
            let i = form.with(|f| Unit::ALL.iter().position(|u| *u == f.unit).unwrap_or(1));
            unit_sel.set_if_changed(i);
        })
        .bind(move || {
            let i = unit_sel.get();
            let next = Unit::ALL[i.min(2)];
            if form.with_untracked(|f| f.unit != next).unwrap_or(false) {
                form.update(|f| f.on_unit_change(next));
            }
        });
    let c = ctx.clone();
    let help = w::button(ui, "Help", move || c.open_wiki(Some("app-soap-ui"))).variant("quiet");
    let c = ctx.clone();
    let reset = w::button(ui, "Reset", move || {
        let msg = fields::act(form, |f| f.reset_defaults()).unwrap_or_default();
        c.toast(&msg);
    })
    .variant("quiet");
    w::wrap(ui)
        .gap(unit * 2.0)
        .align(Align::Center)
        .fill_width()
        .child(
            w::column(ui).grow(1.0).child(w::heading(ui, 2, "Soap Calculator")).child(
                w::text(ui, "Cold-process lye, water & fragrance — live as you type.").variant("muted"),
            ),
        )
        .child(w::row(ui).gap(unit).align(Align::Center).child(units).child(help).child(reset))
}

/// Recipe name, Save / Saved / Load / Share / Copy / Print, notes and the saved list.
fn recipe_card(ctx: &Ctx, s: S) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let form = s.form;
    let name = fields::text(
        ui,
        "Recipe name",
        "e.g. Lavender everyday bar",
        false,
        move || form.with(|f| f.recipe_name.clone()),
        move |v| form.update(|f| f.recipe_name = crate::js::slice16(&v, 120)),
    );
    let c = ctx.clone();
    let save = w::button(
        ui,
        move || if form.with(|f| f.active_recipe_id.is_some()) { "Update" } else { "Save" }.to_owned(),
        move || save_recipe(&c, form),
    )
    .variant("primary");
    let saved_count = ctx.soap_saved;
    let saved_btn = w::button(
        ui,
        move || {
            if form.with(|f| f.show_saved) {
                "Hide saved".to_owned()
            } else {
                format!("Saved ({})", saved_count.with(Vec::len))
            }
        },
        move || form.update(|f| f.show_saved = !f.show_saved),
    );
    let c = ctx.clone();
    let load = w::button(ui, "Load", move || load_file(&c, form));
    w::tooltip(&load, "Load a recipe or library backup file into Saved");
    let c = ctx.clone();
    let share = w::button(ui, "Share", move || share_recipe(&c, form));
    w::tooltip(
        &share,
        "Share recipe (phone share sheet or download). Right-click / long-press: share full library",
    );
    let c = ctx.clone();
    let share = w::context_menu(&share, move || {
        let c = c.clone();
        vec![MenuItem::new(crate::i18n::tr("Share full library"), move || share_library(&c))]
    });
    let c = ctx.clone();
    let copy = w::button(ui, "Copy", move || {
        c.copy(form.with(SoapForm::format_recipe_text), "Recipe copied to clipboard")
    });
    w::tooltip(&copy, "Copy batch text");
    let c = ctx.clone();
    let print = w::button(ui, "Print", move || {
        super::wiki::print_sheet(
            &c,
            "Soap Recipe",
            "Alex's Craft Calc — Soap",
            &form.with(SoapForm::format_recipe_text),
            "Craft planning only. Verify SAP values. Lye is caustic.",
        )
    });
    let notes = fields::text(
        ui,
        "Custom recipe notes",
        "Batch notes, scent blend, colorants, cure log, mold, customer order…",
        true,
        move || form.with(|f| f.recipe_notes.clone()),
        move |v| form.update(|f| f.recipe_notes = crate::js::slice16(&v, 4000)),
    );
    let slot_hint = show(ui, move || form.with(|f| f.active_recipe_id.is_some()), {
        let u = ui.clone();
        move || {
            w::text(&u, "Editing saved recipe — Save updates this library slot (or rename to keep both).")
                .variant("muted")
        }
    })
    .el();
    let c = ctx.clone();
    let list = show(ui, move || form.with(|f| f.show_saved), move || saved_list(&c, form)).el();
    w::card(ui)
        .gap(unit * 2.0)
        .padding(Insets::all(unit * 3.0))
        .fill_width()
        .child(
            w::wrap(ui)
                .gap(unit)
                .align(Align::End)
                .fill_width()
                .child(name.layout(|l| {
                    l.grow = 1.0;
                    l.width = Length::Auto;
                    l.basis = Length::Px(220.0);
                    l.min_width = Length::Px(220.0_f32.min(160.0));
                    l.shrink = 1.0;
                }))
                .child(
                    w::wrap(ui)
                        .gap(unit)
                        .child(save)
                        .child(saved_btn)
                        .child(load)
                        .child(share)
                        .child(copy)
                        .child(print),
                ),
        )
        .child(notes)
        .child(slot_hint)
        .child(list)
}

fn saved_list(ctx: &Ctx, form: Signal<SoapForm>) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let saved = ctx.soap_saved;
    let c = ctx.clone();
    let col = w::column(ui).gap(unit).fill_width();
    let empty = show(ui, move || saved.with(Vec::is_empty), {
        let u = ui.clone();
        move || w::text(&u, "No saved soap recipes yet.").variant("muted")
    })
    .el();
    let share_all = show(ui, move || !saved.with(Vec::is_empty), {
        let c = c.clone();
        move || {
            let c2 = c.clone();
            let b = w::button(&c.ui, "Share library", move || share_library(&c2));
            w::tooltip(&b, "Share or download every saved soap + candle recipe");
            b
        }
    })
    .el();
    let c = ctx.clone();
    let rows = w::for_each(
        &w::column(ui).gap(unit / 2.0).fill_width(),
        saved,
        |r: &storage::SoapRecipe| r.id.clone(),
        move |r| saved_row(&c, form, r),
    );
    col.child(empty).child(share_all).child(rows)
}

fn saved_row(ctx: &Ctx, form: Signal<SoapForm>, r: &storage::SoapRecipe) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let when = super::wiki::format_saved_at(ui, &r.saved_at);
    let meta = format!(
        "{}{}{}",
        crate::i18n::tr(&format!(
            "{} oils · {} · SF {}%",
            r.oils.len(),
            r.lye_type.to_uppercase(),
            js::to_string(r.superfat_pct)
        )),
        r.total_oils_weight.map(|t| format!(" · {} {}", fmt_num(t, 2), r.unit)).unwrap_or_default(),
        if when.is_empty() { String::new() } else { format!(" · {when}") },
    );
    let (c, rec) = (ctx.clone(), r.clone());
    let id = r.id.clone();
    let load = w::button(ui, r.name.clone(), move || {
        let msg = fields::act(form, |f| f.load_recipe(&rec)).unwrap_or_default();
        c.toast(&msg);
    })
    .variant("quiet")
    .justify(remedy_ui::layout::Justify::Start)
    .grow(1.0);
    let notes =
        if r.notes.is_some() { format!(" · {}", crate::i18n::t("common.notes")) } else { String::new() };
    let label = format!("{} — {meta}{notes}", r.name);
    let load = load.semantics(
        Semantics::new(Role::Button).label(crate::i18n::tr(&label)).action(remedy_ui::a11y::Action::Click),
    );
    let (c, id2) = (ctx.clone(), id.clone());
    let del = w::icon_button(ui, w::Icon::Close, format!("Delete {}", r.name), move || {
        match c.lib.delete_soap(&id2) {
            Ok(()) => {
                form.update(|f| {
                    if f.active_recipe_id.as_deref() == Some(id2.as_str()) {
                        f.active_recipe_id = None;
                    }
                });
                c.refresh();
                c.toast("Recipe deleted");
            }
            Err(e) => c.toast(&e),
        }
    });
    let row = w::row(ui)
        .gap(unit)
        .align(Align::Center)
        .fill_width()
        .child(
            w::column(ui)
                .grow(1.0)
                .child(load)
                .child(w::text(ui, meta).variant("muted"))
                .child(if r.notes.is_some() { w::badge(ui, "notes") } else { w::column(ui) }),
        )
        .child(del)
        .variant("saved_item");
    let el = row.clone();
    row.bind(move || {
        let active = form.with(|f| f.active_recipe_id.as_deref() == Some(id.as_str()));
        el.state(States::SELECTED, active);
    })
}

fn save_recipe(ctx: &Ctx, form: Signal<SoapForm>) {
    let payload =
        form.with_untracked(|f| f.save_payload(&format!("Soap {}", today()))).unwrap_or(Value::Null);
    let name = payload["name"].as_str().unwrap_or_default().to_owned();
    let active = form.with_untracked(|f| f.active_recipe_id.clone()).ok().flatten();
    let list = ctx.lib.soap();
    let collision =
        storage::soap_name_collision(&list, &name, active.as_deref()).map(|r| (r.id.clone(), r.name.clone()));
    let c = ctx.clone();
    let commit = move || match c.lib.save_soap(&payload) {
        Ok(saved) => {
            let name = saved.recipe.name.clone();
            form.update(|f| {
                f.active_recipe_id = Some(saved.recipe.id.clone());
                f.recipe_name = name.clone();
            });
            c.refresh();
            c.toast(&if saved.overwritten {
                format!("Updated “{name}”")
            } else {
                format!("Saved “{name}”")
            });
        }
        Err(e) => c.toast(&e),
    };
    match collision {
        Some((cid, cname)) if Some(cid.as_str()) != active.as_deref() => {
            let commit = Rc::new(commit);
            let _ = w::dialog(
                &ctx.ui,
                "Overwrite saved recipe?",
                format!("A saved soap recipe named “{cname}” already exists. Overwrite it?"),
                vec![
                    w::DialogButton::new(crate::i18n::tr("Overwrite"), "danger", move || commit()),
                    w::DialogButton::new(crate::i18n::tr("Cancel"), "quiet", || {}),
                ],
            );
        }
        _ => commit(),
    }
}

fn load_file(ctx: &Ctx, form: Signal<SoapForm>) {
    let c = ctx.clone();
    ctx.pick_file(move |text| {
        let text = match text {
            Ok(t) => t,
            Err(e) => return c.toast(&e),
        };
        let parsed = match storage::parse_share_payload(&text) {
            Ok(p) => p,
            Err(e) => return c.toast(&e),
        };
        match c.lib.merge(&parsed) {
            Ok(merged) => {
                c.refresh();
                if let Some(last) = &merged.last_soap
                    && parsed.kind == PackKind::Soap
                    && parsed.soap.len() == 1
                    && parsed.candle.is_empty()
                {
                    let last = last.clone();
                    let _ = fields::act(form, |f| f.load_recipe(&last));
                }
                c.toast(&storage::import_summary(&merged));
            }
            Err(e) => c.toast(&e),
        }
    });
}

fn share_recipe(ctx: &Ctx, form: Signal<SoapForm>) {
    let Ok((payload, text)) =
        form.with_untracked(|f| (f.save_payload(&format!("Soap {}", today())), f.format_recipe_text()))
    else {
        return;
    };
    // `currentSoapSnapshot`: the live recipe, normalised like a saved one.
    let mut fields = payload.as_object().cloned().unwrap_or_default();
    if !fields.contains_key("id") {
        fields.insert("id".into(), Value::String(format!("soap-live-{}", js::base36(storage::now_ms()))));
    }
    fields.insert("savedAt".into(), Value::String(storage::iso_from_ms(storage::now_ms())));
    let recipe = storage::normalize_soap(&Value::Object(fields), false);
    let pack = storage::share_pack(PackKind::Soap, std::slice::from_ref(&recipe), &[]);
    let date = storage::iso_from_ms(storage::now_ms())[..10].to_owned();
    let file = storage::pack_filename(PackKind::Soap, std::slice::from_ref(&recipe), &[], &date);
    let msg = storage::pack_share_text(PackKind::Soap, std::slice::from_ref(&recipe), &[], Some(&text));
    ctx.share_pack(file, format!("Soap: {}", recipe.name), msg, storage::pack_to_json(&pack));
}

/// Shares (or saves) the whole library, soap and candle.
pub fn share_library(ctx: &Ctx) {
    let (soap, candle) = (ctx.lib.soap(), ctx.lib.candle());
    let n = soap.len() + candle.len();
    if n == 0 {
        ctx.toast("No saved recipes to share");
        return;
    }
    let pack = storage::share_pack(PackKind::Library, &soap, &candle);
    let date = storage::iso_from_ms(storage::now_ms())[..10].to_owned();
    let file = storage::pack_filename(PackKind::Library, &soap, &candle, &date);
    let msg = storage::pack_share_text(PackKind::Library, &soap, &candle, None);
    ctx.share_pack(file, format!("Alex's Craft Calc library ({n})"), msg, storage::pack_to_json(&pack));
}

/// The oil names for the oil choice, the empty choice first.
fn oil_options() -> Vec<String> {
    std::iter::once("— Select oil —".to_owned())
        .chain(data::data().oils.iter().map(|o| o.name.clone()))
        .collect()
}

fn oil_index(id: &str) -> usize {
    data::data().oils.iter().position(|o| o.id == id).map_or(0, |i| i + 1)
}

fn oils_card(ctx: &Ctx, s: S) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let form = s.form;
    let u = move || form.with(|f| f.u().to_owned());
    let total = fields::decimal(
        ui,
        "Total oils weight",
        opts(Some(0.0), None, "1"),
        move || form.with(|f| f.total_oils_weight.clone()),
        move |v| form.update(|f| f.on_total_oils_change(&v)),
    );
    let total_label = w::text(ui, move || format!("Total oils weight ({})", u())).variant("strong");
    let c = ctx.clone();
    let scale = w::button(ui, "Scale weights to total", move || {
        let m = fields::act(form, |f| f.scale_weights_to_ceiling()).unwrap_or_default();
        c.toast(&m);
    })
    .variant("primary");
    w::tooltip(&scale, "Scale current oil weights so they sum to Total oils (keeps ratios)");
    let c = ctx.clone();
    let apply = w::button(ui, "Apply % to weights", move || {
        let m = fields::act(form, |f| f.apply_percents_to_ceiling()).unwrap_or_default();
        c.toast(&m);
    });
    w::tooltip(&apply, "Set each oil weight from its % × Total oils");
    let hint = w::text(
        ui,
        "Total oils is your batch size. Type a weight or a % on any oil — the other updates live. Results unlock when the oils add up to Total oils (100%); press Recalculate to balance them for you.",
    )
    .variant("muted");

    let c = ctx.clone();
    let custom = w::button(ui, "Custom", move || {
        let m = fields::act(form, |f| f.start_custom_recipe()).unwrap_or_default();
        c.toast(&m);
    })
    .variant("primary");
    w::tooltip(&custom, "Start empty — no oils or butters preloaded");
    let presets = PRESETS.iter().enumerate().fold(w::wrap(ui).gap(unit).child(custom), |r, (i, p)| {
        let c = ctx.clone();
        r.child(w::button(ui, p.name, move || {
            let m = fields::act(form, |f| f.apply_preset(&PRESETS[i])).unwrap_or_default();
            c.toast(&m);
        }))
    });

    let header = w::row(ui)
        .gap(unit)
        .fill_width()
        .child(w::text(ui, "Oil").variant("muted").grow(2.0))
        .child(w::text(ui, move || format!("Weight ({})", u())).variant("muted").grow(1.0))
        .child(w::text(ui, "% of total").variant("muted").grow(1.0));
    let empty = show(ui, move || form.with(|f| f.rows.is_empty()), {
        let u2 = ui.clone();
        move || {
            w::column(&u2)
                .gap(unit)
                .align(Align::Center)
                .child(w::text(&u2, "No oils yet — this is a blank custom recipe."))
                .child(
                    w::button(&u2, "+ Add first oil", move || {
                        form.update(|f| {
                            f.add_row();
                        });
                    })
                    .variant("primary"),
                )
        }
    })
    .el();
    let c = ctx.clone();
    let rows = w::for_each(
        &w::column(ui).gap(unit).fill_width(),
        s.row_keys,
        |k: &u64| *k,
        move |k| oil_row(&c, form, *k),
    );
    let add = w::button(ui, "+ Add oil", move || {
        form.update(|f| {
            f.add_row();
        });
    });
    let status = w::column(ui)
        .gap(unit / 2.0)
        .padding(Insets::all(unit))
        .fill_width()
        .child(w::text(ui, move || form.with(SoapForm::status_totals)).variant("strong"))
        .child(w::text(ui, move || form.with(SoapForm::status_hint)))
        .variant("status");
    let c = ctx.clone();
    let recalc = recalc_button(&c, form);
    let st = status.clone();
    let status = status
        .bind(move || {
            let (ok, bad) =
                form.with(|f| (f.recipe_balanced(), f.parsed_total_oils() > 0.0 && !f.recipe_balanced()));
            st.state(States::CHECKED, ok);
            st.state(States::INVALID, bad);
        })
        .semantics(move || {
            Semantics::new(Role::Status).label(form.with(|f| {
                format!("{} — {}", crate::i18n::tr(&f.status_totals()), crate::i18n::tr(&f.status_hint()))
            }))
        });
    w::card(ui)
        .gap(unit * 2.0)
        .padding(Insets::all(unit * 3.0))
        .fill_width()
        .child(card_head(ui, "Weight of oils", vec![w::badge(ui, "Ceiling")]))
        .child(total_label)
        .child(total)
        .child(w::wrap(ui).gap(unit).child(scale).child(apply))
        .child(hint)
        .child(card_head(ui, "Oils & butters", vec![presets]))
        .child(header)
        .child(empty)
        .child(rows)
        .child(w::wrap(ui).gap(unit).child(add).child(recalc))
        .child(status)
}

/// Recalculate: balances the oils against Total oils so the results unlock.
fn recalc_button(ctx: &Ctx, form: Signal<SoapForm>) -> El {
    let c = ctx.clone();
    let b = w::button(&ctx.ui, "Recalculate", move || {
        let m = fields::act(form, |f| f.recalculate()).unwrap_or_default();
        c.toast(&m);
    })
    .variant("primary");
    w::tooltip(&b, "Balance the oils against Total oils and refresh the results");
    b
}

fn oil_row(ctx: &Ctx, form: Signal<SoapForm>, key: u64) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let row = move |f: &SoapForm| f.rows.iter().find(|r| r.key == key).cloned();
    let oil_name = move || {
        form.with(|f| row(f).and_then(|r| data::oil(&r.oil_id)).map(|o| o.name.clone()).unwrap_or_default())
    };
    let choice = fields::choice(
        ui,
        "Select oil or butter",
        oil_options(),
        move || form.with(|f| row(f).map_or(0, |r| oil_index(&r.oil_id))),
        move |i| {
            let id = if i == 0 { String::new() } else { data::data().oils[i - 1].id.clone() };
            form.update(|f| f.update_row_oil(key, &id));
        },
    );
    let c = ctx.clone();
    let info = w::button(ui, "i", move || {
        if let Some(id) =
            form.with_untracked(|f| row(f).map(|r| r.oil_id)).ok().flatten().filter(|s| !s.is_empty())
        {
            c.open_wiki(Some(&crate::wiki::oil_wiki_id(&id)));
        }
    })
    .disabled(move || form.with(|f| row(f).is_none_or(|r| r.oil_id.is_empty())))
    .semantics(move || {
        let n = oil_name();
        Semantics::new(Role::Button)
            .label(crate::i18n::tr(&format!("Wiki: {}", if n.is_empty() { "oil".to_owned() } else { n })))
            .action(remedy_ui::a11y::Action::Click)
    });
    w::tooltip(&info, move || {
        form.with(|f| {
            row(f)
                .and_then(|r| data::oil(&r.oil_id))
                .and_then(|o| o.notes.clone())
                .unwrap_or_else(|| "Oil info".into())
        })
    });
    let weight = fields::decimal(
        ui,
        "Weight",
        opts(Some(0.0), None, "any"),
        move || form.with(|f| row(f).map(|r| r.amount).unwrap_or_default()),
        move |v| form.update(|f| f.update_row_weight(key, &v)),
    );
    let pct = fields::decimal(
        ui,
        "Percent of total",
        opts(Some(0.0), Some(100.0), "any").unit("%"),
        move || form.with(|f| row(f).map(|r| r.pct).unwrap_or_default()),
        move |v| form.update(|f| f.update_row_pct(key, &v)),
    );
    let p2 = pct.clone();
    let pct = pct.bind(move || {
        let over = form.with(|f| row(f).is_some_and(|r| f.row_over_max(&r)));
        p2.state(States::INVALID, over);
    });
    let remove = w::icon_button(ui, w::Icon::Close, "Remove oil", move || form.update(|f| f.remove_row(key)));
    w::wrap(ui)
        .gap(unit)
        .align(Align::Center)
        .fill_width()
        .child(w::row(ui).gap(unit / 2.0).align(Align::Center).child(choice.grow(1.0)).child(info).layout(
            |l| {
                l.grow = 2.0;
                l.width = Length::Auto;
                l.basis = Length::Px(220.0);
                l.min_width = Length::Px(220.0_f32.min(160.0));
                l.shrink = 1.0;
            },
        ))
        .child(weight.layout(|l| {
            l.grow = 1.0;
            l.width = Length::Auto;
            l.basis = Length::Px(110.0);
            l.min_width = Length::Px(110.0_f32.min(160.0));
            l.shrink = 1.0;
        }))
        .child(pct.layout(|l| {
            l.grow = 1.0;
            l.width = Length::Auto;
            l.basis = Length::Px(90.0);
            l.min_width = Length::Px(90.0_f32.min(160.0));
            l.shrink = 1.0;
        }))
        .child(remove)
}

/// The additive choices: "Category · Name (min–max%)", the empty choice first.
fn additive_options() -> Vec<String> {
    let d = data::data();
    std::iter::once("— Select additive —".to_owned())
        .chain(d.additive_categories.iter().flat_map(|c| {
            d.additives.iter().filter(move |a| a.category == c.id).map(move |a| {
                format!(
                    "{} · {} ({}–{}%)",
                    c.label,
                    a.name,
                    js::to_string(a.usage_pct.min),
                    js::to_string(a.usage_pct.max)
                )
            })
        }))
        .collect()
}

/// The additives in the order of [`additive_options`].
fn additive_order() -> Vec<&'static data::Additive> {
    let d = data::data();
    d.additive_categories
        .iter()
        .flat_map(|c| d.additives.iter().filter(move |a| a.category == c.id))
        .collect()
}

fn additive_index(id: &str) -> usize {
    additive_order().iter().position(|a| a.id == id).map_or(0, |i| i + 1)
}

fn additives_card(ctx: &Ctx, s: S) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let form = s.form;
    let c = ctx.clone();
    let guide = w::link(ui, "Additive guide", move || c.open_wiki(Some("soap-additives")));
    let hint = w::text(
        ui,
        move || {
            format!(
                "Ground oats, clays, milks, salts, sugars, botanicals — enter by weight ({}) or spoon (tsp/tbsp). Usage is checked as % of oils; amounts add to your batch total. Spoon weights are approximate (powder packing varies).",
                form.with(|f| f.u().to_owned())
            )
        },
    )
    .variant("muted");
    let none = show(ui, move || form.with(|f| f.additive_rows.is_empty()), {
        let u = ui.clone();
        move || {
            w::text(&u, "None yet — pick an additive below (colloidal oats, kaolin, honey…).")
                .variant("muted")
        }
    })
    .el();
    let c = ctx.clone();
    let rows = w::for_each(
        &w::column(ui).gap(unit).fill_width(),
        s.add_keys,
        |k: &u64| *k,
        move |k| additive_row(&c, form, *k),
    );
    let mut add_opts = additive_options();
    add_opts[0] = "+ Add additive…".into();
    let pick = Signal::new(0usize);
    let add_select = w::select(ui, "Add additive", add_opts, pick).bind(move || {
        let i = pick.get();
        if i > 0 {
            let id = additive_order()[i - 1].id.clone();
            form.update(|f| {
                f.add_additive_row(&id);
            });
            pick.set(0);
        }
    });
    let add = w::button(ui, "+ Additive", move || {
        form.update(|f| {
            f.add_additive_row("");
        });
    });
    w::card(ui)
        .gap(unit * 2.0)
        .padding(Insets::all(unit * 3.0))
        .fill_width()
        .child(card_head(ui, "Additives & add-ins", vec![guide]))
        .child(hint)
        .child(none)
        .child(rows)
        .child(w::wrap(ui).gap(unit).child(add_select).child(add))
}

fn additive_row(ctx: &Ctx, form: Signal<SoapForm>, key: u64) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let row = move |f: &SoapForm| f.additive_rows.iter().find(|r| r.key == key).cloned();
    let choice = fields::choice(
        ui,
        "Select additive",
        additive_options(),
        move || form.with(|f| row(f).map_or(0, |r| additive_index(&r.additive_id))),
        move |i| {
            let id = if i == 0 { String::new() } else { additive_order()[i - 1].id.clone() };
            form.update(|f| f.update_additive_id(key, &id));
        },
    );
    let add_name = move || {
        form.with(|f| {
            row(f).and_then(|r| data::additive(&r.additive_id)).map(|a| a.name.clone()).unwrap_or_default()
        })
    };
    let c = ctx.clone();
    let info = w::button(ui, "i", move || c.open_wiki(Some("soap-additives")))
        .disabled(move || form.with(|f| row(f).is_none_or(|r| r.additive_id.is_empty())))
        .semantics(move || {
            let n = add_name();
            Semantics::new(Role::Button)
                .label(crate::i18n::tr(&format!(
                    "Wiki: {}",
                    if n.is_empty() { "additive".to_owned() } else { n }
                )))
                .action(remedy_ui::a11y::Action::Click)
        });
    w::tooltip(&info, move || {
        form.with(|f| {
            row(f)
                .and_then(|r| data::additive(&r.additive_id))
                .map(|a| a.benefits.clone())
                .unwrap_or_else(|| "Additive info".into())
        })
    });
    let amount = fields::decimal(
        ui,
        "Amount",
        opts(Some(0.0), None, "any"),
        move || form.with(|f| row(f).map(|r| r.amount).unwrap_or_default()),
        move |v| form.update(|f| f.update_additive_amount(key, &v)),
    );
    let units: Vec<String> = AmountUnit::ALL.iter().map(|u| u.as_str().to_owned()).collect();
    let unit_choice = fields::choice(
        ui,
        "Unit",
        units,
        move || {
            form.with(|f| {
                row(f).and_then(|r| AmountUnit::ALL.iter().position(|u| *u == r.amount_unit)).unwrap_or(0)
            })
        },
        move |i| form.update(|f| f.update_additive_amount_unit(key, AmountUnit::ALL[i.min(4)])),
    );
    let view = move || form.with(|f| row(f).map(|r| f.additive_row_view(&r)));
    let status = w::badge(ui, move || view().map(|v| v.label).unwrap_or_default());
    let st = status.clone();
    let status = status.bind(move || {
        let s = view().map_or("n/a", |v| v.status);
        st.state(States::CHECKED, s == "ok");
        st.state(States::INVALID, s == "low" || s == "high");
    });
    w::tooltip(&status, move || view().map(|v| v.title).unwrap_or_default());
    let meta = w::text(ui, move || view().map(|v| v.meta.join(" · ")).unwrap_or_default()).variant("muted");
    let remove = w::icon_button(ui, w::Icon::Close, "Remove additive", move || {
        form.update(|f| f.remove_additive_row(key))
    });
    w::column(ui)
        .gap(unit / 2.0)
        .fill_width()
        .child(
            w::wrap(ui)
                .gap(unit)
                .align(Align::Center)
                .fill_width()
                .child(
                    w::row(ui)
                        .gap(unit / 2.0)
                        .align(Align::Center)
                        .child(choice.grow(1.0))
                        .child(info)
                        .layout(|l| {
                            l.grow = 2.0;
                            l.width = Length::Auto;
                            l.basis = Length::Px(240.0);
                            l.min_width = Length::Px(240.0_f32.min(160.0));
                            l.shrink = 1.0;
                        }),
                )
                .child(
                    w::row(ui)
                        .gap(unit / 2.0)
                        .align(Align::Center)
                        .child(amount.grow(1.0))
                        .child(unit_choice)
                        .layout(|l| {
                            l.grow = 1.0;
                            l.width = Length::Auto;
                            l.basis = Length::Px(170.0);
                            l.min_width = Length::Px(170.0_f32.min(160.0));
                            l.shrink = 1.0;
                        }),
                )
                .child(status)
                .child(remove),
        )
        .child(meta)
}

fn lye_card(ctx: &Ctx, s: S) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let form = s.form;
    let lye = fields::choice(
        ui,
        "Lye type",
        vec!["NaOH (bar)".into(), "KOH (liquid)".into()],
        move || form.with(|f| usize::from(f.lye_type == Lye::Koh)),
        move |i| form.update(|f| f.lye_type = if i == 1 { Lye::Koh } else { Lye::Naoh }),
    );
    let sf = fields::decimal(
        ui,
        "Superfat %",
        opts(Some(0.0), Some(20.0), "0.5"),
        move || form.with(|f| f.superfat_pct.clone()),
        move |v| form.update(|f| f.superfat_pct = v),
    );
    let fo = fields::decimal(
        ui,
        "Fragrance % of oils",
        opts(Some(0.0), Some(10.0), "0.1"),
        move || form.with(|f| f.fragrance_pct.clone()),
        move |v| form.update(|f| f.fragrance_pct = v),
    );
    let (c1, c2) = (ctx.clone(), ctx.clone());
    w::card(ui)
        .gap(unit * 2.0)
        .padding(Insets::all(unit * 3.0))
        .child(w::heading(ui, 3, "Lye & superfat"))
        .child(w::field(ui, "Lye type", lye))
        .child(w::field(ui, "Superfat %", sf))
        .child(w::field(ui, "Fragrance % of oils", fo))
        .child(
            w::wrap(ui)
                .gap(unit)
                .child(w::link(ui, "Superfat guide", move || c1.open_wiki(Some("soap-superfat"))))
                .child(w::link(ui, "Lye safety", move || c2.open_wiki(Some("soap-lye-safety")))),
        )
}

fn water_card(ctx: &Ctx, s: S) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let form = s.form;
    let method = fields::choice(
        ui,
        "Method",
        vec!["Water as % of oils".into(), "Lye concentration".into(), "Water discount (from 38%)".into()],
        move || form.with(|f| WaterMethod::ALL.iter().position(|m| *m == f.water_method).unwrap_or(0)),
        move |i| form.update(|f| f.water_method = WaterMethod::ALL[i.min(2)]),
    );
    let is = move |m: WaterMethod| move || form.with(|f| f.water_method == m);
    let u = ui.clone();
    let pct = show(ui, is(WaterMethod::PercentOils), move || {
        w::field(
            &u,
            "Water % of oils",
            fields::decimal(
                &u,
                "Water % of oils",
                opts(Some(20.0), Some(45.0), "0.5"),
                move || form.with(|f| f.water_as_percent_of_oils.clone()),
                move |v| form.update(|f| f.water_as_percent_of_oils = v),
            ),
        )
    })
    .el();
    let u = ui.clone();
    let conc = show(ui, is(WaterMethod::LyeConcentration), move || {
        w::field(
            &u,
            "Lye concentration %",
            fields::decimal(
                &u,
                "Lye concentration %",
                opts(Some(25.0), Some(50.0), "0.5"),
                move || form.with(|f| f.lye_concentration_pct.clone()),
                move |v| form.update(|f| f.lye_concentration_pct = v),
            ),
        )
    })
    .el();
    let u = ui.clone();
    let disc = show(ui, is(WaterMethod::Discount), move || {
        w::field(
            &u,
            "Water discount %",
            fields::decimal(
                &u,
                "Water discount %",
                opts(Some(0.0), Some(40.0), "1"),
                move || form.with(|f| f.water_discount_pct.clone()),
                move |v| form.update(|f| f.water_discount_pct = v),
            ),
        )
    })
    .el();
    let c = ctx.clone();
    w::card(ui)
        .gap(unit * 2.0)
        .padding(Insets::all(unit * 3.0))
        .child(w::heading(ui, 3, "Water"))
        .child(w::field(ui, "Method", method))
        .child(pct)
        .child(conc)
        .child(disc)
        .child(w::link(ui, "Water methods explained", move || c.open_wiki(Some("soap-water"))))
}

fn results_card(ctx: &Ctx, s: S) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let (form, result) = (s.form, s.result);
    let u = move || form.with(|f| f.u().to_owned());
    let n = move |get: fn(&SoapResult) -> f64| {
        move || result.with(|r| if r.locked { "—".to_owned() } else { js::to_string(get(r)) })
    };
    let c = ctx.clone();
    let copy = w::button(ui, "Copy results", move || {
        c.copy(form.with(SoapForm::format_recipe_text), "Recipe copied to clipboard")
    })
    .disabled(move || result.with(|r| r.locked));
    let warnings = {
        let boxed = w::column(ui).gap(unit / 2.0).fill_width();
        let items = mirror(&boxed, move || result.with(|r| r.warnings.clone()));
        w::for_each(&boxed, items, |s: &String| s.clone(), {
            let u2 = ui.clone();
            move |m: &String| w::text(&u2, format!("• {m}")).variant("warning")
        })
    };
    let lye_label = move || form.with(|f| format!("{} (with SF)", f.lye_type.label()));
    let lye_stat = {
        let lab = Rc::new(lye_label);
        let l2 = lab.clone();
        stat(ui, "NaOH (with SF)", n(|r| r.lye_with_superfat), u, true).semantics(move || {
            Semantics::new(Role::Group).label(crate::i18n::tr(&l2())).value(crate::i18n::tr(
                &result.with(|r| if r.locked { "—".to_owned() } else { js::to_string(r.lye_with_superfat) }),
            ))
        })
    };
    let total_oils = move || {
        form.with(|f| {
            result.with(|r| {
                if r.locked { fmt_num(f.parsed_total_oils(), 2) } else { js::to_string(r.total_oils) }
            })
        })
    };
    let grid = w::wrap(ui)
        .gap(unit * 2.0)
        .fill_width()
        .child(lye_stat)
        .child(stat(ui, "Water", n(|r| r.water), u, false))
        .child(stat(ui, "Lye solution", n(|r| r.lye_solution), u, false))
        .child(stat(ui, "Fragrance", n(|r| r.fragrance), u, false))
        .child(stat(ui, "Total oils", total_oils, u, false))
        .child(stat(ui, "Batch total", n(|r| r.total_batch), u, false))
        .child(stat(ui, "Additives", n(|r| r.additive_total), u, false));
    let meta = w::text(ui, move || {
        result.with(|r| {
            let mut parts = vec![format!(
                "Pure lye 0% SF: {}",
                if r.locked { "—".to_owned() } else { format!("{} {}", js::to_string(r.pure_lye), u()) }
            )];
            if let Some(i) = r.weighted_iodine {
                parts.push(format!("Iodine: {}", js::to_string(i)));
            }
            if let Some(i) = r.weighted_ins {
                parts.push(format!("INS: {}", js::to_string(i)));
            }
            parts.join("   ")
        })
    });
    let c = ctx.clone();
    let quality =
        show(ui, move || result.with(|r| !r.locked && !r.quality.is_empty()), move || quality_panel(&c, s))
            .el();
    let c = ctx.clone();
    let breakdown =
        show(ui, move || result.with(|r| !r.locked && !r.oil_breakdown.is_empty()), move || breakdown(&c, s))
            .el();
    let c = ctx.clone();
    let adds = show(
        ui,
        move || result.with(|r| !r.locked && !r.additives.is_empty()),
        move || additive_breakdown(&c, s),
    )
    .el();
    let card = w::card(ui)
        .gap(unit * 2.0)
        .padding(Insets::all(unit * 3.0))
        .fill_width()
        .child(card_head(ui, "Batch results", vec![recalc_button(ctx, form), copy]))
        .child(warnings)
        .child(grid)
        .child(meta)
        .child(quality)
        .child(breakdown)
        .child(adds);
    let c2 = card.clone();
    card.bind(move || {
        let locked = result.with(|r| r.locked);
        c2.state(States::DISABLED, locked);
    })
}

fn quality_panel(ctx: &Ctx, s: S) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let (form, result) = (s.form, s.result);
    let c = ctx.clone();
    let how = w::link(ui, "How to read this", move || c.open_wiki(Some("soap-quality")));
    let quality = move || form.with(|f| result.with(|r| f.quality(r)));
    let grid = data::data().qualities.iter().fold(w::wrap(ui).gap(unit * 2.0).fill_width(), |g, def| {
        let key = def.key.clone();
        let k2 = key.clone();
        let metric = move || quality().into_iter().find(|q| q.key == k2);
        let m1 = Rc::new(metric);
        let (m2, m3, m4, m5) = (m1.clone(), m1.clone(), m1.clone(), m1.clone());
        let label = def.label.clone();
        let (min, max) = (def.min, def.max);
        let bar = ui.el("quality_track").fill_width().height(8.0).paint(move |cx| {
            let Some(q) = m2() else { return };
            let wdt = cx.size.width;
            let h = cx.size.height;
            let colors = &cx.theme.colors;
            let track = cx.theme.derive().line;
            cx.list.fill_rounded(Rect::new(0.0, 0.0, wdt, h), CornerRadii::all(h / 2.0), Brush::Solid(track));
            cx.list.fill_rounded(
                Rect::new(wdt * 0.25, 0.0, wdt * 0.75, h),
                CornerRadii::all(h / 2.0),
                Brush::Solid(colors.ok.with_alpha(0.45)),
            );
            let x = wdt * (quality_bar_pos(q.value, q.min, q.max) as f32) / 100.0;
            let color = if q.status == "good" { colors.ok } else { colors.warn };
            cx.list.fill_rounded(
                Rect::new((x - 3.0).max(0.0), -2.0, (x + 3.0).min(wdt), h + 2.0),
                CornerRadii::all(3.0),
                Brush::Solid(color),
            );
        });
        let value = w::text(ui, move || {
            m3().map(|q| {
                format!(
                    "{}  {}",
                    crate::i18n::tr(&q.value.map_or("—".into(), js::to_string)),
                    crate::i18n::tr(&format!("ideal {}–{}", js::to_string(min), js::to_string(max)))
                )
            })
            .unwrap_or_default()
        });
        let hint =
            w::text(ui, move || m4().filter(|q| q.status != "good").map(|q| q.hint).unwrap_or_default())
                .variant("muted");
        let l2 = label.clone();
        let cell = w::card(ui)
            .gap(unit / 2.0)
            .padding(Insets::all(unit * 1.5))
            .layout(|l| {
                l.grow = 1.0;
                l.width = Length::Auto;
                l.basis = Length::Px(220.0);
                l.min_width = Length::Px(220.0_f32.min(160.0));
                l.shrink = 1.0;
                l.max_width = Length::Px(420.0);
            })
            .child(w::row(ui).gap(unit).child(w::text(ui, label).variant("strong").grow(1.0)).child(value))
            .child(bar)
            .child(hint)
            .semantics(move || {
                let q = m5();
                let status = match q.as_ref().map(|q| q.status.as_str()) {
                    Some("good") => "In ideal range",
                    Some("low") => "Below ideal range",
                    _ => "Above ideal range",
                };
                Semantics::new(Role::Group).label(crate::i18n::tr(&l2)).value(format!(
                    "{} — {}",
                    crate::i18n::tr(&q.and_then(|q| q.value).map_or("—".into(), js::to_string)),
                    crate::i18n::tr(status)
                ))
            });
        let _ = key;
        g.child(cell)
    });
    let ratio = w::text(ui, move || {
        form.with(|f| result.with(|r| f.sat_ratio(r)))
            .map(|(s, u)| {
                format!(
                    "Saturated : unsaturated ≈ {}:{} — a typical balanced bar sits near 40:60.",
                    fmt_num(s, 0),
                    fmt_num(u, 0)
                )
            })
            .unwrap_or_default()
    });
    w::column(ui)
        .gap(unit * 1.5)
        .fill_width()
        .child(card_head(ui, "Quality profile", vec![how]))
        .child(grid)
        .child(ratio)
}

fn breakdown(ctx: &Ctx, s: S) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let (form, result) = (s.form, s.result);
    let c = ctx.clone();
    let list = {
        let boxed = w::column(ui).gap(unit / 2.0).fill_width();
        let items = mirror(&boxed, move || result.with(|r| r.oil_breakdown.clone()));
        w::for_each(
            &boxed,
            items,
            |b: &crate::soap::OilBreakdown| format!("{}{}", b.oil_id, b.name),
            move |b| {
                let id = b.oil_id.clone();
                let c2 = c.clone();
                let u = c.ui.clone();
                let line = format!(
                    "{} {} · {}%",
                    js::to_string(b.amount),
                    form.with_untracked(|f| f.u().to_owned()).unwrap_or_default(),
                    js::to_string(b.pct)
                );
                w::row(&u)
                    .gap(unit)
                    .fill_width()
                    .child(
                        w::link(&u, b.name.clone(), move || {
                            c2.open_wiki(Some(&crate::wiki::oil_wiki_id(&id)))
                        })
                        .grow(1.0),
                    )
                    .child(w::text(&u, line))
            },
        )
    };
    w::column(ui).gap(unit).fill_width().child(w::heading(ui, 3, "Oil breakdown")).child(list)
}

fn additive_breakdown(ctx: &Ctx, s: S) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let (form, result) = (s.form, s.result);
    let c = ctx.clone();
    let list = {
        let boxed = w::column(ui).gap(unit / 2.0).fill_width();
        let items = mirror(&boxed, move || result.with(|r| r.additives.clone()));
        w::for_each(
            &boxed,
            items,
            |a: &crate::soap::AdditiveResult| format!("{}{}{}", a.additive_id, a.amount, a.status),
            move |a| {
                let c2 = c.clone();
                let u = c.ui.clone();
                let unit_s = form.with_untracked(|f| f.u().to_owned()).unwrap_or_default();
                let (lo, hi) = (js::to_string(a.usage_min), js::to_string(a.usage_max));
                let tag = match a.status.as_str() {
                    "ok" => format!("OK {lo}–{hi}%"),
                    "low" => format!("Low {lo}–{hi}%"),
                    _ => format!("High max {hi}%"),
                };
                let title = match a.status.as_str() {
                    "ok" => format!("Within {lo}–{hi}% of oils"),
                    "low" => format!("Below recommended {lo}–{hi}% of oils"),
                    _ => format!("Above recommended {lo}–{hi}% of oils"),
                };
                let chip = w::badge(
                    &u,
                    format!(
                        "{} {unit_s} · {}% · {tag}",
                        js::to_string(a.amount),
                        js::to_string(a.pct_of_oils)
                    ),
                );
                chip.state(States::INVALID, a.status != "ok");
                chip.state(States::CHECKED, a.status == "ok");
                w::tooltip(&chip, title);
                w::row(&u)
                    .gap(unit)
                    .fill_width()
                    .child(
                        w::link(&u, a.name.clone(), move || c2.open_wiki(Some("soap-additives"))).grow(1.0),
                    )
                    .child(chip)
            },
        )
    };
    w::column(ui).gap(unit).fill_width().child(w::heading(ui, 3, "Additives & add-ins")).child(list)
}

/// A list signal that follows `f`, for keyed lists of derived values; the binding lives on
/// `el` (the list's container), so it goes when the list does.
pub fn mirror<T: Clone + PartialEq + 'static>(el: &El, f: impl Fn() -> Vec<T> + 'static) -> Signal<Vec<T>> {
    let s = Signal::new(remedy_ui::reactive::untrack(&f));
    let _ = el.clone().bind(move || s.set_if_changed(f()));
    s
}
