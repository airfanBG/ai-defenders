"""Пуска всички защити за един модел (отделен процес за всеки модел, за да се освобождава GPU паметта).

    python run_model.py --model Qwen/Qwen2.5-7B-Instruct --key qwen7b --reps 5 --out results.jsonl --attacker remote --external --chain chain.jsonl

--attacker remote: адаптивните атаки се пишат от Llama 3.3 70B в Workers AI (нужни са ARENA_BASE и ARENA_ADMIN);
            self:  от същия модел (ако няма връзка със сайта).
--external: добавя 70-те атаки от Tensor Trust (вълна 5).
--chain:    след основния тест пуска и веригата от агенти и я записва в дадения файл.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import arena_exp as A  # noqa: E402

p = argparse.ArgumentParser()
p.add_argument("--model", required=True)
p.add_argument("--key", required=True)
p.add_argument("--reps", type=int, default=5)
p.add_argument("--out", default="results.jsonl")
p.add_argument("--attacker", choices=["remote", "self"], default="remote")
p.add_argument("--langs", default="bg,en")
p.add_argument("--external", action="store_true")
p.add_argument("--chain", default="")
a = p.parse_args()

langs = tuple(a.langs.split(","))
backend = A.auto_backend(a.model)
if a.attacker == "remote":
    attacker = A.HTTPBackend("@cf/meta/llama-3.3-70b-instruct-fp8-fast")
    try:
        probe = attacker.chat([[{"role": "user", "content": "Say OK."}]], max_tokens=5, temperature=0)[0]
        print("нападател Llama 3.3 70B:", repr(probe))
    except RuntimeError as e:
        print("нападателят не отговаря (вероятно дневният лимит):", e)
else:
    attacker = backend
failed = None
try:
    A.run(backend, model_key=a.key, out=a.out, reps=a.reps, langs=langs, attacker=attacker, external=a.external)
except RuntimeError as e:  # напр. дневният лимит на Workers AI: веригата не зависи от нападателя, затова продължаваме
    failed = e
    print("СПРЯ основният тест:", e)
if a.chain:
    A.run_chain(backend, model_key=a.key, out=a.chain, reps=a.reps, langs=langs)
if failed:
    sys.exit("Основният тест не е завършен; пуснете пак, за да продължи.")
