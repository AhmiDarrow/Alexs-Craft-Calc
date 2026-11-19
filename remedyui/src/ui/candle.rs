//! The candle calculator screen.

use remedy_ui::a11y::{Role, Semantics};
use remedy_ui::core::Insets;
use remedy_ui::layout::{Align, Length};
use remedy_ui::reactive::{Memo, Signal};
use remedy_ui::style::States;
use remedy_ui::widgets::{self as w, MenuItem};
use remedy_ui::{El, show};
use serde_json::Value;

use super::fields::{self, opts};
use super::soap::{mirror, share_library};
use super::{Ctx, card_head, stat};
use crate::candle::CandleResult;
use crate::candle_form::{CandleForm, FoPreset};
use crate::data;
use crate::js;
use crate::soap::Unit;
use crate::storage::{self, PackKind};

/// The screen.
pub fn screen(ctx: &Ctx) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let form = Signal::new(CandleForm::new());
    let result = Memo::new(move || form.with(CandleForm::result));
    w::column(ui)
        .gap(unit * 3.0)
        .fill_width()
        .child(head(ctx, form))
        .child(recipe_card(ctx, form))
        .child(
            w::wrap(ui)
                .gap(unit * 3.0)
                .fill_width()
                .child(wax_card(ctx, form).layout(|l| {
                    l.grow = 1.0;
                    l.width = Length::Auto;
                    l.basis = Length::Px(300.0);
                    l.min_width = Length::Px(300.0_f32.min(160.0));
                    l.shrink = 1.0;
                }))
                .child(fragrance_card(ctx, form).layout(|l| {
                    l.grow = 1.0;
                    l.width = Length::Auto;
                    l.basis = Length::Px(300.0);
                    l.min_width = Length::Px(300.0_f32.min(160.0));
                    l.shrink = 1.0;
                })),
        )
        .child(results_card(ctx, form, result))
}

fn head(ctx: &Ctx, form: Signal<CandleForm>) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let units = fields::choice(
        ui,
        "Unit",
        vec!["grams".into(), "ounces".into(), "pounds".into()],
        move || form.with(|f| Unit::ALL.iter().position(|u| *u == f.unit).unwrap_or(0)),
        move |i| form.update(|f| f.on_unit_change(Unit::ALL[i.min(2)])),
    );
    let c = ctx.clone();
    let reset = w::button(ui, "Reset", move || {
        let m = fields::act(form, CandleForm::reset_defaults).unwrap_or_default();
        c.toast(&m);
    })
    .variant("quiet");
    w::wrap(ui)
        .gap(unit * 2.0)
        .align(Align::Center)
        .fill_width()
        .child(
            w::column(ui)
                .grow(1.0)
                .child(w::heading(ui, 2, "Candle Calculator"))
                .child(w::text(ui, "Wax, fragrance load, dye guide & wick hints — live.").variant("muted")),
        )
        .child(w::row(ui).gap(unit).align(Align::Center).child(units).child(reset))
}

fn recipe_card(ctx: &Ctx, form: Signal<CandleForm>) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let name = fields::text(
        ui,
        "Recipe name",
        "e.g. Lavender 8oz soy run",
        false,
        move || form.with(|f| f.recipe_name.clone()),
        move |v| form.update(|f| f.recipe_name = js::slice16(&v, 120)),
    );
    let c = ctx.clone();
    let save = w::button(
        ui,
        move || if form.with(|f| f.active_recipe_id.is_some()) { "Update" } else { "Save" }.to_owned(),
        move || save_recipe(&c, form),
    )
    .variant("primary");
    let saved = ctx.candle_saved;
    let saved_btn = w::button(
        ui,
        move || {
            if form.with(|f| f.show_saved) {
                "Hide saved".to_owned()
            } else {
                format!("Saved ({})", saved.with(Vec::len))
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
        vec![MenuItem::new("Share full library", move || share_library(&c))]
    });
    let c = ctx.clone();
    let copy =
        w::button(ui, "Copy", move || c.copy(form.with(CandleForm::format_recipe_text), "Results copied"));
    w::tooltip(&copy, "Copy batch text");
    let c = ctx.clone();
    let print = w::button(ui, "Print", move || {
        super::wiki::print_sheet(
            &c,
            "Candle Recipe",
            "Alex's Craft Calc — Candle",
            &form.with(CandleForm::format_recipe_text),
            "Craft planning only. Verify FO limits and wick with test burns.",
        )
    });
    let notes = fields::text(
        ui,
        "Custom recipe notes",
        "Batch notes, FO blend, dye, wick size, cure log, customer order…",
        true,
        move || form.with(|f| f.recipe_notes.clone()),
        move |v| form.update(|f| f.recipe_notes = js::slice16(&v, 4000)),
    );
    let hint = show(ui, move || form.with(|f| f.active_recipe_id.is_some()), {
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
        .child(hint)
        .child(list)
}

fn saved_list(ctx: &Ctx, form: Signal<CandleForm>) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let saved = ctx.candle_saved;
    let empty = show(ui, move || saved.with(Vec::is_empty), {
        let u = ui.clone();
        move || w::text(&u, "No saved candle recipes yet.").variant("muted")
    })
    .el();
    let c = ctx.clone();
    let share_all = show(
        ui,
        move || !saved.with(Vec::is_empty),
        move || {
            let c2 = c.clone();
            let b = w::button(&c.ui, "Share library", move || share_library(&c2));
            w::tooltip(&b, "Share or download every saved soap + candle recipe");
            b
        },
    )
    .el();
    let c = ctx.clone();
    let rows = w::for_each(
        &w::column(ui).gap(unit / 2.0).fill_width(),
        saved,
        |r: &storage::CandleRecipe| r.id.clone(),
        move |r| saved_row(&c, form, r),
    );
    w::column(ui).gap(unit).fill_width().child(empty).child(share_all).child(rows)
}

fn saved_row(ctx: &Ctx, form: Signal<CandleForm>, r: &storage::CandleRecipe) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let when = super::wiki::format_saved_at(ui, &r.saved_at);
    let meta = format!(
        "{} · {} vessels · {}% FO{}",
        data::wax(&r.wax_id).map_or(r.wax_id.as_str(), |w| w.name.as_str()),
        js::to_string(r.vessel_count),
        js::to_string(r.fragrance_pct),
        if when.is_empty() { String::new() } else { format!(" · {when}") },
    );
    let (c, rec) = (ctx.clone(), r.clone());
    let load = w::button(ui, r.name.clone(), move || {
        let m = fields::act(form, |f| f.load_recipe(&rec)).unwrap_or_default();
        c.toast(&m);
    })
    .variant("quiet")
    .justify(remedy_ui::layout::Justify::Start)
    .semantics(
        Semantics::new(Role::Button)
            .label(format!("{} — {meta}{}", r.name, if r.notes.is_some() { " · notes" } else { "" }))
            .action(remedy_ui::a11y::Action::Click),
    );
    let (c, id) = (ctx.clone(), r.id.clone());
    let id2 = id.clone();
    let del = w::icon_button(ui, w::Icon::Close, format!("Delete {}", r.name), move || {
        match c.lib.delete_candle(&id2) {
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
        .child(del);
    let el = row.clone();
    row.bind(move || {
        let active = form.with(|f| f.active_recipe_id.as_deref() == Some(id.as_str()));
        el.state(States::SELECTED, active);
    })
}

fn save_recipe(ctx: &Ctx, form: Signal<CandleForm>) {
    let payload = form.with_untracked(CandleForm::save_payload).unwrap_or(Value::Null);
    let name = payload["name"].as_str().unwrap_or_default().to_owned();
    let active = form.with_untracked(|f| f.active_recipe_id.clone()).ok().flatten();
    let list = ctx.lib.candle();
    let collision = storage::candle_name_collision(&list, &name, active.as_deref())
        .map(|r| (r.id.clone(), r.name.clone()));
    let c = ctx.clone();
    let commit = move || match c.lib.save_candle(&payload) {
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
            let commit = std::rc::Rc::new(commit);
            let _ = w::dialog(
                &ctx.ui,
                "Overwrite saved recipe?",
                format!("A saved candle recipe named “{cname}” already exists. Overwrite it?"),
                vec![
                    w::DialogButton::new("Overwrite", "danger", move || commit()),
                    w::DialogButton::new("Cancel", "quiet", || {}),
                ],
            );
        }
        _ => commit(),
    }
}

fn load_file(ctx: &Ctx, form: Signal<CandleForm>) {
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
                if let Some(last) = &merged.last_candle
                    && parsed.kind == PackKind::Candle
                    && parsed.candle.len() == 1
                    && parsed.soap.is_empty()
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

fn share_recipe(ctx: &Ctx, form: Signal<CandleForm>) {
    let Ok((payload, text)) = form.with_untracked(|f| (f.save_payload(), f.format_recipe_text())) else {
        return;
    };
    let mut fields = payload.as_object().cloned().unwrap_or_default();
    if !fields.contains_key("id") {
        fields.insert("id".into(), Value::String(format!("candle-live-{}", js::base36(storage::now_ms()))));
    }
    fields.insert("savedAt".into(), Value::String(storage::iso_from_ms(storage::now_ms())));
    let recipe = storage::normalize_candle(&Value::Object(fields), false);
    let one = std::slice::from_ref(&recipe);
    let pack = storage::share_pack(PackKind::Candle, &[], one);
    let date = storage::iso_from_ms(storage::now_ms())[..10].to_owned();
    let file = storage::pack_filename(PackKind::Candle, &[], one, &date);
    let msg = storage::pack_share_text(PackKind::Candle, &[], one, Some(&text));
    ctx.share_pack(file, format!("Candle: {}", recipe.name), msg, storage::pack_to_json(&pack));
}

fn wax_card(ctx: &Ctx, form: Signal<CandleForm>) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let waxes = &data::data().waxes;
    let wax = fields::choice(
        ui,
        "Wax type",
        waxes.iter().map(|w| w.name.clone()).collect(),
        move || form.with(|f| data::data().waxes.iter().position(|w| w.id == f.wax_id).unwrap_or(0)),
        move |i| {
            let id = data::data().waxes[i.min(data::data().waxes.len() - 1)].id.clone();
            form.update(|f| f.on_wax_change(&id));
        },
    );
    let c = ctx.clone();
    let wiki_btn = w::button(ui, "Wiki", move || {
        let id = form.with_untracked(|f| f.wax_id.clone()).unwrap_or_default();
        c.open_wiki(Some(&crate::wiki::wax_wiki_id(&id)));
    });
    w::tooltip(&wiki_btn, "Open wax in wiki");
    let wax_meta = {
        let u = ui.clone();
        let boxed = w::column(ui).gap(unit / 2.0).fill_width();
        let lines = mirror(&boxed, move || {
            form.with(|f| {
                let Some(w) = data::wax(&f.wax_id) else { return Vec::new() };
                let mut out = vec![format!(
                    "FO load {}–{}% · typical {}%{}{}",
                    js::to_string(w.fragrance_min),
                    js::to_string(w.fragrance_max),
                    js::to_string(w.fragrance_typical),
                    w.melt_point_f
                        .filter(|v| *v != 0.0)
                        .map(|v| format!(" · melt ~{}°F", js::to_string(v)))
                        .unwrap_or_default(),
                    w.pour_temp_f
                        .filter(|v| *v != 0.0)
                        .map(|v| format!(" · pour ~{}°F", js::to_string(v)))
                        .unwrap_or_default(),
                )];
                if let Some(n) = w.notes.clone().filter(|n| !n.is_empty()) {
                    out.push(n);
                }
                if let Some(c) = w.cure_days.clone().filter(|n| !n.is_empty()) {
                    out.push(format!("Cure: {c}"));
                }
                if let Some(b) = &w.best_for {
                    out.push(b.join(" · "));
                }
                out
            })
        });
        w::for_each(&boxed, lines, |l: &String| l.clone(), move |l| w::text(&u, l.clone()).variant("muted"))
    };
    let vessels = &data::data().vessels;
    let vessel = fields::choice(
        ui,
        "Vessel preset",
        vessels
            .iter()
            .map(|v| {
                if v.fill_oz > 0.0 {
                    format!("{} (~{} oz wax)", v.label, js::to_string(v.fill_oz))
                } else {
                    v.label.clone()
                }
            })
            .collect(),
        move || {
            form.with(|f| data::data().vessels.iter().position(|v| v.id == f.vessel_preset_id).unwrap_or(0))
        },
        move |i| {
            let id = data::data().vessels[i.min(data::data().vessels.len() - 1)].id.clone();
            form.update(|f| f.apply_vessel_preset(&id));
        },
    );
    let count = fields::decimal(
        ui,
        "Number of vessels",
        opts(Some(1.0), None, "1"),
        move || form.with(|f| f.vessel_count.clone()),
        move |v| form.update(|f| f.vessel_count = v),
    );
    let diameter = fields::decimal(
        ui,
        "Vessel diameter (in)",
        opts(Some(0.0), None, "0.25"),
        move || form.with(|f| f.vessel_diameter_in.clone()),
        move |v| form.update(|f| f.vessel_diameter_in = v),
    );
    let use_total = Signal::new(false);
    let check = w::check(ui, "Enter total wax instead of per vessel", use_total)
        .bind(move || {
            let v = form.with(|f| f.use_total_wax);
            use_total.set_if_changed(v);
        })
        .bind(move || {
            let v = use_total.get();
            if form.with_untracked(|f| f.use_total_wax != v).unwrap_or(false) {
                form.update(|f| f.use_total_wax = v);
            }
        });
    let u1 = ui.clone();
    let u2 = ui.clone();
    let amount = show(
        ui,
        move || form.with(|f| f.use_total_wax),
        move || {
            w::field(
                &u1,
                "Total wax",
                fields::decimal(
                    &u1,
                    "Total wax",
                    opts(Some(0.0), None, "any"),
                    move || form.with(|f| f.total_wax.clone()),
                    move |v| {
                        form.update(|f| {
                            f.total_wax = v;
                            f.vessel_preset_id = "custom".into();
                        })
                    },
                ),
            )
        },
    )
    .fallback(move || {
        w::field(
            &u2,
            "Wax per vessel",
            fields::decimal(
                &u2,
                "Wax per vessel",
                opts(Some(0.0), None, "any"),
                move || form.with(|f| f.wax_per_vessel.clone()),
                move |v| {
                    form.update(|f| {
                        f.wax_per_vessel = v;
                        f.vessel_preset_id = "custom".into();
                    })
                },
            ),
        )
    })
    .el();
    let unit_note = w::text(ui, move || format!("Amounts in {}", form.with(|f| f.unit.as_str().to_owned())))
        .variant("muted");
    w::card(ui)
        .gap(unit * 2.0)
        .padding(Insets::all(unit * 3.0))
        .child(card_head(ui, "Wax & vessels", vec![wiki_btn]))
        .child(w::field(ui, "Wax type", wax))
        .child(wax_meta)
        .child(w::field(ui, "Vessel preset", vessel))
        .child(w::wrap(ui).gap(unit * 2.0).child(w::field(ui, "Number of vessels", count)).child(w::field(
            ui,
            "Vessel diameter (in)",
            diameter,
        )))
        .child(check)
        .child(amount)
        .child(unit_note)
}

fn fragrance_card(ctx: &Ctx, form: Signal<CandleForm>) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let fo = fields::decimal(
        ui,
        "Fragrance load %",
        opts(Some(0.0), Some(20.0), "0.1"),
        move || form.with(|f| f.fragrance_pct.clone()),
        move |v| form.update(|f| f.fragrance_pct = v),
    );
    let dye = fields::decimal(
        ui,
        "Dye blocks per lb wax",
        opts(Some(0.0), Some(10.0), "0.25"),
        move || form.with(|f| f.dye_blocks_per_lb.clone()),
        move |v| form.update(|f| f.dye_blocks_per_lb = v),
    );
    let quick = |label: &str, which: FoPreset| {
        w::button(ui, label.to_owned(), move || form.update(|f| f.set_fo(which)))
            .disabled(move || form.with(|f| data::wax(&f.wax_id).is_none()))
    };
    let pill = w::badge(ui, move || {
        if form.with(CandleForm::fo_in_range) { "In range" } else { "Outside typical band" }.to_owned()
    });
    let p2 = pill.clone();
    let pill = pill.bind(move || {
        let ok = form.with(CandleForm::fo_in_range);
        p2.state(States::CHECKED, ok);
        p2.state(States::INVALID, !ok);
    });
    w::card(ui)
        .gap(unit * 2.0)
        .padding(Insets::all(unit * 3.0))
        .child(w::heading(ui, 3, "Fragrance & dye"))
        .child(w::wrap(ui).gap(unit * 2.0).child(w::field(ui, "Fragrance load %", fo)).child(w::field(ui, "Dye blocks per lb wax", dye)))
        .child(
            w::wrap(ui)
                .gap(unit)
                .align(Align::Center)
                .child(quick("Min FO", FoPreset::Min))
                .child(quick("Typical", FoPreset::Typical))
                .child(quick("Max FO", FoPreset::Max))
                .child(pill),
        )
        .child(
            w::text(ui, "Dye is a rough guide only — pigments vary wildly. Start light and test burn. FO % is of wax weight (not total batch).")
                .variant("muted"),
        )
}

fn results_card(ctx: &Ctx, form: Signal<CandleForm>, result: Memo<CandleResult>) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let u = move || form.with(|f| f.unit.as_str().to_owned());
    let n = move |get: fn(&CandleResult) -> f64| move || result.with(|r| js::to_string(get(r)));
    let c = ctx.clone();
    let copy =
        w::button(ui, "Copy", move || c.copy(form.with(CandleForm::format_recipe_text), "Results copied"));
    let c = ctx.clone();
    let print = w::button(ui, "Print", move || {
        super::wiki::print_sheet(
            &c,
            "Candle Recipe",
            "Alex's Craft Calc — Candle",
            &form.with(CandleForm::format_recipe_text),
            "Craft planning only. Verify FO limits and wick with test burns.",
        )
    });
    let warn_box = w::column(ui).gap(unit / 2.0).fill_width();
    let warns = mirror(&warn_box, move || result.with(|r| r.warnings.clone()));
    let uw = ui.clone();
    let warnings = w::for_each(
        &warn_box,
        warns,
        |s: &String| s.clone(),
        move |m| w::text(&uw, format!("• {m}")).variant("warning"),
    );
    let grid = w::wrap(ui)
        .gap(unit * 2.0)
        .fill_width()
        .child(stat(ui, "Fragrance oil", n(|r| r.fragrance), u, true))
        .child(stat(ui, "Total wax", n(|r| r.total_wax), u, false))
        .child(stat(ui, "Batch total", n(|r| r.total_batch), u, false))
        .child(stat(ui, "Dye blocks (est.)", n(|r| r.dye_blocks), String::new, false))
        .child(stat(ui, "Wax / vessel", n(|r| r.per_vessel.wax), u, false))
        .child(stat(ui, "FO / vessel", n(|r| r.per_vessel.fragrance), u, false));
    let wick = w::card(ui)
        .gap(unit)
        .padding(Insets::all(unit * 2.0))
        .layout(|l| {
            l.grow = 1.0;
            l.width = Length::Auto;
            l.basis = Length::Px(260.0);
            l.min_width = Length::Px(260.0_f32.min(160.0));
            l.shrink = 1.0;
        })
        .child(w::heading(ui, 3, "Wick guidance"))
        .child(w::text(ui, move || result.with(|r| r.wick_hint.clone())));
    let u3 = ui.clone();
    let pour = show(
        ui,
        move || result.with(|r| !r.pour_hint.is_empty()),
        move || {
            w::card(&u3)
                .gap(unit)
                .padding(Insets::all(unit * 2.0))
                .layout(|l| {
                    l.grow = 1.0;
                    l.width = Length::Auto;
                    l.basis = Length::Px(260.0);
                    l.min_width = Length::Px(260.0_f32.min(160.0));
                    l.shrink = 1.0;
                })
                .child(w::heading(&u3, 3, "Pour notes"))
                .child(w::text(&u3, move || result.with(|r| r.pour_hint.clone())))
        },
    )
    .el();
    let wick_note = w::text(ui, move || {
        form.with(|f| {
            data::wax(&f.wax_id)
                .and_then(|w| w.wick_notes.clone())
                .map(|n| format!("Wick note: {n}"))
                .unwrap_or_default()
        })
    });
    w::card(ui)
        .gap(unit * 2.0)
        .padding(Insets::all(unit * 3.0))
        .fill_width()
        .child(card_head(ui, "Batch results", vec![copy, print]))
        .child(warnings)
        .child(grid)
        .child(w::wrap(ui).gap(unit * 2.0).fill_width().child(wick).child(pour))
        .child(wick_note)
        .child(
            w::text(
                ui,
                "Always test-burn. Fragrance load limits depend on your FO flash point and wax brand. Follow FO supplier max usage rates. This calculator is for craft planning only.",
            )
            .variant("muted"),
        )
}
