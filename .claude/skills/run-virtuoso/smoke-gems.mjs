#!/usr/bin/env node
// Guard for the #254 per-note GEM hook (wired 2026-06-04). Virtuoso's bundle exposes
// getNoteState(note)/getNoteStateProvider() so the host highway can light each note's gem
// on a hit/miss from our pitch tracker. This locks the contract so a future screen.js
// change can't silently kill it:
//   1. the bundle exposes real getNoteState + getNoteStateProvider (not the old null stub);
//   2. with NO scorer running, both are inert (provider null, getNoteState null) → no gems,
//      which is the correct no-SDK / not-playing behavior;
//   3. while a scorer runs, getNoteStateProvider() is non-null (the host's "detect-mode" signal);
//   4. a CORRECT pitch lights note[0] ('hit'/'active').
// Target-independent: it injects a FAKE createContinuous + fires a synthetic pitch, so it
// passes on both the bundled (no real SDK) and checkout (real SDK) hosts. countIn is forced
// to 0 so note[0].t = 0 and the synthetic pitch lands in its window. (host up via launch.ps1)
import { chromium } from "playwright";
const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
let fails = 0;
const ok = (c, l, d) => { console.log(`  [${c ? "PASS" : "FAIL"}] ${l}${d ? "  " + d : ""}`); if (!c) fails++; };
// Benign headless noise (autoplay policy, mic-less scoring) — not a gem-path fault.
const BENIGN = [/note detect: mic access denied/i, /audiocontext/i, /failed to set up audio analyser/i, /play\(\) request was interrupted/i, /continuous scoring failed to start/i, /invalidstateerror/i];
const isBenign = (m) => BENIGN.some((re) => re.test(m));

const browser = await chromium.launch({ headless: true });
try {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. launch.ps1 first.`);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    globalThis.__SS_HARNESS__ = true;   // row 6 reads __ss_debug (playhead + window table)
    // This suite drives a FAKE scorer with NO real audio, so the host-mirror
    // input-level/onset gate (which requires real input energy) must stay
    // INACTIVE here — it's covered with REAL audio in smoke-scoring-e2e + the
    // fake-getLevels row below. Reject getUserMedia so the level meter finds no
    // source → mode 'none' → gate off (the gem/timing MODEL is what this tests).
    try { if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("smoke-gems: no mic by design")); } catch (_) {}
  });
  const p = await ctx.newPage();
  // Seed the L1 instrument store BEFORE page scripts run: the host-settings
  // sync (v0.1.11) treats an empty localStorage as a fresh install and ADOPTS
  // host config — which persists whatever instrument the PREVIOUS suite's panel
  // drives wrote through (cross-suite contamination; the panel flipped to bass
  // mid-suite). With the store seeded, the local-wins boot path holds the
  // deterministic 6-string default AND heals the host config for later suites.
  await p.addInitScript(() => { try { localStorage.setItem("virtuoso.instrument", JSON.stringify({ stringSetup: "guitar_6_standard", customOpenMidis: "" })); } catch (_) {} });
  const errs = [];
  p.on("pageerror", e => { if (!isBenign(e.message)) errs.push(e.message); });
  await p.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20000 });
  await p.waitForFunction(() => typeof window.showScreen === "function");
  await p.evaluate(() => window.showScreen("plugin-virtuoso"));
  await p.waitForSelector("#virtuoso-root", { state: "attached" });
  await p.waitForFunction(() => window.Virtuoso && typeof window.Virtuoso.makeBundle === "function");

  // (1)+(2) structural + no-scorer gating (a fresh bundle, nothing playing).
  const s = await p.evaluate(() => {
    const bundle = window.Virtuoso.makeBundle(window.Virtuoso.generateExercise(window.Virtuoso.readConfig()));
    return { gns: typeof bundle.getNoteState, gnp: typeof bundle.getNoteStateProvider,
             provNull: bundle.getNoteStateProvider() === null, stNull: bundle.getNoteState(bundle.notes[0]) === null };
  });
  ok(s.gns === "function" && s.gnp === "function", "bundle exposes getNoteState + getNoteStateProvider (real, not the null stub)");
  ok(s.provNull, "getNoteStateProvider() === null with no scorer running");
  ok(s.stNull, "getNoteState(note) === null with no scorer (no gems = correct no-SDK behavior)");

  // (3)+(4) inject a fake scorer, play, fire a CORRECT synthetic pitch for note[0].
  await p.evaluate(() => {
    // Re-add the harness-only 0-bar count-in option (removed from the product UI
    // 2026-06-09 — players always get ≥1) so this suite's fixture keeps note[0] at
    // t=0; the option persists on the element for the later set("countIn","0") calls.
    const c = document.querySelector('[name="countIn"]'); if (c) { if (!c.querySelector('option[value="0"]')) { const o = document.createElement('option'); o.value = '0'; o.textContent = 'None'; c.insertBefore(o, c.firstChild); } c.value = '0'; c.dispatchEvent(new Event('change', { bubbles: true })); }
    window.__fp = null; window.__run = true;
    // Pin the YIN scoring lane: with the note_detect plugin installed (PR #4
    // verifier-backed scoring), window.noteDetect would put the run in verifier
    // mode and make ptOnPitch display-only — the fake pitch events below would
    // never score. This suite owns the FAKE-YIN gem contract; the verifier lane
    // is covered with REAL audio in smoke-scoring-e2e.
    try { delete window.noteDetect; } catch (_) { window.noteDetect = undefined; }
    window.slopsmithMinigames = window.slopsmithMinigames || {}; window.slopsmithMinigames.scoring = window.slopsmithMinigames.scoring || {};
    window.slopsmithMinigames.scoring.createContinuous = () => ({ on: (e, cb) => { if (e === "pitch") window.__fp = cb; }, stop: () => { window.__run = false; }, isRunning: () => window.__run });
  });
  await p.click("#virtuoso-play"); // generates (countIn=0) + plays + starts the fake tracker
  const h = await p.evaluate(async () => {
    const bundle = window.Virtuoso.makeBundle(window.Virtuoso.generateExercise(window.Virtuoso.readConfig()));
    const om = bundle.openMidis || [], n0 = bundle.notes[0], midi = (om[n0.s] || 0) + n0.f, freq = 440 * Math.pow(2, (midi - 69) / 12);
    let st = null, fired = 0, provActive = false, fadeCredited = false;
    // Fade-frame rejection (feel panel 2026-06-06): conf ≤ 0.85 = a stale YIN
    // fade re-emitting the previous pitch — it must NEVER score, even in-pitch
    // in-window. Fire a burst of fades first and assert nothing lights.
    for (let i = 0; i < 25 && !window.__fp; i++) await new Promise(r2 => setTimeout(r2, 20));
    if (window.__fp) {
      for (let i = 0; i < 4; i++) { window.__fp({ freqHz: freq, confidence: 0.70 }); await new Promise(r2 => setTimeout(r2, 20)); }
      const x0 = bundle.getNoteState(n0); if (x0 === "hit" || x0 === "active") fadeCredited = true;
    }
    for (let i = 0; i < 60; i++) {
      if (bundle.getNoteStateProvider() !== null) provActive = true;   // scorer startup is async — poll, don't snapshot once
      if (window.__fp) { window.__fp({ freqHz: freq, confidence: 0.95 }); fired++; }
      const x = bundle.getNoteState(n0); if (x === "hit" || x === "active") { st = x; break; }
      await new Promise(r2 => setTimeout(r2, 20));
    }
    return { provActive, fired, st, fadeCredited };
  });
  ok(h.provActive, "getNoteStateProvider() !== null while the scorer runs (the host's detect-mode signal)");
  ok(!h.fadeCredited, "fade frames (conf ≤ 0.85) never score — even in-pitch in-window");
  ok(h.st === "hit" || h.st === "active", "a CORRECT pitch lights note[0] (hit/active)", `state=${h.st} fired=${h.fired}`);
  ok(h.fired === 1, "ONE fresh lock commits the hit (the host's single-frame rule)", `fired=${h.fired}`);
  await p.click("#virtuoso-play").catch(() => {});

  // (5) CHORD EXEMPTION (2026-06-05, the DapperTap report): the host detector is
  // monophonic and reports nothing usable for polyphony (probe-chord-detector.mjs),
  // so simultaneous notes (chords/diads) are SHOWN but never pitch-judged — no hit
  // even on a root-matching pitch, and no miss after the window passes. Singles in
  // the same chart stay individually judged. Built from the REAL pedal_riff builder
  // (chordOverride '5' emits 2-note power chords at identical t), never synthetic
  // same-t notes.
  await p.evaluate(() => {
    const set = (name, v) => { const el = document.querySelector(`#virtuoso-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    set("advancedMode", true); set("practiceType", "pedal_riff"); set("chordOverride", "5");
    set("progression", "static_i"); set("scale", "natural_minor"); set("key", "A");
    set("stringSetup", "guitar_6_standard"); set("fretboardSystem", "position");
    set("meter", "4/4"); set("subdivision", "eighth"); set("bpm", "120"); set("bars", "4"); set("countIn", "0");
  });
  await p.click("#virtuoso-play");
  const c5 = await p.evaluate(async () => {
    const b = window.Virtuoso.makeBundle(window.Virtuoso.generateExercise(window.Virtuoso.readConfig()));
    const om = b.openMidis || [];
    const byG = new Map();
    for (const n of b.notes) { const k = n.ch != null ? "c" + n.ch : "t" + n.t; if (!byG.has(k)) byG.set(k, []); byG.get(k).push(n); }
    const groups = [...byG.values()];
    const chordPair = groups.find((g) => g.length > 1) || [];
    const singles = groups.filter((g) => g.length === 1).map((g) => g[0]).slice(0, 8);
    if (!chordPair.length || !singles.length) return { structural: false };
    // In key-A static_i the pedal AND the chord root both expect A2 — one fired
    // pitch stream exercises both judgments at once.
    const root = chordPair.slice().sort((a, b2) => (om[a.s] + a.f) - (om[b2.s] + b2.f))[0];
    const freq = 440 * Math.pow(2, ((om[root.s] + root.f) - 69) / 12);
    let singleHit = null, chordLit = null;
    for (let i = 0; i < 150; i++) {   // ~3s: several chord windows open AND pass
      if (window.__fp) window.__fp({ freqHz: freq, confidence: 0.95 });
      for (const n of chordPair) { const st = b.getNoteState(n); if (st) chordLit = st; }
      if (!singleHit) for (const n of singles) { const st = b.getNoteState(n); if (st === "hit" || st === "active") { singleHit = st; break; } }
      await new Promise((r2) => setTimeout(r2, 20));
    }
    return { structural: true, nChord: chordPair.length, singleHit, chordLit };
  });
  ok(c5.structural, "(5a) chord drill yields chord groups + pedal singles (real builder output)");
  ok(c5.singleHit === "hit" || c5.singleHit === "active", "(5b) singles in a chord chart still judge (pedal lights on correct pitch)", `state=${c5.singleHit}`);
  ok(c5.chordLit == null, "(5c) chord members NEVER judged — no hit on a root-matching pitch, no miss after the window (shown, not scored)", `lit=${c5.chordLit}`);
  await p.click("#virtuoso-play").catch(() => {});

  // (6) TIMING-MODEL acceptance (2026-06-06 seven-lane panel): an ON-TIME player
  // must credit EVERY note of a 160 BPM chromatic 16th run. Structurally
  // impossible under the old first-match/consecutive-streak judge (each window
  // opened ~46ms late and the 80ms streak couldn't fit the 94ms slot); the
  // parallel-window + latency-anchored + evidence-pair model must make it pass.
  // Also asserts the precomputed window table's exclusive bounds are
  // non-overlapping (the by-construction invariant both ears rely on).
  await p.evaluate(() => {
    const set = (name, v) => { const el = document.querySelector(`#virtuoso-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    set("practiceType", "chromatic"); set("stringSetup", "guitar_6_standard");
    set("meter", "4/4"); set("subdivision", "sixteenth"); set("bpm", "160"); set("bars", "2"); set("countIn", "0");
  });
  await p.click("#virtuoso-play");
  const c6 = await p.evaluate(async () => {
    const dbg = globalThis.__ss_debug;
    if (!dbg || typeof dbg.ptPracticeTime !== "function") return { wired: false };
    const b = window.Virtuoso.makeBundle(window.Virtuoso.generateExercise(window.Virtuoso.readConfig()));
    const om = b.openMidis || [];
    const notes = b.notes.filter((n) => !n._tail).sort((a, b2) => a.t - b2.t);
    // window-table invariant: exclusive bounds sorted + non-overlapping
    let contiguous = true;
    const ws = dbg.ptWindows();
    for (let i = 0; i + 1 < ws.length; i++) if (ws[i].exclEnd > ws[i + 1].exclStart + 1e-6) { contiguous = false; break; }
    // drive an on-time perfect player: each ~15ms, fire the pitch of the note
    // under the JUDGE clock (playhead − 80ms detector latency)
    const dur = notes[notes.length - 1].t + 0.6;
    const deadline = performance.now() + dur * 1000 + 4000;
    while (performance.now() < deadline) {
      const tj = dbg.ptPracticeTime() - 0.08;
      if (tj > notes[notes.length - 1].t + 0.3) break;
      let nearest = null, nd = Infinity;
      for (const n of notes) { const d = Math.abs(n.t - tj); if (d < nd) { nd = d; nearest = n; } }
      if (nearest && window.__fp) {
        const midi = (om[nearest.s] || 0) + nearest.f;
        window.__fp({ freqHz: 440 * Math.pow(2, (midi - 69) / 12), confidence: 0.95 });
      }
      await new Promise((r2) => setTimeout(r2, 15));
    }
    const hit = notes.filter((n) => { const st = b.getNoteState(n); return st === "hit" || st === "active"; }).length;
    const info = dbg.ptRunInfo ? dbg.ptRunInfo() : null;
    return { wired: true, contiguous, hit, total: notes.length, nWin: ws.length, exemptFast: info ? info.exemptFast : -1 };
  });
  ok(c6.wired, "(6a) harness debug surface exposes ptPracticeTime + ptWindows");
  ok(c6.contiguous, "(6b) window table exclusive bounds are non-overlapping (by-construction invariant)", `windows=${c6.nWin}`);
  ok(c6.wired && c6.hit === c6.total, "(6c) on-time player credits EVERY note of a 160 BPM chromatic 16th run", `hit=${c6.hit}/${c6.total}`);
  ok(c6.exemptFast === 0, "(6d) the acceptance run stays FULLY per-note judged (legato-ish sus never self-exempts)", `exemptFast=${c6.exemptFast}`);
  await p.click("#virtuoso-play").catch(() => {});

  // (7) SLICE-2 HONESTY LAYER (2026-06-06; docs/timing-judging-roundtable.md):
  // the per-ear tooFast floor (written-staccato rings sus; YIN floor 85ms),
  // the ho/po legato exemption, tremolo SPAN credit (one unit, members light
  // together, ≥60% presence), speakBudget physics, and the pre-run preview's
  // consistency with the live classifier.
  // (7a) written-staccato under the floor → exempt-but-shown, disclosed.
  await p.evaluate(() => {
    const set = (name, v) => { const el = document.querySelector(`#virtuoso-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    set("practiceType", "dead_note_groove"); set("stringSetup", "bass_4_standard");
    set("key", "A"); set("scale", "minor_pentatonic"); set("fretboardSystem", "position"); set("fretMin", "0"); set("fretMax", "7");
    set("meter", "4/4"); set("subdivision", "sixteenth"); set("bpm", "110"); set("bars", "2"); set("countIn", "0");
  });
  await p.click("#virtuoso-play");
  const c7a = await p.evaluate(async () => {
    const dbg = globalThis.__ss_debug;
    for (let i = 0; i < 50 && !dbg.ptRunInfo(); i++) await new Promise((r2) => setTimeout(r2, 20));
    const info = dbg.ptRunInfo();
    const b = window.Virtuoso.makeBundle(window.Virtuoso.generateExercise(window.Virtuoso.readConfig()));
    const prev = dbg.ptPreviewJudgeCounts(b);
    return info ? { fast: info.exemptFast, muted: info.exemptMuted, subFloor: info.exemptSubFloor, judged: info.judged, floorMs: info.floorMs,
                    prevJudged: prev ? prev.judged : -1 } : null;
  });
  ok(c7a && c7a.fast > 0, "(7a) written-staccato 16ths below the YIN floor are exempt-but-shown", c7a ? `fast=${c7a.fast} floor=${c7a.floorMs}ms` : "no run info");
  // On bass in A the dead-thumb ghosts ride the sub-70Hz root string — they're
  // disclosed under SUB-FLOOR there, muted elsewhere. Either way: disclosed.
  ok(c7a && c7a.judged >= 1 && (c7a.muted > 0 || c7a.subFloor > 0), "(7a2) the same chart keeps a judged remainder + discloses its ghosts", c7a ? `judged=${c7a.judged} muted=${c7a.muted} subFloor=${c7a.subFloor}` : "");
  ok(c7a && c7a.prevJudged === c7a.judged, "(7a3) pre-run preview matches the live classifier (the denominator line can't drift)", c7a ? `preview=${c7a.prevJudged} live=${c7a.judged}` : "");
  await p.click("#virtuoso-play").catch(() => {});

  // (7b) legato: ho/po notes exempt; the picked opener stays judged.
  await p.evaluate(() => {
    const set = (name, v) => { const el = document.querySelector(`#virtuoso-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    set("practiceType", "legato"); set("stringSetup", "guitar_6_standard");
    set("meter", "4/4"); set("subdivision", "eighth"); set("bpm", "90"); set("bars", "2"); set("countIn", "0");
  });
  await p.click("#virtuoso-play");
  const c7b = await p.evaluate(async () => {
    const dbg = globalThis.__ss_debug;
    for (let i = 0; i < 50 && !dbg.ptRunInfo(); i++) await new Promise((r2) => setTimeout(r2, 20));
    const info = dbg.ptRunInfo();
    const b = window.Virtuoso.makeBundle(window.Virtuoso.generateExercise(window.Virtuoso.readConfig()));
    const slurred = b.notes.filter((n) => !n._tail && (n.ho || n.po));
    const lit = slurred.some((n) => b.getNoteState(n) != null);
    return info ? { legato: info.exemptLegato, judged: info.judged, slurN: slurred.length, slurLit: lit } : null;
  });
  ok(c7b && c7b.legato > 0 && c7b.slurN > 0, "(7b) slurred (ho/po) notes are exempt-but-shown", c7b ? `legato=${c7b.legato}` : "no run info");
  ok(c7b && !c7b.slurLit && c7b.judged > 0, "(7b2) slurred notes never light gems; picked openers stay judged", c7b ? `judged=${c7b.judged}` : "");
  await p.click("#virtuoso-play").catch(() => {});

  // (7c) tremolo SPAN: one judged unit per same-pitch run; ≥60% in-tune presence
  // credits ALL member gems together; an abandoned span earns nothing.
  await p.evaluate(() => {
    const set = (name, v) => { const el = document.querySelector(`#virtuoso-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    set("practiceType", "tremolo_picking"); set("stringSetup", "guitar_6_standard"); set("scale", "minor_pentatonic"); set("key", "A");
    set("meter", "4/4"); set("subdivision", "sixteenth"); set("bpm", "120"); set("bars", "2"); set("countIn", "0");
  });
  await p.click("#virtuoso-play");
  const c7c = await p.evaluate(async () => {
    const dbg = globalThis.__ss_debug;
    const b = window.Virtuoso.makeBundle(window.Virtuoso.generateExercise(window.Virtuoso.readConfig()));
    const om = b.openMidis || [];
    for (let i = 0; i < 50 && !(dbg.ptWindows() || []).length; i++) await new Promise((r2) => setTimeout(r2, 20));
    const spans = dbg.ptWindows().filter((w) => w.span);
    if (spans.length < 2) return { spans: spans.length };
    const [s1, s2] = spans;
    const freqOf = (w) => { const n = w.notes[0]; return 440 * Math.pow(2, ((om[n.s] + n.f) - 69) / 12); };
    // drive: full presence through span 1; only the first ~30% of span 2.
    const deadline = performance.now() + (s2.spanEnd + 2) * 1000 + 4000;
    while (performance.now() < deadline) {
      const tj = dbg.ptPracticeTime() - 0.08;
      if (tj > s2.spanEnd + 0.3) break;
      if (window.__fp) {
        if (tj >= s1.t - 0.05 && tj <= s1.spanEnd) window.__fp({ freqHz: freqOf(s1), confidence: 0.95 });
        else if (tj >= s2.t && tj <= s2.t + 0.3 * (s2.spanEnd - s2.t)) window.__fp({ freqHz: freqOf(s2), confidence: 0.95 });
      }
      await new Promise((r2) => setTimeout(r2, 15));
    }
    const lit1 = s1.notes.filter((n) => b.getNoteState({ s: n.s, f: n.f, t: n.t }) === "hit").length;
    const lit2 = s2.notes.filter((n) => b.getNoteState({ s: n.s, f: n.f, t: n.t }) === "hit").length;
    return { spans: spans.length, members1: s1.notes.length, lit1, lit2, units: dbg.ptScoredUnits() };
  });
  ok(c7c.spans >= 2, "(7c) tremolo chart collapses to span windows (one per same-pitch run)", `spans=${c7c.spans}`);
  ok(c7c.lit1 === c7c.members1 && c7c.members1 > 2, "(7c2) ≥60% in-tune presence credits ALL span members together (the ribbon)", `lit=${c7c.lit1}/${c7c.members1}`);
  ok(c7c.lit2 === 0, "(7c3) an abandoned span (30% presence) earns nothing", `lit2=${c7c.lit2}`);
  ok(c7c.units === 1, "(7c4) accuracy counts the span as ONE unit, not per-member", `units=${c7c.units}`);
  await p.click("#virtuoso-play").catch(() => {});

  // (7d) speakBudget physics: f0-derived, clamped 35–80ms (D2≈66, A2≈52, G4→35).
  const c7d = await p.evaluate(() => {
    const sb = globalThis.__ss_debug.ptSpeakBudget;
    return { d2: Math.round(sb(73.42) * 1000), a2: Math.round(sb(110) * 1000), g4: Math.round(sb(392) * 1000), b0: Math.round(sb(30.87) * 1000) };
  });
  ok(c7d.d2 >= 60 && c7d.d2 <= 72 && c7d.a2 >= 48 && c7d.a2 <= 56 && c7d.g4 === 35 && c7d.b0 === 80,
    "(7d) speakBudget: D2≈66ms · A2≈52ms · G4 clamps 35 · B0 clamps 80", JSON.stringify(c7d));

  // (8) SLICE-3 A/V auto-calibration (host-mirror sweep, pure): synthetic
  // detections lagging a synthetic chart by a KNOWN latency must recover it
  // (−offset = +latency, ± one 10ms grid step after residual refinement);
  // sparse evidence must return null (no anchor update off a blip).
  const c8 = await p.evaluate(() => {
    const dbg = globalThis.__ss_debug;
    // synthetic windows: 20 quarter notes at midi 45 (A2) on a 0.5s grid —
    // shaped like the real table (span:false, notes:[{s,f}], t).
    const wins = [];
    for (let i = 0; i < 20; i++) wins.push({ t: i * 0.5, span: false, notes: [{ s: 0, f: 5 }] });
    // detections arrive 120ms AFTER each onset, in-pitch.
    const dets = wins.map((w) => ({ bt: w.t + 0.120, m: 45 }));
    const cal = dbg.ptCalibrateOffsetMs(dets, wins);
    const sparse = dbg.ptCalibrateOffsetMs(dets.slice(0, 5), wins.slice(0, 5));
    // octave-tolerant: detections reading the 2nd harmonic (an octave up) still match.
    const octDets = wins.map((w) => ({ bt: w.t + 0.080, m: 57 }));
    const calOct = dbg.ptCalibrateOffsetMs(octDets, wins);
    return { est: cal ? -cal.offsetMs : null, matched: cal ? cal.matched : 0,
             sparseNull: sparse === null, octEst: calOct ? -calOct.offsetMs : null,
             latencyNow: Math.round(dbg.ptLatency() * 1000) };
  });
  ok(c8.est != null && Math.abs(c8.est - 120) <= 12 && c8.matched >= 12, "(8a) the sweep recovers a known 120ms latency from offset-free detections", `est=${c8.est}ms matched=${c8.matched}`);
  ok(c8.sparseNull, "(8b) sparse evidence (<12 matches) returns null — no anchor update off a blip");
  ok(c8.octEst != null && Math.abs(c8.octEst - 80) <= 12, "(8c) octave-tolerant matching (2nd-harmonic readings still calibrate)", `est=${c8.octEst}ms`);
  ok(c8.latencyNow >= 0 && c8.latencyNow <= 250, "(8d) the live anchor stays in the 0–250ms clamp", `anchor=${c8.latencyNow}ms`);

  // (9) BORROWED-HIGHWAY JUDGMENT EVENTS (feel-panel reconciliation 2026-06-07):
  // our judge dispatches the host's notedetect:hit / notedetect:miss window
  // events so the borrowed highway renders its native marks + ±ms/±¢ labels.
  // Contract: hit on credit (label-free); miss at window expiry with the
  // WITNESSED diagnostic (a wrong-pitch fresh frame in-window → SHARP/FLAT);
  // payload {note:{s,f}, noteTime} matches the bundle note; misses need input.
  await p.evaluate(() => {
    const set = (name, v) => { const el = document.querySelector(`#virtuoso-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    set("practiceType", "scale"); set("stringSetup", "guitar_6_standard"); set("fretboardSystem", "position");
    set("key", "A"); set("scale", "minor_pentatonic"); set("fretMin", "0"); set("fretMax", "7");
    set("meter", "4/4"); set("subdivision", "quarter"); set("bpm", "120"); set("bars", "2"); set("countIn", "0");
    window.__ndEvents = [];
    window.__ndCap = (ev) => window.__ndEvents.push({ type: ev.type, d: ev.detail });
    window.addEventListener("notedetect:hit", window.__ndCap);
    window.addEventListener("notedetect:miss", window.__ndCap);
  });
  await p.click("#virtuoso-play");
  const c9 = await p.evaluate(async () => {
    const dbg = globalThis.__ss_debug;
    const b = window.Virtuoso.makeBundle(window.Virtuoso.generateExercise(window.Virtuoso.readConfig()));
    const om = b.openMidis || [];
    const notes = b.notes.filter((n) => !n._tail).sort((a, b2) => a.t - b2.t);
    const freqOf = (n) => 440 * Math.pow(2, ((om[n.s] || 0) + n.f - 69) / 12);
    // hit note[0] correctly; play note[1] a tritone SHARP (wrong, in-window);
    // give note[2] nothing. Then let their windows expire.
    const deadline = performance.now() + 6000;
    while (performance.now() < deadline) {
      const tj = dbg.ptPracticeTime() - 0.08;
      if (tj > notes[2].t + 1.2) break;
      if (window.__fp) {
        if (Math.abs(tj - notes[0].t) < 0.05) window.__fp({ freqHz: freqOf(notes[0]), confidence: 0.95 });
        else if (Math.abs(tj - notes[1].t) < 0.05) window.__fp({ freqHz: freqOf(notes[1]) * Math.pow(2, 6 / 12), confidence: 0.95 });
      }
      await new Promise((r2) => setTimeout(r2, 15));
    }
    window.removeEventListener("notedetect:hit", window.__ndCap);
    window.removeEventListener("notedetect:miss", window.__ndCap);
    const evs = window.__ndEvents;
    const hit0 = evs.find((e) => e.type === "notedetect:hit" && Math.abs(e.d.noteTime - notes[0].t) < 0.01);
    const miss1 = evs.find((e) => e.type === "notedetect:miss" && Math.abs(e.d.noteTime - notes[1].t) < 0.01);
    const miss2 = evs.find((e) => e.type === "notedetect:miss" && Math.abs(e.d.noteTime - notes[2].t) < 0.01);
    return {
      n: evs.length,
      hit0: hit0 ? { s: hit0.d.note.s === notes[0].s, f: hit0.d.note.f === notes[0].f, noLabel: hit0.d.timingState == null && hit0.d.pitchState == null } : null,
      miss1: miss1 ? { pitchState: miss1.d.pitchState, err: miss1.d.pitchError } : null,
      miss2: miss2 ? { bare: miss2.d.timingState == null && miss2.d.pitchState == null } : null,
    };
  });
  ok(c9.hit0 && c9.hit0.s && c9.hit0.f && c9.hit0.noLabel, "(9a) credit dispatches notedetect:hit with matching {s,f,noteTime}, label-free", JSON.stringify(c9.hit0));
  ok(c9.miss1 && c9.miss1.pitchState === "SHARP" && c9.miss1.err > 60, "(9b) a witnessed wrong-pitch miss carries the SHARP ±¢ label", JSON.stringify(c9.miss1));
  ok(c9.miss2 && c9.miss2.bare, "(9c) an unplayed note's miss dispatches mark-only (no fabricated diagnostics)", JSON.stringify(c9.miss2));
  await p.click("#virtuoso-play").catch(() => {});

  // (10) HOST-TUNER WINDOW INHERIT (2026-06-07): the judge's timing windows
  // come from note_detect's saved sliders in localStorage['slopsmith_notedetect']
  // (Clean Timing / chord window, host clamp chain incl. timingTolerance),
  // read per run, inherit-never-write; absent key = the shipped ±100/±150ms.
  const winDiff = async () => p.evaluate(async () => {
    const dbg = globalThis.__ss_debug;
    for (let i = 0; i < 50 && !(dbg.ptWindows() || []).length; i++) await new Promise((r2) => setTimeout(r2, 20));
    const ws = dbg.ptWindows();
    if (!ws.length) return null;
    return +(ws[0].t - ws[0].matchStart).toFixed(3);
  });
  await p.evaluate(() => {
    const set = (name, v) => { const el = document.querySelector(`#virtuoso-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    set("practiceType", "chromatic"); set("subdivision", "quarter"); set("bpm", "120"); set("bars", "2"); set("countIn", "0");
    localStorage.setItem("slopsmith_notedetect", JSON.stringify({ timingTolerance: 0.25, timingHitThreshold: 0.2 }));
  });
  await p.click("#virtuoso-play");
  const inherited = await winDiff();
  // The transport split: Play mid-run = PAUSE (resume keeps the window table).
  // STOP ends the run so the next Play rebuilds windows + re-reads the inherit.
  await p.click("#virtuoso-stop").catch(() => {});
  await p.evaluate(() => localStorage.removeItem("slopsmith_notedetect"));
  await p.click("#virtuoso-play");
  const dflt = await winDiff();
  await p.click("#virtuoso-stop").catch(() => {});
  ok(inherited === 0.2, "(10a) a widened host Clean Timing slider widens the judge window (±200ms inherited)", `got ${inherited}`);
  ok(dflt === 0.1, "(10b) no host tuner settings = the shipped ±100ms default", `got ${dflt}`);

  ok(errs.length === 0, "no page errors from the gem path", errs.join(" | "));

  console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  gems: ${fails} failure(s)`);
  process.exit(fails ? 1 : 0);
} finally {
  await browser.close();
}
