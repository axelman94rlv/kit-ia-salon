// TP 4.1 — Sorties structurées avec la Responses API : du texte libre vers un objet typé et validé.
// Cas : trier les tickets du support de la plateforme Orion (données fictives).
//
// Responses API ≠ Chat Completions : on envoie un « input » (texte ou liste d'éléments),
// les consignes vont dans « instructions », le format de sortie dans « text.format »,
// et la réponse est une liste d'éléments « output » (le SDK en extrait output_text / output_parsed).
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { config, openai } from "../src/config.js";

// Le schéma est la SPÉCIFICATION : il sert au modèle (contrainte) ET à votre code (validation, types).
// TODO : Définir le schéma zod Ticket : categorie (enum bug | facturation | acces | demande_fonctionnalite | autre), priorite (enum P1 | P2 | P3), resume (≤ 140 caractères), client (chaîne ou null), produit (chaîne ou null), action_suggeree (chaîne).
const Ticket = z.object({ resume: z.string() }); // à compléter
type Ticket = z.infer<typeof Ticket>;

const tickets = [
  "Bonjour, depuis ce matin 8h plus personne chez Brasserie Lumen ne peut se connecter à Orion Caisse, on a un service à midi !!! Merci de faire vite. — Julie",
  "Petite question : serait-il possible d'exporter les rapports mensuels d'Orion Stock en CSV plutôt qu'en PDF ? Ce serait bien pratique. Bonne journée, Karim (Atelier Nord)",
  "On a été facturés deux fois pour octobre (facture F-2026-1042), pouvez-vous rembourser le doublon ? Cordialement, compta Transports Vey",
];

const client = openai();

for (const text of tickets) {
  // TODO : Appeler client.responses.parse avec instructions (la tâche), input (le ticket), text: { format: zodTextFormat(Ticket, "ticket") }, temperature 0 et store: false. Récupérer output_parsed ; en cas d'exception ou d'objet absent, afficher l'erreur et passer au ticket suivant.
  const parsed: Ticket | undefined = undefined;
  if (!parsed) { console.log("à implémenter"); continue; }

  // Ceinture ET bretelles : on revalide côté code. Le modèle peut se tromper, le schéma non.
  const check = Ticket.safeParse(parsed);
  console.log(check.success ? "✓" : "✗", JSON.stringify(parsed, null, 2), "\n");
}

