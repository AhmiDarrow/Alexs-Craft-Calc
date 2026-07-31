import re
from pathlib import Path

paths = [
    Path("src/components/SoapCalculator.tsx"),
    Path("src/components/CandleCalculator.tsx"),
    Path("src/App.tsx"),
    Path("src/components/Wiki.tsx"),
    Path("src/components/Toast.tsx"),
    Path("src/components/ModeToggle.tsx"),
]
classes = set()
for p in paths:
    t = p.read_text(encoding="utf-8")
    for m in re.findall(r'className="([^"]+)"', t):
        for c in m.split():
            classes.add(c)
    for m in re.findall(r"className=\{`([^`]+)`\}", t):
        for c in m.replace("${", " ").replace("}", " ").split():
            if c.isidentifier() or "-" in c:
                classes.add(c)
print("\n".join(sorted(classes)))
