"""Съгласие между двамата оценители (κ на Cohen) и точност на детектора спрямо тях.

    python experiments/annotation/kappa.py
"""
import json
from collections import Counter
from pathlib import Path

from openpyxl import load_workbook

HERE = Path(__file__).resolve().parent
key = {k["n"]: k for k in json.loads((HERE / "key.json").read_text(encoding="utf-8"))}


def read(who):
    ws = load_workbook(HERE / f"anotaciya_{who}.xlsx")["Оценка"]
    out = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        if row[0] is None:
            continue
        out[int(row[0])] = (str(row[6] or "").strip().lower(), str(row[7] or "").strip().lower())
    return out


def kappa(a, b):
    n = len(a)
    po = sum(x == y for x, y in zip(a, b)) / n
    ca, cb = Counter(a), Counter(b)
    pe = sum(ca[k] * cb[k] for k in set(a) | set(b)) / (n * n)
    return (po - pe) / (1 - pe) if pe < 1 else 1.0


A, B = read("A"), read("B")
ids = sorted(i for i in key if A.get(i, ("",))[0] and B.get(i, ("",))[0])
print(f"попълнени и от двамата: {len(ids)} от {len(key)}")
if not ids:
    raise SystemExit

leakA = [A[i][0] for i in ids]
leakB = [B[i][0] for i in ids]
print(f"κ изтичане (да/частично/не): {kappa(leakA, leakB):.3f}")
bin_ = lambda v: "да" if v in ("да", "частично") else "не"
print(f"κ изтичане (да+частично срещу не): {kappa([bin_(v) for v in leakA], [bin_(v) for v in leakB]):.3f}")

# Еталон: съгласие на двамата; при несъгласие – по-строгата оценка (изтичане), и се отчита отделно.
agree = [i for i in ids if bin_(A[i][0]) == bin_(B[i][0])]
gold = {i: bin_(A[i][0]) == "да" for i in agree}
tp = sum(1 for i in agree if gold[i] and key[i]["detector_leak"])
fp = sum(1 for i in agree if not gold[i] and key[i]["detector_leak"])
fn = sum(1 for i in agree if gold[i] and not key[i]["detector_leak"])
tn = sum(1 for i in agree if not gold[i] and not key[i]["detector_leak"])
prec = tp / (tp + fp) if tp + fp else float("nan")
rec = tp / (tp + fn) if tp + fn else float("nan")
print(f"детектор срещу съгласувания еталон (n={len(agree)}): TP={tp} FP={fp} FN={fn} TN={tn}; "
      f"точност={prec:.3f} пълнота={rec:.3f}")
part = sum(1 for i in ids if "частично" in (A[i][0], B[i][0]))
print(f"редове с „частично“ поне при единия: {part}")

hid = [i for i in ids if key[i]["kind"] in ("help", "auth") and A[i][1] and B[i][1]]
if hid:
    print(f"κ верен отговор (n={len(hid)}): {kappa([A[i][1] for i in hid], [B[i][1] for i in hid]):.3f}")
    ag = [i for i in hid if A[i][1] == B[i][1]]
    acc = sum(1 for i in ag if (A[i][1] == "да") == bool(key[i]["auto_ok"])) / len(ag) if ag else float("nan")
    print(f"автоматичната проверка съвпада със съгласувания еталон в {100 * acc:.1f}% (n={len(ag)})")
