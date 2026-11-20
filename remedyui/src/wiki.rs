//! The craft wiki (F1): the hand-written articles plus one generated per oil and per wax,
//! search, and the light text format the articles are written in. Ported from the shipped
//! app's `src/data/wiki.ts` and the `renderBody` of `src/components/Wiki.tsx`.

use std::sync::OnceLock;

use crate::data::{self, Oil, Wax, WikiArticle, WikiSection};
use crate::js;

/// `oilArticlesFromDb`.
pub fn oil_articles(oils: &[Oil]) -> Vec<WikiArticle> {
    oils.iter()
        .map(|o| {
            let mut tags = vec![o.name.to_lowercase(), o.id.clone(), o.category.clone()];
            tags.extend(o.traits.clone().unwrap_or_default());
            tags.push("oil".into());
            tags.push("sap".into());
            let summary = first_truthy([
                o.notes.clone(),
                o.wiki.as_ref().map(|w| js::slice16(w, 90)),
                Some(format!("{} soap oil profile", o.name)),
            ]);
            let body = o.wiki.clone().filter(|w| !w.is_empty()).unwrap_or_else(|| {
                format!("{} is available in the soap calculator. Verify SAP with your supplier.", o.name)
            });
            let specs: Vec<String> = [
                Some(format!(
                    "NaOH SAP: {} g/g (KOH ≈ {})",
                    js::to_string(o.sap_naoh),
                    js::to_fixed(o.sap_naoh * 1.4027, 4)
                )),
                o.iodine.map(|v| format!("Iodine value: {}", js::to_string(v))),
                o.ins.map(|v| format!("INS: {}", js::to_string(v))),
                o.max_pct.map(|v| format!("Typical max in a balanced bar: ~{}%", js::to_string(v))),
                truthy_str(&o.hardness).map(|v| format!("Hardness contribution: {v}")),
                truthy_str(&o.conditioning).map(|v| format!("Conditioning: {v}")),
                truthy_str(&o.lather).map(|v| format!("Lather character: {v}")),
                o.traits.as_ref().filter(|t| !t.is_empty()).map(|t| format!("Traits: {}", t.join(", "))),
                truthy_str(&o.notes).map(|v| format!("Short note: {v}")),
            ]
            .into_iter()
            .flatten()
            .collect();
            WikiArticle {
                id: format!("oil-{}", o.id),
                title: o.name.clone(),
                category: "oils".into(),
                tags,
                summary,
                sections: vec![
                    WikiSection { heading: None, body },
                    WikiSection { heading: Some("Calculator specs".into()), body: specs.join("\n") },
                ],
            }
        })
        .collect()
}

/// `waxArticlesFromDb`.
pub fn wax_articles(waxes: &[Wax]) -> Vec<WikiArticle> {
    waxes
        .iter()
        .map(|w| {
            let tags = vec![
                w.name.to_lowercase(),
                w.id.clone(),
                w.kind.clone(),
                "wax".into(),
                "candle".into(),
                "fo".into(),
            ];
            let summary = first_truthy([
                w.notes.clone(),
                w.wiki.as_ref().map(|x| js::slice16(x, 90)),
                Some(format!("{} candle profile", w.name)),
            ]);
            let body = w.wiki.clone().filter(|x| !x.is_empty()).unwrap_or_else(|| {
                format!(
                    "{} profile used for fragrance range and pour hints in the candle calculator.",
                    w.name
                )
            });
            let specs: Vec<String> = [
                Some(format!("Type: {}", w.kind)),
                Some(format!(
                    "Fragrance load band: {}–{}% (typical {}%)",
                    js::to_string(w.fragrance_min),
                    js::to_string(w.fragrance_max),
                    js::to_string(w.fragrance_typical)
                )),
                w.melt_point_f.map(|v| format!("Melt point ~{}°F", js::to_string(v))),
                w.pour_temp_f.map(|v| format!("Pour temp ~{}°F", js::to_string(v))),
                truthy_str(&w.cure_days).map(|v| format!("Cure guidance: {v}")),
                w.best_for.as_ref().filter(|t| !t.is_empty()).map(|t| format!("Best for: {}", t.join(", "))),
                truthy_str(&w.wick_notes).map(|v| format!("Wick notes: {v}")),
                truthy_str(&w.notes).map(|v| format!("Short note: {v}")),
            ]
            .into_iter()
            .flatten()
            .collect();
            WikiArticle {
                id: format!("wax-{}", w.id),
                title: w.name.clone(),
                category: "waxes".into(),
                tags,
                summary,
                sections: vec![
                    WikiSection { heading: None, body },
                    WikiSection { heading: Some("Calculator specs".into()), body: specs.join("\n") },
                ],
            }
        })
        .collect()
}

fn truthy_str(s: &Option<String>) -> Option<&str> {
    s.as_deref().filter(|s| !s.is_empty())
}

fn first_truthy<const N: usize>(options: [Option<String>; N]) -> String {
    options.into_iter().flatten().find(|s| !s.is_empty()).unwrap_or_default()
}

/// `buildFullWiki`: the hand-written articles, then the oil and wax encyclopedias.
pub fn build_full_wiki() -> Vec<WikiArticle> {
    let d = data::data();
    let mut all = d.wiki_articles.clone();
    all.extend(oil_articles(&d.oils));
    all.extend(wax_articles(&d.waxes));
    all
}

/// The full wiki, built once.
pub fn articles() -> &'static [WikiArticle] {
    static ALL: OnceLock<Vec<WikiArticle>> = OnceLock::new();
    ALL.get_or_init(build_full_wiki)
}

/// An article by id.
pub fn article(id: &str) -> Option<&'static WikiArticle> {
    articles().iter().find(|a| a.id == id)
}

/// `searchWiki`: articles whose text holds every word of the query.
pub fn search<'a>(articles: &'a [WikiArticle], query: &str) -> Vec<&'a WikiArticle> {
    let q = js::trim(query).to_lowercase();
    if q.is_empty() {
        return articles.iter().collect();
    }
    let parts: Vec<&str> = q.split(js::is_js_space).filter(|p| !p.is_empty()).collect();
    articles
        .iter()
        .filter(|a| {
            let mut hay = vec![a.title.as_str(), a.summary.as_str(), a.id.as_str(), a.category.as_str()];
            hay.extend(a.tags.iter().map(String::as_str));
            hay.extend(a.sections.iter().map(|s| s.body.as_str()));
            let hay = hay.join(" ").to_lowercase();
            parts.iter().all(|p| hay.contains(p))
        })
        .collect()
}

/// A run of text, bold or not (`**bold**` in the articles).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Span {
    pub text: String,
    pub bold: bool,
}

/// A block of an article body.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Block {
    /// A bulleted list (lines starting with •, - or *).
    Bullets(Vec<String>),
    /// A numbered list (lines starting with `1.`).
    Numbered(Vec<String>),
    /// A paragraph: lines (kept as line breaks), each of spans.
    Paragraph(Vec<Vec<Span>>),
}

fn is_bullet_start(s: &str) -> bool {
    s.starts_with(['•', '-', '*'])
}

fn is_number_start(s: &str) -> bool {
    let digits = s.chars().take_while(char::is_ascii_digit).count();
    digits > 0 && s[digits..].starts_with('.')
}

/// `formatInline`: `**bold**` spans.
pub fn inline(line: &str) -> Vec<Span> {
    // JavaScript: line.split(/(\*\*[^*]+\*\*)/g), keeping the bold parts.
    let mut out = Vec::new();
    let mut rest = line;
    while let Some(start) = rest.find("**") {
        let after = &rest[start + 2..];
        let inner_len = after.find('*').unwrap_or(after.len());
        if inner_len > 0 && after[inner_len..].starts_with("**") {
            if start > 0 {
                out.push(Span { text: rest[..start].to_owned(), bold: false });
            }
            out.push(Span { text: after[..inner_len].to_owned(), bold: true });
            rest = &after[inner_len + 2..];
        } else {
            // No match here: the regex tries again from the next character.
            let (head, tail) = rest.split_at(start + 1);
            match out.last_mut() {
                Some(Span { text, bold: false }) => text.push_str(head),
                _ => out.push(Span { text: head.to_owned(), bold: false }),
            }
            rest = tail;
            continue;
        }
    }
    if !rest.is_empty() {
        match out.last_mut() {
            Some(Span { text, bold: false }) => text.push_str(rest),
            _ => out.push(Span { text: rest.to_owned(), bold: false }),
        }
    }
    if out.is_empty() {
        out.push(Span { text: String::new(), bold: false });
    }
    out
}

/// `renderBody`: paragraphs on blank lines, bulleted and numbered lists.
pub fn blocks(text: &str) -> Vec<Block> {
    let mut blocks = Vec::new();
    for block in split_blank_lines(text) {
        let lines: Vec<&str> = block.split('\n').collect();
        let is_list = lines.iter().all(|l| {
            let t = js::trim(l);
            is_bullet_start(t) || t.is_empty()
        });
        if is_list {
            blocks.push(Block::Bullets(
                lines
                    .iter()
                    .filter(|l| !js::trim(l).is_empty())
                    .map(|l| strip_marker(l, is_bullet_start, |s| s.chars().next().map_or(0, char::len_utf8)))
                    .collect(),
            ));
            continue;
        }
        let is_num = lines.iter().all(|l| {
            let t = js::trim(l);
            is_number_start(t) || t.is_empty()
        });
        if is_num {
            blocks.push(Block::Numbered(
                lines
                    .iter()
                    .filter(|l| !js::trim(l).is_empty())
                    .map(|l| {
                        strip_marker(l, is_number_start, |s| {
                            s.chars().take_while(char::is_ascii_digit).count() + 1
                        })
                    })
                    .collect(),
            ));
            continue;
        }
        blocks.push(Block::Paragraph(lines.iter().map(|l| inline(l)).collect()));
    }
    blocks
}

/// `l.replace(/^MARKER\s*/, '')` on the untrimmed line.
fn strip_marker(l: &str, starts: fn(&str) -> bool, marker_len: impl Fn(&str) -> usize) -> String {
    if !starts(l) {
        return l.to_owned();
    }
    l[marker_len(l)..].trim_start_matches(is_regex_space).to_owned()
}

/// JavaScript's `\s`.
fn is_regex_space(c: char) -> bool {
    js::is_js_space(c)
}

/// `text.split(/\n\n+/)`.
fn split_blank_lines(text: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut start = 0;
    let b = text.as_bytes();
    let mut i = 0;
    while i + 1 < b.len() {
        if b[i] == b'\n' && b[i + 1] == b'\n' {
            out.push(&text[start..i]);
            let mut j = i;
            while j < b.len() && b[j] == b'\n' {
                j += 1;
            }
            start = j;
            i = j;
        } else {
            i += 1;
        }
    }
    out.push(&text[start..]);
    out
}

/// The wiki article for an oil.
pub fn oil_wiki_id(oil_id: &str) -> String {
    format!("oil-{oil_id}")
}

/// The wiki article for a wax.
pub fn wax_wiki_id(wax_id: &str) -> String {
    format!("wax-{wax_id}")
}
