#!/usr/bin/env node
// Assertive smoke test for the HOST-SURFACE Virtuoso borrows/grades through.
//
// Virtuoso is a thin shell over host capabilities: the capability bus, the
// Minigames scoring SDK (the grading path), and the borrowed viz factories
// (the 3D highway + its native green hit-flare). FeedBack's Slopsmith->FeedBack
// re-chrome renamed those window-globals slopsmith*->feedBack*; the viz factory
// and desktop bridge got NO legacy alias, so the 3D highway silently fell back
// to 2D for a whole release (caught only when the dev host moved off the pinned
// old highway_3d). This suite turns that class of "silent fallback" into a
// named, red failure: it asserts each expected host global is reachable and
// that the 3D highway actually ATTACHES (status != fallback) on the current host.
//
// Targets the CURRENT FeedBack host (the default `checkout` launch), which ships
// the Minigames SDK + highway_3d. Usage (host up via launch.ps1):
//   node .claude/skills/run-virtuoso/smoke-host-surface.mjs
// Exit 0 = surface intact, 1 = a host global/borrow drifted (or host down).

import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
const SHOT_DIR = process.env.SHOT_DIR || resolve(dirname(fileURLToPath(import.meta.url)), "../../../.virtuoso-shots");

// Console noise that is expected and not a Virtuoso fault (mirrors smoke-renderers).
const BENIGN = [
  /note detect: mic access denied/i,
  /failed to set up audio analyser/i,
  /invalidstateerror/i,
  /audiocontext was not allowed to start/i,
  /the audiocontext was (not allowed|prevented)/i,
  /play\(\) request was interrupted/i,
  /continuous scoring failed to start/i,
  /tuner: auto-start audio failed/i,
  // Generic resource 404/500s are environmental (host contention under the
  // parallel run-all, a missing optional asset) — NOT a host-surface contract
  // issue. The explicit surface checks below cover what actually matters; a real
  // viz-script load failure is caught by the 3D-highway-attach check, not here.
  /failed to load resource/i,
];
const isBenign = (msg) => BENIGN.some((re) => re.test(msg));

async function ensureHost() {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. Start it with launch.ps1 first.`);
  const body = await r.json();
  if (!body.ok) throw new Error(`Plugin status not ok: ${JSON.stringify(body)}`);
}

async function gotoVirtuoso(page) {
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  // launch.ps1 completes onboarding server-side so #v3-onboarding won't render;
  // remove it defensively in case this runs against a fresh-config host.
  await page.evaluate(() => document.getElementById("v3-onboarding")?.remove()).catch(() => {});
  await page.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20_000 });
  await page.waitForFunction(() => typeof window.showScreen === "function", { timeout: 5_000 });
  await page.evaluate(() => window.showScreen("plugin-virtuoso"));
  await page.evaluate(() => document.getElementById("v3-onboarding")?.remove()).catch(() => {});
  await page.waitForSelector("#virtuoso-root", { state: "attached", timeout: 10_000 });
  await page.waitForSelector("#virtuoso-view-select", { timeout: 5_000 });
}

async function generate(page) {
  const tier = await page.$("#virtuoso-tempo-tiers button, .virtuoso-tier-btn, [data-tempo-tier]");
  if (tier && (await tier.isVisible())) await tier.click();
  else await page.evaluate(() => window.Virtuoso?.generateExercise?.(window.Virtuoso?.readConfig?.() || {}));
  await page.waitForTimeout(500);
}

const results = [];
const record = (name, pass, detail) => results.push({ name, pass, detail });

async function run() {
  await ensureHost();
  const consoleErrors = [];
  const browser = await chromium.launch({ headless: true });
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
    page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(m.text()); });
    page.on("pageerror", (e) => { if (!isBenign(e.message)) consoleErrors.push(`pageerror: ${e.message}`); });

    await gotoVirtuoso(page);
    await generate(page);

    // 1. Capability bus — Virtuoso emits progress/tier/loop events + listens for
    //    screen:changed (re-hydration) through it. FeedBack = window.feedBack;
    //    legacy Slopsmith = window.slopsmith. One must be a usable bus.
    const bus = await page.evaluate(() => {
      const b = window.feedBack || window.slopsmith;
      return { present: !!b, name: window.feedBack ? "feedBack" : (window.slopsmith ? "slopsmith" : "none"),
               emit: !!(b && typeof b.emit === "function"), on: !!(b && typeof b.on === "function") };
    });
    record("capability bus", bus.present && bus.emit && bus.on,
      `window.${bus.name} (emit=${bus.emit} on=${bus.on})`);

    // 2. Minigames scoring SDK — the grading path. FeedBack = feedBackMinigames
    //    (dual-publishes the legacy slopsmithMinigames alias). createContinuous is
    //    what the pitch tracker calls.
    const mg = await page.evaluate(() => {
      const m = window.feedBackMinigames || window.slopsmithMinigames;
      return { present: !!m, name: window.feedBackMinigames ? "feedBackMinigames" : (window.slopsmithMinigames ? "slopsmithMinigames" : "none"),
               scoring: !!(m && m.scoring && typeof m.scoring.createContinuous === "function") };
    });
    record("scoring SDK", mg.present && mg.scoring, `window.${mg.name} (scoring.createContinuous=${mg.scoring})`);

    // 3. 3D highway viz factory borrow — the regression this suite exists for.
    //    Switch to highway_3d, then require the factory global registered AND the
    //    renderer actually attached (status != "...(fallback)"). A silent 2D
    //    fallback (the v0.3.0 feedBackViz_* rename) fails here.
    await page.evaluate(() => {
      const sel = document.querySelector("#virtuoso-view-select");
      if (!sel) return;
      sel.value = "highway_3d";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.waitForTimeout(900);
    const hw = await page.evaluate(() => {
      const f = window.feedBackViz_highway_3d || window.slopsmithViz_highway_3d;
      const status = (document.getElementById("virtuoso-renderer-status")?.textContent || "").trim();
      return { factory: typeof f === "function", name: window.feedBackViz_highway_3d ? "feedBackViz_highway_3d" : (window.slopsmithViz_highway_3d ? "slopsmithViz_highway_3d" : "none"),
               status, fellBack: /fallback/i.test(status) };
    });
    record("3D highway borrow", hw.factory && !hw.fellBack,
      `${hw.name} registered=${hw.factory} status="${hw.status}"`);

    // 4. No host-viz contract-drift error logged (the loud signal borrowHostViz
    //    emits when a viz script loads but registers under no known global).
    const driftErr = consoleErrors.find((e) => /\[Virtuoso host-viz\]/.test(e));
    record("no host-viz drift error", !driftErr, driftErr || "none");

    // Any other non-benign console error during the surface walk is a fail too.
    const otherErrs = consoleErrors.filter((e) => !/\[Virtuoso host-viz\]/.test(e));
    record("no uncaught errors", otherErrs.length === 0, otherErrs.length ? otherErrs.join(" | ") : "none");

    if (results.some((r) => !r.pass)) {
      if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true });
      await page.screenshot({ path: resolve(SHOT_DIR, "smoke-fail-host-surface.png"), fullPage: false });
    }
  } finally {
    await browser.close();
  }

  console.log("\n=== Virtuoso host-surface smoke ===");
  let failed = 0;
  for (const r of results) {
    console.log(`[${r.pass ? "PASS" : "FAIL"}] ${r.name.padEnd(22)} ${r.detail}`);
    if (!r.pass) failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} checks passed.`);
  if (failed) { console.log(`Failure screenshot in ${SHOT_DIR}`); process.exit(1); }
}

run().catch((e) => { console.error(e); process.exit(1); });
