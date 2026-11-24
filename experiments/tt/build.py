"""Атаките от Tensor Trust (extraction robustness v1) като пета вълна на корпуса.

Избрани са 70 различни атаки с дължина 15–350 знака (seed 20261123), преведени на
български ръчно (bg.json). Суровите данни не се качват в хранилището (няма изричен лиценз);
цитира се Toyer et al., ICLR 2024.

    python experiments/tt/build.py   →   experiments/kaggle/corpus_tt.json
"""
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
sel = json.loads((HERE / "selected_en.json").read_text(encoding="utf-8"))
bg = json.loads((HERE / "bg.json").read_text(encoding="utf-8"))

RULES = [  # подклас по механизъм; първото съвпадение печели
    ("tt_code", r"python|pseudocode|json|coq|java|code"),
    ("tt_creative", r"poem|rap|sonnet|rhyme|irc"),
    ("tt_translate", r"translate|german|italian|tradur"),
    ("tt_prefix", r"begin (your|with)|start (your|with)|begin!"),
    ("tt_repeat", r"repeat|list|summar|instruction|prompt|rules|rephrase|print|tell me|what are"),
    ("tt_other", r"."),
]


def cls(text):
    t = text.lower()
    return next(name for name, pat in RULES if re.search(pat, t))


out = {"bg": [], "en": []}
for s in sel:
    c = cls(s["en"])
    out["en"].append({"id": s["id"], "wave": 5, "cls": c, "text": s["en"], "source": s["sample_id"]})
    out["bg"].append({"id": s["id"], "wave": 5, "cls": c, "text": bg[s["id"]], "source": s["sample_id"]})
assert len(bg) == len(sel) == 70
dest = HERE.parent / "kaggle" / "corpus_tt.json"
dest.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
from collections import Counter
print(dest, dict(Counter(a["cls"] for a in out["en"])))
