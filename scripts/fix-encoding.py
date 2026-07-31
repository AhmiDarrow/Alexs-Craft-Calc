from pathlib import Path
import re

files = [
    Path("src/components/SoapCalculator.tsx"),
    Path("src/components/CandleCalculator.tsx"),
    Path("src/components/Wiki.tsx"),
    Path("src/App.tsx"),
]

# Pure ASCII source: use unicode escapes only
DOT = "\u00b7"      # ·
ARROW = "\u2192"    # →
BULLET = "\u2022"   # •
DEG = "\u00b0"      # °
TIMES = "\u00d7"    # ×
MDASH = "\u2014"    # —
SEARCH = "\u2315"   # ⌕

for p in files:
    t = p.read_text(encoding="utf-8", errors="replace")
    orig = t
    # replacement char and control junk
    t = t.replace("\ufffd", DOT)
    t = t.replace("\x1a", ARROW)
    t = t.replace("\x07", BULLET)
    # common mojibake sequences if present as multi-byte misreads already decoded wrong
    for bad, good in [
        ("\u00c2\u00b7", DOT),
        ("\u00c2\u00b0", DEG),
    ]:
        t = t.replace(bad, good)
    # degree F fixes after dot substitution
    t = re.sub(r"~(\$\{[^}]+\})" + re.escape(DOT) + r"F", r"~\1" + DEG + "F", t)
    t = re.sub(r"~(\d+)" + re.escape(DOT) + r"F", r"~\1" + DEG + "F", t)
    t = re.sub(r"(\d+)" + re.escape(DOT) + r"F", r"\1" + DEG + "F", t)
    # Wiki list regex: ensure bullet in character class
    t = t.replace("/^[" + BULLET + r"\-\*]/", "/^[" + BULLET + r"\-\*]/")
    # If class only has backslash- hyphen star without bullet, inject bullet
    t = t.replace(r"/^[\-\*]/", "/^[" + BULLET + r"\-\*]/")
    t = t.replace(r"/^[\-\*]\s*/", "/^[" + BULLET + r"\-\*]\s*/")
    # Fix search icon if became ?
    t = t.replace("icon: '?'", "icon: '" + SEARCH + "'")
    t = t.replace('icon: "?"', 'icon: "' + SEARCH + '"')
    if t != orig:
        p.write_text(t, encoding="utf-8", newline="\n")
        print("fixed", p)
    else:
        print("unchanged", p)
    # report leftover controls
    controls = [hex(ord(ch)) for ch in t if ord(ch) < 32 and ch not in "\n\r\t"]
    print("  controls", controls[:10], "nonascii", len(set(ch for ch in t if ord(ch)>127)))
