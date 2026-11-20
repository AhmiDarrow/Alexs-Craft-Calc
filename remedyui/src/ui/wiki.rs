//! The craft wiki (F1): search, categories, the article list and the reader. Wide windows
//! show list and article side by side; narrow ones (phones) one full page at a time, with
//! Back and Escape stepping article → list → calculator, as the shipped app did.

use std::cell::RefCell;
use std::rc::Rc;

use super::tw as w;
use remedy_ui::a11y::{Role, Semantics};
use remedy_ui::core::Insets;
use remedy_ui::input::{Key, KeyEvent};
use remedy_ui::layout::{Align, Length};
use remedy_ui::reactive::{Persist, Signal, untrack};
use remedy_ui::view::{RichText, TextStylePatch};
use remedy_ui::{El, Ui, show};

use super::Ctx;
use super::soap::mirror;
use crate::data;
use crate::i18n;
use crate::library::{VERSION, keys};
use crate::storage;
use crate::wiki::{self, Block};

/// Below this width the wiki shows one page at a time (the shipped app's 780 px).
pub const NARROW: f32 = 780.0;

/// Mounts the wiki: it shows over the window while `ctx.wiki` is set.
pub fn attach(ctx: &Ctx) {
    let ui = ctx.ui.clone();
    let shown: Rc<RefCell<Option<El>>> = Rc::default();
    let last = Signal::new("welcome".to_owned()).persist(Persist::new(keys::LAST_WIKI).version(VERSION));
    let c = ctx.clone();
    let _ = ui.root().bind(move || {
        let want = c.wiki.get();
        untrack(|| {
            if let Some(old) = shown.borrow_mut().take() {
                old.remove();
            }
            if let Some(initial) = want {
                let panel = panel(&c, initial, last);
                let layer = c.ui.overlay(w::fill_window(panel.clone()));
                // Keys go to the wiki while it is open: Escape and Back step back from there.
                panel.focus_first();
                *shown.borrow_mut() = Some(layer);
            }
        });
    });
}

#[derive(Clone, PartialEq)]
enum NavItem {
    Group(String),
    Article(String),
}

fn panel(ctx: &Ctx, initial: Option<String>, last: Signal<String>) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let all = i18n::articles();
    let jump = initial.as_deref().filter(|id| i18n::article(id).is_some()).map(str::to_owned);
    let start = jump
        .clone()
        .or_else(|| last.get_untracked().ok().filter(|id| i18n::article(id).is_some()))
        .unwrap_or_else(|| "welcome".into());
    let active = Signal::new(start);
    let query = Signal::new(String::new());
    let category = Signal::new("all".to_owned());
    let reading = Signal::new(jump.is_some());
    let narrow = {
        let u = ui.clone();
        move || u.window_size().width < NARROW
    };
    let n1 = narrow.clone();
    let show_list = move || !n1() || !reading.get();
    let n2 = narrow.clone();
    let show_article = move || !n2() || reading.get();

    let c = ctx.clone();
    let close = move || c.wiki.set(None);
    let close = Rc::new(close);

    let open_article = {
        let n = narrow.clone();
        move |id: String| {
            active.set(id.clone());
            last.set(id);
            if n() {
                reading.set(true);
            }
        }
    };
    let open_article = Rc::new(open_article);
    let back_to_list = move || reading.set(false);

    // Header.
    let n3 = narrow.clone();
    let title = w::heading(ui, 2, move || {
        if n3() && reading.get() {
            i18n::article(&active.get()).map(|a| a.title.clone()).unwrap_or_default()
        } else {
            "Alex's Craft Knowledge".to_owned()
        }
    });
    let n4 = narrow.clone();
    let kicker = show(ui, move || !(n4() && reading.get()), {
        let u = ui.clone();
        move || {
            w::column(&u)
                .child(w::text(&u, "F1 · Craft Wiki").variant("muted"))
                .child(w::text(&u, "App help · oils · waxes · soap & candle craft").variant("muted"))
        }
    })
    .fallback({
        let u = ui.clone();
        move || w::button(&u, "← All articles", back_to_list).variant("quiet")
    })
    .el();
    let search = w::search(ui, "Search oils, lye, wick, FO…", move |q| query.set(q));
    let search = search.layout(|l| {
        l.width = Length::Px(300.0);
        l.min_width = Length::Px(200.0);
        l.shrink = 1.0;
    });
    let search = show(ui, show_list.clone(), move || search.clone()).el();
    let cl = close.clone();
    let n5 = narrow.clone();
    let close_btn =
        w::button(ui, move || if n5() { "Close".to_owned() } else { "Esc".to_owned() }, move || cl())
            .semantics(
                Semantics::new(Role::Button)
                    .label(crate::i18n::tr("Close"))
                    .action(remedy_ui::a11y::Action::Click),
            );
    let header = w::wrap(ui)
        .gap(unit * 2.0)
        .align(Align::Center)
        .fill_width()
        .child(w::column(ui).grow(1.0).child(kicker).child(title))
        .child(w::row(ui).gap(unit).align(Align::Center).child(search).child(close_btn));

    // Categories.
    let cats = data::data().wiki_categories.iter().fold(
        w::wrap(ui)
            .gap(unit)
            .semantics(Semantics::new(Role::TabList).label(crate::i18n::tr("Wiki categories")))
            .child(cat_button(ui, "all", "All", category)),
        |r, c| r.child(cat_button(ui, &c.id, &format!("{} {}", c.icon, i18n::tr(&c.label)), category)),
    );
    let cats = show(ui, show_list.clone(), move || cats.clone()).el();

    // The list.
    let nav_box = w::column(ui).gap(unit / 2.0).fill_width();
    let items = mirror(&nav_box, move || {
        let q = query.get();
        let cat = category.get();
        let found: Vec<&data::WikiArticle> =
            wiki::search(all, &q).into_iter().filter(|a| cat == "all" || a.category == cat).collect();
        let mut out = Vec::new();
        if !crate::js::trim(&q).is_empty() {
            out.push(NavItem::Group(format!("⌕ {} ({})", i18n::t("wiki.searchResults"), found.len())));
            out.extend(found.iter().map(|a| NavItem::Article(a.id.clone())));
        } else {
            for c in &data::data().wiki_categories {
                let group: Vec<_> = found.iter().filter(|a| a.category == c.id).collect();
                if !group.is_empty() {
                    out.push(NavItem::Group(format!("{} {} ({})", c.icon, i18n::tr(&c.label), group.len())));
                    out.extend(group.iter().map(|a| NavItem::Article(a.id.clone())));
                }
            }
        }
        out
    });
    let oa = open_article.clone();
    let u = ui.clone();
    let nav = w::for_each(
        &nav_box,
        items,
        |i: &NavItem| match i {
            NavItem::Group(g) => format!("g:{g}"),
            NavItem::Article(a) => format!("a:{a}"),
        },
        move |i| match i {
            NavItem::Group(g) => w::heading(&u, 3, g.clone()),
            NavItem::Article(id) => {
                let a = i18n::article(id).cloned().unwrap_or_else(|| data::WikiArticle {
                    id: id.clone(),
                    title: id.clone(),
                    category: String::new(),
                    tags: Vec::new(),
                    summary: String::new(),
                    sections: Vec::new(),
                });
                let oa = oa.clone();
                let id2 = id.clone();
                let b = w::button(&u, a.title.clone(), move || oa(id2.clone()))
                    .variant("quiet")
                    .fill_width()
                    .justify(remedy_ui::layout::Justify::Start)
                    .semantics(
                        Semantics::new(Role::Button)
                            .label(format!("{} — {}", a.title, a.summary))
                            .action(remedy_ui::a11y::Action::Click),
                    );
                let id3 = id.clone();
                let b2 = b.clone();
                let col = w::column(&u)
                    .fill_width()
                    .child(b)
                    .child(w::text(&u, a.summary.clone()).variant("muted"));
                col.bind(move || b2.state(remedy_ui::style::States::SELECTED, active.get() == id3))
            }
        },
    );
    let empty = show(
        ui,
        move || {
            let q = query.get();
            let cat = category.get();
            !wiki::search(all, &q).into_iter().any(|a| cat == "all" || a.category == cat)
        },
        {
            let u = ui.clone();
            move || w::text(&u, "No articles match. Try “coconut”, “trace”, or “wick”.").variant("muted")
        },
    )
    .el();
    let n6 = narrow.clone();
    let nav = show(ui, show_list.clone(), {
        let u = ui.clone();
        move || {
            let n6 = n6.clone();
            let list = w::scroll(&u).child(w::column(&u).gap(unit).child(nav.clone()).child(empty.clone()));
            let l2 = list.clone();
            list.bind(move || {
                let wide = !n6();
                let _ = l2.clone().layout(move |l| {
                    l.width = if wide { Length::Px(320.0) } else { Length::Auto };
                    l.grow = if wide { 0.0 } else { 1.0 };
                });
            })
        }
    })
    .el();

    // The article.
    let reader = w::column(ui).gap(unit * 2.0).fill_width();
    let r2 = reader.clone();
    let c = ctx.clone();
    let n7 = narrow.clone();
    let reader = reader.bind(move || {
        let id = active.get();
        let mobile_article = n7() && reading.get();
        untrack(|| {
            r2.clear();
            let _ = r2.clone().child(article(&c, &id, mobile_article, query, reading));
        });
    });
    let article_view = show(ui, show_article, {
        let u = ui.clone();
        move || w::scroll(&u).grow(1.0).child(reader.clone())
    })
    .el();

    let body = w::row(ui).gap(unit * 3.0).grow(1.0).fill_width().child(nav).child(article_view);
    let cl = close.clone();
    let n8 = narrow.clone();
    w::column(ui)
        .gap(unit * 2.0)
        .padding(Insets::all(unit * 3.0))
        .grow(1.0)
        .fill_width()
        .variant("wiki")
        .style(remedy_ui::style::Style::new().background(remedy_ui::style::ColorRole::Bg))
        .semantics(Semantics::new(Role::Dialog).label(crate::i18n::tr("Craft wiki")))
        .child(header)
        .child(cats)
        .child(body)
        .on_key(move |e: &KeyEvent| {
            if !e.pressed {
                return false;
            }
            match e.key {
                Key::Escape | Key::Back => {
                    if n8() && reading.get_untracked().unwrap_or(false) {
                        reading.set(false);
                    } else {
                        cl();
                    }
                    true
                }
                Key::F(1) => {
                    cl();
                    true
                }
                _ => false,
            }
        })
}

fn cat_button(ui: &Ui, id: &str, label: &str, category: Signal<String>) -> El {
    let id = id.to_owned();
    let id2 = id.clone();
    let b = w::button(ui, label.to_owned(), move || category.set(id.clone())).variant("quiet");
    let b2 = b.clone();
    b.bind(move || {
        let on = category.get() == id2;
        b2.state(remedy_ui::style::States::CHECKED, on);
    })
}

fn article(ctx: &Ctx, id: &str, mobile_article: bool, query: Signal<String>, reading: Signal<bool>) -> El {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let Some(a) = i18n::article(id) else { return w::text(ui, "Select an article.").variant("muted") };
    let cat = data::data()
        .wiki_categories
        .iter()
        .find(|c| c.id == a.category)
        .map_or(a.category.clone(), |c| c.label.clone());
    let mut col = w::column(ui).gap(unit * 1.5).fill_width().child(w::row(ui).child(w::badge(ui, cat)));
    if !mobile_article {
        col = col.child(w::heading(ui, 2, a.title.clone()));
    }
    col = col.child(w::text(ui, a.summary.clone()).variant("muted"));
    if !a.tags.is_empty() {
        let tags = a.tags.iter().take(8).fold(w::wrap(ui).gap(unit), |r, t| {
            let t2 = t.clone();
            r.child(
                w::button(ui, i18n::display_tag(t), move || {
                    query.set(t2.clone());
                    reading.set(false);
                })
                .variant("quiet"),
            )
        });
        col = col.child(tags);
    }
    for s in &a.sections {
        let mut sec = w::column(ui).gap(unit).fill_width();
        if let Some(h) = &s.heading {
            sec = sec.child(w::heading(ui, 3, h.clone()));
        }
        for b in wiki::blocks(&s.body) {
            sec = sec.child(block(ui, &b));
        }
        col = col.child(sec);
    }
    if mobile_article {
        col = col.child(w::button(ui, "← Back to all articles", move || reading.set(false)));
    }
    col.child(
        w::text(ui, "Educational craft reference — always verify SAP, IFRA, and brand TDS with your suppliers. Not lab certification.")
            .variant("muted"),
    )
}

fn block(ui: &Ui, b: &Block) -> El {
    let unit = ui.theme().spacing.unit;
    match b {
        Block::Bullets(items) => {
            items.iter().fold(w::column(ui).gap(unit / 2.0), |c, i| c.child(w::text(ui, format!("•  {i}"))))
        }
        Block::Numbered(items) => {
            items.iter().enumerate().fold(w::column(ui).gap(unit / 2.0), |c, (n, i)| {
                c.child(w::text(ui, format!("{}.  {i}", n + 1)))
            })
        }
        Block::Paragraph(lines) => {
            let mut rich = RichText::new();
            for (i, line) in lines.iter().enumerate() {
                if i > 0 {
                    rich = rich.text("\n");
                }
                for span in line {
                    rich = if span.bold {
                        let mut p = TextStylePatch::default();
                        p.weight = Some(700.0);
                        rich.styled(&span.text, p)
                    } else {
                        rich.text(&span.text)
                    };
                }
            }
            ui.el("label").text(rich).fill_width()
        }
    }
}

/// `formatSavedAt`: "Mar 4, 2025, 10:20 AM" in the person's local time.
pub fn format_saved_at(ui: &Ui, iso: &str) -> String {
    let Some(ms) = storage::parse_date_ms(iso) else { return String::new() };
    let offset = i64::from(untrack(|| ui.local_time()).utc_offset);
    let local = ms.div_euclid(1000) + offset;
    let (y, m, d) = storage::civil_from_days(local.div_euclid(86_400));
    let secs = local.rem_euclid(86_400);
    let (h, min) = (secs / 3600, (secs % 3600) / 60);
    const MONTHS: [&str; 12] =
        ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let (h12, ampm) = match h {
        0 => (12, "AM"),
        1..=11 => (h, "AM"),
        12 => (12, "PM"),
        _ => (h - 12, "PM"),
    };
    format!("{} {d}, {y}, {h12:02}:{min:02} {ampm}", MONTHS[(m as usize).saturating_sub(1).min(11)])
}

/// Print: the print sheet the shipped app opened (title, the batch text, the note). In a
/// browser it prints straight away; elsewhere it is saved as a page to print.
pub fn print_sheet(ctx: &Ctx, title: &str, heading: &str, text: &str, note: &str) {
    let tr = crate::i18n::tr_lines;
    let html = print_html(&tr(title), &tr(heading), &tr(text), &tr(note));
    // The platform's print dialog; where there is none, the page is saved to print later.
    let (c, name, page) =
        (ctx.clone(), format!("{}.html", storage::safe_filename(title, "recipe")), html.clone());
    ctx.app.print_html(Some(&ctx.window), tr(title), html, move |r| {
        if r.is_err() {
            c.save_file(name, page);
        }
    });
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

/// The print sheet page.
pub fn print_html(title: &str, heading: &str, text: &str, note: &str) -> String {
    format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>{}</title><style>body{{font-family:Segoe UI,system-ui,sans-serif;padding:2rem;color:#1a0a2e;line-height:1.5}}h1{{color:#6b21a8;font-size:1.4rem}}pre{{white-space:pre-wrap;background:#f5e9ff;padding:1rem;border-radius:12px}}.note{{font-size:0.85rem;color:#666;margin-top:1.5rem}}</style></head><body><h1>{}</h1><pre>{}</pre><p class=\"note\">{}</p></body></html>",
        escape_html(title),
        escape_html(heading),
        escape_html(text),
        escape_html(note)
    )
}
