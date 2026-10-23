// TP 1.0 — Quels modèles votre clé peut-elle appeler ?
// La liste dépend du projet et de l'organisation qui portent la clé : ne la supposez jamais.
//   npm run models            → tous les modèles visibles
//   npm run models -- gpt     → seulement ceux dont l'identifiant contient « gpt »
import { config, requireKey } from "../src/config.js";

type Model = { id: string; created: number; owned_by: string };
const filtre = process.argv[2] ?? "";

const res = await fetch(`${config.baseURL}/models`, { headers: { Authorization: `Bearer ${requireKey()}` } });
if (!res.ok) throw new Error(`HTTP ${res.status} : ${await res.text()}`);
const { data } = (await res.json()) as { data: Model[] };
const ids = data.map((m) => m.id).filter((id) => id.includes(filtre)).sort();
for (const id of ids) console.log(id);
console.log(`\n${ids.length} modèle(s)${filtre ? ` contenant « ${filtre} »` : ""} sur ${data.length}.`);
console.log(`Modèle configuré dans .env : ${config.model} · temps réel : ${config.realtimeModel}`);
