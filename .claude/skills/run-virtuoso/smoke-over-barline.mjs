#!/usr/bin/env node
// Regression guard for the "Over the Barline" capstone rung (Tier 2 of the
// 2026-06-03 meter fix; npm run smoke:overbar, in npm test). Selects the real
// `rhy_over_barline` pathway and asserts (a) it presets quarter-in-7/8 and that
// preset SURVIVES the Tier-1 meter-aware bump (the trap-as-lesson interaction —
// pathways set fields silently, so the deliberate cross-pulse isn't auto-corrected),
// (b) it generates a valid phasing chart (quarter-spaced notes that don't divide
// the 7/8 bar — the 5th note lands mid-bar-2), (c) the option + band + goal card
// are wired. Guards both that the rung exists and that Tier 1 doesn't eat it.
// (host up via launch.ps1.)
import { chromium } from "playwright";
const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
let fails = 0;
const ok = (c, l, d) => { console.log(`  [${c ? "PASS" : "FAIL"}] ${l}${d ? "  " + d : ""}`); if (!c) fails++; };

const b = await chromium.launch({ headless: true });
try {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. launch.ps1 first.`);
  const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  // Seed the L1 instrument store BEFORE page scripts run: the host-settings
  // sync (v0.1.11) treats an empty localStorage as a fresh install and ADOPTS
  // host config — which persists whatever instrument the PREVIOUS suite's panel
  // drives wrote through (cross-suite contamination; the panel flipped to bass
  // mid-suite). With the store seeded, the local-wins boot path holds the
  // deterministic 6-string default AND heals the host config for later suites.
  await page.addInitScript(() => { try { localStorage.setItem("virtuoso.instrument", JSON.stringify({ stringSetup: "guitar_6_standard", customOpenMidis: "" })); } catch (_) {} });
  const pageErrs = []; page.on("pageerror", e => pageErrs.push(e.message));
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => typeof window.showScreen === "function");
  await page.evaluate(() => window.showScreen("plugin-virtuoso"));
  await page.waitForSelector("#virtuoso-root", { state: "attached" });
  await page.waitForFunction(() => window.Virtuoso && typeof window.Virtuoso.generateExercise === "function", { timeout: 10000 });

  // 1) option present
  const opts = await page.evaluate(() => Array.from(document.querySelectorAll('#virtuoso-pathway option')).map(o => o.value));
  ok(opts.includes("rhy_over_barline"), "pathway option present");

  // 2) select the pathway through the real UI flow, then read state
  const sel = await page.evaluate(() => {
    const ps = document.getElementById("virtuoso-pathway");
    ps.value = "rhy_over_barline";
    ps.dispatchEvent(new Event("change", { bubbles: true }));
    const cfg = window.Virtuoso.readConfig();
    const title = (document.getElementById("virtuoso-pathway-title") || {}).textContent || "";
    const subField = document.querySelector('#virtuoso-controls [name="subdivision"]').value;
    const meterField = document.querySelector('#virtuoso-controls [name="meter"]').value;
    return { subdiv: cfg.subdivision, subField, meterField, den: cfg.meter && cfg.meter.denominator, title };
  });
  ok(sel.title === "Over the Barline", "goal card title set", `“${sel.title}”`);
  ok(sel.meterField.startsWith("7/8"), "meter preset to 7/8", `meter=${sel.meterField}`);
  ok(sel.subField === "quarter", "subdivision field PRESET to quarter (survived Tier-1 bump)", `subField=${sel.subField}`);
  ok(sel.subdiv === "quarter", "readConfig sees quarter", `subdiv=${sel.subdiv}`);

  // 3) generate from the pathway config; assert a real phasing chart
  const gen = await page.evaluate(() => {
    const cfg = window.Virtuoso.readConfig();
    const e = window.Virtuoso.generateExercise(cfg);
    const ch = e.chart || {};
    const t = (ch.notes || []).map(n => n.t);
    const gaps = t.slice(1, 9).map((x, i) => +(x - t[i]).toFixed(4));
    // quarter @ 54bpm = 60/54 = 1.1111s
    return { notes: t.length, gaps, bpm: cfg.bpm, bars: cfg.bars };
  });
  const q = +(60 / gen.bpm).toFixed(4);
  const allQuarter = gen.gaps.length > 0 && gen.gaps.every(g => Math.abs(g - q) < 0.01);
  ok(gen.notes > 0, "generates notes", `notes=${gen.notes}`);
  ok(allQuarter, `note gaps are quarters (=${q}s @ ${gen.bpm}bpm)`, `gaps=[${gen.gaps.join(", ")}]`);

  // 4) phasing sanity: bar = 3.5 quarters, so notes must NOT all sit on bar lines
  //    (a 4th note at 3q lands 0.5q before the 2.625q*... bar — i.e. it phases)
  const phases = await page.evaluate(() => {
    const cfg = window.Virtuoso.readConfig();
    const e = window.Virtuoso.generateExercise(cfg);
    const t = (e.chart.notes || []).map(n => n.t);
    const q = 60 / cfg.bpm, bar = q * (4 / cfg.meter.denominator) * cfg.meter.numerator; // 3.5q
    // 5th note is at 4q = bar(3.5q)+0.5q -> 0.5q into bar 2, NOT on the downbeat
    const fifth = t[4];
    return { fifth: +fifth.toFixed(4), bar: +bar.toFixed(4), q: +q.toFixed(4) };
  });
  ok(Math.abs(phases.fifth - (phases.bar + phases.q * 0.5)) < 0.02, "quarter line phases across the 7/8 bar (5th note lands mid-bar-2)", `5th=${phases.fifth} bar=${phases.bar}`);

  ok(pageErrs.length === 0, "no uncaught page errors", pageErrs.join(" | "));
  console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  over-the-barline rung: ${fails} failure(s)`);
  process.exit(fails ? 1 : 0);
} finally { await b.close(); }
