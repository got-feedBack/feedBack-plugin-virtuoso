#!/usr/bin/env node
// Regression guard for the meter-aware Division default + the live pulse caption
// (2026-06-03 rhythm-meter panel fix; npm run smoke:meter, in npm test). Guards
// that the "quarter notes don't follow my tempo in 7/8" trap can't return: a USER
// meter change bumps a too-coarse subdivision (quarter→eighth under any /8) but
// NEVER touches a /4 meter or a finer pick, an explicit subdivision pick survives
// a regenerate (default, not clamp), and the caption names the pulse / frames the
// cross-pulse phasing. The generation ENGINE is intentionally unchanged (it is
// DAW/notation-correct — see probe-meter-timing.mjs); this guards only the UX
// default that keeps the common path on the locking pulse. (host up via launch.ps1.)
import { chromium } from "playwright";
const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
let fails = 0;
const ok = (c, l, d) => { console.log(`  [${c ? "PASS" : "FAIL"}] ${l}${d ? "  " + d : ""}`); if (!c) fails++; };

const browser = await chromium.launch({ headless: true });
try {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. launch.ps1 first.`);
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  // Seed the L1 instrument store BEFORE page scripts run: the host-settings
  // sync (v0.1.11) treats an empty localStorage as a fresh install and ADOPTS
  // host config — which persists whatever instrument the PREVIOUS suite's panel
  // drives wrote through (cross-suite contamination; the panel flipped to bass
  // mid-suite). With the store seeded, the local-wins boot path holds the
  // deterministic 6-string default AND heals the host config for later suites.
  await page.addInitScript(() => { try { localStorage.setItem("virtuoso.instrument", JSON.stringify({ stringSetup: "guitar_6_standard", customOpenMidis: "" })); } catch (_) {} });
  const pageErrs = [];
  page.on("pageerror", e => pageErrs.push(e.message));
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => typeof window.showScreen === "function");
  await page.evaluate(() => window.showScreen("plugin-virtuoso"));
  await page.waitForSelector("#virtuoso-root", { state: "attached" });
  await page.waitForFunction(() => window.Virtuoso && typeof window.Virtuoso.readConfig === "function", { timeout: 10000 });

  // Helpers that run in the page: set a control's value + fire the bubbling
  // 'change' a real user interaction would, then read back state.
  const setMeter = (v) => page.evaluate((v) => {
    const m = document.querySelector('#virtuoso-controls [name="meter"]');
    m.value = v; m.dispatchEvent(new Event("change", { bubbles: true }));
  }, v);
  const setSubdiv = (v) => page.evaluate((v) => {
    const s = document.querySelector('#virtuoso-controls [name="subdivision"]');
    s.value = v; s.dispatchEvent(new Event("change", { bubbles: true }));
  }, v);
  const state = () => page.evaluate(() => ({
    subdiv: document.querySelector('#virtuoso-controls [name="subdivision"]').value,
    meter: document.querySelector('#virtuoso-controls [name="meter"]').value,
    help: (document.getElementById("virtuoso-division-help") || {}).textContent || "",
  }));

  console.log("\n-- meter-aware Division default --");

  // 1) quarter in 4/4, switch to 7/8 → bumps to eighth
  await setMeter("4/4"); await setSubdiv("quarter");
  await setMeter("7/8:2+2+3");
  let s = await state();
  ok(s.subdiv === "eighth", "quarter→7/8 bumps to eighth", `subdiv=${s.subdiv}`);

  // 2) the bump fires for EVERY /8 (compound too): quarter→6/8 bumps to eighth
  await setMeter("4/4"); await setSubdiv("quarter");
  await setMeter("6/8");
  s = await state();
  ok(s.subdiv === "eighth", "quarter→6/8 (compound) bumps to eighth", `subdiv=${s.subdiv}`);

  // 3) a finer pick is NOT touched: sixteenth in 4/4 → 7/8 stays sixteenth
  await setMeter("4/4"); await setSubdiv("sixteenth");
  await setMeter("7/8:2+2+3");
  s = await state();
  ok(s.subdiv === "sixteenth", "sixteenth survives the switch to 7/8", `subdiv=${s.subdiv}`);

  // 4) /4 ↔ /4 never bumps: a deliberate quarter in 4/4 → 5/4 stays quarter
  await setMeter("4/4"); await setSubdiv("quarter");
  await setMeter("5/4");
  s = await state();
  ok(s.subdiv === "quarter", "quarter→5/4 (/4 meter) is left alone", `subdiv=${s.subdiv}`);

  // 5) explicit pick survives: pick quarter AFTER landing in 7/8 → it stays
  //    (no further meter change; a regenerate must not reset it)
  await setMeter("4/4"); await setMeter("7/8:2+2+3");   // now eighth (default)
  await setSubdiv("quarter");                            // deliberate cross-pulse pick
  await page.evaluate(() => { const f = document.querySelector('#virtuoso-controls [name="bpm"]'); f.value = "92"; f.dispatchEvent(new Event("change", { bubbles: true })); }); // a regenerate-y change
  s = await state();
  ok(s.subdiv === "quarter", "explicit quarter-in-7/8 survives a regenerate", `subdiv=${s.subdiv}`);

  console.log("\n-- pulse caption --");

  await setMeter("4/4"); await setSubdiv("eighth");
  s = await state();
  ok(/Pulse = ♩ · 4 per bar/.test(s.help) && /8 notes\/bar/.test(s.help), "4/4 eighth caption", `“${s.help}”`);

  await setMeter("7/8:2+2+3"); // bumps to eighth
  s = await state();
  ok(/Pulse = ♪ · 7 per bar \(2\+2\+3\)/.test(s.help) && /7 notes\/bar/.test(s.help), "7/8 eighth caption", `“${s.help}”`);

  await setSubdiv("quarter"); // deliberate cross-pulse → flags the phasing
  s = await state();
  ok(/crosses the 7\/8 pulse/.test(s.help) && /re-aligns every 2 bars/.test(s.help), "7/8 quarter cross-pulse caption", `“${s.help}”`);

  console.log("\n-- count-in grid preview defaults (panel 2026-06-12) --");

  // 16th-grid exercises default to a 2-bar count-in (pulse bar + gridded bar)
  // ONLY when the player hasn't chosen a count-in; an explicit saved default
  // always wins; 8ths keep 1 bar; under an /8 meter a 16th is only 2 ticks per
  // felt pulse → no bump (meter-correct, not token-keyed).
  await setMeter("4/4"); await setSubdiv("sixteenth");
  let ci = await page.evaluate(() => { localStorage.removeItem("virtuoso.countInDefault"); return window.Virtuoso.readConfig().countInBars; });
  ok(ci === 2, "sixteenth in 4/4 defaults to a 2-bar count-in", `bars=${ci}`);
  ci = await page.evaluate(() => { localStorage.setItem("virtuoso.countInDefault", "1"); const v = window.Virtuoso.readConfig().countInBars; localStorage.removeItem("virtuoso.countInDefault"); return v; });
  ok(ci === 1, "an explicit saved 1-bar default wins over the 16th bump", `bars=${ci}`);
  await setSubdiv("eighth");
  ci = await page.evaluate(() => window.Virtuoso.readConfig().countInBars);
  ok(ci === 1, "eighth keeps the 1-bar count-in", `bars=${ci}`);
  await setMeter("6/8"); await setSubdiv("sixteenth");
  ci = await page.evaluate(() => window.Virtuoso.readConfig().countInBars);
  ok(ci === 1, "sixteenth under 6/8 (2 ticks per felt pulse) does NOT bump", `bars=${ci}`);

  ok(pageErrs.length === 0, "no uncaught page errors", pageErrs.join(" | "));
  console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  meter-aware subdivision: ${fails} failure(s)`);
  process.exit(fails ? 1 : 0);
} finally {
  await browser.close();
}
