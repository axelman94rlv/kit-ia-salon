// TP 1.3 — Le SDK officiel d'OpenAI : même requête, typée, avec retries et timeouts.
import { config, openai } from "../src/config.js";

const client = openai();

const res = await client.chat.completions.create({
  model: config.model,
  temperature: 0.3,
  max_tokens: 300,
  messages: [
    { role: "system", content: "Tu es un assistant technique concis. Réponds en français." },
    { role: "user", content: "Quelle différence entre une API REST et une API WebSocket ?" },
  ],
});

console.log(res.choices[0]?.message?.content);
console.log("\nmodèle :", res.model);
console.log("usage  :", res.usage);

// À observer : changez OPENAI_BASE_URL (faux serveur, autre fournisseur compatible) : le code ne bouge pas.
// C'est ça, un standard de fait.
