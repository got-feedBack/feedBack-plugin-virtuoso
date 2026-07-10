#!/usr/bin/env node
// Assertive smoke test for the Virtuoso generators (complements
// smoke-renderers.mjs, which covers the render/playback surface).
//
// It drives window.Virtuoso.generateExercise() directly (fast — no rendering)
// across every practice type and every scale, plus a bass pass (string-count
// dependent shapes), then launches each built-in session through the UI. For
// each generated chart it validates structure: notes present, every note has a
// finite t>=0, an integer string in range, a sane fret, positive sustain; beats
// present (transport clock). It exits non-zero on any fatal failure.
//
// The no-unison rule is covered for free: screen.js throws a
// "[Virtuoso no-unison] …" error at load time if a resolved shape doubles a
// pitch, which surfaces as a pageerror and fails the run.
//
// Usage (host must already be up via launch.ps1):
//   node .claude/skills/run-virtuoso/smoke-generators.mjs   # or: npm run smoke:gen
//
// Exit 0 = all generators OK (warnings allowed), 1 = a fatal failure / host down.

import { chromium } from "playwright";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";

const BENIGN = [/note detect: mic access denied/i, 
  /failed to set up audio analyser/i,
  /invalidstateerror/i,
  /audiocontext was not allowed to start/i,
  /the audiocontext was (not allowed|prevented)/i,
  /play\(\) request was interrupted/i,
  /continuous scoring failed to start/i,   // Minigames SDK can't start the mic in headless — scoring is optional (the SDK is now PRESENT on the checkout target, so it tries + fails benignly)
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
  await page.waitForSelector("#virtuoso-view-select", { timeout: 5_000 });
  await page.waitForFunction(() => window.Virtuoso && typeof window.Virtuoso.generateExercise === "function", { timeout: 5_000 });
}

// Runs in the page: generate `cfg` overrides over a base config and validate the
// resulting chart. Returns one result row per override. `mode` picks the matrix.
function runMatrixInPage({ mode, overridesList, stringCount }) {
  const S = window.Virtuoso;
  const base = S.readConfig();
  const sc = stringCount || (base.openMidis && base.openMidis.length) || 6;

  function check(res) {
    const fatal = [], warn = [];
    if (!res || !res.chart) { fatal.push("no chart returned"); return { fatal, warn, notes: 0 }; }
    const c = res.chart;
    const notes = Array.isArray(c.notes) ? c.notes : [];
    if (notes.length === 0) fatal.push("no notes");
    if (!Array.isArray(c.beats) || c.beats.length === 0) warn.push("no beats");
    // String index must be inside the instrument's range — FATAL, not a warning
    // (a bass-invalid string is a real regression, not a nit). Use the chart's
    // string count; fall back to the 8-string guitar ceiling if it's unknown.
    const maxStrings = Number.isInteger(sc) && sc > 0 ? sc : 8;
    for (const n of notes) {
      if (typeof n.t !== "number" || !isFinite(n.t) || n.t < 0) { fatal.push(`bad t=${n.t}`); break; }
      if (!Number.isInteger(n.s) || n.s < 0 || n.s >= maxStrings) { fatal.push(`bad string=${n.s} (max ${maxStrings})`); break; }
      if (!Number.isInteger(n.f) || n.f < 0 || n.f > 30) { fatal.push(`bad fret=${n.f}`); break; }
      if (n.sus !== undefined && (typeof n.sus !== "number" || n.sus <= 0)) { fatal.push(`bad sus=${n.sus}`); break; }
    }
    return { fatal, warn, notes: notes.length };
  }

  const out = [];
  for (const ov of overridesList) {
    const label = mode === "scale" ? `scale:${ov.scale}` : (ov.practiceType || JSON.stringify(ov));
    // readConfig() returns BOTH cfg.mode and cfg.practiceType, and the dispatch
    // (buildSingleChart) reads cfg.mode first — so an override must set both or
    // the stale base.mode wins and every type generates the same chart.
    const merged = { ...base, ...ov };
    if (ov.practiceType) merged.mode = ov.practiceType;
    try {
      const res = S.generateExercise(merged);
      const v = check(res);
      out.push({ label, ok: v.fatal.length === 0, fatal: v.fatal, warn: v.warn, notes: v.notes });
    } catch (e) {
      out.push({ label, ok: false, fatal: [`threw: ${e.message}`], warn: [], notes: 0 });
    }
  }
  return out;
}

async function run() {
  await ensureHost();
  const pageErrors = [];
  const consoleErrors = [];
  const browser = await chromium.launch({ headless: true });
  const sections = []; // { name, rows }
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => { if (!isBenign(e.message)) pageErrors.push(e.message); });
    page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) consoleErrors.push(m.text()); });

    await gotoVirtuoso(page);

    // ── Phase 1: practice-type matrix (default scale, guitar) ──────────────
    const practiceTypes = await page.$$eval('select[name="practiceType"] option', (os) => os.map((o) => o.value));
    const p1 = await page.evaluate(runMatrixInPage, {
      mode: "pt", stringCount: null,
      overridesList: practiceTypes.map((practiceType) => ({ practiceType })),
    });
    sections.push({ name: `practice types (${practiceTypes.length})`, rows: p1 });

    // ── Phase 2: scale matrix (practiceType=scale, guitar) ─────────────────
    const scales = await page.$$eval('select[name="scale"] option', (os) => os.map((o) => o.value));
    const p2 = await page.evaluate(runMatrixInPage, {
      mode: "scale", stringCount: null,
      overridesList: scales.map((scale) => ({ practiceType: "scale", scale })),
    });
    sections.push({ name: `scales (${scales.length})`, rows: p2 });

    // ── Phase 3: bass pass (string-count-dependent shapes) ─────────────────
    const bassVal = await page.evaluate(() => {
      const sel = document.querySelector('select[name="instrument"]');
      if (!sel) return null;
      const opt = [...sel.options].find((o) => /bass/i.test(o.value) || /bass/i.test(o.textContent));
      if (!opt) return null;
      sel.value = opt.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return opt.value;
    });
    if (bassVal) {
      await page.waitForTimeout(300); // let syncInstrumentClass switch shapes
      const bassTypes = ["scale", "diatonic_arpeggios", "chromatic", "walking_bass",
        "root_fifth_octave", "octave_groove", "dead_note_groove", "right_hand_technique", "slap_pop"].filter((t) => practiceTypes.includes(t));
      const p3 = await page.evaluate(runMatrixInPage, {
        mode: "pt", stringCount: null,
        overridesList: bassTypes.map((practiceType) => ({ practiceType })),
      });
      sections.push({ name: `bass (${bassVal}) practice types`, rows: p3 });
    } else {
      // A missing bass option is a real UI/config regression — fail, don't skip.
      sections.push({ name: "bass", rows: [{ label: "instrument select / bass option not found", ok: false, fatal: ["bass option missing; bass string-count smoke not executed"], warn: [], notes: 0 }] });
    }

    // ── Phase 4: built-in sessions ──────────────────────────────────────────
    // Diet (dev-ops audit 2026-06-05): launching all starters through the UI
    // exercised the SAME drawer→Load→Launch shell path once per session (~31s of
    // fixed sleeps) when only the chart differs. Now:
    //   (a) EVERY session's chart is built + structurally validated in-page via
    //       generateSession() (engine coverage — this is MORE than the old launch
    //       loop checked, which never looked at the notes), and
    //   (b) only three REPRESENTATIVES still walk the real drawer→Load→Launch UI
    //       (shell coverage), picked per materialization path: the default inline
    //       arc, a bpm-ladder/key-cycle rung session, and a Phase-7 template-ref
    //       session. A drawer⇄registry drift guard keeps enumeration honest.
    await page.click("#virtuoso-mode-session").catch(() => {});
    await page.waitForTimeout(300);
    await page.click("#virtuoso-starters-open").catch(() => {});
    await page.waitForTimeout(300);
    const sessionVals = await page.$$eval(".virtuoso-starter-load", (els) =>
      els.map((e) => ({ v: e.dataset.starterId, t: (e.closest(".virtuoso-starter-card")?.querySelector(".virtuoso-segment-name")?.textContent || e.dataset.starterId).trim() }))
    ).catch(() => []);
    await page.click("#virtuoso-starters-close").catch(() => {});
    await page.waitForTimeout(120);
    const sessionRows = [];

    // (a) in-page build + validate of EVERY registered session, plus the drift
    // guard: every registry session has a drawer card and vice versa.
    const sessionBuild = await page.evaluate((drawerIds) => {
      const S = window.Virtuoso;
      const reg = S.BUILT_IN_SESSIONS || {};
      const regIds = Object.keys(reg);
      const rows = [];
      // Empty enumeration must FAIL, not silently skip the whole phase
      // (CodeRabbit, 2026-06-05: a broken export or drawer selector would
      // otherwise pass with zero sessions validated).
      if (!regIds.length) rows.push({ label: "session enumeration", ok: false, fatal: ["BUILT_IN_SESSIONS is missing/empty on the public surface"], warn: [], notes: 0 });
      if (!drawerIds.length) rows.push({ label: "session enumeration", ok: false, fatal: ["no starter cards enumerated from the drawer"], warn: [], notes: 0 });
      const missingCard = regIds.filter((id) => !drawerIds.includes(id));
      const ghostCard = drawerIds.filter((id) => !regIds.includes(id));
      if (missingCard.length) rows.push({ label: "drawer drift", ok: false, fatal: [`sessions missing a drawer card: ${missingCard.join(", ")}`], warn: [], notes: 0 });
      if (ghostCard.length) rows.push({ label: "drawer drift", ok: false, fatal: [`drawer cards with no registry session: ${ghostCard.join(", ")}`], warn: [], notes: 0 });
      const reps = { inline: null, ladder: null, templateRef: null };
      for (const id of regIds) {
        const def = reg[id];
        const isLadder = !!((def.bpmLadder && def.bpmLadder.enabled) || (def.keyCycle && def.keyCycle.enabled));
        const isTplRef = (def.segments || []).some((seg) => seg && seg.templateId);
        if (isLadder && !reps.ladder) reps.ladder = id;
        else if (isTplRef && !reps.templateRef) reps.templateRef = id;
        else if (!isLadder && !isTplRef && !reps.inline) reps.inline = id;
        const fatal = [], warn = [];
        try {
          const res = S.generateSession(def);
          const c = res && res.chart;
          const notes = (c && c.notes) || [];
          if (!c) fatal.push("no chart");
          else {
            if (!notes.length) fatal.push("no notes");
            if (!Array.isArray(c.beats) || !c.beats.length) warn.push("no beats");
            for (const n of notes) {
              if (typeof n.t !== "number" || !isFinite(n.t) || n.t < 0) { fatal.push(`bad t=${n.t}`); break; }
              if (!Number.isInteger(n.s) || n.s < 0 || n.s >= 8) { fatal.push(`bad string=${n.s}`); break; }
              if (!Number.isInteger(n.f) || n.f < 0 || n.f > 30) { fatal.push(`bad fret=${n.f}`); break; }
              if (n.sus !== undefined && (typeof n.sus !== "number" || n.sus <= 0)) { fatal.push(`bad sus=${n.sus}`); break; }
            }
          }
          rows.push({ label: `session:${id} (build)`, ok: fatal.length === 0, fatal, warn, notes: notes.length });
        } catch (e) {
          rows.push({ label: `session:${id} (build)`, ok: false, fatal: [`threw: ${e.message}`], warn: [], notes: 0 });
        }
      }
      const repIds = [...new Set([reps.inline, reps.ladder, reps.templateRef].filter(Boolean))];
      return { rows, repIds };
    }, sessionVals.map((s) => s.v));
    sessionRows.push(...sessionBuild.rows);

    // (b) the three representatives through the real UI launch path.
    const reps = sessionBuild.repIds.length ? sessionBuild.repIds : sessionVals.slice(0, 3).map((s) => s.v);
    for (const v of reps) {
      const errBase = pageErrors.length, conBase = consoleErrors.length;
      try {
        await page.click("#virtuoso-starters-open");
        await page.waitForTimeout(150);
        await page.click(`.virtuoso-starter-load[data-starter-id="${v}"]`);
        // A prior edited draft would stage the replace-guard — confirm it through.
        const guard = await page.$(".virtuoso-starter-confirm-yes");
        if (guard) { await guard.click().catch(() => {}); await page.waitForTimeout(120); }
        await page.waitForTimeout(150);
        await page.click("#virtuoso-launch-session");
        await page.waitForTimeout(700);
        const status = (await page.$eval("#virtuoso-renderer-status", (e) => e.textContent.trim()).catch(() => "")) || "";
        const fatal = [];
        if (!status) fatal.push("renderer-status empty after launch");
        for (const e of pageErrors.slice(errBase)) fatal.push(`pageerror: ${e}`);
        for (const e of consoleErrors.slice(conBase)) fatal.push(`console.error: ${e}`);
        sessionRows.push({ label: `session:${v} (UI launch)`, ok: fatal.length === 0, fatal, warn: [], notes: 0 });
        // Stop playback if the launch auto-started it (Play toggles to Stop).
        const playTxt = await page.$eval("#virtuoso-play", (e) => e.textContent).catch(() => "");
        if (playTxt && !/play/i.test(playTxt)) { await page.click("#virtuoso-play").catch(() => {}); await page.waitForTimeout(150); }
      } catch (e) {
        sessionRows.push({ label: `session:${v} (UI launch)`, ok: false, fatal: [`threw: ${e.message}`], warn: [], notes: 0 });
      }
    }
    sections.push({ name: `built-in sessions (${sessionBuild.rows.length} built, ${reps.length} UI-launched)`, rows: sessionRows });

    // ── Phase 5: engine semantics ──────────────────────────────────────────
    // Durable per-device asserts folded from probe-djent-ladder (per-system
    // rule: the suite owns the system, probes stay throwaway). Guards the
    // 2026-06-05 engine fixes: RHYTHM_CELLS shape call_response's call (was a
    // silent no-op), the call/response bar-gate epsilon (the 33rd-note leak ON
    // the response downbeat), and pedal_riff stabs landing on grouping group
    // starts (the djent riff cell living in the NOTES). Meter must round-trip
    // through the FORM — readConfig parses it via parseMeter; patching
    // cfg.meter with a raw string corrupts the generators' meter object.
    const p5 = await page.evaluate(() => {
      const S = window.Virtuoso;
      // Phase 3 left the instrument select on bass — restore guitar so the
      // form-derived base config matches the patches below.
      const inst = document.querySelector('select[name="instrument"]');
      if (inst && !/guitar/i.test(inst.value)) {
        const g = [...inst.options].find((o) => /guitar/i.test(o.value));
        if (g) { inst.value = g.value; inst.dispatchEvent(new Event("change", { bubbles: true })); }
      }
      const setMeter = (m) => { const el = document.querySelector('#virtuoso-controls [name="meter"]'); if (el) el.value = m; };
      const adv = document.querySelector('[name="advancedMode"]'); if (adv) adv.checked = true;
      const base = { stringSetup: "guitar_6_drop_d", key: "D", scale: "phrygian", fretboardSystem: "position", fretMin: 0, fretMax: 7, bars: 8, bpm: 90 };
      const run = (label, meterStr, patch, judge) => {
        try {
          setMeter(meterStr);
          const cfg = Object.assign(S.readConfig(), base, patch);
          cfg.mode = cfg.practiceType;
          const chart = S.generateExercise(cfg).chart || {};
          const notes = chart.notes || [];
          const m = cfg.meter, barSec = m.numerator * (60 / cfg.bpm) * (4 / m.denominator);
          return Object.assign({ label, notes: notes.length }, judge(notes, barSec, chart));
        } catch (e) { return { label, ok: false, fatal: [`threw: ${e.message}`], warn: [], notes: 0 }; }
      };
      const rows = [];
      rows.push(run("call_response honours RHYTHM_CELLS (reverse_gallop shapes the call)", "4/4",
        { practiceType: "call_response", subdivision: "reverse_gallop" },
        (notes) => {
          const gaps = new Set();
          for (let i = 1; i < notes.length; i++) { const g = notes[i].t - notes[i - 1].t; if (g > 1e-6) gaps.add(g.toFixed(3)); }
          const okv = notes.length > 0 && gaps.size >= 2;
          return { ok: okv, fatal: okv ? [] : [`uniform onset gaps (${gaps.size} kind) — cells ignored`], warn: [] };
        }));
      rows.push(run("call_response bar-gate: zero leak into the response bars", "4/4",
        { practiceType: "call_response", subdivision: "eighth" },
        (notes, barSec) => {
          const leak = notes.filter((n) => Math.floor(n.t / barSec + 1e-9) % 4 >= 2).length;
          return { ok: leak === 0, fatal: leak ? [`${leak} note(s) inside the response window`] : [], warn: [] };
        }));
      rows.push(run("pedal_riff stabs land on group starts (8/8:3+3+2 = 3 stabs/bar)", "8/8:3+3+2",
        { stringSetup: "guitar_7_standard", key: "B", practiceType: "pedal_riff", subdivision: "eighth", progression: "metal_pedal_chromatic", chordOverride: "5oct" },
        (notes, barSec) => {
          const inBar = notes.filter((n) => n.t < barSec - 1e-6);
          const byT = {}; inBar.forEach((n) => { const k = n.t.toFixed(4); byT[k] = (byT[k] || 0) + 1; });
          const stabs = Object.values(byT).filter((c) => c >= 2).length;
          return { ok: stabs === 3, fatal: stabs === 3 ? [] : [`stabs in bar 1 = ${stabs}, expected 3`], warn: [] };
        }));
      // strum_comp chord-rung semantics (2026-06-06 dogfood fixes — see the
      // shape-walk/economy/nearest_low changes in pickStrumGrip et al.).
      rows.push(run("strum_comp shapeWalk: five distinct CAGED shapes climbing the neck", "4/4",
        { practiceType: "strum_comp", stringSetup: "guitar_6_standard", key: "G", scale: "major", subdivision: "eighth",
          progression: "static_i", chordDepth: "triad", chordOverride: "auto", voicingPosition: "movable", shapeWalk: true, bars: 10, fretboardSystem: "position" },
        (notes, barSec, chart) => {
          const tags = (chart.chordTemplates || []).map((t) => ((t.displayName || "").match(/\(([A-G])-shape\)/i) || [])[1]).filter(Boolean);
          const mins = (chart.chords || []).map((c) => Math.min(...c.notes.map((n) => n.f)));
          const five = new Set(tags.slice(0, 5)).size === 5;
          const climb = mins.slice(0, 5).every((m2, i) => i === 0 || m2 >= mins[i - 1]);
          const fatal = [];
          if (!five) fatal.push(`first lap shapes = ${tags.slice(0, 5).join("→")} (expected 5 distinct)`);
          if (!climb) fatal.push(`grip frets not climbing: ${mins.slice(0, 5).join(",")}`);
          return { ok: five && climb, fatal, warn: [] };
        }));
      rows.push(run("strum_comp economy: nearest-grip comping (bounded jumps, ≤ fret 12)", "4/4",
        { practiceType: "strum_comp", stringSetup: "guitar_6_standard", key: "G", scale: "major", subdivision: "eighth",
          progression: "I-V-vi-IV", chordDepth: "triad", chordOverride: "auto", voicingPosition: "economy", shapeWalk: false, bars: 8, fretboardSystem: "position" },
        (notes, barSec, chart) => {
          const mins = (chart.chords || []).map((c) => Math.min(...c.notes.map((n) => n.f)));
          const jumps = mins.slice(1).map((m2, i) => Math.abs(m2 - mins[i]));
          const fatal = [];
          if (Math.max(...jumps) > 5) fatal.push(`grip jump > 5 frets (${jumps.join(",")}) — not voice economy`);
          if (Math.max(...mins) > 12) fatal.push(`grip above fret 12 (${mins.join(",")}) — nearest_low broken`);
          return { ok: fatal.length === 0, fatal, warn: [] };
        }));
      // MOTIF_CELLS engine semantics (riff-vocab pilot 2026-06-12; per-system
      // rule: rows here, probe-motif* stays throwaway). The blues turnaround
      // cell: one drill pass = 4 ch-tagged parallel-m3 dyads walking down
      // chromatically + 3 singles, resolving onto the V root; construct phase
      // leaves the answer window EMPTY (the D13 construction surface) with the
      // backing still alive; bass ADAPT renders the lower voice as one line.
      const OPENS6 = [40, 45, 50, 55, 59, 64], OPENS4B = [28, 33, 38, 43];
      const motifBase = { practiceType: "motif", motifCell: "blues_turnaround_thirds", stringSetup: "guitar_6_standard",
        key: "A", scale: "blues", fretboardSystem: "caged", shape: "E", subdivision: "eighth", bars: 8, bpm: 80,
        backingStyle: "boogie", swing: "shuffle", fretMin: 0, fretMax: 14 };
      rows.push(run("motif drill: m3-dyad walkdown resolves onto the V root", "4/4",
        Object.assign({}, motifBase),
        (notes, barSec) => {
          const p1 = notes.filter((n) => !n._tail && n.t < 2 * barSec - 0.01);
          const byT = {}; p1.forEach((n) => { const k = n.t.toFixed(4); (byT[k] = byT[k] || []).push(OPENS6[n.s] + n.f); });
          const onsets = Object.keys(byT).sort((a, b) => a - b);
          const dyadOnsets = onsets.filter((k) => byT[k].length === 2);
          const tops = onsets.slice(0, 4).map((k) => Math.max(...byT[k]));
          const chrom = tops.every((m, i) => i === 0 || tops[i - 1] - m === 1);
          const m3 = onsets.slice(0, 4).every((k) => byT[k].length === 2 && Math.max(...byT[k]) - Math.min(...byT[k]) === 3);
          const lastPc = ((byT[onsets[onsets.length - 1]][0] % 12) + 12) % 12;   // key A → V root E = pc 4
          const tagged = p1.filter((n) => n.ch).length;
          const fatal = [];
          if (p1.length !== 11) fatal.push(`pass = ${p1.length} notes, expected 11`);
          if (dyadOnsets.length !== 4) fatal.push(`${dyadOnsets.length} dyad onsets, expected 4`);
          if (tagged !== 8) fatal.push(`${tagged} ch-tagged dyad members, expected 8`);
          if (!chrom) fatal.push(`top voice not chromatic-descending (${tops.join("→")})`);
          if (!m3) fatal.push("dyads are not parallel minor 3rds");
          if (lastPc !== 4) fatal.push(`resolution pc ${lastPc}, expected the V root (4)`);
          return { ok: fatal.length === 0, fatal, warn: [] };
        }));
      rows.push(run("motif construct: empty answer window, backing alive (D13)", "4/4",
        Object.assign({}, motifBase, { motifPhase: "construct" }),
        (notes, barSec, chart) => {
          const cellSec = 2 * barSec;
          const resp = notes.filter((n) => !n._tail && n.t >= cellSec - 0.01 && n.t < 2 * cellSec - 0.01);
          const back = (chart.backingEvents || []).filter((ev) => ev.t >= cellSec && ev.t < 2 * cellSec);
          const fatal = [];
          if (resp.length) fatal.push(`${resp.length} note(s) inside the answer window`);
          if (!back.length) fatal.push("backing silent through the answer window");
          if (!(chart.timeline || []).length) fatal.push("no cell-owned timeline on the chart");
          return { ok: fatal.length === 0, fatal, warn: [] };
        }));
      rows.push(run("motif bass ADAPT: lower voice as one line, no dyads", "4/4",
        Object.assign({}, motifBase, { stringSetup: "bass_4_standard", fretboardSystem: "position", fretMin: 0, fretMax: 9, shape: undefined }),
        (notes, barSec) => {
          const p1 = notes.filter((n) => !n._tail && n.t < 2 * barSec - 0.01);
          const midis = p1.map((n) => OPENS4B[n.s] + n.f);
          const walk = midis.slice(0, 4).every((m, i, a) => i === 0 || a[i - 1] - m === 1);
          const fatal = [];
          if (p1.length !== 7) fatal.push(`bass pass = ${p1.length} notes, expected 7 singles`);
          if (p1.some((n) => n.ch)) fatal.push("bass notes carry ch dyad tags");
          if (!walk) fatal.push(`bass lower-voice walkdown broken (${midis.join("→")})`);
          return { ok: fatal.length === 0, fatal, warn: [] };
        }));
      // Jam multi-pass assembly (slice J-1, docs/jam-mode-roundtable.md): the
      // varied band is BAKED into the chart — N passes, switch-it-up alternates
      // the style's progressions per pass, the band-mode filter drops the bass.
      rows.push(run("jam multi-pass: 4 varied passes, switch-up alternates, no_bass filters", "4/4",
        { practiceType: "scale", stringSetup: "guitar_6_standard", key: "A", scale: "blues",
          fretboardSystem: "position", fretMin: 4, fretMax: 9, bars: 12, bpm: 120, subdivision: "eighth",
          progression: "12_bar_blues", chordDepth: "seventh", chordOverride: "dom7",
          backingStyle: "boogie", swing: "shuffle",
          jamStyle: "blues", jamPasses: 4, jamProgressionIdx: 0, jamSwitchUp: true, jamBandMode: "no_bass" },
        (notes, barSec, chart) => {
          const fatal = [];
          const secs = (chart.sections || []).map((s) => s.name);
          if (secs.length !== 4 || new Set(secs).size < 2) fatal.push(`sections ${secs.join("|")} — switch-up not varying`);
          if (!((chart.duration || 0) > 0)) fatal.push(`bad duration ${chart.duration}`);
          const last = (chart.timeline || [])[Math.max(0, (chart.timeline || []).length - 1)];
          if (!last || last.end < (chart.duration || 0) - 0.05) fatal.push(`timeline ends ${last && last.end}, duration ${chart.duration}`);
          if ((chart.backingEvents || []).some((e) => e.role === "bass")) fatal.push("no_bass left bass events in the band");
          return { ok: fatal.length === 0, fatal, warn: [] };
        }));
      rows.push(run("jam Spotlight: band turns use sparse phrase calls, not scale runs", "4/4",
        { practiceType: "scale", stringSetup: "guitar_6_standard", key: "A", scale: "blues",
          fretboardSystem: "position", fretMin: 4, fretMax: 9, bars: 12, bpm: 120, subdivision: "eighth",
          progression: "12_bar_blues", chordDepth: "seventh", chordOverride: "dom7",
          backingStyle: "boogie", swing: "shuffle",
          jamStyle: "blues", jamPasses: 4, jamProgressionIdx: 0, jamSwitchUp: false, jamBandMode: "full", jamSpotlight: true },
        (notes, barSec, chart) => {
          const fatal = [];
          const band = notes.filter((n) => !n._tail && n.solo === "band");
          const you = notes.filter((n) => !n._tail && n.solo === "you");
          if (!band.length) fatal.push("no band-turn Spotlight notes");
          if (!you.length) fatal.push("no player-turn Spotlight notes");
          if (band.some((n) => !n._spotlightPhrase)) fatal.push("band-turn notes include generic generated run material");
          if (you.some((n) => n._spotlightPhrase)) fatal.push("player-turn notes were replaced with phrase calls");
          if (band.length >= you.length * 0.75) fatal.push(`band phrases too dense (${band.length} vs player ${you.length})`);
          const bandPcs = new Set(band.map((n) => ((OPENS6[n.s] + n.f) % 12 + 12) % 12));
          const chordPcs = new Set((chart.timeline || []).flatMap((ev) => ev.cpcs || []));
          if (![...bandPcs].some((pc) => chordPcs.has(pc))) fatal.push("band phrases do not target chord tones");
          return { ok: fatal.length === 0, fatal, warn: [] };
        }));
      setMeter("4/4");
      return rows;
    });
    sections.push({ name: "engine semantics (5)", rows: p5 });

    // ── Phase 5b: interval-SEQUENCE engine (diatonic 4ths/5ths/6ths) ────────
    // Durable assert folded from probe-intervals (per-system rule): the
    // SEQUENCE_PATTERNS single-note skip drill must land the DIATONIC interval —
    // quality alternates to stay in key (P4 / aug4 on IV; P5 / dim5 on vii; maj6 /
    // min6). Distinct from the HARMONIZED scale_thirds/scale_sixths double-stops.
    // Built 2026-06-11 (beyoki's Discord ask + 4-agent review → the Intervals pack).
    const p5b = await page.evaluate(() => {
      const S = window.Virtuoso;
      // Build the cfg by MERGING over readConfig() with shapeNotes:null (the Phase-6
      // gen() pattern) — NOT by driving the form. Avoids both the shape-hidden-field
      // sync (silent-set leaves it stale) and the instrument-handler pollution
      // (change-dispatch leaks into the later bass rows). shapeNotes:null forces the
      // E-shape to re-resolve; ascending + caged gives a clean pitch-ascending run so
      // consecutive pairs are consecutive scale degrees (position mode orders by
      // string, which would scramble the pairs).
      const row = (seq, expect) => {
        // fretMin/fretMax pinned (2026-06-12): readConfig stopped letting the
        // beginner-mode CAGED fallback clobber frame-type fret windows, so the
        // form residue here is now the literal window (e.g. the chromatic
        // warmup's 1-4) — which skews the re-resolved run. The row must stand
        // on its own cfg, like the sweep row.
        const cfg = Object.assign(S.readConfig(), { shapeNotes: null, stringSetup: "guitar_6_standard", practiceType: "scale", scale: "major", key: "C", fretboardSystem: "caged", shape: "E", direction: "ascending", sequence: seq, bars: 8, fretMin: 0, fretMax: 12 });
        cfg.mode = "scale";
        const ex = S.generateExercise(cfg);
        const opens = S.makeBundle(ex).openMidis || [];
        const ns = (ex.chart.notes || []).filter((n) => !n._tail).map((n) => (opens[n.s] != null ? opens[n.s] + n.f : null)).filter((x) => x != null);
        const g = []; for (let i = 0; i + 1 < ns.length; i += 2) g.push(ns[i + 1] - ns[i]);
        const okv = g.length > 0 && g.every((x) => expect.includes(x));
        return { label: `sequence '${seq}' lands the diatonic interval (${expect.join("/")} st)`, ok: okv, fatal: okv ? [] : [`pair gaps ${JSON.stringify(g.slice(0, 8))} not all in ${JSON.stringify(expect)}`], warn: [], notes: ns.length };
      };
      return [row("fourths", [5, 6]), row("fifths", [6, 7]), row("sixths", [8, 9])];
    });
    sections.push({ name: "interval sequences (5b)", rows: p5b });

    // ── Phase 6: hand-marks data layer (fg/pkd) ────────────────────────────
    // Durable rows promoted from probe-hand-marks (per-system rule): the
    // Slice-1 emission semantics from docs/hand-marks-roundtable.md. Display
    // only — nothing ever scores on fg/pkd/rh — but the DATA must stay honest:
    // fg only from a validated source (honesty by omission), pkd strict
    // alternation by note order with legato pick-transparency, sweeps
    // directional, bass on the 1-2-4 low-box regime. shapeNotes is nulled in
    // every patch: readConfig pre-resolves the form's shape and shape notes
    // (correctly) win over the fretboardSystem switch.
    const p6 = await page.evaluate(() => {
      const S = window.Virtuoso;
      const gen = (over) => {
        const cfg = Object.assign(S.readConfig(), { shapeNotes: null }, over);
        cfg.mode = cfg.practiceType;
        return S.generateExercise(cfg).chart.notes.filter((n) => !n._tail);
      };
      const row = (label, fn) => {
        try {
          const fatal = fn();
          return { label, ok: fatal.length === 0, fatal, warn: [], notes: 0 };
        } catch (e) { return { label, ok: false, fatal: [`threw: ${e.message}`], warn: [], notes: 0 }; }
      };
      const rows = [];
      const all = []; // pooled for the cross-cutting invariants row
      rows.push(row("CAGED scale: fg on every note + strict alternate pkd from a downstroke", () => {
        // fg rides the form-resolved shapeNotes (readConfig pre-resolves the
        // shape, and the resolver is where fg lives) — so drive the REAL form
        // like smoke-strings does; patching cfg around readConfig would test a
        // path that never carries fingering.
        const adv = document.querySelector('[name="advancedMode"]'); if (adv) adv.checked = true;
        const setForm = (o) => { for (const [k, v] of Object.entries(o)) { const el = document.querySelector(`#virtuoso-controls [name="${k}"]`); if (el) el.value = String(v); } };
        setForm({ stringSetup: "guitar_6_standard", practiceType: "scale", scale: "minor_pentatonic", key: "A", fretboardSystem: "caged", shape: "E" });
        const cfg = S.readConfig(); cfg.mode = cfg.practiceType;
        const caged = S.generateExercise(cfg).chart.notes.filter((n) => !n._tail);
        all.push(...caged);
        const fgN = caged.filter((n) => n.fg != null).length;
        const picked = caged.filter((n) => !n.ho && !n.po && !n.tp);
        const fatal = [];
        if (!caged.length || fgN !== caged.length) fatal.push(`fg on ${fgN}/${caged.length} notes — resolver fg plumbing broken`);
        if (!picked.every((n) => n.pkd === 0 || n.pkd === 1)) fatal.push("a picked note is missing pkd");
        if (!(picked.length && picked[0].pkd === 0)) fatal.push("first stroke is not a downstroke");
        if (!picked.every((n, i) => i === 0 || n.pkd !== picked[i - 1].pkd || n.t - picked[i - 1].t > 0.5)) fatal.push("pkd does not alternate by note order");
        return fatal;
      }));
      rows.push(row("chromatic: 1-2-3-4 frame fingering + strict alternate", () => {
        const chrom = gen({ practiceType: "chromatic", chromaticPattern: "1234", fretMin: 1, fretMax: 4, stringSetup: "guitar_6_standard" });
        all.push(...chrom);
        const fatal = [];
        // fretBase=1 → fg = offset+1 = f exactly.
        if (!chrom.every((n) => n.fg >= 1 && n.fg <= 4 && n.fg === n.f)) fatal.push("frame fingering broken (fg should equal the fret in a 1–4 window)");
        if (!chrom.every((n, i) => n.pkd === i % 2)) fatal.push("chromatic pkd not strict-alternate from down");
        return fatal;
      }));
      rows.push(row("loopable warmups: chromatic + spider round up to whole drill cycles", () => {
        const fatal = [];
        const chromCfg = Object.assign(S.readConfig(), { shapeNotes: null, practiceType: "chromatic", mode: "chromatic", stringSetup: "guitar_6_standard", chromaticPattern: "1234", fretMin: 1, fretMax: 4, subdivision: "quarter", bpm: 60, bars: 4, direction: "up_down" });
        const chromChart = S.generateExercise(chromCfg).chart;
        const chromNotes = (chromChart.notes || []).filter((n) => !n._tail);
        const chromCycle = 6 * 4 * 2;
        if (chromNotes.length % chromCycle !== 0) fatal.push(`chromatic note count ${chromNotes.length} is not a whole up/down cycle (${chromCycle})`);
        if (Math.abs((chromChart.duration || 0) - chromNotes.length) > 0.001) fatal.push(`chromatic duration ${chromChart.duration} does not match ${chromNotes.length} quarter-note steps`);
        const spiderCfg = Object.assign(S.readConfig(), { shapeNotes: null, practiceType: "spider", mode: "spider", stringSetup: "guitar_6_standard", chromaticPattern: "1342", spiderPair: "adjacent", fretMin: 5, fretMax: 10, subdivision: "quarter", bpm: 60, bars: 5, direction: "up_down" });
        const spiderChart = S.generateExercise(spiderCfg).chart;
        const spiderNotes = (spiderChart.notes || []).filter((n) => !n._tail);
        const spiderFrames = [5, 6, 7, 6];
        const spiderCycle = spiderFrames.length * 8;
        if (spiderNotes.length % spiderCycle !== 0) fatal.push(`spider note count ${spiderNotes.length} is not a whole frame-walk cycle (${spiderCycle})`);
        if (Math.abs((spiderChart.duration || 0) - spiderNotes.length) > 0.001) fatal.push(`spider duration ${spiderChart.duration} does not match ${spiderNotes.length} quarter-note steps`);
        return fatal;
      }));
      rows.push(row("loopable sequence drills round up without stretching progression timelines", () => {
        const fatal = [];
        const base = { shapeNotes: null, meter: { numerator: 4, denominator: 4, grouping: [4] }, subdivision: "quarter", bpm: 60, bars: 1, direction: "up_down", stringSetup: "guitar_6_standard", fretboardSystem: "position", fretMin: 0, fretMax: 7, key: "C", scale: "major" };
        const loopCases = [
          { practiceType: "legato", minDuration: 4 },
          { practiceType: "tapping", fretMax: 5, minDuration: 4 },
          { practiceType: "string_skipping", minDuration: 4 },
          { practiceType: "bebop_scale", minDuration: 4 },
          { practiceType: "arpeggio_inversions", chordDepth: "triad", minDuration: 4 },
          { practiceType: "scale_thirds", minDuration: 4 }
        ];
        for (const cfg of loopCases) {
          const c = Object.assign({}, S.readConfig(), base, cfg, { mode: cfg.practiceType });
          const chart = S.generateExercise(c).chart;
          const notes = (chart.notes || []).filter((n) => !n._tail);
          if (!notes.length) { fatal.push(`${cfg.practiceType} generated no notes`); continue; }
          if ((chart.duration || 0) <= (cfg.minDuration || 4) + 0.001) fatal.push(`${cfg.practiceType} did not round past the one-bar minimum (duration ${chart.duration})`);
          if (cfg.practiceType !== "scale_thirds" && Math.abs((chart.duration || 0) - notes.length) > 0.001) fatal.push(`${cfg.practiceType} duration ${chart.duration} no longer matches ${notes.length} quarter-step notes`);
        }
        const progressionCases = [
          { practiceType: "chord_scales", mode: "chord_scales", progression: "ii-V-I", chordDepth: "seventh", bars: 5 },
          { practiceType: "walking_bass", mode: "walking_bass", stringSetup: "bass_4_standard", stringCount: 4, progression: "ii-V-I", chordDepth: "seventh", bars: 5, fretMin: 0, fretMax: 7 },
          { practiceType: "pedal_riff", mode: "pedal_riff", key: "E", scale: "natural_minor", progression: "i-VII-VI-VII", chordOverride: "5", bars: 5, fretMin: 0, fretMax: 7 }
        ];
        for (const cfg of progressionCases) {
          const c = Object.assign({}, S.readConfig(), base, cfg);
          const chart = S.generateExercise(c).chart;
          const want = (cfg.bars || base.bars) * 4;
          if (Math.abs((chart.duration || 0) - want) > 0.001) fatal.push(`${cfg.practiceType} progression timeline duration ${chart.duration}, want ${want}`);
        }
        return fatal;
      }));
      rows.push(row("full_neck: NO fg (honesty by omission — no validated source)", () => {
        const fullNeck = gen({ practiceType: "scale", fretboardSystem: "full_neck", key: "C", scale: "major", stringSetup: "guitar_6_standard" });
        all.push(...fullNeck);
        return fullNeck.every((n) => n.fg == null) ? [] : ["full_neck emitted fg — guessed fingering violates the honesty rule"];
      }));
      rows.push(row("bass low box: 1-2-4 regime — ring finger never assigned", () => {
        const bassLow = gen({ practiceType: "scale", fretboardSystem: "position", stringSetup: "bass_4_standard", stringCount: 4, key: "A", scale: "minor_pentatonic", fretMin: 0, fretMax: 4 });
        all.push(...bassLow);
        const fg = bassLow.filter((n) => n.f > 0 && n.fg != null).map((n) => n.fg);
        const fatal = [];
        if (!fg.length) fatal.push("no fingered notes — bass fg emission gone");
        if (fg.includes(3)) fatal.push("finger 3 assigned below the anchor-5 boundary (1-2-4 regime broken)");
        return fatal;
      }));
      rows.push(row("sweep: directional pkd both ways, apex legato pick-transparent", () => {
        // Pin the grid (every sweep rung declares sixteenth): this row used to
        // inherit the form residue, and the 2026-06-12 beginner retune moved the
        // auto-applied first pathway to quarter@60 — where a sweep chart is
        // degenerate (ascending rakes only). The invariant under test is stroke
        // DIRECTION, so the cfg must stand on its own like the economy row.
        const sweep = gen({ practiceType: "sweep_arpeggios", key: "A", scale: "natural_minor", fretMin: 5, fretMax: 17, stringSetup: "guitar_6_standard", stringCount: 6, subdivision: "sixteenth", bpm: 65 });
        all.push(...sweep);
        const sw = sweep.filter((n) => !n.ho && !n.po);
        const fatal = [];
        if (!(sw.some((n) => n.pkd === 0) && sw.some((n) => n.pkd === 1))) fatal.push("sweep pkd is not directional (missing downs or ups)");
        if (!sweep.filter((n) => n.ho || n.po).every((n) => n.pkd == null)) fatal.push("a legato sweep note carries pkd");
        return fatal;
      }));
      rows.push(row("tremolo: strict alternate", () => {
        const trem = gen({ practiceType: "tremolo_picking", key: "E", scale: "natural_minor", stringSetup: "guitar_6_standard" });
        all.push(...trem);
        const okv = trem.length > 4 && trem.every((n, i) => n.pkd === i % 2 || (i > 0 && n.t - trem[i - 1].t > 0.5));
        return okv ? [] : ["tremolo pkd not strict-alternate"];
      }));
      // Stroke-policy engine rows (hand-marks Slice 2): the per-genre schools are
      // pure functions dispatched off cfg.strokePolicy — assert each school's
      // DEFINING invariant (a wrong stroke mark teaches a wrong habit).
      rows.push(row("economy policy: a string crossing continues the travel direction", () => {
        const eco = gen({ practiceType: "scale", strokePolicy: "economy", fretboardSystem: "3nps", shape: 1, key: "C", scale: "major", direction: "ascending", stringSetup: "guitar_6_standard", bpm: 90, subdivision: "sixteenth" });
        all.push(...eco);
        const picked = eco.filter((n) => !n.ho && !n.po && !n.tp);
        const fatal = [];
        let crossings = 0;
        for (let i = 1; i < picked.length; i++) {
          const a = picked[i - 1], b = picked[i];
          if (b.t - a.t > 0.5 || b.s === a.s) continue;
          crossings++;
          const want = b.s > a.s ? 0 : 1;
          if (b.pkd !== want) { fatal.push(`crossing at t=${b.t.toFixed(2)} got pkd=${b.pkd}, want ${want}`); break; }
        }
        if (!crossings) fatal.push("no string crossings generated — bad test config");
        return fatal;
      }));
      rows.push(row("gypsy policy: upstrokes only as same-string fill", () => {
        const gy = gen({ practiceType: "scale", strokePolicy: "gypsy", fretboardSystem: "caged", shape: "E", key: "A", scale: "minor_pentatonic", stringSetup: "guitar_6_standard", bpm: 90, subdivision: "sixteenth" });
        all.push(...gy);
        const picked = gy.filter((n) => !n.ho && !n.po && !n.tp);
        for (let i = 1; i < picked.length; i++) {
          if (picked[i].pkd === 1 && picked[i].s !== picked[i - 1].s) return [`upstroke on a string change at t=${picked[i].t.toFixed(2)} — the rest-stroke school broken`];
        }
        return picked.some((n) => n.pkd === 0) ? [] : ["no strokes emitted"];
      }));
      rows.push(row("metal policy: all-down palm-muted 8ths ≤ ceiling, flips to alternate above", () => {
        const lo = gen({ practiceType: "rhythm_pulse", strokePolicy: "metal", subdivision: "eighth", bpm: 130, key: "E", stringSetup: "guitar_6_drop_d", bars: 4 });
        const hi = gen({ practiceType: "rhythm_pulse", strokePolicy: "metal", subdivision: "eighth", bpm: 200, key: "E", stringSetup: "guitar_6_drop_d", bars: 4 });
        all.push(...lo, ...hi);
        const fatal = [];
        if (!lo.length || !lo.every((n) => n.pkd === 0)) fatal.push("≤170 BPM palm-muted 8ths are not all-down");
        if (!hi.some((n) => n.pkd === 1)) fatal.push(">170 BPM did not flip to alternate (the per-tier flip is the lesson)");
        return fatal;
      }));
      // Slice-2 finish rows: gallop cell strokes (definitive D-DU), bass rh
      // emission per the bass-pedagogy per-class table, and the bass veto on
      // guitar sweep pick logic.
      rows.push(row("gallop cell strokes are definitive: D-DU cycling", () => {
        const gal = gen({ practiceType: "scale", strokePolicy: "alternate", subdivision: "gallop", fretboardSystem: "position", key: "E", scale: "minor_pentatonic", stringSetup: "guitar_6_standard", bpm: 100, fretMin: 0, fretMax: 5 });
        all.push(...gal);
        const picked = gal.filter((n) => !n.ho && !n.po && !n.tp);
        if (picked.length < 6) return ["too few notes to judge the cell"];
        const okv = picked.every((n, i) => n.pkd === (i % 3 === 2 ? 1 : 0));
        return okv ? [] : ["gallop pkd is not the D-D-U cell pattern"];
      }));
      rows.push(row("bass dead-note pocket: i-m parity, GHOSTS COUNT", () => {
        const dng = gen({ practiceType: "dead_note_groove", stringSetup: "bass_4_standard", stringCount: 4, key: "A", bpm: 90 });
        all.push(...dng);
        const fatal = [];
        if (!dng.length || !dng.every((n) => n.rh === 1 || n.rh === 2)) fatal.push("a bass pocket note is missing i/m");
        if (!dng.some((n) => n.mt && n.rh != null)) fatal.push("ghosts are not in the plucking sequence (the 16th motor)");
        return fatal;
      }));
      rows.push(row("bass octave groove: rh BY STRING — i on the root, m on the octave", () => {
        const og = gen({ practiceType: "octave_groove", stringSetup: "bass_4_standard", stringCount: 4, key: "A", bpm: 95 });
        all.push(...og);
        // The builder marks the octave pop accented (ac:!isRoot).
        const okv = og.length > 0 && og.every((n) => (n.ac ? n.rh === 2 : n.rh === 1));
        return okv ? [] : ["octave-groove rh is not role-assigned (i root / m octave)"];
      }));
      rows.push(row("bass slap & pop: region-derived — thumb on the low root (ghosts too), pop above", () => {
        const sp = gen({ practiceType: "slap_pop", stringSetup: "bass_4_standard", stringCount: 4, key: "A", bpm: 90 });
        all.push(...sp);
        const fatal = [];
        if (!sp.length || !sp.every((n) => n.rh === 0 || n.rh === 1)) fatal.push("a slap note carries a non-t/p finger");
        if (!sp.filter((n) => n.mt).every((n) => n.rh === 0)) fatal.push("a dead-thumb ghost isn't marked thumb");
        if (!(sp.some((n) => n.rh === 0) && sp.some((n) => n.rh === 1))) fatal.push("missing thumb or pop marks");
        return fatal;
      }));
      rows.push(row("bass veto: sweeps carry NO pick arrows — i-m/rake instead", () => {
        const bsw = gen({ practiceType: "sweep_arpeggios", stringSetup: "bass_4_standard", stringCount: 4, key: "A", scale: "natural_minor", fretMin: 3, fretMax: 12, bpm: 80 });
        all.push(...bsw);
        const fatal = [];
        if (bsw.some((n) => n.pkd != null)) fatal.push("a bass sweep note carries pkd (guitar sweep pick logic is vetoed on bass)");
        if (!bsw.some((n) => n.rh != null)) fatal.push("bass sweep emitted no plucking marks at all");
        return fatal;
      }));
      rows.push(row("chord-template fingers: never double-booked, wide spans omitted (Slice 3)", () => {
        // The heuristic templates (templateFromPositions) must obey the grip
        // rules: one finger never on two different frets (barre = same fret),
        // and an ungrippable span (>4 frets — an arpeggio tone collection)
        // emits NO fingers at all (honesty by omission).
        const fatal = [];
        const mk = (over) => {
          const cfg = Object.assign(S.readConfig(), { shapeNotes: null }, over);
          cfg.mode = cfg.practiceType;
          return S.generateExercise(cfg).chart.chordTemplates || [];
        };
        const cts = [
          ...mk({ practiceType: "diatonic_arpeggios", fretboardSystem: "position", key: "C", scale: "major", stringSetup: "guitar_6_standard", fretMin: 0, fretMax: 7 }),
          ...mk({ practiceType: "progression_arpeggios", fretboardSystem: "position", key: "A", scale: "natural_minor", progression: "i-VI-III-VII", stringSetup: "guitar_6_standard", fretMin: 0, fretMax: 12 }),
        ];
        if (!cts.length) return ["no templates generated"];
        for (const ct of cts) {
          const fr = ct.frets || [], fi = ct.fingers || [];
          const byFinger = {};
          fi.forEach((f, s) => { if (f > 0) (byFinger[f] = byFinger[f] || new Set()).add(fr[s]); });
          for (const f of Object.keys(byFinger)) {
            if (byFinger[f].size > 1) { fatal.push(`${ct.name}: finger ${f} on ${byFinger[f].size} different frets`); break; }
          }
          const fretted = fr.filter((x) => x > 0);
          if (fretted.length && Math.max(...fretted) - Math.min(...fretted) > 3 && fi.some((x) => x > 0)) {
            fatal.push(`${ct.name}: ungrippable span (${Math.min(...fretted)}–${Math.max(...fretted)}) carries fingers`);
          }
        }
        return fatal;
      }));
      rows.push(row("invariants: pkd/rh exclusive + legato/tapped never picked", () => {
        const fatal = [];
        if (!all.every((n) => !(n.pkd != null && n.rh != null))) fatal.push("a note carries BOTH pkd and rh");
        if (!all.filter((n) => n.ho || n.po || n.tp).every((n) => n.pkd == null)) fatal.push("a legato/tapped note carries pkd");
        return fatal;
      }));
      return rows;
    });
    sections.push({ name: "hand-marks data layer (6)", rows: p6 });
  } finally {
    await browser.close();
  }

  // Report.
  console.log("\n=== Virtuoso generator smoke ===");
  let fatalCount = 0, warnCount = 0, total = 0;
  for (const sec of sections) {
    console.log(`\n-- ${sec.name} --`);
    for (const r of sec.rows) {
      total++;
      const tag = r.ok ? (r.warn.length ? "WARN" : "PASS") : "FAIL";
      if (!r.ok) fatalCount++;
      if (r.ok && r.warn.length) warnCount++;
      const extra = r.notes ? ` notes=${r.notes}` : "";
      console.log(`  [${tag}] ${r.label}${extra}`);
      for (const f of r.fatal) console.log(`         x ${f}`);
      for (const w of r.warn) console.log(`         ~ ${w}`);
    }
  }
  console.log(`\n${total - fatalCount}/${total} generator checks passed (${warnCount} with warnings).`);
  if (fatalCount) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
