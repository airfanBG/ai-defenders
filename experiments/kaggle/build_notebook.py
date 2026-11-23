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
ATTACKER = "remote" if os.environ.get("ARENA_ADMIN") else "self"
print("адаптивни атаки:", ATTACKER)
"""),
    writefile("arena_exp.py"),
    writefile("run_model.py"),
    code("%%writefile corpus.json\n" + (HERE / "corpus.json").read_text(encoding="utf-8")),
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
    !python run_model.py --model "{{model}}" --key {{key}} --reps {{REPS}} --out results.jsonl --attacker {{ATTACKER}}
"""),
    md("## Резултати"),
    code("""
import arena_exp as A
table, by_class, adaptive = A.summarize("results.jsonl")
table.to_csv("summary_by_cell.csv"); by_class.to_csv("asr_by_class.csv"); adaptive.to_csv("asr_adaptive.csv")
"""),
]

nb = {"cells": cells, "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
                                    "language_info": {"name": "python"}}, "nbformat": 4, "nbformat_minor": 5}
Path(ARGS.out).parent.mkdir(parents=True, exist_ok=True)
Path(ARGS.out).write_text(json.dumps(nb, ensure_ascii=False, indent=1), encoding="utf-8")
print(ARGS.out, f"(повторения: {REPS}, модели: {', '.join(MODEL_KEYS)})")
