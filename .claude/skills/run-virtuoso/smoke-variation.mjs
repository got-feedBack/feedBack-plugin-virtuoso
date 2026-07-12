#!/usr/bin/env node
// Assertive smoke test for the Virtuoso variation engine (Workout library
// substrate) — SEGMENT_TEMPLATES + rollSegment + refreshWorkout.
//
// It drives window.Virtuoso directly (fast — no rendering). For every segment
// template it rolls EVERY variant through generateSession() (a one-slot workout
// built from a { templateId, variantIdx } ref) and validates the resulting chart:
// notes present, every note finite t>=0 / integer string in range / sane fret /
// positive sustain; beats present (transport clock). It then asserts the two
// refresh invariants that are checkable at the chart level:
//   • LENGTH-LOCKED — every variant of a template yields the SAME chart duration
//     (refresh varies content, never difficulty/length).
//   • refreshWorkout() advances a template-ref slot's variant and still builds.
//
// The other invariants are guarded elsewhere: the no-unison rule + the no-row /
// style-lock startup checks throw at LOAD (validateSegmentTemplates /
// "[Virtuoso no-unison] …"), surfacing as a pageerror and failing this run
// before a single template is read.
//
// Usage (host must already be up via launch.ps1):
//   node .claude/skills/run-virtuoso/smoke-variation.mjs   # or: npm run smoke:variation
//
// Exit 0 = all templates OK, 1 = a fatal failure / host down.

import { chromium } from "playwright";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";

const BENIGN = [/note detect: mic access denied/i, 
  /failed to set up audio analyser/i,
  /invalidstateerror/i,
  /audiocontext was not allowed to start/i,
  /the audiocontext was (not allowed|prevented)/i,
  /play\(\) request was interrupted/i,
  /desktop audio api not available/i,   // host audio engine reporting headless/browser mode
  /continuous scoring failed to start/i,   // Minigames SDK can't start the mic in headless — scoring is optional (present on the checkout target)
];
const isBenign = (m) => BENIGN.some((re) => re.test(m));

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
  await page.waitForFunction(
    () => window.Virtuoso && window.Virtuoso.SEGMENT_TEMPLATES && typeof window.Virtuoso.generateSession === "function" && typeof window.Virtuoso.refreshWorkout === "function",
    { timeout: 5_000 }
  );
}

// Runs in the page: roll every variant of every template through generateSession
// and validate the chart + the length-locked invariant, then exercise refreshWorkout.
function runVariationInPage() {
  const S = window.Virtuoso;
  const T = S.SEGMENT_TEMPLATES || {};
  const out = [];

  const stringFor = (inst) => (inst === "bass" ? "bass_4_standard" : "guitar_6_standard");
  const scFor = (inst) => (inst === "bass" ? 4 : 6);

  function check(res, maxStrings) {
    const fatal = [];
    if (!res || !res.chart) { fatal.push("no chart returned"); return { fatal, notes: 0, dur: 0 }; }
    const c = res.chart;
    const notes = Array.isArray(c.notes) ? c.notes : [];
    if (notes.length === 0) fatal.push("no notes");
    if (!Array.isArray(c.beats) || c.beats.length === 0) fatal.push("no beats (transport clock)");
    const ms = Number.isInteger(maxStrings) && maxStrings > 0 ? maxStrings : 8;
    for (const n of notes) {
      if (typeof n.t !== "number" || !isFinite(n.t) || n.t < 0) { fatal.push(`bad t=${n.t}`); break; }
      if (!Number.isInteger(n.s) || n.s < 0 || n.s >= ms) { fatal.push(`bad string=${n.s} (max ${ms})`); break; }
      if (!Number.isInteger(n.f) || n.f < 0 || n.f > 30) { fatal.push(`bad fret=${n.f}`); break; }
      if (n.sus !== undefined && (typeof n.sus !== "number" || n.sus <= 0)) { fatal.push(`bad sus=${n.sus}`); break; }
    }
    return { fatal, notes: notes.length, dur: c.duration || 0 };
  }

  for (const id of Object.keys(T)) {
    const t = T[id];
    const ss = stringFor(t.instrument);
    const ms = scFor(t.instrument);
    const n = (t.vary && t.vary.length) || 1;
    const durs = [];
    const fatal = [];
    let totalNotes = 0;
    for (let i = 0; i < n; i++) {
      let res;
      try {
        res = S.generateSession({ version: 1, name: `t_${id}_${i}`, stringSetup: ss, segments: [{ id: "slot", templateId: id, variantIdx: i }] });
      } catch (e) { fatal.push(`variant ${i} threw: ${e.message}`); continue; }
      const v = check(res, ms);
      if (v.fatal.length) fatal.push(`variant ${i}: ${v.fatal.join(", ")}`);
      durs.push(v.dur);
      totalNotes += v.notes;
    }
    // LENGTH-LOCKED: variants must not differ in length by more than sub-bar content
    // rounding (different CAGED shapes can fit a whole-cycle drill a hair differently).
    // The hard length-determinants (bpm/meter/bars/targetSec) are forbidden in a vary
    // delta by validateSegmentTemplates, so a gross (~2x) spread = a real dodge/bug.
    if (durs.length > 1) {
      const mx = Math.max(...durs), mn = Math.min(...durs);
      if (mn < mx * 0.8) fatal.push(`length not held across variants (min ${mn.toFixed(2)} < 80% of max ${mx.toFixed(2)}): [${durs.map((d) => d.toFixed(2)).join(", ")}]`);
    }
    out.push({ label: `${t.role}/${id} (${n}v)`, ok: fatal.length === 0, fatal, notes: totalNotes });
  }

  // refreshWorkout: advance a one-slot workout and confirm the variant index moved
  // (when the template has >1 variant) and the refreshed workout still builds.
  const ids = Object.keys(T);
  if (ids.length) {
    const a = ids.find((k) => (T[k].vary || []).length > 1) || ids[0];
    const multi = (T[a].vary || []).length > 1;
    const w0 = { version: 1, name: "rw", stringSetup: stringFor(T[a].instrument), segments: [{ id: "s1", templateId: a, variantIdx: 0 }] };
    const w1 = S.refreshWorkout(w0, { scope: "all" });
    const fatal = [];
    const moved = (w1.segments[0].variantIdx | 0) !== 0;
    if (multi && !moved) fatal.push("refreshWorkout did not advance variantIdx for a multi-variant template");
    try {
      const r0 = S.generateSession(w0), r1 = S.generateSession(w1);
      if (!r0.chart || !r1.chart) fatal.push("refresh materialisation produced no chart");
    } catch (e) { fatal.push(`refresh build threw: ${e.message}`); }
    out.push({ label: `refreshWorkout(${a})`, ok: fatal.length === 0, fatal, notes: 0 });
  } else {
    out.push({ label: "SEGMENT_TEMPLATES", ok: false, fatal: ["registry is empty"], notes: 0 });
  }

  // ── Workout-love Tier 3 — the length-preset ADD-ARC ─────────────────────────
  // A longer preset must mean a better ARC (more context-cycling passes), never the
  // SAME blocks stretched longer (the massing this replaced). Guards: Quick adds
  // nothing; Woodshed grows + interleaves a Review before the application + adds no
  // single bloated block (≤4min) + doesn't compound on re-apply.
  if (typeof S.applyLengthPreset === "function" && S.BUILT_IN_SESSIONS) {
    const fatal = [];
    const sessions = S.BUILT_IN_SESSIONS;
    const pickId = Object.keys(sessions).find((id) => {
      const segs = (sessions[id].segments || []).map(S.materializeSegment).filter(Boolean);
      return segs.length >= 3 && segs.map((s) => s.role || null).some((r) => r === "application" || r === "jam");
    });
    if (!pickId) { fatal.push("no multi-block session with an application/jam block to test"); }
    else {
      const base = sessions[pickId];
      const mk = () => Object.assign({}, base, { segments: (base.segments || []).map(S.materializeSegment).filter(Boolean).map((s) => Object.assign({}, s)) });
      const origN = mk().segments.length;
      const quick = S.applyLengthPreset(mk(), "quick");
      if (quick.segments.length !== origN || quick.segments.some((s) => s._added)) fatal.push(`quick changed the arc (${origN} -> ${quick.segments.length}, added ${quick.segments.filter((s) => s._added).length})`);
      const wood = S.applyLengthPreset(mk(), "woodshed");
      if (wood.segments.length <= origN) fatal.push(`woodshed did not grow the arc (${origN} -> ${wood.segments.length})`);
      if (!wood.segments.some((s) => s._added && s.role === "review")) fatal.push("woodshed added no Review block");
      const revIdx = wood.segments.findIndex((s) => s._added && s.role === "review");
      const appIdx = wood.segments.findIndex((s) => (s.role === "application" || s.role === "jam") && !s._added);
      if (!(revIdx >= 0 && appIdx >= 0 && revIdx < appIdx)) fatal.push("Review not interleaved before the application");
      const wood2 = S.applyLengthPreset(wood, "woodshed");
      if (wood2.segments.length !== wood.segments.length) fatal.push(`compounds on re-apply (${wood.segments.length} -> ${wood2.segments.length})`);
      const ex = S.generateSession(wood);
      const sb = (ex.chart && ex.chart.segmentBounds) || [];
      if (!sb.length || !sb.every((b) => typeof b.competency === "string" && b.competency)) fatal.push("segmentBounds missing competency (recap data)");
      if (sb.filter((b) => b.added).some((b) => b.end - b.start > 240)) fatal.push("an added block masses (>4min)");
      out.push({ label: `addArc(${pickId}: ${origN}->${wood.segments.length})`, ok: fatal.length === 0, fatal, notes: 0 });
    }
  }

  return out;
}

async function run() {
  await ensureHost();
  const pageErrors = [];
  const consoleErrors = [];
  const browser = await chromium.launch({ headless: true });
  let rows = [];
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
    page.on("pageerror", (e) => { if (!isBenign(e.message)) pageErrors.push(e.message); });
    page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(m.text()); });
    await gotoVirtuoso(page);
    rows = await page.evaluate(runVariationInPage);
  } finally {
    await browser.close();
  }

  console.log("\n=== Virtuoso variation-engine smoke ===\n");
  let fatalCount = 0;
  for (const r of rows) {
    const tag = r.ok ? "PASS" : "FAIL";
    if (!r.ok) fatalCount++;
    const extra = r.notes ? ` notes=${r.notes}` : "";
    console.log(`  [${tag}] ${r.label}${extra}`);
    for (const f of r.fatal) console.log(`         x ${f}`);
  }
  // Load-time guard breakage (validateSegmentTemplates / no-unison) surfaces here.
  for (const e of pageErrors) { console.log(`  [FAIL] pageerror: ${e}`); fatalCount++; }
  for (const e of consoleErrors) { console.log(`  [FAIL] console.error: ${e}`); fatalCount++; }

  console.log(`\n${rows.length - rows.filter((r) => !r.ok).length}/${rows.length} template checks passed.`);
  if (fatalCount) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
