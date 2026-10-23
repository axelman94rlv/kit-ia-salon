// TP 2.1 — Un parseur Server-Sent Events écrit à la main.
//
// Format SSE (texte, UTF-8) :
//   data: {"choices":[...]}\n
//   \n                         ← une ligne vide termine l'événement
//   : keep-alive               ← commentaire (à ignorer) : certains serveurs et proxys en envoient
//   data: [DONE]\n\n           ← convention de Chat Completions : fin du flux
//
// Piège n°1 : un paquet réseau ne correspond PAS à un événement. Un morceau peut
// contenir trois événements, ou la moitié d'un seul. Il faut un tampon.

/** Transforme un flux d'octets en une suite de charges utiles `data:` (chaînes). */
export async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder(); // { stream: true } gère les caractères UTF-8 coupés en deux
  let buffer = "";

  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, "\n");

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      const data = rawEvent
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).replace(/^ /, ""))
        .join("\n");

      if (!data) continue; // commentaire ou événement sans data
      if (data === "[DONE]") return;
      yield data;
    }
  }
}
