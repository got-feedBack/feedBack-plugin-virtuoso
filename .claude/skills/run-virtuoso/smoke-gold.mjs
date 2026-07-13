#!/usr/bin/env node
// Assertive smoke test for the Gold improv rung (career passports).
//
// Drives window.Virtuoso.goldDebug directly: the GOLD_BAR gate math (every
// axis independently unmet → not met; all met → met; comb-only rejects a
// YIN-heard take), the gained-only goldImprov store, and the midi→(string,
// fret) probe mapping the comb-confirm push uses.
//
// Usage (host must already be up via launch.ps1):
//   node .claude/skills/run-virtuoso/smoke-gold.mjs   # or: npm run smoke:gold
//
// Exit 0 = all checks pass, 1 = a fatal failure / host down.

import { chromium } from "playwright";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";

async function ensureHost() {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. Start it with launch.ps1 first.`);
  if (!(await r.json()).ok) throw new Error("Plugin status not ok");
}

async function gotoVirtuoso(page) {
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20_000 });
  await page.waitForFunction(() => typeof window.showScreen === "function", { timeout: 5_000 });
  await page.evaluate(() => window.showScreen("plugin-virtuoso"));
  await page.waitForSelector("#virtuoso-root", { state: "attached", timeout: 10_000 });
  await page.waitForFunction(
    () => window.Virtuoso && window.Virtuoso.goldDebug && typeof window.Virtuoso.goldDebug.evaluate === "function",
    { timeout: 5_000 }
  );
}

function runGoldInPage() {
  const G = window.Virtuoso.goldDebug;
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, ok: !!cond, detail: cond ? "" : (detail || "") });
  const BAR = G.bar;

  // A mirror that clears every axis (comb-heard).
  const goldMirror = {
    confirmed: 100, inChord: 70, inKey: 90, outside: 10,
    pcs: [0, 2, 4, 5, 7, 9, 11], chordHops: BAR.minChordHops + 2, comb: true,
  };
  const session = { duration_ms: BAR.minMs + 1000 };

  G.seed(goldMirror);
  const met = G.evaluate(session);
  ok("all axes met → met", met && met.met === true, JSON.stringify(met));
  ok("verifier reported as comb", met && met.verifier === "comb");

  // Each axis independently unmet flips the gate.
  G.seed({ ...goldMirror });
  ok("short jam → not met", G.evaluate({ duration_ms: BAR.minMs - 1 }).met === false);
  G.seed({ ...goldMirror, inKey: Math.floor(100 * (BAR.minInKeyPct - 0.05)) });
  ok("low in-key → not met", G.evaluate(session).met === false);
  G.seed({ ...goldMirror, chordHops: BAR.minChordHops - 1 });
  ok("few chord hops → not met", G.evaluate(session).met === false);
  G.seed({ ...goldMirror, pcs: [0, 2, 4] });
  ok("few tones → not met", G.evaluate(session).met === false);
  G.seed({ ...goldMirror, comb: false });
  const yinRes = G.evaluate(session);
  ok("comb-only bar rejects a YIN-heard take", BAR.combOnly ? yinRes.met === false : yinRes.met === true,
    JSON.stringify(yinRes));

  // No confirmed notes → null (nothing to say).
  G.seed({ ...goldMirror, confirmed: 0, inKey: 0, inChord: 0 });
  ok("silent take → null", G.evaluate(session) === null);

  // Gained-only store.
  localStorage.setItem("virtuoso.progress", JSON.stringify({ mode: "casual", xp: 0, byNode: {} }));
  G.seed(goldMirror);
  const res = G.evaluate(session);
  ok("first mint stores", G.store("blues", res) === true);
  const stored = JSON.parse(localStorage.getItem("virtuoso.progress")).goldImprov;
  ok("store shape", stored && stored.blues && stored.blues.verifier === "comb" && stored.blues.chords === goldMirror.chordHops,
    JSON.stringify(stored));
  ok("second mint is a no-op (gained-only)", G.store("blues", res) === false);

  // midi→(s,f) probe mapping against an explicit tuning (E std).
  const om = [40, 45, 50, 55, 59, 64];
  const t1 = G.midiTarget(64, om);   // open high E → highest string, fret 0
  ok("midiTarget maps a playable position", Array.isArray(t1) && t1.length === 1 && om[t1[0].s] + t1[0].f === 64,
    JSON.stringify(t1));
  const t2 = G.midiTarget(52, om);   // E3 → some (s,f) with matching pitch
  ok("midiTarget pitch-exact", t2 && om[t2[0].s] + t2[0].f === 52, JSON.stringify(t2));
  ok("midiTarget rejects out-of-range", G.midiTarget(20, om) === null);

  return out;
}

const browser = await chromium.launch();
try {
  await ensureHost();
  const page = await browser.newPage();
  await gotoVirtuoso(page);
  const results = await page.evaluate(runGoldInPage);
  let failed = 0;
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
    if (!r.ok) failed++;
  }
  if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
  console.log(`smoke-gold: ${results.length} checks green`);
} finally {
  await browser.close();
}
