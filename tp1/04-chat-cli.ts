// TP 1.4 — Un chat en ligne de commande. Point clé : l'API est SANS ÉTAT.
// Le modèle ne se souvient de rien : c'est vous qui renvoyez tout l'historique à chaque tour.
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { config, openai } from "../src/config.js";

type Msg = { role: "system" | "user" | "assistant"; content: string };

const client = openai();
const SYSTEM: Msg = { role: "system", content: "Tu es un assistant pour développeurs. Réponses courtes, en français." };
const MAX_TURNS = 6; // nombre d'échanges conservés : au-delà, on oublie les plus anciens
let history: Msg[] = [];
let totalTokens = 0;

const rl = readline.createInterface({ input: stdin, output: stdout });
console.log("Chat prêt. Commandes : /reset, /historique, /quitter\n");

while (true) {
  const line = (await rl.question("vous > ")).trim();
  if (!line) continue;
  if (line === "/quitter") break;
  if (line === "/reset") { history = []; console.log("(historique effacé)\n"); continue; }
  if (line === "/historique") { console.log(history); continue; }

  history.push({ role: "user", content: line });

  history = history.slice(-MAX_TURNS * 2);
  const res = await client.chat.completions.create({ model: config.model, messages: [SYSTEM, ...history] });
  const answer = res.choices[0]?.message?.content ?? "";
  history.push({ role: "assistant", content: answer });
  totalTokens += res.usage?.total_tokens ?? 0;

  console.log(`ia   > ${answer}\n       [${history.length} messages envoyés · ${totalTokens} tokens cumulés]\n`);
}
rl.close();
