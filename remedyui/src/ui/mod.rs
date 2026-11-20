//! The app's windows: the shell (brand header, Soap ⇄ Candle, footer), the two calculators,
//! the wiki (F1) and the shared pieces they use.

pub mod candle;
pub mod fields;
pub mod soap;
pub mod theme;
pub mod tw;
pub mod wiki;

use std::rc::Rc;
use std::sync::Arc;
use std::time::Duration;

use remedy_ui::a11y::{Role, Semantics};
use remedy_ui::host::{FileDialog, ShareFile, ShareOptions, ShareOutcome};
use remedy_ui::image::{Fit, Source, image};
use remedy_ui::input::{Chord, Key, Modifiers};
use remedy_ui::reactive::{Persist, Signal};
use remedy_ui::{App, El, Ui, Window, WindowSpec};
use tw as w;

use crate::library::{Backing, Library, VERSION, keys};
use crate::{legacy, storage};

/// What every screen reaches: the app, its library, the wiki and the toast.
#[derive(Clone)]
pub struct Ctx {
    pub app: App,
    pub window: Window,
    pub ui: Ui,
    pub lib: Library,
    /// The wiki is open, at this article (`None`: the article last read).
    pub wiki: Signal<Option<Option<String>>>,
    /// The saved soap recipes, newest first (refreshed after each change).
    pub soap_saved: Signal<Vec<storage::SoapRecipe>>,
    /// The saved candle recipes.
    pub candle_saved: Signal<Vec<storage::CandleRecipe>>,
    /// The colour theme chosen ([`theme::CHOICES`]).
    pub appearance: Signal<usize>,
    /// The language chosen (an id of [`crate::i18n::LOCALES`]; empty: the system's).
    pub locale: Signal<String>,
    /// The calculators' forms, kept across Soap ⇄ Candle and a change of language.
    pub soap: Signal<crate::soap_form::SoapForm>,
    pub candle: Signal<crate::candle_form::CandleForm>,
}

impl Ctx {
    /// Opens the wiki at `article` (or where the reader left off).
    pub fn open_wiki(&self, article: Option<&str>) {
        self.wiki.set(Some(article.map(str::to_owned)));
    }

    /// Re-reads the saved lists.
    pub fn refresh(&self) {
        self.soap_saved.set(self.lib.soap());
        self.candle_saved.set(self.lib.candle());
    }

    /// Shows a short message, longer messages for longer (as the shipped app timed them).
    pub fn toast(&self, message: &str) {
        toast(&self.ui, message);
    }

    /// Copies text to the clipboard. Returns the toast to show.
    pub fn copy(&self, text: String, ok: &str) {
        self.app.copy(crate::i18n::tr_lines(&text), false);
        self.toast(ok);
    }

    /// Shares a recipe file through the platform's share sheet; where there is none, offers
    /// to save the file instead, and where saving is not possible either, copies the JSON.
    pub fn share_pack(&self, file_name: String, title: String, text: String, json: String) {
        let me = self.clone();
        let opts = ShareOptions::new()
            .title(crate::i18n::tr(&title))
            .text(crate::i18n::tr_lines(&text))
            .file(ShareFile::new(file_name.clone(), "application/json", json.clone().into_bytes()));
        self.app.share(Some(&self.window), opts, move |outcome| match outcome {
            ShareOutcome::Shared => me.toast("Shared recipe file"),
            ShareOutcome::Cancelled => {}
            _ => me.save_file(file_name, json),
        });
    }

    /// Saves `contents` as a file the person places (a download on the web).
    pub fn save_file(&self, file_name: String, contents: String) {
        let me = self.clone();
        let mut dialog = FileDialog::default();
        dialog.title = "Save recipe file".into();
        dialog.save = true;
        dialog.file_name = Some(file_name.clone());
        dialog.filters = vec![("Recipe files".into(), vec!["json".into()])];
        self.app.file_dialog(Some(&self.window), dialog, move |paths| {
            let Some(path) = paths.into_iter().next() else { return };
            match write_file(&path, contents.as_bytes()) {
                Ok(()) => me.toast(&format!("Downloaded {file_name}")),
                Err(_) => me.copy(contents.clone(), "Recipe JSON copied — paste into a file or message"),
            }
        });
    }

    /// Lets the person pick a recipe or library file, then `done` gets its text.
    pub fn pick_file(&self, done: impl FnOnce(Result<String, String>) + 'static) {
        let mut dialog = FileDialog::default();
        dialog.title = "Load recipe or library file".into();
        dialog.filters = vec![("Recipe files".into(), vec!["json".into(), "txt".into()])];
        self.app.file_dialog(Some(&self.window), dialog, move |paths| {
            let Some(path) = paths.into_iter().next() else { return };
            done(read_file(&path).map_err(|_| "Could not read that file".to_owned()));
        });
    }
}

/// Reads a file the person picked (on the web, from the page's file store).
pub fn read_file(path: &std::path::Path) -> std::io::Result<String> {
    #[cfg(target_arch = "wasm32")]
    {
        let bytes = remedy_ui::web::files::read(path)
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "not in the page's files"))?;
        Ok(String::from_utf8_lossy(&bytes).into_owned())
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let bytes = std::fs::read(path)?;
        Ok(String::from_utf8_lossy(&bytes).into_owned())
    }
}

/// Writes a file the person placed (on the web, a download).
pub fn write_file(path: &std::path::Path, bytes: &[u8]) -> std::io::Result<()> {
    #[cfg(target_arch = "wasm32")]
    {
        remedy_ui::web::files::save(path, bytes).map_err(|e| std::io::Error::other(e.to_string()))
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        std::fs::write(path, bytes)
    }
}

/// `toastTone`: errors and warnings by their wording.
pub fn toast_tone(message: &str) -> &'static str {
    let m = message.to_lowercase();
    let err = [
        "fail",
        "could not",
        "blocked",
        "storage full",
        "not valid",
        "empty",
        "unrecognized",
        "no valid",
        "no recognized",
        "pop-up",
    ];
    if err.iter().any(|w| m.contains(w)) {
        return "error";
    }
    if ["must", "before", "nothing new", "no saved"].iter().any(|w| m.contains(w)) {
        return "warn";
    }
    "ok"
}

/// `toastMs`: longer messages stay longer.
pub fn toast_duration(message: &str) -> Duration {
    let n = message.chars().count();
    Duration::from_millis(if n > 72 {
        4200
    } else if n > 40 {
        3200
    } else {
        2400
    })
}

/// Shows a toast.
pub fn toast(ui: &Ui, message: &str) {
    if message.is_empty() {
        return;
    }
    let t = w::toast(ui, message, toast_duration(message));
    if toast_tone(message) == "error" {
        let _ = t.variant("error");
    }
}

/// The brand mark and banner art, carried in the app.
pub fn brand_mark() -> Source {
    static B: std::sync::OnceLock<Arc<[u8]>> = std::sync::OnceLock::new();
    Source::Bytes(B.get_or_init(|| Arc::from(&include_bytes!("../../assets/brand-soap.png")[..])).clone())
}

/// The banner over the calculators.
pub fn banner_art() -> Source {
    static B: std::sync::OnceLock<Arc<[u8]>> = std::sync::OnceLock::new();
    Source::Bytes(B.get_or_init(|| Arc::from(&include_bytes!("../../assets/banner-art.png")[..])).clone())
}

/// Where the library lives: the app's persist store, or memory when the platform gives the
/// app none (said in the footer, so nobody believes recipes are kept).
pub fn backing(app: &App) -> Backing {
    match app.persist_store() {
        Some(s) => Backing::Store(s),
        None => Backing::memory(),
    }
}

/// Runs the one-time import of the web-view version's storage (or, after it, tidies its
/// backup). Returns what to tell the person.
pub fn first_run_import(lib: &Library, source: &LegacySource) -> Option<String> {
    match lib.backing.load::<legacy::MigrationRecord>(keys::MIGRATION) {
        Ok(Some(_)) => {
            if let Err(e) = legacy::settle_backup(lib) {
                return Some(format!("Could not tidy the import backup: {e}"));
            }
            return None;
        }
        Ok(None) => {}
        Err(e) => return Some(format!("Could not read the saved recipes: {e}")),
    }
    let now = storage::iso_from_ms(storage::now_ms());
    let read = match source {
        LegacySource::Platform => legacy::read_platform(None),
        LegacySource::Dir(dir, origins) => legacy::read_platform(Some((dir.clone(), origins.clone()))),
        LegacySource::Items(items) => Ok(Some(items.clone())),
    };
    let items = match read {
        Ok(Some(items)) => items,
        Ok(None) => legacy::LegacyItems::default(),
        Err(e) => return Some(format!("Could not read recipes from the previous version: {e}")),
    };
    let result = legacy::import(lib, &items, &now);
    #[cfg(target_os = "android")]
    remedy_ui::android::log(&format!("Alex's Craft Calc: import from {:?}: {result:?}", items.source));
    match result {
        Ok(rec) => legacy::summary(&rec),
        Err(e) => Some(format!("Could not bring over saved recipes: {e}")),
    }
}

/// Where the web-view version's storage is read from on first run.
#[derive(Clone, Debug)]
pub enum LegacySource {
    /// Where that version kept it on this platform.
    Platform,
    /// Another Chromium `Local Storage/leveldb` folder, with the origins to look for (tests,
    /// and moving a store by hand).
    Dir(std::path::PathBuf, Vec<String>),
    /// Values already read (tests).
    Items(legacy::LegacyItems),
}

impl LegacySource {
    /// `CRAFTCALC_LEGACY_WEBSTORAGE_DIR` (and `CRAFTCALC_LEGACY_ORIGIN`, comma-separated) name
    /// another folder; otherwise the platform's.
    pub fn from_env() -> LegacySource {
        #[cfg(not(target_arch = "wasm32"))]
        if let Some(dir) = std::env::var_os("CRAFTCALC_LEGACY_WEBSTORAGE_DIR") {
            let origins = std::env::var("CRAFTCALC_LEGACY_ORIGIN")
                .map(|o| o.split(',').map(str::to_owned).collect())
                .unwrap_or_else(|_| {
                    remedy_ui::webstorage::TAURI_WINDOWS_ORIGINS.iter().map(|s| (*s).to_owned()).collect()
                });
            return LegacySource::Dir(std::path::PathBuf::from(dir), origins);
        }
        LegacySource::Platform
    }
}

/// Where the app opens: `--mode soap|candle` and `--wiki[=<article>]` on the command line
/// (deep links, as the shipped app's info buttons opened the wiki at an article).
#[derive(Clone, Debug, Default)]
pub struct Start {
    pub mode: Option<String>,
    pub wiki: Option<Option<String>>,
    /// `--lang=<id>`: show this language (and keep it chosen).
    pub lang: Option<String>,
}

impl Start {
    /// Reads the command line.
    pub fn from_args(args: impl IntoIterator<Item = String>) -> Start {
        let mut s = Start::default();
        for a in args {
            if let Some(m) = a.strip_prefix("--mode=") {
                s.mode = Some(m.to_owned());
            } else if a == "--wiki" {
                s.wiki = Some(None);
            } else if let Some(l) = a.strip_prefix("--lang=") {
                s.lang = Some(l.to_owned());
            } else if let Some(id) = a.strip_prefix("--wiki=") {
                s.wiki = Some(Some(id.to_owned()));
            }
        }
        s
    }
}

/// Opens the app's window.
pub fn open(app: &App, source: LegacySource) {
    open_at(app, source, Start::default());
}

/// Opens the app's window at `start`.
pub fn open_at(app: &App, source: LegacySource, start: Start) {
    let lib = Library::new(backing(app));
    let imported = first_run_import(&lib, &source);
    let spec = WindowSpec::new("Alex's Craft Calc")
        .size(1180.0, 820.0)
        .min_size(360.0, 560.0)
        .persist_geometry("main");
    let lib2 = lib.clone();
    app.open(spec, move |ui, window| {
        let ctx = Ctx {
            app: window.app().clone(),
            window: window.clone(),
            ui: ui.clone(),
            lib: lib2.clone(),
            wiki: Signal::new(None),
            soap_saved: Signal::new(lib2.soap()),
            candle_saved: Signal::new(lib2.candle()),
            appearance: theme::choice_signal(),
            locale: Signal::new(String::new()).persist(Persist::new(keys::LOCALE).version(VERSION)),
            soap: Signal::new(crate::soap_form::SoapForm::new()),
            candle: Signal::new(crate::candle_form::CandleForm::new()),
        };
        theme::follow_appearance(&ctx);
        if let Some(l) = start.lang.clone().filter(|l| crate::i18n::LOCALES.iter().any(|(id, _)| id == l)) {
            ctx.locale.set(l);
        }
        follow_language(&ctx, start.mode.clone());
        wiki::attach(&ctx);
        if let Some(w) = start.wiki.clone() {
            ctx.wiki.set(Some(w));
        }
        if let Some(msg) = &imported {
            toast(ui, msg);
        }
    });
}

/// Shows the chosen language (or the system's) and builds the window's content again in
/// it whenever the choice or the system's language changes.
fn follow_language(ctx: &Ctx, start_mode: Option<String>) {
    let shown: std::cell::RefCell<Option<(String, El, El)>> = std::cell::RefCell::default();
    let start_mode = std::cell::Cell::new(start_mode);
    let asked: std::cell::RefCell<Option<String>> = std::cell::RefCell::default();
    let c = ctx.clone();
    let _ = ctx.ui.root().bind(move || {
        let chosen = c.locale.get();
        let own = crate::i18n::LOCALES.iter().any(|(l, _)| *l == chosen);
        // Numbers in fields follow the language chosen; with none, the system's.
        let want = own.then(|| chosen.clone());
        if *asked.borrow() != want {
            *asked.borrow_mut() = want.clone();
            c.app.set_locale(want);
        }
        let id = if own { chosen } else { crate::i18n::match_locale([c.ui.locale().as_str()]).to_owned() };
        if shown.borrow().as_ref().is_some_and(|(l, _, _)| *l == id) {
            return;
        }
        crate::i18n::set_current(&id);
        let el = remedy_ui::reactive::untrack(|| shell(&c, start_mode.take()));
        if let Some((_, old, old_fab)) = shown.borrow_mut().take() {
            old.remove();
            old_fab.remove();
        }
        let _ = c.ui.root().child(el.clone());
        let fab = remedy_ui::reactive::untrack(|| help_fab(&c));
        *shown.borrow_mut() = Some((id, el, fab));
    });
}

/// The window's content: header, banner, the chosen calculator, footer.
pub fn shell(ctx: &Ctx, start_mode: Option<String>) -> El {
    let ui = &ctx.ui;
    let mode = Signal::new("soap".to_owned()).persist(Persist::new(keys::MODE).version(VERSION));
    if let Some(m) = start_mode.filter(|m| m == "soap" || m == "candle") {
        mode.set(m);
    }
    let unit = ui.theme().spacing.unit;

    let wiki_btn = {
        let c = ctx.clone();
        w::button(ui, format!("F1 {}", crate::i18n::t("header.wiki")), move || c.open_wiki(None)).semantics(
            Semantics::new(Role::Button)
                .label(crate::i18n::tr("Craft wiki (F1)"))
                .action(remedy_ui::a11y::Action::Click),
        )
    };
    let modes =
        [format!("✦ {}", crate::i18n::t("mode.soap")), format!("✧ {}", crate::i18n::t("mode.candle"))];
    let sel = Signal::new(if mode.get_untracked().ok().as_deref() == Some("candle") { 1usize } else { 0 });
    let toggle =
        w::segmented(ui, "Calculator mode", &[modes[0].as_str(), modes[1].as_str()], sel).bind(move || {
            let m = if sel.get() == 1 { "candle" } else { "soap" };
            mode.set_if_changed(m.to_owned());
        });
    let _ = modes;

    let brand = w::row(ui)
        .gap(unit * 2.0)
        .align(remedy_ui::layout::Align::Center)
        .child(image(ui, brand_mark(), "", Fit::Contain).width(44.0).height(44.0))
        .child(
            w::column(ui)
                .child(w::heading(ui, 1, "Alex's Craft Calc"))
                .child(w::text(ui, "Soap · Candle · Precision in purple").variant("muted")),
        );
    let header = w::wrap(ui)
        .gap(unit * 2.0)
        .align(remedy_ui::layout::Align::Center)
        .fill_width()
        .child(flex(brand, 320.0, 1.0))
        .child(
            w::wrap(ui)
                .gap(unit)
                .align(remedy_ui::layout::Align::Center)
                .child(wiki_btn)
                .child(about_button(ctx))
                .child(language_choice(ctx))
                .child(toggle),
        );

    let banner = w::column(ui).fill_width().height(110.0).clip().variant("banner").child(
        image(ui, banner_art(), "", Fit::Cover).layout(|l| {
            l.width = remedy_ui::layout::Length::Percent(1.0);
            l.height = remedy_ui::layout::Length::Percent(1.0);
            l.aspect_ratio = None;
        }),
    );

    let (c1, c2) = (ctx.clone(), ctx.clone());
    let soap_view = remedy_ui::show(ui, move || mode.get() != "candle", move || soap::screen(&c1)).el();
    let candle_view = remedy_ui::show(ui, move || mode.get() == "candle", move || candle::screen(&c2)).el();

    let storage_note = if matches!(ctx.lib.backing, Backing::Memory(_)) {
        "This device gives the app no storage: saved recipes last until the app closes. Share your library to keep it."
    } else {
        "Works offline · recipes stay on this device"
    };
    let f1 = {
        let c = ctx.clone();
        w::link(ui, "F1", move || c.open_wiki(None))
    };
    let appearance = ctx.appearance;
    let theme_choice = fields::choice(
        ui,
        "Appearance",
        theme::CHOICES.iter().map(|c| (*c).to_owned()).collect(),
        move || appearance.get(),
        move |i| appearance.set(i),
    );
    let footer = w::column(ui)
        .gap(unit)
        .align(remedy_ui::layout::Align::Center)
        .child(
            w::wrap(ui)
                .gap(unit)
                .child(w::text(ui, "Everyday craft math · NaOH/KOH SAP · fragrance loads · press").variant("muted"))
                .child(f1)
                .child(w::text(ui, "for the craft wiki ·").variant("muted"))
                .child(w::text(ui, storage_note).variant("muted")),
        )
        .child(
            w::text(
                ui,
                "Always verify SAP values with your oil supplier. Lye is caustic — wear PPE. Fragrance % limits vary by IFRA and wax brand.",
            )
            .variant("muted"),
        )
        .child(w::row(ui).gap(unit).align(remedy_ui::layout::Align::Center).child(w::text(ui, "Appearance").variant("muted")).child(theme_choice));

    let content = w::column(ui)
        .gap(unit * 3.0)
        .padding(remedy_ui::core::Insets::all(unit * 3.0))
        .fill_width()
        .layout(|l| l.max_width = remedy_ui::layout::Length::Px(1180.0))
        .child(header)
        .child(banner)
        .child(soap_view)
        .child(candle_view)
        .child(footer);

    shortcuts(ctx);
    w::scroll(ui).fill_width().align(remedy_ui::layout::Align::Center).child(content)
}

/// The repository the About dialog links to.
pub const SOURCE_URL: &str = "https://github.com/AhmiDarrow/alexs-craft-calc";

/// About: the app, its version, the source, and Ahmi's line.
fn about_button(ctx: &Ctx) -> El {
    let c = ctx.clone();
    w::button(&ctx.ui, "About", move || about(&c)).variant("quiet")
}

/// Opens the About dialog.
pub fn about(ctx: &Ctx) {
    let ui = &ctx.ui;
    let unit = ui.theme().spacing.unit;
    let slot: Rc<std::cell::RefCell<Option<w::Modal>>> = Rc::default();
    let s2 = slot.clone();
    let close = w::button(ui, "Close", move || {
        if let Some(m) = s2.borrow().as_ref() {
            m.close();
        }
    })
    .variant("primary");
    let app = ctx.app.clone();
    let c = ctx.clone();
    let source = w::link(ui, "Source code", move || {
        let c = c.clone();
        app.open_url(SOURCE_URL, move |r| {
            if r.is_err() {
                c.copy(SOURCE_URL.to_owned(), "Copied");
            }
        });
    });
    let content = w::column(ui)
        .gap(unit * 2.0)
        .padding(remedy_ui::core::Insets::all(unit * 3.0))
        .child(w::heading(ui, 2, "About"))
        .child(w::text(ui, "Alex's Craft Calc").variant("strong"))
        .child(w::text(ui, format!("{} {}", crate::i18n::t("about.version"), env!("CARGO_PKG_VERSION"))))
        .child(source)
        // The sign-off stays as written in every language.
        .child(remedy_ui::widgets::text(ui, "\"Hope this helps\" - Ahmi").variant("muted"))
        .child(w::row(ui).justify(remedy_ui::layout::Justify::End).child(close));
    *slot.borrow_mut() = Some(w::modal(ui, crate::i18n::t("about.title"), content, true));
}

/// The language choice, in each language's own name.
fn language_choice(ctx: &Ctx) -> El {
    let locale = ctx.locale;
    let names: Vec<String> = crate::i18n::LOCALES.iter().map(|(_, n)| (*n).to_owned()).collect();
    let now = crate::i18n::LOCALES.iter().position(|(l, _)| *l == crate::i18n::current()).unwrap_or(0);
    let sel = Signal::new(now);
    // The names stay in their own language: the plain select, not the translating one.
    remedy_ui::widgets::select(&ctx.ui, crate::i18n::t("settings.language"), names, sel).bind(move || {
        let i = sel.get();
        if i != now {
            locale.set(crate::i18n::LOCALES[i].0.to_owned());
        }
    })
}

/// The floating "?" that opens the wiki, bottom right, as in the shipped app.
fn help_fab(ctx: &Ctx) -> El {
    let c = ctx.clone();
    let b = remedy_ui::widgets::button(&ctx.ui, "?", move || c.open_wiki(None))
        .variant("primary")
        .width(52.0)
        .height(52.0)
        .semantics(
            Semantics::new(Role::Button)
                .label(crate::i18n::t("header.openWiki"))
                .action(remedy_ui::a11y::Action::Click),
        )
        .layout(|l| {
            l.position = remedy_ui::layout::Position::Absolute;
            l.inset = remedy_ui::core::Insets {
                top: remedy_ui::layout::AUTO,
                start: remedy_ui::layout::AUTO,
                end: 16.0,
                bottom: 16.0,
            };
        });
    w::tooltip(&b, crate::i18n::t("header.wikiTitle"));
    ctx.ui.overlay(b)
}

/// F1 and Ctrl+/ open and close the wiki (commands, so people can rebind them).
fn shortcuts(ctx: &Ctx) {
    let commands = remedy_ui::nav::Commands::new();
    let c = ctx.clone();
    commands.add(
        "wiki.toggle",
        "Craft wiki",
        vec![Chord::new(Modifiers::NONE, Key::F(1)), Chord::new(Modifiers::CTRL, Key::Character("/".into()))],
        None,
        move || {
            let open = c.wiki.get_untracked().ok().flatten().is_some();
            c.wiki.set(if open { None } else { Some(None) });
        },
    );
    let _ = commands.attach(&ctx.ui);
}

/// A wrapping row's child: starts at `basis` px, grows by `grow`, wraps below that width.
pub fn flex(el: El, basis: f32, grow: f32) -> El {
    el.layout(move |l| {
        l.width = remedy_ui::layout::Length::Auto;
        l.basis = remedy_ui::layout::Length::Px(basis);
        l.min_width = remedy_ui::layout::Length::Px(basis.min(160.0));
        l.grow = grow;
        l.shrink = 1.0;
    })
}

/// Shared by both calculators: a card with a heading and a row of actions.
pub fn card_head(ui: &Ui, title: &str, actions: Vec<El>) -> El {
    let unit = ui.theme().spacing.unit;
    actions.into_iter().fold(
        w::wrap(ui)
            .gap(unit)
            .align(remedy_ui::layout::Align::Center)
            .fill_width()
            .child(w::heading(ui, 3, title).grow(1.0)),
        |r, a| r.child(a),
    )
}

/// A labelled number in the results grid.
pub fn stat(
    ui: &Ui,
    label: &str,
    value: impl Fn() -> String + 'static,
    unit: impl Fn() -> String + 'static,
    hero: bool,
) -> El {
    let u = ui.theme().spacing.unit;
    let label_s = label.to_owned();
    let value = Rc::new(value);
    let unit = Rc::new(unit);
    let (v1, u1) = (value.clone(), unit.clone());
    let card = w::card(ui)
        .gap(u / 2.0)
        .padding(remedy_ui::core::Insets::all(u * 2.0))
        .layout(|l| {
            l.width = remedy_ui::layout::Length::Auto;
            l.basis = remedy_ui::layout::Length::Px(180.0);
            l.min_width = remedy_ui::layout::Length::Px(140.0);
            l.grow = 1.0;
        })
        .child(w::text(ui, crate::i18n::tr(&label).to_uppercase()).variant("muted"))
        .child(
            w::row(ui)
                .gap(u / 2.0)
                .align(remedy_ui::layout::Align::End)
                .child(w::heading(ui, 2, move || v1()))
                .child(w::text(ui, move || u1()).variant("muted")),
        )
        .semantics(move || {
            Semantics::new(Role::Group).label(crate::i18n::tr(&label_s)).value(format!(
                "{} {}",
                crate::i18n::tr(&value()),
                crate::i18n::tr(&unit())
            ))
        });
    if hero { card.variant("accent") } else { card }
}
