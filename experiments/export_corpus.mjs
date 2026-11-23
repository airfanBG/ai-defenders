// Изнася корпуса (bg и en) в JSON за Python скрипта и Kaggle notebook-а.
//   node experiments/export_corpus.mjs
import { writeFileSync } from "node:fs";
import { CORPUS } from "./corpus.mjs";

writeFileSync(new URL("./kaggle/corpus.json", import.meta.url), JSON.stringify(CORPUS, null, 1));
console.log("experiments/kaggle/corpus.json");
