#!/usr/bin/env node
// Assertive smoke guard for the CORE/SHELL host-independence boundary
// (CLAUDE.md "Key constraints" → "Core/shell boundary"). It proves the
// generation path (window.Virtuoso.generateExercise / generateSession → a plain
// { version, session, chart }) does NOT reach for host/DOM globals — that chart is
// Virtuoso's portable IP. makeBundle() is the chart→renderer-bundle BOUNDARY (it
// reads display prefs), the first shell step, intentionally not asserted here.
//
// BEHAVIOURAL, not textual: §1–§10 are physically interleaved with shell helpers
// in one IIFE, so a line-range grep is the wrong tool. Instead we TRAP the host
// surface — Document.prototype.{getElementById,querySelector,createElement,…},
// Storage.prototype.{getItem,setItem,…}, and window.fetch — to throw, then run
// generateExercise() across every practice type. `readConfig()`
// is built BEFORE trapping (it's the legitimate DOM→cfg funnel — the boundary,
// not the core). If the core touches a trapped global it throws and we record
// the violation. The traps are installed and removed inside a single synchronous
// page.evaluate, so no other page code interleaves.
//
// Usage (host up via launch.ps1):
//   node .claude/skills/run-virtuoso/smoke-core-purity.mjs   # or: npm run smoke:core
//
// Exit 0 = the core is host-independent; 1 = a coupling leak / host down.

import { chromium } from "playwright";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";

async function ensureHost() {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. Start it with launch.ps1 first.`);
  const body = await r.json();
  if (!body.ok) throw new Error(`Plugin status not ok: ${JSON.stringify(body)}`);
}

async function gotoVirtuoso(page) {
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20_000 });
  await page.waitForFunction(() => typeof window.showScreen === "function", { timeout: 5_000 });
  await page.evaluate(() => window.showScreen("plugin-virtuoso"));
  await page.waitForSelector("#virtuoso-root", { state: "attached", timeout: 10_000 });
  await page.waitForSelector("#virtuoso-view-select", { timeout: 5_000 });
  await page.waitForFunction(() => window.Virtuoso && typeof window.Virtuoso.generateExercise === "function", { timeout: 5_000 });
}

// Runs in the page. Traps the host surface, then exercises the core. Returns one
// row per practice type (+ a makeBundle row). A row is clean iff it produced
// notes, did not throw, and tripped no trap.
function runPurityInPage(practiceTypes) {
  const S = window.Virtuoso;
  if (!S || typeof S.generateExercise !== "function") return { ok: false, reason: "window.Virtuoso.generateExercise missing" };

  // Build configs BEFORE trapping — readConfig() is the shell funnel and is
  // allowed to touch the DOM/localStorage. The dispatch (buildSingleChart) reads
  // cfg.mode first, so set BOTH mode and practiceType.
  const base = S.readConfig();
  const cfgs = practiceTypes.map((pt) => ({ ...base, practiceType: pt, mode: pt }));

  const violations = [];
  const mk = (label) => function () { violations.push(label); throw new Error("core touched " + label); };

  const dproto = Document.prototype, sproto = Storage.prototype;
  const docM = ["getElementById", "querySelector", "querySelectorAll", "createElement", "createElementNS", "getElementsByClassName"];
  const stoM = ["getItem", "setItem", "removeItem", "clear"];
  const saved = {};
  const savedFetch = window.fetch;
  const installed = [];

  function install() {
    for (const m of docM) { try { saved["d_" + m] = dproto[m]; dproto[m] = mk("document." + m); installed.push("d_" + m); } catch (_) {} }
    for (const m of stoM) { try { saved["s_" + m] = sproto[m]; sproto[m] = mk("localStorage." + m); installed.push("s_" + m); } catch (_) {} }
    try { window.fetch = mk("fetch"); installed.push("fetch"); } catch (_) {}
  }
  function restore() {
    for (const m of docM) { if (installed.includes("d_" + m)) try { dproto[m] = saved["d_" + m]; } catch (_) {} }
    for (const m of stoM) { if (installed.includes("s_" + m)) try { sproto[m] = saved["s_" + m]; } catch (_) {} }
    if (installed.includes("fetch")) try { window.fetch = savedFetch; } catch (_) {}
  }

  const rows = [];
  install();
  try {
    for (let i = 0; i < cfgs.length; i++) {
      const pt = practiceTypes[i];
      const v0 = violations.length;
      let notes = 0, threw = null;
      try {
        const ex = S.generateExercise(cfgs[i]);
        notes = ex && ex.chart && Array.isArray(ex.chart.notes) ? ex.chart.notes.length : 0;
      } catch (e) { threw = String((e && e.message) || e); }
      rows.push({ label: pt, notes, threw, violations: violations.slice(v0) });
    }
    // makeBundle() is intentionally NOT asserted: it's the chart→renderer-bundle
    // BOUNDARY (§10), not core. It reads Virtuoso display prefs (highway
    // inverted / lefty / render-scale / look — readHighwayInverted/readLefty/
    // readRenderScale/syncHighwaySettings) to shape the bundle for the renderers,
    // so it legitimately touches the shell. The portable, host-independent
    // artifact is the CHART that generateExercise returns (asserted above).
  } finally {
    restore();
  }
  return { ok: true, rows, trapsInstalled: installed.length };
}

async function run() {
  await ensureHost();
  const browser = await chromium.launch({ headless: true });
  let result = null;
  const pageErrors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
  // Seed the L1 instrument store BEFORE page scripts run: the host-settings
  // sync (v0.1.11) treats an empty localStorage as a fresh install and ADOPTS
  // host config — which persists whatever instrument the PREVIOUS suite's panel
  // drives wrote through (cross-suite contamination; the panel flipped to bass
  // mid-suite). With the store seeded, the local-wins boot path holds the
  // deterministic 6-string default AND heals the host config for later suites.
  await page.addInitScript(() => { try { localStorage.setItem("virtuoso.instrument", JSON.stringify({ stringSetup: "guitar_6_standard", customOpenMidis: "" })); } catch (_) {} });
    page.on("pageerror", (e) => pageErrors.push(e.message));
    await gotoVirtuoso(page);
    const practiceTypes = await page.$$eval('select[name="practiceType"] option', (os) => os.map((o) => o.value));
    result = await page.evaluate(runPurityInPage, practiceTypes);
  } finally {
    await browser.close();
  }

  console.log("\n=== Virtuoso core-purity smoke (host-independence) ===");
  if (!result || !result.ok) {
    console.log(`FAIL  ${result ? result.reason : "no result"}`);
    process.exit(1);
  }
  console.log(`(traps installed: ${result.trapsInstalled} host-surface methods)\n`);
  let fail = 0;
  for (const r of result.rows) {
    const bad = r.violations.length > 0 || r.threw || r.notes === 0 || r.notes == null;
    // A throw with no recorded violation is an unexpected error, still a fail.
    if (bad) fail++;
    const tag = bad ? "FAIL" : "PASS";
    let detail = `notes=${r.notes}`;
    if (r.violations.length) detail = `COUPLING → ${r.violations.join(", ")}`;
    else if (r.threw) detail = `threw: ${r.threw}`;
    console.log(`  [${tag}] ${r.label}  ${detail}`);
  }
  if (pageErrors.length) { console.log(`\n  page errors during run:`); for (const e of pageErrors) console.log(`   x ${e}`); }
  console.log(`\n${result.rows.length - fail}/${result.rows.length} core entry points are host-independent.`);
  if (fail || pageErrors.length) {
    console.log("FAIL  core/shell boundary violated — a §1–§10 generation path reached a host/DOM global.");
    process.exit(1);
  }
  console.log("PASS  core is host-independent (generation path touches no document/localStorage/fetch).");
}

run().catch((e) => { console.error(e); process.exit(1); });
