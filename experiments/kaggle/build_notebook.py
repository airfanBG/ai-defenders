"""Сглобява Kaggle notebook-а: вгражда arena_exp.py, run_model.py и corpus.json, за да тръгне без нищо друго.

    python experiments/kaggle/build_notebook.py
"""
import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
_a = argparse.ArgumentParser()
_a.add_argument("--reps", type=int, default=5)
_a.add_argument("--models", default="qwen2.5-7b,llama3.1-8b,bggpt-7b")
_a.add_argument("--out", default=str(HERE / "secret_keeper_experiments.ipynb"))
ARGS = _a.parse_args()
REPS, MODEL_KEYS = ARGS.reps, ARGS.models.split(",")


def md(text):
    return {"cell_type": "markdown", "metadata": {}, "source": text.strip("\n").splitlines(keepends=True)}


def code(text):
    return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [],
            "source": text.strip("\n").splitlines(keepends=True)}


def writefile(name):
    body = (HERE / name).read_text(encoding="utf-8")
    return code(f"%%writefile {name}\n" + body)


cells = [
    md("""
# Пазителят на тайната: експерименти със защитите на ИИ асистенти

Седем защити (D0–D6) срещу 28 статични и 6 адаптивни атаки, на български и английски, върху отворени модели.
Мерим колко атаки изкарват тайната (ASR), дали асистентът отговаря вярно и дали служителите с код получават тайната.

**Настройки на notebook-а:** Accelerator **GPU T4 x2**, Internet **On**.
**Kaggle Secrets** (Add-ons → Secrets): `HF_TOKEN` (за моделите с лиценз), по желание `ARENA_BASE` и `ARENA_ADMIN`
(тогава адаптивните атаки се пишат от Llama 3.3 70B в Workers AI, еднакво за всички модели).
"""),
    md("""
Моделите вървят през Hugging Face Transformers (вече са в Kaggle). Ако инсталирате vLLM,
скриптът го ползва сам и е много по-бързо; в Kaggle с Python 3.13 vLLM 0.6 не се инсталира.
"""),
    code("""
import os
from kaggle_secrets import UserSecretsClient
s = UserSecretsClient()
for name in ["HF_TOKEN", "ARENA_BASE", "ARENA_ADMIN"]:
    try:
        os.environ[name] = s.get_secret(name)
        print(name, "✓")
    except Exception:
        print(name, "— няма")
os.environ.setdefault("ARENA_BASE", "https://ai-hackathon-k3b.pages.dev")
import glob
for _f in sorted(glob.glob("/kaggle/input/**/token.txt", recursive=True)):  # частен Dataset с EXPERIMENT_TOKEN
    _t = open(_f, encoding="utf-8").read().strip()
    if _t:
        os.environ["ARENA_ADMIN"] = _t
        print("ключ за експеримента: от", _f)
        break
if not os.environ.get("ARENA_ADMIN"):
    raise SystemExit("Няма ключ: закачете частния Dataset с token.txt (или Kaggle Secret ARENA_ADMIN) и пуснете отново.")
import json, urllib.request, urllib.error
_req = urllib.request.Request(os.environ["ARENA_BASE"] + "/api/llm", data=json.dumps({
    "messages": [{"role": "user", "content": "Say OK."}], "model": "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    "max_tokens": 5}).encode(), headers={"Authorization": "Bearer " + os.environ["ARENA_ADMIN"], "Content-Type": "application/json", "User-Agent": "secret-keeper-experiments/1.0"})
try:
    with urllib.request.urlopen(_req, timeout=120) as _r:
        _out = json.loads(_r.read().decode())
except urllib.error.HTTPError as e:
    raise SystemExit(f"Сайтът отказа ({e.code}): {e.read().decode(errors='replace')[:300]}")
if _out.get("model", "").find("llama-3.3-70b") < 0:
    raise SystemExit(f"Сайтът не използва Llama 70B за админа: {_out}")
ATTACKER = "remote"
print("адаптивни атаки: Llama 3.3 70B през", os.environ["ARENA_BASE"], "→", repr(_out.get("reply")))
"""),
    writefile("arena_exp.py"),
    writefile("run_model.py"),
    code("%%writefile corpus.json\n" + (HERE / "corpus.json").read_text(encoding="utf-8")),
    code("%%writefile corpus_tt.json\n" + (HERE / "corpus_tt.json").read_text(encoding="utf-8")),
    code("%%writefile chain.json\n" + (HERE / "chain.json").read_text(encoding="utf-8")),
    code("""
# Продължаване: частни резултати от предишно пускане (Dataset с results_<модел>.jsonl и chain_<модел>.jsonl)
import glob
MODEL_KEYS = __MK__
for _kind in ["results", "chain"]:
    _parts = sorted([f for _k in MODEL_KEYS for f in glob.glob(f"/kaggle/input/**/{_kind}_{_k}.jsonl", recursive=True)])
    if _parts and not os.path.exists(f"{_kind}.jsonl"):
        with open(f"{_kind}.jsonl", "w", encoding="utf-8") as _o:
            for _f in _parts:
                _o.write(open(_f, encoding="utf-8").read())
        print("продължавам от", _parts)
""".replace("__MK__", repr(MODEL_KEYS))),
    md("""
## Моделите

Всеки модел се пуска в отделен процес. Резултатите се добавят в `results.jsonl`; ако сесията прекъсне,
пуснете клетката пак и тя продължава оттам, докъдето е стигнала.
"""),
    code(f"""
REPS = {REPS}
ALL_MODELS = [
    ("Qwen/Qwen2.5-7B-Instruct", "qwen2.5-7b"),
    ("meta-llama/Llama-3.1-8B-Instruct", "llama3.1-8b"),            # нужен е достъп в Hugging Face
    ("INSAIT-Institute/BgGPT-7B-Instruct-v0.2", "bggpt-7b"),        # български модел (INSAIT)
]
MODELS = [m for m in ALL_MODELS if m[1] in {MODEL_KEYS!r}]
for model, key in MODELS:
    print("=====", model)
    !python run_model.py --model "{{model}}" --key {{key}} --reps {{REPS}} --out results.jsonl --attacker {{ATTACKER}} --external --chain chain.jsonl
"""),
    md("## Резултати"),
    code("""
import arena_exp as A
table, by_class, adaptive = A.summarize("results.jsonl")
table.to_csv("summary_by_cell.csv"); by_class.to_csv("asr_by_class.csv"); adaptive.to_csv("asr_adaptive.csv")
import json
import pandas as pd
ch = pd.DataFrame([json.loads(l) for l in open("chain.jsonl", encoding="utf-8")])
chain = (ch.pivot_table(index=["model", "lang", "defense"], columns="kind", values=["leaked", "ok", "leak_inner"], aggfunc="mean") * 100).round(1)
chain.to_csv("chain_summary.csv")
print(chain.to_string())
"""),
]

nb = {"cells": cells, "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
                                    "language_info": {"name": "python"}}, "nbformat": 4, "nbformat_minor": 5}
Path(ARGS.out).parent.mkdir(parents=True, exist_ok=True)
Path(ARGS.out).write_text(json.dumps(nb, ensure_ascii=False, indent=1), encoding="utf-8")
print(ARGS.out, f"(повторения: {REPS}, модели: {', '.join(MODEL_KEYS)})")
