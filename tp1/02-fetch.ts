// TP 1.2 — Le même appel avec fetch, sans SDK : tout ce qu'un SDK fait pour vous.
import { config, requireKey } from "../src/config.js";

const question = process.argv.slice(2).join(" ") || "Donne trois usages d'un LLM dans une application métier.";

const t0 = performance.now();
const res = await fetch(`${config.baseURL}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${requireKey()}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: config.model,
    temperature: 0.3,
    max_tokens: 300,
    messages: [
      { role: "system", content: "Tu es un assistant technique concis. Réponds en français." },
      { role: "user", content: question },
    ],
  }),
});

if (!res.ok) {
  console.error(`Erreur HTTP ${res.status} :`, await res.text());
  process.exit(1);
}

const data = (await res.json()) as {
  model: string;
  choices: { message: { content: string }; finish_reason: string }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};
const ms = Math.round(performance.now() - t0);

console.log(data.choices[0].message.content);
console.log("\n---");
console.log(`modèle        : ${data.model}`);
console.log(`finish_reason : ${data.choices[0].finish_reason}`);
console.log(`tokens        : ${data.usage.prompt_tokens} en entrée + ${data.usage.completion_tokens} en sortie = ${data.usage.total_tokens}`);
console.log(`latence       : ${ms} ms (réponse complète)`);
console.log(`quota minute  : ${res.headers.get("x-ratelimit-remaining-requests") ?? "?"} requêtes restantes`);
