#!/usr/bin/env node
// Parallel smoke-suite runner — the `npm test` entrypoint (dev-ops audit,
// 2026-06-05: the suites are independent chromium processes with fresh
// profiles and are host-read-only, so bounded parallelism is safe; measured
// 14/14 green at concurrency 4, wall ~45s vs ~91s sequential).
//
//  - Suites are DISCOVERED (smoke-*.mjs in this dir), so a new suite can never
//    be silently missing from `npm test`. Known-long suites start first.
//  - A failing suite's FULL output is replayed at the end (interleaved logs
//    are useless for diagnosis), and the exit code is non-zero.
//  - `npm run test:seq` keeps the old sequential chain as a fallback for
//    debugging suspected cross-suite interference.
// Usage: node run-all.mjs [concurrency]   (default 4; 1 = sequential)
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
// NaN-proof: `Math.max(1, NaN)` is NaN → zero workers → zero suites → exit 0,
// a FALSE GREEN (CodeRabbit, 2026-06-05). Fall back to 4 on garbage argv.
const CONC_RAW = parseInt(process.argv[2] || "4", 10);
const CONC = Number.isFinite(CONC_RAW) && CONC_RAW >= 1 ? CONC_RAW : 4;

// Measured rough weights (s) — longest-first scheduling keeps the wall clock
// near max(longest suite, total/concurrency). Unlisted suites are assumed
// long so brand-new ones also start early.
const WEIGHTS = {
  generators: 45, renderers: 20, "highway-settings": 8, "scoring-e2e": 7,
  "meter-subdiv": 5, strings: 4, audioctx: 3, connect: 3, gems: 3,
  "session-sync": 3, "over-barline": 2, herta: 2, variation: 2, progress: 2,
  "core-purity": 1,
};
const SUITES = readdirSync(DIR)
  .filter((f) => /^smoke-.+\.mjs$/.test(f))
  .map((f) => f.replace(/^smoke-/, "").replace(/\.mjs$/, ""))
  .sort((a, b) => (WEIGHTS[b] ?? 99) - (WEIGHTS[a] ?? 99));
if (!SUITES.length) {
  console.error("No smoke-*.mjs suites discovered — refusing to report a false green.");
  process.exit(2);
}

// Fail fast with ONE clear message if the host isn't up (otherwise every
// suite times out with its own copy of the same complaint).
try {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`);
  if (!r.ok) throw new Error(`status ${r.status}`);
} catch (e) {
  console.error(`Host not reachable at ${HOST} (${e.message}). Start it with launch.ps1 first.`);
  process.exit(2);
}

const t0 = Date.now();
let next = 0;
const results = [];

function runOne(s) {
  return new Promise((res) => {
    const start = Date.now();
    const p = spawn(process.execPath, [resolve(DIR, `smoke-${s}.mjs`)], { cwd: DIR });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", (code) => {
      const secs = (Date.now() - start) / 1000;
      const last = out.trim().split("\n").pop() || "";
      results.push({ s, code, secs, out });
      console.log(`${code === 0 ? "PASS" : "FAIL"}  ${s.padEnd(18)} ${secs.toFixed(1).padStart(6)}s  ${last.slice(0, 70)}`);
      res();
    });
  });
}

async function worker() {
  while (next < SUITES.length) {
    const s = SUITES[next++];
    await runOne(s);
  }
}

console.log(`Running ${SUITES.length} suites at concurrency ${CONC} against ${HOST}\n`);
await Promise.all(Array.from({ length: Math.min(CONC, SUITES.length) }, worker));

const wall = (Date.now() - t0) / 1000;
const fails = results.filter((r) => r.code !== 0);
for (const f of fails) {
  console.log(`\n${"=".repeat(70)}\nFULL OUTPUT — smoke-${f.s}.mjs (exit ${f.code})\n${"=".repeat(70)}\n${f.out}`);
}
console.log(`\nWALL ${wall.toFixed(1)}s at concurrency ${CONC}; ${results.length - fails.length}/${results.length} passed${fails.length ? `  FAILED: ${fails.map((f) => f.s).join(", ")}` : ""}`);
process.exit(fails.length ? 1 : 0);
