#!/usr/bin/env node
// Regression guard for the GUITAR herta drill (Tier 3; npm run smoke:herta, in
// npm test). Asserts the cell structure (pick → hammer → pull → pick, default
// accent on note 0), even-sixteenth spacing, the whole-step trill, that
// hertaAccent moves the accent (incl. the authentic accent-last) and hertaWalk
// walks the base through the scale, and that the pick_herta pathway + Custom
// practiceType option are wired. (The authentic R-R-L-R accent-last DRUM herta is
// a separate node/guard.) (host up via launch.ps1.)
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

  // Build a herta chart from a cfg patch (off readConfig, like the other probes).
  const gen = (patch) => page.evaluate((p) => {
    const cfg = Object.assign(window.Virtuoso.readConfig(), {
      practiceType: "herta", mode: "herta", scale: "minor_pentatonic", key: "A",
      meter: { numerator: 4, denominator: 4, grouping: [4] }, bpm: 60, bars: 4,
      advancedMode: true, fretboardSystem: "caged", shape: "E", stringSetup: "guitar_6_standard",
    }, p);
    try {
      const e = window.Virtuoso.generateExercise(cfg);
      return { ok: true, notes: (e.chart.notes || []) };
    } catch (err) { return { ok: false, err: String(err && err.message || err) }; }
  }, patch);

  console.log("\n-- guitar herta cell --");
  let res = await gen({ hertaAccent: 0, hertaWalk: false });
  ok(res.ok && res.notes.length > 0, "generates notes", res.ok ? `n=${res.notes.length}` : res.err);
  if (res.ok && res.notes.length >= 5) {
    const n = res.notes;
    ok(n[0].ac === true && n[1].ho === true && n[2].po === true && n[3].ac === false,
       "cell = pick(accent) → hammer → pull → pick", `ac/ho/po=${n[0].ac}/${n[1].ho}/${n[2].po}`);
    ok(n[1].f === n[0].f + 2 && n[2].f === n[0].f && n[1].s === n[0].s,
       "whole-step trill on one string (f, f+2, f)", `f=${n[0].f},${n[1].f},${n[2].f} s=${n[0].s}`);
    ok(n[4].ac === true, "next cell re-accents (accent every 4)", `n[4].ac=${n[4].ac}`);
    const q = 60 / 60, step = q / 4;
    const gaps = n.slice(1, 8).map((x, i) => +(x.t - n[i].t).toFixed(4));
    ok(gaps.every(g => Math.abs(g - step) < 0.005), `even sixteenth spacing (=${step}s)`, `gaps=[${gaps.join(",")}]`);
  }

  console.log("\n-- accent placement + walk --");
  res = await gen({ hertaAccent: 3, hertaWalk: false });
  ok(res.ok && res.notes[3].ac === true && res.notes[0].ac === false, "hertaAccent:3 moves accent to note 4 (the authentic accent-last)", `acc@3=${res.ok && res.notes[3].ac}`);
  const stat = await gen({ hertaWalk: false });
  const walk = await gen({ hertaWalk: true });
  const staticBaseConst = stat.ok && stat.notes[0].f === stat.notes[4].f && stat.notes[0].f === stat.notes[8].f;
  const walkBaseMoves = walk.ok && (walk.notes[0].f !== walk.notes[4].f || walk.notes[0].s !== walk.notes[4].s);
  ok(staticBaseConst, "static (hertaWalk:false) keeps one anchor note", `f=${stat.ok && [stat.notes[0].f, stat.notes[4].f, stat.notes[8].f]}`);
  ok(walkBaseMoves, "hertaWalk:true walks the base through the scale", `cell0=${walk.ok && walk.notes[0].s + ":" + walk.notes[0].f} cell1=${walk.ok && walk.notes[4].s + ":" + walk.notes[4].f}`);

  console.log("\n-- wiring --");
  const wired = await page.evaluate(() => {
    const ptOpts = Array.from(document.querySelectorAll('#virtuoso-controls [name="practiceType"] option')).map(o => o.value);
    const pwOpts = Array.from(document.querySelectorAll('#virtuoso-pathway option')).map(o => o.value);
    const ps = document.getElementById("virtuoso-pathway");
    ps.value = "pick_herta"; ps.dispatchEvent(new Event("change", { bubbles: true }));
    const title = (document.getElementById("virtuoso-pathway-title") || {}).textContent || "";
    const cfg = window.Virtuoso.readConfig();
    let pwNotes = 0; try { pwNotes = (window.Virtuoso.generateExercise(cfg).chart.notes || []).length; } catch (_) {}
    return { hasPt: ptOpts.includes("herta"), hasPw: pwOpts.includes("pick_herta"), title, pwNotes };
  });
  ok(wired.hasPt, "practiceType option 'herta' present");
  ok(wired.hasPw, "pathway option 'pick_herta' present");
  ok(wired.title === "Herta Burst", "pick_herta goal card loads", `“${wired.title}”`);
  ok(wired.pwNotes > 0, "pick_herta pathway generates a chart", `n=${wired.pwNotes}`);

  // FORM plumbing (hand-marks Slice 2 fix): hertaAccent/hertaWalk had no hidden
  // fields, so the pathway's vary steps wrote to nothing and the accent ladder
  // was silently inert in the UI (the cfg-patch rows above never saw it). Drive
  // the hidden FIELD and assert readConfig + the chart pick it up.
  const plumbed = await page.evaluate(() => {
    const set = (name, v) => { const el = document.querySelector(`#virtuoso-controls [name="${name}"]`); if (el) el.value = String(v); return !!el; };
    const hasField = set("hertaAccent", 3) && set("hertaWalk", "true");
    const cfg = window.Virtuoso.readConfig();
    let acc3 = false, walked = false;
    try {
      const notes = window.Virtuoso.generateExercise(Object.assign(cfg, { mode: "herta", practiceType: "herta" })).chart.notes.filter(n => !n._tail);
      acc3 = notes.length > 4 && notes[3].ac === true && notes[0].ac === false;
      walked = notes[0].f !== notes[4].f || notes[0].s !== notes[4].s;
    } catch (_) {}
    set("hertaAccent", 0); set("hertaWalk", "");
    return { hasField, cfgAccent: cfg.hertaAccent, cfgWalk: cfg.hertaWalk, acc3, walked };
  });
  ok(plumbed.hasField, "hertaAccent/hertaWalk hidden fields exist (were unplumbed pre-Slice-2)");
  ok(plumbed.cfgAccent === 3 && plumbed.cfgWalk === true, "readConfig carries the form's hertaAccent/hertaWalk", `acc=${plumbed.cfgAccent} walk=${plumbed.cfgWalk}`);
  ok(plumbed.acc3 && plumbed.walked, "form-driven accent + walk reach the chart", `acc3=${plumbed.acc3} walked=${plumbed.walked}`);

  ok(pageErrs.length === 0, "no uncaught page errors", pageErrs.join(" | "));
  console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  guitar herta: ${fails} failure(s)`);
  process.exit(fails ? 1 : 0);
} finally { await b.close(); }
