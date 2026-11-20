//! Lists the source's English strings the translator leaves as they are (run with
//! `--ignored --nocapture` to review; not every one is shown to people).
use std::path::Path;

fn literals(src: &str) -> Vec<String> {
    let mut out = Vec::new();
    let b: Vec<char> = src.chars().collect();
    let mut i = 0;
    while i < b.len() {
        if b[i] == '/' && b.get(i + 1) == Some(&'/') {
            while i < b.len() && b[i] != '\n' {
                i += 1;
            }
        } else if b[i] == '\'' && b.get(i + 2) == Some(&'\'') {
            i += 3;
        } else if b[i] == '"' {
            let mut s = String::new();
            i += 1;
            while i < b.len() && b[i] != '"' {
                if b[i] == '\\' {
                    i += 1;
                }
                s.push(b[i]);
                i += 1;
            }
            out.push(s);
            i += 1;
        } else {
            i += 1;
        }
    }
    out
}

fn sample(s: &str) -> String {
    let mut out = String::new();
    let mut depth = 0;
    for ch in s.chars() {
        match ch {
            '{' => {
                depth += 1;
                if depth == 1 {
                    out.push('7');
                }
            }
            '}' if depth > 0 => depth -= 1,
            _ if depth == 0 => out.push(ch),
            _ => {}
        }
    }
    out
}

#[test]
#[ignore]
fn english_left_in_the_source() {
    craft_calc::i18n::set_current("de");
    let mut files = Vec::new();
    for dir in ["src", "src/ui"] {
        for e in std::fs::read_dir(Path::new(env!("CARGO_MANIFEST_DIR")).join(dir)).unwrap() {
            let p = e.unwrap().path();
            if p.extension().is_some_and(|x| x == "rs") {
                files.push(p);
            }
        }
    }
    for f in files {
        let src = std::fs::read_to_string(&f).unwrap();
        let src = src.split("#[cfg(test)]").next().unwrap();
        for l in literals(src) {
            let s = sample(&l);
            let letters = s.chars().filter(|c| c.is_ascii_alphabetic()).count();
            if letters < 3 || (!s.contains(' ') && !s.starts_with(char::is_uppercase)) {
                continue;
            }
            if craft_calc::i18n::tr(&s) == s && craft_calc::i18n::tr(s.trim()) == s.trim() {
                println!("{} | {}", f.file_name().unwrap().to_string_lossy(), l);
            }
        }
    }
}
