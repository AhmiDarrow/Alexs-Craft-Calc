//! In-app languages: the shipped app's catalogs (`data/locales/*.json`, the same files as
//! 1.1.x) and the display translator. The calculators keep working in English (the parity
//! tests compare English); what they show goes through [`tr`] on its way to the screen.

use std::cell::Cell;
use std::collections::HashMap;
use std::sync::OnceLock;

use serde_json::Value;

/// The languages, in the shipped app's order: id and native name.
pub const LOCALES: [(&str, &str); 11] = [
    ("en", "English"),
    ("es", "Español"),
    ("fr", "Français"),
    ("de", "Deutsch"),
    ("pt-BR", "Português (Brasil)"),
    ("it", "Italiano"),
    ("ru", "Русский"),
    ("pl", "Polski"),
    ("ja", "日本語"),
    ("ko", "한국어"),
    ("zh-CN", "中文（简体）"),
];

const SOURCES: [&str; 11] = [
    include_str!("../data/locales/en.json"),
    include_str!("../data/locales/es.json"),
    include_str!("../data/locales/fr.json"),
    include_str!("../data/locales/de.json"),
    include_str!("../data/locales/pt-BR.json"),
    include_str!("../data/locales/it.json"),
    include_str!("../data/locales/ru.json"),
    include_str!("../data/locales/pl.json"),
    include_str!("../data/locales/ja.json"),
    include_str!("../data/locales/ko.json"),
    include_str!("../data/locales/zh-CN.json"),
];

/// Strings only this edition has (English → language → text), in the catalogs' form.
const PORT: &str = include_str!("../data/locales/port.json");

thread_local! {
    static CURRENT: Cell<usize> = const { Cell::new(0) };
}

#[derive(Debug, Clone, PartialEq)]
enum Part {
    Lit(String),
    Var(String),
}

struct Template {
    parts: Vec<Part>,
    /// Per language (index into [`LOCALES`]): the text with `{name}` placeholders.
    texts: Vec<Option<String>>,
    /// For a plural group (`key.one` … `key.other`): per language, each category's text.
    plural: Option<Vec<HashMap<&'static str, String>>>,
}

const CATEGORIES: [&str; 4] = ["one", "few", "many", "other"];

/// The CLDR plural category of a whole number `n` in language `id`.
fn plural_category(id: &str, n: u64) -> &'static str {
    let (m10, m100) = (n % 10, n % 100);
    let few = (2..=4).contains(&m10) && !(12..=14).contains(&m100);
    match id {
        "ja" | "ko" | "zh-CN" => "other",
        "fr" | "pt-BR" => {
            if n <= 1 {
                "one"
            } else {
                "other"
            }
        }
        "ru" => {
            if m10 == 1 && m100 != 11 {
                "one"
            } else if few {
                "few"
            } else {
                "many"
            }
        }
        "pl" => {
            if n == 1 {
                "one"
            } else if few {
                "few"
            } else {
                "many"
            }
        }
        _ => {
            if n == 1 {
                "one"
            } else {
                "other"
            }
        }
    }
}

struct Catalogs {
    by_locale: Vec<HashMap<String, String>>,
    /// English text without placeholders → its translations.
    exact: HashMap<String, Vec<Option<String>>>,
    /// English templates, most specific first.
    templates: Vec<Template>,
}

fn catalogs() -> &'static Catalogs {
    static C: OnceLock<Catalogs> = OnceLock::new();
    C.get_or_init(|| {
        let by_locale: Vec<HashMap<String, String>> =
            SOURCES.iter().map(|s| serde_json::from_str(s).expect("locale catalog")).collect();
        let mut keys: Vec<&String> = by_locale[0].keys().collect();
        keys.sort();
        type Forms = Option<Vec<HashMap<&'static str, String>>>;
        let mut entries: Vec<(String, Vec<Option<String>>, Forms)> = Vec::new();
        for k in keys {
            let texts: Vec<Option<String>> =
                by_locale.iter().map(|c| c.get(k).filter(|v| !v.trim().is_empty()).cloned()).collect();
            // A plural group is one template, keyed by its `other` form.
            let plural = k.rsplit_once('.').filter(|(_, c)| CATEGORIES.contains(c));
            let forms = match plural {
                Some((_, c)) if c != "other" => continue,
                Some((base, _)) => Some(
                    by_locale
                        .iter()
                        .map(|cat| {
                            CATEGORIES
                                .iter()
                                .filter_map(|c| cat.get(&format!("{base}.{c}")).map(|v| (*c, v.clone())))
                                .collect()
                        })
                        .collect(),
                ),
                None => None,
            };
            entries.push((by_locale[0][k].clone(), texts, forms));
        }
        let port: HashMap<String, HashMap<String, String>> = serde_json::from_str(PORT).expect("port.json");
        let mut port: Vec<_> = port.into_iter().collect();
        port.sort_by(|a, b| a.0.cmp(&b.0));
        // This edition's own strings win over the shared catalog.
        for (english, tr) in port.into_iter().rev() {
            let texts = LOCALES
                .iter()
                .map(|(id, _)| if *id == "en" { Some(english.clone()) } else { tr.get(*id).cloned() })
                .collect();
            entries.insert(0, (english, texts, None));
        }
        let mut exact = HashMap::new();
        let mut templates = Vec::new();
        for (english, texts, plural) in entries {
            let parts = parse(&english);
            if parts.iter().any(|p| matches!(p, Part::Var(_))) {
                let letters: usize = parts
                    .iter()
                    .map(|p| {
                        if let Part::Lit(s) = p { s.chars().filter(|c| c.is_alphabetic()).count() } else { 0 }
                    })
                    .sum();
                // `{a} {b}` and the like would match anything.
                if letters >= 3 {
                    templates.push(Template { parts, texts, plural });
                }
            } else {
                exact.entry(english).or_insert(texts);
            }
        }
        let lit_len = |t: &Template| -> usize {
            t.parts.iter().map(|p| if let Part::Lit(s) = p { s.len() } else { 0 }).sum()
        };
        templates.sort_by(|a, b| lit_len(b).cmp(&lit_len(a)));
        Catalogs { by_locale, exact, templates }
    })
}

fn parse(text: &str) -> Vec<Part> {
    let mut parts = Vec::new();
    let mut rest = text;
    while let Some(open) = rest.find('{') {
        let Some(close) = rest[open..].find('}').map(|c| open + c) else { break };
        let name = &rest[open + 1..close];
        if name.is_empty() || !name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
            parts.push(Part::Lit(rest[..=open].to_owned()));
            rest = &rest[open + 1..];
            continue;
        }
        if open > 0 {
            parts.push(Part::Lit(rest[..open].to_owned()));
        }
        parts.push(Part::Var(name.to_owned()));
        rest = &rest[close + 1..];
    }
    if !rest.is_empty() {
        parts.push(Part::Lit(rest.to_owned()));
    }
    // Merge neighbouring literals (from skipped braces).
    let mut out: Vec<Part> = Vec::new();
    for p in parts {
        match (out.last_mut(), p) {
            (Some(Part::Lit(a)), Part::Lit(b)) => a.push_str(&b),
            (_, p) => out.push(p),
        }
    }
    out
}

/// Matches `s` against a template; the captured placeholder values.
fn match_parts<'a>(parts: &[Part], s: &'a str, out: &mut Vec<(String, &'a str)>) -> bool {
    match parts.split_first() {
        None => s.is_empty(),
        Some((Part::Lit(l), rest)) => {
            s.strip_prefix(l.as_str()).is_some_and(|tail| match_parts(rest, tail, out))
        }
        Some((Part::Var(name), rest)) => {
            // Shortest non-empty capture first, then longer ones.
            let mut ends: Vec<usize> = s.char_indices().map(|(i, _)| i).skip(1).collect();
            ends.push(s.len());
            for end in ends {
                out.push((name.clone(), &s[..end]));
                if match_parts(rest, &s[end..], out) {
                    return true;
                }
                out.pop();
            }
            false
        }
    }
}

fn fill(template: &str, vars: &[(String, String)]) -> String {
    parse(template)
        .into_iter()
        .map(|p| match p {
            Part::Lit(s) => s,
            Part::Var(n) => {
                vars.iter().find(|(k, _)| *k == n).map(|(_, v)| v.clone()).unwrap_or(format!("{{{n}}}"))
            }
        })
        .collect()
}

/// The language shown (an id from [`LOCALES`]).
pub fn current() -> &'static str {
    LOCALES[CURRENT.with(Cell::get)].0
}

/// Shows `id` from now on (unknown ids: English). Screens built before keep their text:
/// the app builds its window again.
pub fn set_current(id: &str) {
    let i = LOCALES.iter().position(|(l, _)| *l == id).unwrap_or(0);
    CURRENT.with(|c| c.set(i));
}

/// A catalog string by key, in the language shown (English, then the key, when missing).
pub fn t(key: &str) -> String {
    let c = catalogs();
    let i = CURRENT.with(Cell::get);
    c.by_locale[i]
        .get(key)
        .filter(|v| !v.trim().is_empty())
        .or_else(|| c.by_locale[0].get(key))
        .cloned()
        .unwrap_or_else(|| key.to_owned())
}

/// [`t`] with `{name}` placeholders filled.
pub fn tv(key: &str, vars: &[(&str, String)]) -> String {
    let v: Vec<(String, String)> = vars.iter().map(|(k, v)| ((*k).to_owned(), v.clone())).collect();
    fill(&t(key), &v)
}

/// `key` in the language shown, or `fallback` when the catalogs never had it.
pub fn tx(key: &str, fallback: &str) -> String {
    let s = t(key);
    if s == key { fallback.to_owned() } else { s }
}

/// English text the app shows, in the language shown: catalog strings, catalog templates
/// (`Saved ({n})`, with the values themselves translated and numbers written the
/// language's way), and plain numbers. Anything else (what people typed) is unchanged.
pub fn tr(english: &str) -> String {
    let i = CURRENT.with(Cell::get);
    if i == 0 || english.is_empty() {
        return english.to_owned();
    }
    tr_in(i, english)
}

fn tr_in(i: usize, english: &str) -> String {
    let c = catalogs();
    if let Some(texts) = c.exact.get(english) {
        return texts[i].clone().unwrap_or_else(|| english.to_owned());
    }
    // Surrounding spaces and a trailing colon belong to the layout, not the words.
    let trimmed = english.trim();
    if trimmed.len() != english.len() && !trimmed.is_empty() {
        let (lead, _) = english.split_at(english.find(trimmed).unwrap_or(0));
        let tail = &english[lead.len() + trimmed.len()..];
        let inner = tr_in(i, trimmed);
        if inner != trimmed {
            return format!("{lead}{inner}{tail}");
        }
    }
    if let Some(n) = number(english, i) {
        return n;
    }
    for t in &c.templates {
        let Some(mut target) = t.texts[i].as_deref() else { continue };
        let mut caps = Vec::new();
        if match_parts(&t.parts, english, &mut caps) {
            if let Some(forms) = &t.plural {
                // The count must be a number, or this is not the template.
                let Some(n) = caps.iter().find(|(k, _)| k == "n").and_then(|(_, v)| v.parse::<u64>().ok())
                else {
                    continue;
                };
                if let Some(form) = forms[i].get(plural_category(LOCALES[i].0, n)) {
                    target = form;
                }
            }
            let vars: Vec<(String, String)> = caps
                .into_iter()
                .map(|(k, v)| {
                    let v = if let Some(n) = number(v, i) {
                        n
                    } else if let Some(texts) = c.exact.get(v) {
                        texts[i].clone().unwrap_or_else(|| v.to_owned())
                    } else if v.contains(", ") {
                        // A list (`2 new soap, 1 updated candle`): each item on its own.
                        let sep = tv("import.joiner", &[]);
                        v.split(", ").map(|p| tr_in(i, p)).collect::<Vec<_>>().join(&sep)
                    } else if v.len() < english.len() {
                        tr_in(i, v)
                    } else {
                        v.to_owned()
                    };
                    (k, v)
                })
                .collect();
            return fill(target, &vars);
        }
    }
    english.to_owned()
}

/// A number as the app writes it (`-1234.5`), written the way of language `i`.
fn number(s: &str, i: usize) -> Option<String> {
    let body = s.strip_prefix('-').unwrap_or(s);
    let (int, frac) = body.split_once('.').map_or((body, None), |(a, b)| (a, Some(b)));
    if int.is_empty()
        || !int.bytes().all(|b| b.is_ascii_digit())
        || frac.is_some_and(|f| f.is_empty() || !f.bytes().all(|b| b.is_ascii_digit()))
    {
        return None;
    }
    let (dec, group, min_group) = separators(LOCALES[i].0);
    let mut grouped = String::new();
    if int.len() >= min_group {
        for (n, ch) in int.chars().enumerate() {
            if n > 0 && (int.len() - n) % 3 == 0 {
                grouped.push_str(group);
            }
            grouped.push(ch);
        }
    } else {
        grouped.push_str(int);
    }
    let sign = if s.starts_with('-') { "-" } else { "" };
    Some(match frac {
        Some(f) => format!("{sign}{grouped}{dec}{f}"),
        None => format!("{sign}{grouped}"),
    })
}

/// Decimal separator, grouping separator, and the fewest integer digits that get grouped
/// (what `Intl.NumberFormat` does for these languages).
fn separators(id: &str) -> (&'static str, &'static str, usize) {
    match id {
        "es" | "pl" => (",", if id == "pl" { "\u{a0}" } else { "." }, 5),
        "de" | "it" | "pt-BR" => (",", ".", 4),
        "fr" => (",", "\u{202f}", 4),
        "ru" => (",", "\u{a0}", 5),
        _ => (".", ",", 4),
    }
}

/// [`tr`] line by line (recipe text for the clipboard, the print sheet, a share).
pub fn tr_lines(text: &str) -> String {
    text.split('\n').map(tr).collect::<Vec<_>>().join("\n")
}

/// [`tr`] piece by piece of a line joined with `sep`.
pub fn tr_parts(text: &str, sep: &str) -> String {
    text.split(sep).map(tr).collect::<Vec<_>>().join(sep)
}

/// A number for display in the language shown, to at most `places` decimals.
pub fn num(n: f64, places: i32) -> String {
    let s = crate::soap_form::fmt_num(n, places);
    tr(&s)
}

/// The language for a list of BCP 47 tags (the system's, in order), as the shipped app
/// chose it: `pt*` → pt-BR, `zh`/Simplified → zh-CN, Traditional Chinese skipped.
pub fn match_locale<'a>(tags: impl IntoIterator<Item = &'a str>) -> &'static str {
    for raw in tags {
        let tag = raw.trim().replace('_', "-");
        if tag.is_empty() {
            continue;
        }
        let lower = tag.to_lowercase();
        if let Some((id, _)) = LOCALES.iter().find(|(id, _)| id.to_lowercase() == lower) {
            return id;
        }
        if lower == "zh" || ["zh-cn", "zh-hans", "zh-sg"].iter().any(|p| lower.starts_with(p)) {
            return "zh-CN";
        }
        if lower.starts_with("zh") {
            continue;
        }
        if lower.starts_with("pt") {
            return "pt-BR";
        }
        let primary = lower.split('-').next().unwrap_or("");
        if let Some((id, _)) = LOCALES.iter().find(|(id, _)| *id == primary) {
            return id;
        }
    }
    "en"
}

/// Temperature for display: English stays °F, other languages add a rounded °C.
pub fn temp_f(f: f64) -> String {
    let ft = num(f.round(), 0);
    if current() == "en" {
        return format!("{ft}°F");
    }
    format!("{ft}°F ({}°C)", num(((f - 32.0) * 5.0 / 9.0).round(), 0))
}

/// The value of a 1.1.x preferences object's `locale`, when it is one of ours.
pub fn legacy_locale(prefs: &Value) -> Option<&'static str> {
    let l = prefs.get("locale")?.as_str()?;
    LOCALES.iter().find(|(id, _)| *id == l).map(|(id, _)| *id)
}

/// `tagKey`: a stable ASCII key for a free-text tag.
pub fn tag_key(tag: &str) -> String {
    let mut out = String::new();
    for ch in tag.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
        } else if matches!(ch, ' ' | '-' | '_' | '/' | '\'' | '’') {
            out.push('_');
        } else {
            out.push_str(&format!("u{:x}", ch as u32));
        }
    }
    let mut s = out.to_lowercase();
    while s.contains("__") {
        s = s.replace("__", "_");
    }
    let s = s.trim_matches('_').to_owned();
    if s.is_empty() { "tag".into() } else { s }
}

/// How a wiki tag reads in the language shown (`displayTag`).
pub fn display_tag(tag: &str) -> String {
    if let Some(o) = crate::data::data().oils.iter().find(|o| o.id == tag || o.name.eq_ignore_ascii_case(tag))
    {
        return tx(&format!("oil.{}.name", o.id), &o.name);
    }
    if let Some(w) =
        crate::data::data().waxes.iter().find(|w| w.id == tag || w.name.eq_ignore_ascii_case(tag))
    {
        return tx(&format!("wax.{}.name", w.id), &w.name);
    }
    let k = tag_key(tag);
    for key in [
        format!("trait.{tag}"),
        format!("oilCat.{tag}"),
        format!("waxType.{tag}"),
        format!("wiki.cat.{tag}"),
        format!("bestFor.{k}"),
        format!("tag.{k}"),
    ] {
        let v = t(&key);
        if v != key {
            return v;
        }
    }
    tag.to_owned()
}

fn localize_static(a: &crate::data::WikiArticle) -> crate::data::WikiArticle {
    let id = &a.id;
    crate::data::WikiArticle {
        title: tx(&format!("wiki.{id}.title"), &a.title),
        summary: tx(&format!("wiki.{id}.summary"), &a.summary),
        sections: a
            .sections
            .iter()
            .enumerate()
            .map(|(i, s)| crate::data::WikiSection {
                heading: s.heading.as_ref().map(|h| tx(&format!("wiki.{id}.s{i}.heading"), h)),
                body: tx(&format!("wiki.{id}.s{i}.body"), &s.body),
            })
            .collect(),
        ..a.clone()
    }
}

fn summary_of(notes: &str, wiki: &str, fallback: String) -> String {
    if !notes.is_empty() {
        notes.to_owned()
    } else if !wiki.is_empty() {
        wiki.chars().take(90).collect()
    } else {
        fallback
    }
}

fn localize_oil(a: &crate::data::WikiArticle, o: &crate::data::Oil) -> crate::data::WikiArticle {
    let field = |key: &str, v: &Option<String>| {
        v.as_deref().map(|n| tx(&format!("oil.{}.{key}", o.id), n)).unwrap_or_default().trim().to_owned()
    };
    let name = tx(&format!("oil.{}.name", o.id), &o.name);
    let notes = field("notes", &o.notes);
    let wiki = field("wiki", &o.wiki);
    let level = |v: &str| tx(&format!("level.{v}"), v);
    let mut lines =
        vec![tv("spec.naohSap", &[("sap", num(o.sap_naoh, 4)), ("koh", fixed(o.sap_naoh * 1.4027, 4))])];
    if let Some(v) = o.iodine {
        lines.push(tv("spec.iodine", &[("value", num(v, 4))]));
    }
    if let Some(v) = o.ins {
        lines.push(tv("spec.ins", &[("value", num(v, 4))]));
    }
    if let Some(v) = o.max_pct {
        lines.push(tv("spec.maxPct", &[("pct", num(v, 2))]));
    }
    for (key, v) in
        [("spec.hardness", &o.hardness), ("spec.conditioning", &o.conditioning), ("spec.lather", &o.lather)]
    {
        if let Some(v) = v.as_deref().filter(|v| !v.is_empty()) {
            lines.push(tv(key, &[("value", level(v))]));
        }
    }
    if let Some(list) = o.traits.as_ref().filter(|l| !l.is_empty()) {
        let list: Vec<String> =
            list.iter().map(|x| tx(&format!("trait.{x}"), &x.replace('-', " "))).collect();
        lines.push(tv("spec.traits", &[("list", list.join(&t("spec.listSep")))]));
    }
    if !notes.is_empty() {
        lines.push(tv("spec.shortNote", &[("note", notes.clone())]));
    }
    let n = [("name", name.clone())];
    crate::data::WikiArticle {
        title: name.clone(),
        summary: summary_of(&notes, &wiki, tv("spec.oilFallbackSummary", &n)),
        sections: vec![
            crate::data::WikiSection {
                heading: None,
                body: if wiki.is_empty() { tv("spec.oilFallbackBody", &n) } else { wiki },
            },
            crate::data::WikiSection { heading: Some(t("spec.heading")), body: lines.join("\n") },
        ],
        ..a.clone()
    }
}

fn localize_wax(a: &crate::data::WikiArticle, w: &crate::data::Wax) -> crate::data::WikiArticle {
    let id = &w.id;
    let field = |key: &str, v: &Option<String>| {
        v.as_deref().map(|n| tx(&format!("wax.{id}.{key}"), n)).unwrap_or_default().trim().to_owned()
    };
    let name = tx(&format!("wax.{id}.name"), &w.name);
    let notes = field("notes", &w.notes);
    let wiki = field("wiki", &w.wiki);
    let cure = field("cure", &w.cure_days);
    let wick = field("wick", &w.wick_notes);
    let mut lines = vec![
        tv("spec.type", &[("value", tx(&format!("waxType.{}", w.kind), &w.kind))]),
        tv(
            "spec.foBand",
            &[
                ("min", num(w.fragrance_min, 2)),
                ("max", num(w.fragrance_max, 2)),
                ("typical", num(w.fragrance_typical, 2)),
            ],
        ),
    ];
    if let Some(f) = w.melt_point_f {
        lines.push(tv("spec.melt", &[("temp", temp_f(f))]));
    }
    if let Some(f) = w.pour_temp_f {
        lines.push(tv("spec.pour", &[("temp", temp_f(f))]));
    }
    if !cure.is_empty() {
        lines.push(tv("spec.cure", &[("text", cure)]));
    }
    if let Some(b) = w.best_for.as_ref().filter(|b| !b.is_empty()) {
        let list: Vec<String> = b.iter().map(|u| tx(&format!("bestFor.{}", tag_key(u)), u)).collect();
        lines.push(tv("spec.bestFor", &[("list", list.join(&t("spec.listSep")))]));
    }
    if !wick.is_empty() {
        lines.push(tv("spec.wick", &[("text", wick)]));
    }
    if !notes.is_empty() {
        lines.push(tv("spec.shortNote", &[("note", notes.clone())]));
    }
    let n = [("name", name.clone())];
    crate::data::WikiArticle {
        title: name.clone(),
        summary: summary_of(&notes, &wiki, tv("spec.waxFallbackSummary", &n)),
        sections: vec![
            crate::data::WikiSection {
                heading: None,
                body: if wiki.is_empty() { tv("spec.waxFallbackBody", &n) } else { wiki },
            },
            crate::data::WikiSection { heading: Some(t("spec.heading")), body: lines.join("\n") },
        ],
        ..a.clone()
    }
}

/// `n` with exactly `places` decimals, the language's way.
fn fixed(n: f64, places: usize) -> String {
    let s = format!("{n:.places$}");
    if current() == "en" { s } else { tr(&s) }
}

/// The wiki in the language shown (`localizeArticles`); tags stay as written, for search.
pub fn articles() -> &'static [crate::data::WikiArticle] {
    thread_local! {
        static CACHE: std::cell::RefCell<HashMap<usize, &'static [crate::data::WikiArticle]>> = Default::default();
    }
    let i = CURRENT.with(Cell::get);
    CACHE.with(|c| {
        *c.borrow_mut().entry(i).or_insert_with(|| {
            let list: Vec<_> = crate::wiki::articles()
                .iter()
                .map(|a| {
                    let oil =
                        a.id.strip_prefix("oil-")
                            .and_then(|id| crate::data::data().oils.iter().find(|o| o.id == id));
                    let wax =
                        a.id.strip_prefix("wax-")
                            .and_then(|id| crate::data::data().waxes.iter().find(|w| w.id == id));
                    match (oil, wax) {
                        (Some(o), _) => localize_oil(a, o),
                        (_, Some(w)) => localize_wax(a, w),
                        _ => localize_static(a),
                    }
                })
                .collect();
            Box::leak(list.into_boxed_slice())
        })
    })
}

/// One article of [`articles`].
pub fn article(id: &str) -> Option<&'static crate::data::WikiArticle> {
    articles().iter().find(|a| a.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn with<R>(id: &str, f: impl FnOnce() -> R) -> R {
        set_current(id);
        let r = f();
        set_current("en");
        r
    }

    #[test]
    fn exact_templates_and_numbers() {
        assert_eq!(tr("Recipe name"), "Recipe name");
        with("de", || {
            assert_eq!(tr("Recipe name"), "Rezeptname");
            assert_eq!(tr("Saved (3)"), "Gespeichert (3)");
            assert_eq!(
                tr("Scaled oils to Total oils (35.274 oz)"),
                "Öle auf Öle gesamt skaliert (35,274 oz)"
            );
            assert_eq!(tr("12345.5"), "12.345,5");
            assert_eq!(tr("Olive Oil"), t("oil.olive.name"));
            assert_eq!(tr("My own recipe"), "My own recipe");
            assert_eq!(tr("  Recipe name  "), "  Rezeptname  ");
            assert_eq!(
                tr("Imported 2 new soap, 1 updated candle"),
                "Importiert: 2 neue Seifen, 1 aktualisierte Kerze"
            );
        });
        with("es", || assert_eq!(tr("1234.5"), "1234,5"));
        with("ru", || {
            assert_eq!(tr("Imported 1 new soap"), "Импортировано: 1 новое мыло");
            assert_eq!(tr("Imported 3 new soap"), "Импортировано: 3 новых мыла");
            assert_eq!(tr("Imported 5 new soap"), "Импортировано: 5 новых мыл");
        });
        with("fr", || assert_eq!(tr("1234.5"), "1\u{202f}234,5"));
    }

    #[test]
    fn locale_matching() {
        assert_eq!(match_locale(["de-AT"]), "de");
        assert_eq!(match_locale(["pt-PT"]), "pt-BR");
        assert_eq!(match_locale(["zh-TW", "ja-JP"]), "ja");
        assert_eq!(match_locale(["zh-Hans-CN"]), "zh-CN");
        assert_eq!(match_locale(["xx"]), "en");
    }

    #[test]
    fn every_catalog_has_every_key_with_the_same_placeholders() {
        let c = catalogs();
        for (i, cat) in c.by_locale.iter().enumerate().skip(1) {
            for (k, en) in &c.by_locale[0] {
                let v = cat.get(k).unwrap_or_else(|| panic!("{} lacks {k}", LOCALES[i].0));
                let names = |s: &str| {
                    let mut n: Vec<String> = parse(s)
                        .into_iter()
                        .filter_map(|p| if let Part::Var(v) = p { Some(v) } else { None })
                        .collect();
                    n.sort();
                    n
                };
                assert_eq!(names(en), names(v), "{} {k}", LOCALES[i].0);
            }
        }
        // This edition's strings: every language, same placeholders.
        let port: HashMap<String, HashMap<String, String>> = serde_json::from_str(PORT).unwrap();
        for (en, tr) in &port {
            for (id, _) in LOCALES.iter().skip(1) {
                let v = tr.get(*id).unwrap_or_else(|| panic!("port.json: {en} lacks {id}"));
                assert_eq!(
                    parse(en).len() > 1 || en.contains('{'),
                    parse(v).len() > 1 || v.contains('{'),
                    "{id} {en}"
                );
            }
        }
    }
}
