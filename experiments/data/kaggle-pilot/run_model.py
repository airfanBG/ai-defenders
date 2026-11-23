"""Пуска всички защити за един модел (отделен процес за всеки модел, за да се освобождава GPU паметта).

    python run_model.py --model Qwen/Qwen2.5-7B-Instruct --key qwen7b --reps 5 --out results.jsonl --attacker remote

--attacker remote: адаптивните атаки се пишат от Llama 3.3 70B в Workers AI (нужни са ARENA_BASE и ARENA_ADMIN);
            self:  от същия модел (ако няма връзка със сайта).
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
a = p.parse_args()

backend = A.auto_backend(a.model)
attacker = A.HTTPBackend("@cf/meta/llama-3.3-70b-instruct-fp8-fast") if a.attacker == "remote" else backend
A.run(backend, model_key=a.key, out=a.out, reps=a.reps, langs=tuple(a.langs.split(",")), attacker=attacker)
