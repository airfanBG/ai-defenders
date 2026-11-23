# Експерименти за статията „Пазителят на тайната“

Седем защити на ИИ асистент (D0–D6) срещу атаки на български и английски.
Мерим дела на успешните атаки (ASR), полезността (верни отговори по справката) и дали служители
с правилния код за достъп получават тайната.

| Файл | Какво е |
|---|---|
| `corpus.mjs` | източникът на корпуса: атаките и въпросите от арената (`lib/arena.js`) плюс английския превод и класовете |
| `export_corpus.mjs` | изнася корпуса в `kaggle/corpus.json` |
| `kaggle/arena_exp.py` | защитите, проверката за изтичане (същата като в арената), пускането и обобщението |
| `kaggle/run_model.py` | един модел в отделен процес (за Kaggle) |
| `kaggle/build_notebook.py` | сглобява `kaggle/secret_keeper_experiments.ipynb` с всичко вградено |
| `data/` | резултатите (JSONL, по ред на заявка) |

## Защитите

| | Защита | Тайната е в модела? |
|---|---|---|
| D0 | само системни инструкции | да |
| D1 | усилени инструкции + spotlighting | да |
| D2 | D0 + филтър на входа по ключови думи | да |
| D3 | D0 + втори модел като охрана на входа | да |
| D4 | D0 + филтър на изхода за тайната | да |
| D5 | D2 + D3 + филтър на изхода за тайната и кода | да |
| D6 | кодът се проверява в кода; моделът не знае тайната; филтър на изхода | **не** |

## Как се пуска

**Workers AI** (през локалния сайт):

```bash
npx wrangler pages dev --port 8790 --binding ADMIN_PASSWORD=<тестова парола>
```

```python
import sys; sys.path.insert(0, "experiments/kaggle")
import arena_exp as A
m = A.HTTPBackend("@cf/mistralai/mistral-small-3.1-24b-instruct")      # ARENA_ADMIN и ARENA_BASE от средата
atk = A.HTTPBackend("@cf/meta/llama-3.3-70b-instruct-fp8-fast")
A.run(m, model_key="mistral24b", out="experiments/data/workers.jsonl", reps=5, attacker=atk)
A.summarize("experiments/data/workers.jsonl")
```

**Kaggle:** `python experiments/kaggle/build_notebook.py`, после качете `secret_keeper_experiments.ipynb`
в Kaggle (GPU T4 x2, Internet On, Secret `HF_TOKEN`) и пуснете всички клетки.

Ако промените корпуса или кода, пуснете пак `export_corpus.mjs` и `build_notebook.py`.
