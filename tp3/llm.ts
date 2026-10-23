// TP 3 — Un client LLM qui tient en production.
//
// Trois problèmes à résoudre :
//   1. Le débit : une clé partagée par toute une promo atteint vite ses limites → un limiteur qui met en file.
//   2. Les pannes passagères (429, 5xx, réseau) → des retries avec backoff exponentiel + jitter.
//   3. Les requêtes qui pendent → un timeout, et une annulation à la demande (AbortSignal).
//
// Ce module est réutilisé par le TP 5 et par le mini-projet.
import { config, requireKey } from "../src/config.js";
import { parseSSE } from "../tp2/sse.js";

export type Role = "system" | "user" | "assistant";
export type Msg = { role: Role; content: string };
export type Usage = { prompt_tokens: number; completion_tokens: number; total_tokens: number };

export class HttpError extends Error {
  constructor(public status: number, public body: string, public retryAfterMs?: number) {
    super(`HTTP ${status} : ${body.slice(0, 200)}`);
  }
}

/**
 * Codes pour lesquels réessayer a un sens. Un 400, 401, 403 ou 404 ne guérira pas tout seul.
 * Piège : deux 429 très différents. « rate_limit_exceeded » passe en attendant ;
 * « insufficient_quota » (crédit épuisé) ne passera pas tant que personne n'a payé.
 */
export function isRetryable(e: unknown): boolean {
  if (e instanceof HttpError) {
    if (e.status === 429) return !/insufficient_quota/.test(e.body);
    return e.status === 408 || e.status >= 500;
  }
  if ((e as Error)?.name === "AbortError") return false; // annulation voulue : on ne réessaie pas
  return true; // erreur réseau (ECONNRESET, DNS…)
}

// ---------------------------------------------------------------------------
// 1. Limiteur : au plus une requête toutes les `minIntervalMs`, les autres attendent leur tour.
// ---------------------------------------------------------------------------
export class RateLimiter {
  private last = 0;
  private chain: Promise<unknown> = Promise.resolve();
  constructor(private minIntervalMs = 1000) {}

  /** Nombre de tâches en attente (utile pour afficher une file d'attente). */
  pending = 0;

  schedule<T>(task: () => Promise<T>): Promise<T> {
    this.pending++;
    const run = this.chain.then(async () => {
      const wait = this.last + this.minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.last = Date.now();
      this.pending--;
      return task();
    });
    this.chain = run.catch(() => undefined); // l'échec d'une tâche ne casse pas la file
    return run;
  }
}

// ---------------------------------------------------------------------------
// 2. Retry avec backoff exponentiel et « full jitter ».
//    attente = aléa(0, min(max, base × 2^tentative)), ou Retry-After si le serveur le donne.
// ---------------------------------------------------------------------------
export async function withRetry<T>(
  fn: () => Promise<T>,
  { retries = 4, baseMs = 500, maxMs = 8000, onRetry }: { retries?: number; baseMs?: number; maxMs?: number; onRetry?: (attempt: number, waitMs: number, e: unknown) => void } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= retries || !isRetryable(e)) throw e;
      const backoff = Math.random() * Math.min(maxMs, baseMs * 2 ** attempt);
      const wait = e instanceof HttpError && e.retryAfterMs ? e.retryAfterMs : backoff;
      onRetry?.(attempt + 1, Math.round(wait), e);
      await sleep(wait);
    }
  }
}

// ---------------------------------------------------------------------------
// 3. L'appel HTTP lui-même, avec timeout et annulation.
// ---------------------------------------------------------------------------
async function post(body: object, { signal, timeoutMs = 30_000 }: { signal?: AbortSignal; timeoutMs?: number }) {
  const signals = [AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])];
  const res = await fetch(`${config.baseURL}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.any(signals),
    headers: { Authorization: `Bearer ${requireKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const ra = res.headers.get("retry-after");
    throw new HttpError(res.status, await res.text(), ra ? Number(ra) * 1000 : undefined);
  }
  return res;
}

// Au plus une requête par seconde depuis ce processus : à régler selon les limites de la clé
// (en-têtes x-ratelimit-*) et le nombre de personnes qui la partagent.
export const limiter = new RateLimiter(Number(process.env.MIN_INTERVAL_MS ?? 1000));
const log = (attempt: number, wait: number, e: unknown) =>
  console.warn(`  ↻ tentative ${attempt} dans ${wait} ms (${e instanceof HttpError ? e.status : (e as Error).message})`);

/**
 * Appel non streamé : chaque TENTATIVE passe par le limiteur (sinon un retry
 * rapide après un 503 déclencherait aussitôt un 429), réessayée, bornée dans le temps.
 */
export async function chat(messages: Msg[], opts: { signal?: AbortSignal; temperature?: number; maxTokens?: number } = {}) {
  const res = await withRetry(
    () => limiter.schedule(() =>
      post({ model: config.model, messages, temperature: opts.temperature ?? 0.3, max_tokens: opts.maxTokens }, { signal: opts.signal })),
    { onRetry: log },
  );
  const data = (await res.json()) as { model: string; choices: { message: { content: string } }[]; usage: Usage };
  return { text: data.choices[0].message.content, usage: data.usage, model: data.model };
}

/**
 * Appel streamé. On ne réessaie QUE l'ouverture du flux : réessayer au milieu
 * renverrait au client des morceaux déjà affichés.
 */
export async function* chatStream(
  messages: Msg[],
  opts: { signal?: AbortSignal; temperature?: number; maxTokens?: number } = {},
): AsyncGenerator<{ delta: string } | { usage: Usage }> {
  const res = await withRetry(
    () => limiter.schedule(() =>
      post({ model: config.model, messages, stream: true, stream_options: { include_usage: true }, temperature: opts.temperature ?? 0.5, max_tokens: opts.maxTokens }, { signal: opts.signal, timeoutMs: 120_000 })),
    { onRetry: log },
  );
  for await (const data of parseSSE(res.body!)) {
    const chunk = JSON.parse(data);
    // Erreur en plein flux (fournisseur déconnecté…) : le statut était 200, l'erreur arrive ici.
    if (chunk.error) throw new HttpError(500, chunk.error.message ?? "erreur en plein flux");
    const delta: string = chunk.choices?.[0]?.delta?.content ?? "";
    if (delta) yield { delta };
    if (chunk.usage) yield { usage: chunk.usage as Usage };
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
