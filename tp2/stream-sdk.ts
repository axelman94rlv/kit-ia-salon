// TP 2.3 — Le même flux avec le SDK : il fait le parsing SSE pour vous.
import { config, openai } from "../src/config.js";

const client = openai();
const t0 = performance.now();
let first: number | null = null;

const stream = await client.chat.completions.create({
  model: config.model,
  stream: true,
  stream_options: { include_usage: true },
  messages: [{ role: "user", content: "Donne cinq conseils pour concevoir une API." }],
});
for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta?.content;
  if (delta) {
    first ??= performance.now() - t0;
    process.stdout.write(delta);
  }
  if (chunk.usage) console.log(`\n\nusage (${chunk.model}) :`, chunk.usage);
}
console.log(`TTFT ${Math.round(first ?? 0)} ms · total ${Math.round(performance.now() - t0)} ms`);
