//! JavaScript number semantics the shipped app's results depend on.
//!
//! The React app computed and displayed every value with JavaScript numbers: `Math.round`
//! (halves toward +∞), `String(n)` (shortest round-trip digits, exponent past 1e21 and
//! below 1e-6), `toFixed`, `parseFloat`, `Number(x)` and UTF-16 `slice`. These functions do
//! exactly the same on `f64`, so the RemedyUI app shows the same digits for the same inputs.

use serde_json::Value;

/// `Math.round(x)`: the nearest integer, halves toward +∞ (`Math.round(-2.5)` is `-2`).
pub fn round(x: f64) -> f64 {
    if !x.is_finite() || x == 0.0 {
        return x;
    }
    let f = x.floor();
    // x - floor(x) is exact for every double (Sterbenz for |x| >= 1, trivially below).
    let r = if x - f >= 0.5 { f + 1.0 } else { f };
    // Math.round keeps the sign of zero for -0.5 <= x < 0.
    if r == 0.0 && x < 0.0 { -0.0 } else { r }
}

/// `Math.round(n * 10 ** places) / 10 ** places`, the app's `round` and `fmtNum` core.
pub fn round_to(n: f64, places: i32) -> f64 {
    let f = pow10(places);
    round(n * f) / f
}

/// `10 ** places` as JavaScript computes it for the small integers the app uses (exact).
pub fn pow10(places: i32) -> f64 {
    10f64.powi(places)
}

/// The shortest round-trip digits of a finite, non-zero `x` and its decimal exponent `n`
/// (`x = 0.d1d2… × 10^n`).
fn shortest_digits(x: f64) -> (String, i32) {
    let s = format!("{:e}", x.abs());
    let (mantissa, exp) = s.split_once('e').unwrap_or((&s, "0"));
    let digits: String = mantissa.chars().filter(char::is_ascii_digit).collect();
    let exp: i32 = exp.parse().unwrap_or(0);
    let digits = digits.trim_end_matches('0');
    let digits = if digits.is_empty() { "0".to_owned() } else { digits.to_owned() };
    let n = exp + 1;
    // JavaScript takes, among the shortest digit strings that read back as x, the one
    // closest to x (ties to an even last digit). Rust's shortest form is shortest but not
    // always closest, so the neighbours one unit away in the last place are checked too.
    let exact = exact_digits(x.abs());
    let mut best = digits.clone();
    let mut best_diff = distance(&best, n, &exact);
    for delta in [-1i32, 1] {
        let Some(c) = step_last_digit(&digits, delta) else { continue };
        if format!("0.{c}e{n}").parse::<f64>().ok() != Some(x.abs()) {
            continue;
        }
        let diff = distance(&c, n, &exact);
        let closer = match diff.cmp(&best_diff) {
            std::cmp::Ordering::Less => true,
            std::cmp::Ordering::Equal => c.as_bytes().last().is_some_and(|b| (b - b'0').is_multiple_of(2)),
            std::cmp::Ordering::Greater => false,
        };
        if closer {
            best = c;
            best_diff = diff;
        }
    }
    let best = best.trim_end_matches('0');
    (if best.is_empty() { "0".to_owned() } else { best.to_owned() }, n)
}

/// The exact decimal digits of a positive finite double and its exponent `e`
/// (`x = 0.DIGITS × 10^e`).
fn exact_digits(x: f64) -> (String, i32) {
    let s = format!("{x:.1100e}");
    let (m, e) = s.split_once('e').unwrap_or((&s, "0"));
    let digits: String = m.chars().filter(char::is_ascii_digit).collect();
    (digits, e.parse::<i32>().unwrap_or(0) + 1)
}

/// The same-length digit string one unit away in the last place, if there is one.
fn step_last_digit(d: &str, delta: i32) -> Option<String> {
    let mut b = d.as_bytes().to_vec();
    let mut i = b.len();
    loop {
        if i == 0 {
            return None;
        }
        i -= 1;
        let v = i32::from(b[i] - b'0') + delta;
        if (0..=9).contains(&v) {
            b[i] = b'0' + v as u8;
            break;
        }
        b[i] = if delta > 0 { b'0' } else { b'9' };
    }
    if b.first() == Some(&b'0') {
        return None;
    }
    String::from_utf8(b).ok()
}

/// |0.c × 10^n − x| as a digit string comparable with others for the same x.
fn distance(c: &str, n: i32, exact: &(String, i32)) -> String {
    let (xd, xe) = exact;
    let top = n.max(*xe);
    let mut a: Vec<u8> = "0".repeat((top - n) as usize).into_bytes();
    a.extend_from_slice(c.as_bytes());
    let mut b: Vec<u8> = "0".repeat((top - xe) as usize).into_bytes();
    b.extend_from_slice(xd.as_bytes());
    let len = a.len().max(b.len());
    a.resize(len, b'0');
    b.resize(len, b'0');
    let (hi, lo) = if a >= b { (a, b) } else { (b, a) };
    let mut out = vec![b'0'; len];
    let mut borrow = 0i32;
    for i in (0..len).rev() {
        let mut v = i32::from(hi[i] - b'0') - i32::from(lo[i] - b'0') - borrow;
        borrow = 0;
        if v < 0 {
            v += 10;
            borrow = 1;
        }
        out[i] = b'0' + v as u8;
    }
    String::from_utf8(out).unwrap_or_default()
}

/// `String(x)` for a number (ECMAScript Number::toString with radix 10).
pub fn to_string(x: f64) -> String {
    if x.is_nan() {
        return "NaN".into();
    }
    if x == 0.0 {
        return "0".into();
    }
    if x.is_infinite() {
        return if x > 0.0 { "Infinity".into() } else { "-Infinity".into() };
    }
    let sign = if x < 0.0 { "-" } else { "" };
    let (d, n) = shortest_digits(x);
    let k = d.len() as i32;
    let body = if k <= n && n <= 21 {
        format!("{d}{}", "0".repeat((n - k) as usize))
    } else if 0 < n && n <= 21 {
        format!("{}.{}", &d[..n as usize], &d[n as usize..])
    } else if -6 < n && n <= 0 {
        format!("0.{}{d}", "0".repeat((-n) as usize))
    } else {
        let e = n - 1;
        let es = if e >= 0 { format!("+{e}") } else { e.to_string() };
        if k == 1 { format!("{d}e{es}") } else { format!("{}.{}e{es}", &d[..1], &d[1..]) }
    };
    format!("{sign}{body}")
}

/// `x.toFixed(digits)` (digits 0..=100).
pub fn to_fixed(x: f64, digits: usize) -> String {
    if x.is_nan() {
        return "NaN".into();
    }
    if x.abs() >= 1e21 || x.is_infinite() {
        return to_string(x);
    }
    if x < 0.0 {
        let s = to_fixed(-x, digits);
        // (-0.0001).toFixed(2) is "-0.00" in JavaScript: the sign stays.
        return format!("-{s}");
    }
    // The exact decimal value of x (at most 1074 fraction digits), then rounded with ties
    // going to the larger value, as the specification asks ("pick the larger n").
    let exact = format!("{x:.1100}");
    let (int, frac) = exact.split_once('.').unwrap_or((&exact, ""));
    let keep = &frac[..digits];
    let rest = &frac[digits..];
    let up = rest.as_bytes().first().is_some_and(|b| *b >= b'5');
    let mut num: Vec<u8> = format!("{int}{keep}").into_bytes();
    if up {
        let mut i = num.len();
        loop {
            if i == 0 {
                num.insert(0, b'1');
                break;
            }
            i -= 1;
            if num[i] == b'9' {
                num[i] = b'0';
            } else {
                num[i] += 1;
                break;
            }
        }
    }
    let s = String::from_utf8(num).unwrap_or_default();
    if digits == 0 {
        return s;
    }
    let split = s.len() - digits;
    format!("{}.{}", &s[..split], &s[split..])
}

/// JavaScript's white space and line terminators (what `trim` and `parseFloat` skip).
pub fn is_js_space(c: char) -> bool {
    matches!(
        c,
        '\u{9}' | '\u{A}' | '\u{B}' | '\u{C}' | '\u{D}' | ' ' | '\u{A0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200A}' | '\u{2028}' | '\u{2029}' | '\u{202F}' | '\u{205F}' | '\u{3000}' | '\u{FEFF}'
    )
}

/// `s.trim()`.
pub fn trim(s: &str) -> &str {
    s.trim_matches(is_js_space)
}

/// The longest prefix of `s` that is a StrDecimalLiteral (sign, digits, `.`, exponent).
fn decimal_prefix(s: &str) -> Option<f64> {
    let b = s.as_bytes();
    let mut i = 0;
    if i < b.len() && (b[i] == b'+' || b[i] == b'-') {
        i += 1;
    }
    if s[i..].starts_with("Infinity") {
        return Some(if b.first() == Some(&b'-') { f64::NEG_INFINITY } else { f64::INFINITY });
    }
    let int_start = i;
    while i < b.len() && b[i].is_ascii_digit() {
        i += 1;
    }
    let mut digits = i > int_start;
    if i < b.len() && b[i] == b'.' {
        let f = i + 1;
        let mut j = f;
        while j < b.len() && b[j].is_ascii_digit() {
            j += 1;
        }
        if j > f || digits {
            digits = digits || j > f;
            i = j;
        }
    }
    if !digits {
        return None;
    }
    if i < b.len() && (b[i] == b'e' || b[i] == b'E') {
        let mut j = i + 1;
        if j < b.len() && (b[j] == b'+' || b[j] == b'-') {
            j += 1;
        }
        let e0 = j;
        while j < b.len() && b[j].is_ascii_digit() {
            j += 1;
        }
        if j > e0 {
            i = j;
        }
    }
    let lit = &s[..i];
    // Rust's parser is correctly rounded, like JavaScript's; it rejects "5." and ".5"
    // forms only in edge cases we normalise here.
    let norm = if lit.ends_with('.') { format!("{lit}0") } else { lit.to_owned() };
    norm.parse::<f64>().ok()
}

/// `parseFloat(s)`.
pub fn parse_float(s: &str) -> f64 {
    let t = s.trim_start_matches(is_js_space);
    decimal_prefix(t).unwrap_or(f64::NAN)
}

/// `parseInt(s, 10)`.
pub fn parse_int(s: &str) -> f64 {
    let t = s.trim_start_matches(is_js_space);
    let (neg, rest) = match t.as_bytes().first() {
        Some(b'-') => (true, &t[1..]),
        Some(b'+') => (false, &t[1..]),
        _ => (false, t),
    };
    let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
    if digits.is_empty() {
        return f64::NAN;
    }
    let v: f64 = digits.parse().unwrap_or(f64::NAN);
    if neg { -v } else { v }
}

/// `Number(s)` for a string (StringToNumber).
pub fn string_to_number(s: &str) -> f64 {
    let t = trim(s);
    if t.is_empty() {
        return 0.0;
    }
    let lower = t.to_ascii_lowercase();
    for (prefix, radix) in [("0x", 16), ("0o", 8), ("0b", 2)] {
        if let Some(rest) = lower.strip_prefix(prefix) {
            if rest.is_empty() {
                return f64::NAN;
            }
            let mut v = 0f64;
            for c in rest.chars() {
                match c.to_digit(radix) {
                    Some(d) => v = v * f64::from(radix) + f64::from(d),
                    None => return f64::NAN,
                }
            }
            return v;
        }
    }
    let b = t.as_bytes();
    let body = if b[0] == b'+' || b[0] == b'-' { &t[1..] } else { t };
    if body == "Infinity" {
        return if b[0] == b'-' { f64::NEG_INFINITY } else { f64::INFINITY };
    }
    // The whole string must be a decimal literal.
    let ok = !body.is_empty()
        && body.chars().all(|c| c.is_ascii_digit() || matches!(c, '.' | 'e' | 'E' | '+' | '-'))
        && body.chars().next().is_some_and(|c| c.is_ascii_digit() || c == '.');
    if !ok {
        return f64::NAN;
    }
    match decimal_prefix(t) {
        Some(v) => {
            // decimal_prefix stops at the first character that is not part of the literal;
            // Number() needs the whole string to be one.
            let consumed = literal_len(t);
            if consumed == t.len() { v } else { f64::NAN }
        }
        None => f64::NAN,
    }
}

fn literal_len(s: &str) -> usize {
    let b = s.as_bytes();
    let mut i = 0;
    if i < b.len() && (b[i] == b'+' || b[i] == b'-') {
        i += 1;
    }
    let s0 = i;
    while i < b.len() && b[i].is_ascii_digit() {
        i += 1;
    }
    let had_int = i > s0;
    if i < b.len() && b[i] == b'.' {
        let f = i + 1;
        let mut j = f;
        while j < b.len() && b[j].is_ascii_digit() {
            j += 1;
        }
        if j > f || had_int {
            i = j;
        }
    }
    if i < b.len() && (b[i] == b'e' || b[i] == b'E') {
        let mut j = i + 1;
        if j < b.len() && (b[j] == b'+' || b[j] == b'-') {
            j += 1;
        }
        let e0 = j;
        while j < b.len() && b[j].is_ascii_digit() {
            j += 1;
        }
        if j > e0 {
            i = j;
        }
    }
    i
}

/// `String(v)` for a JSON value as JavaScript would produce it.
pub fn value_to_string(v: &Value) -> String {
    match v {
        Value::Null => "null".into(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => to_string(n.as_f64().unwrap_or(f64::NAN)),
        Value::String(s) => s.clone(),
        Value::Array(a) => a
            .iter()
            .map(|e| match e {
                Value::Null => String::new(),
                other => value_to_string(other),
            })
            .collect::<Vec<_>>()
            .join(","),
        Value::Object(_) => "[object Object]".into(),
    }
}

/// `Number(v)` for a JSON value; `None` is `undefined` (a missing field).
pub fn to_number(v: Option<&Value>) -> f64 {
    match v {
        None => f64::NAN,
        Some(Value::Null) => 0.0,
        Some(Value::Bool(b)) => f64::from(u8::from(*b)),
        Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
        Some(Value::String(s)) => string_to_number(s),
        Some(Value::Array(_)) => string_to_number(&value_to_string(v.unwrap_or(&Value::Null))),
        Some(Value::Object(_)) => f64::NAN,
    }
}

/// JavaScript truthiness of a JSON value (`None` is `undefined`).
pub fn truthy(v: Option<&Value>) -> bool {
    match v {
        None | Some(Value::Null) => false,
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => n.as_f64().is_some_and(|x| x != 0.0 && !x.is_nan()),
        Some(Value::String(s)) => !s.is_empty(),
        Some(_) => true,
    }
}

/// `x || fallback` for a number.
pub fn or(x: f64, fallback: f64) -> f64 {
    if x == 0.0 || x.is_nan() { fallback } else { x }
}

/// `s.slice(0, n)`: the first `n` UTF-16 code units. A surrogate pair cut in half leaves
/// a lone surrogate in JavaScript; Rust strings cannot hold one, so it becomes U+FFFD.
pub fn slice16(s: &str, n: usize) -> String {
    let units: Vec<u16> = s.encode_utf16().take(n).collect();
    String::from_utf16_lossy(&units)
}

/// `s.length` in UTF-16 code units.
pub fn len16(s: &str) -> usize {
    s.encode_utf16().count()
}

/// `n.toString(36)` for a non-negative integer.
pub fn base36(mut n: u64) -> String {
    const D: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    if n == 0 {
        return "0".into();
    }
    let mut out = Vec::new();
    while n > 0 {
        out.push(D[(n % 36) as usize]);
        n /= 36;
    }
    out.reverse();
    String::from_utf8(out).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn math_round_matches_javascript() {
        assert_eq!(round(2.5), 3.0);
        assert_eq!(round(-2.5), -2.0);
        assert_eq!(round(0.49999999999999994), 0.0);
        assert_eq!(round(-0.4).to_bits(), (-0.0f64).to_bits());
        assert_eq!(round(1.005 * 100.0), 100.0);
    }

    #[test]
    fn number_to_string_matches_javascript() {
        for (x, s) in [
            (0.1 + 0.2, "0.30000000000000004"),
            (1e21, "1e+21"),
            (1.5e21, "1.5e+21"),
            (123456789012345680000.0, "123456789012345680000"),
            (1e-7, "1e-7"),
            (1.25e-7, "1.25e-7"),
            (0.000001, "0.000001"),
            (-0.0, "0"),
            (35.274, "35.274"),
            (100.0, "100"),
            (-3.5, "-3.5"),
        ] {
            assert_eq!(to_string(x), s, "{x:e}");
        }
    }

    #[test]
    fn to_fixed_rounds_ties_up() {
        assert_eq!(to_fixed(0.5, 0), "1");
        assert_eq!(to_fixed(2.5, 0), "3");
        assert_eq!(to_fixed(1.005, 2), "1.00");
        assert_eq!(to_fixed(0.125, 2), "0.13");
        assert_eq!(to_fixed(0.18936450000000002, 4), "0.1894");
        assert_eq!(to_fixed(9.99995, 4), "10.0000");
    }

    #[test]
    fn parse_float_reads_a_prefix() {
        assert_eq!(parse_float("12.5abc"), 12.5);
        assert_eq!(parse_float("  .5"), 0.5);
        assert_eq!(parse_float("5."), 5.0);
        assert_eq!(parse_float("1e3x"), 1000.0);
        assert_eq!(parse_float("1e"), 1.0);
        assert!(parse_float("").is_nan());
        assert!(parse_float("-").is_nan());
        assert_eq!(parse_float("-Infinity"), f64::NEG_INFINITY);
        assert_eq!(parse_int("4.9"), 4.0);
    }

    #[test]
    fn number_of_strings() {
        assert_eq!(string_to_number(" 12 "), 12.0);
        assert_eq!(string_to_number(""), 0.0);
        assert!(string_to_number("12px").is_nan());
        assert_eq!(string_to_number("0x1F"), 31.0);
        assert_eq!(string_to_number("1e2"), 100.0);
        assert_eq!(to_number(Some(&serde_json::json!([5]))), 5.0);
        assert_eq!(to_number(Some(&serde_json::json!([]))), 0.0);
    }
}
