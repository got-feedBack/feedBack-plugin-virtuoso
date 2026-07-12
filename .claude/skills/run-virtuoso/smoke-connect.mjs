#!/usr/bin/env node
// Assertive guard: the "Connect" keystone (playing-the-changes Stage 1). The
// chord_scales / mode_of_moment strategy must VOICE-LEAD — each new chord's run
// starts on the nearest GUIDE TONE (3rd/7th) to the previous note, NOT a restart
// on the chord root, and the seam interval stays small (a real connector, often a
// common-tone pivot). Regression guard for the buildChordScaleExercise rework
// (2026-06-01) that replaced the root-restart with nearestPositionForPc-style
// voice-leading. PASS/FAIL, non-zero exit on failure. (host up via launch.ps1.)
import { chromium } from "playwright";
const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
let fails = 0;
const ok = (c, l, d) => { console.log(`  [${c ? "PASS" : "FAIL"}] ${l}${d ? "  " + d : ""}`); if (!c) fails++; };

const PC = { C:0, "C#":1, Db:1, D:2, "D#":3, Eb:3, E:4, F:5, "F#":6, Gb:6, G:7, "G#":8, Ab:8, A:9, "A#":10, Bb:10, B:11 };
const OPENS_6 = [40, 45, 50, 55, 59, 64]; // guitar_6_standard E A D G B e
const rootPcOf = (name) => { const m = /^([A-G])([#b]?)/.exec(name); return m ? PC[m[1] + (m[2] || "")] : null; };

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
  await page.waitForSelector("#virtuoso-view-select");
  await page.waitForFunction(() => window.Virtuoso && typeof window.Virtuoso.generateExercise === "function", { timeout: 10000 });

  const run = (form) => page.evaluate((f) => {
    const setForm = (o) => { for (const [k, v] of Object.entries(o)) { const el = document.querySelector(`#virtuoso-controls [name="${k}"]`); if (el) el.value = String(v); } };
    const adv = document.querySelector('[name="advancedMode"]'); if (adv) { adv.checked = true; adv.dispatchEvent(new Event("change", { bubbles: true })); }
    setForm(f);
    const e = window.Virtuoso.generateExercise(window.Virtuoso.readConfig());
    return { notes: e.chart.notes.map(n => ({ t: n.t, s: n.s, f: n.f })), sections: (e.chart.sections || []).map(x => ({ name: x.name, time: x.time })), chords: (e.chart.chords || []).map(c => ({ t: c.t })) };
  }, form);

  // Largest interval between TIME-CONSECUTIVE notes across the whole run. The
  // pre-existing intra-bar wrap bug produced ~29-39st leaps here; legit motion
  // (in-box steps + voice-led seams + reflective turnarounds) stays well under an
  // octave. Guards the reflectIdx fix against regression.
  const maxConsecutive = (notes) => {
    const seq = notes.slice().sort((a, b) => a.t - b.t).map(n => OPENS_6[n.s] + n.f);
    let mx = 0;
    for (let i = 1; i < seq.length; i++) mx = Math.max(mx, Math.abs(seq[i] - seq[i - 1]));
    return mx;
  };

  const ex = await run({ stringSetup: "guitar_6_standard", practiceType: "chord_scales", chordScaleStrategy: "mode_of_moment", progression: "ii-V-I", key: "C", scale: "major", chordDepth: "seventh", chordOverride: "auto", fretboardSystem: "caged", shape: "E", subdivision: "eighth", bars: "6", direction: "up_down", sequence: "none" });

  // Group notes into bars by chord start time; first/last note per bar.
  const bars = ex.chords.map((c, i) => {
    const next = ex.chords[i + 1] ? ex.chords[i + 1].t : Infinity;
    const inBar = ex.notes.filter(n => n.t >= c.t - 1e-4 && n.t < next - 1e-4).sort((a, b) => a.t - b.t);
    const sec = ex.sections.find(s => Math.abs(s.time - c.t) < 1e-3);
    return { t: c.t, name: sec ? sec.name : null, notes: inBar };
  }).filter(b => b.notes.length);

  console.log(`-- chord_scales / Connect (mode_of_moment), ii-V-I in C, ${bars.length} chords --`);
  let rootStarts = 0, guideStarts = 0, checked = 0, maxSeam = 0;
  let prevLastMidi = null;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const first = b.notes[0];
    const firstMidi = OPENS_6[first.s] + first.f;
    const firstPc = firstMidi % 12;
    const rootPc = rootPcOf(b.name);
    const iv = rootPc == null ? null : ((firstPc - rootPc) + 12) % 12;
    const isRoot = iv === 0;
    const isGuide = iv === 3 || iv === 4 || iv === 10 || iv === 11; // 3rd or 7th
    const tag = i === 0 ? "(open)" : (isRoot ? "ROOT" : (isGuide ? "guide" : `iv=${iv}`));
    let seam = "";
    if (i > 0 && prevLastMidi != null) { const d = Math.abs(firstMidi - prevLastMidi); maxSeam = Math.max(maxSeam, d); seam = ` seam=${d}st`; }
    console.log(`  bar ${i} ${String(b.name).padEnd(7)} starts on ${tag}${seam}`);
    if (i > 0) { checked++; if (isRoot) rootStarts++; if (isGuide) guideStarts++; }
    const last = b.notes[b.notes.length - 1];
    prevLastMidi = OPENS_6[last.s] + last.f;
  }

  ok(rootStarts === 0, "no chord (after the first) restarts the run on its root", `${rootStarts}/${checked} were root-starts`);
  ok(guideStarts >= Math.ceil(checked * 0.75), "most changes land on a guide tone (3rd/7th)", `${guideStarts}/${checked} guide-tone landings`);
  ok(maxSeam > 0 && maxSeam <= 7, "seam interval stays small (voice-leading, not a jump)", `max seam ${maxSeam}st`);

  console.log("-- intra-bar leap guard (the pre-existing modulo-wrap bug; stress configs) --");
  const baseMx = maxConsecutive(ex.notes);
  ok(baseMx <= 13, "ii-V-I run has no teleport leap", `max consecutive ${baseMx}st`);
  // Sparse box + fast subdivision: minor-pentatonic CAGED at 16ths (few notes/box,
  // many notes/bar — the case that wrapped multiple times).
  const sparse = await run({ stringSetup: "guitar_6_standard", practiceType: "chord_scales", chordScaleStrategy: "mode_of_moment", progression: "12_bar_blues", key: "A", scale: "minor_pentatonic", chordDepth: "seventh", chordOverride: "dom7", fretboardSystem: "caged", shape: "E", subdivision: "sixteenth", bars: "6", direction: "up_down", sequence: "none" });
  const sparseMx = maxConsecutive(sparse.notes);
  ok(sparseMx <= 13, "sparse pentatonic @16ths has no teleport leap", `max consecutive ${sparseMx}st`);
  // Wide window: full-neck-ish position range.
  const wide = await run({ stringSetup: "guitar_6_standard", practiceType: "chord_scales", chordScaleStrategy: "mode_of_moment", progression: "ii-V-I", key: "C", scale: "major", chordDepth: "seventh", chordOverride: "auto", fretboardSystem: "position", fretMin: "0", fretMax: "15", subdivision: "eighth", bars: "6", direction: "up_down", sequence: "none" });
  const wideMx = maxConsecutive(wide.notes);
  ok(wideMx <= 13, "wide 0-15 position window has no teleport leap", `max consecutive ${wideMx}st`);
  // Park (chord_tone_emphasis) shared the bug — guard it too.
  const park = await run({ stringSetup: "guitar_6_standard", practiceType: "chord_scales", chordScaleStrategy: "chord_tone_emphasis", progression: "12_bar_blues", key: "A", scale: "minor_pentatonic", chordDepth: "seventh", chordOverride: "dom7", fretboardSystem: "caged", shape: "E", subdivision: "sixteenth", bars: "6", direction: "up_down", sequence: "none" });
  const parkMx = maxConsecutive(park.notes);
  ok(parkMx <= 13, "Park strategy also has no teleport leap", `max consecutive ${parkMx}st`);

  console.log("-- Connect + enclosure (bebop): the two notes before each change are the target's chromatic neighbours --");
  // Key A (E-shape box sits ~fret 5-9, mid-neck) so most targets are off the nut and the enclosure is eligible.
  const enc = await run({ stringSetup: "guitar_6_standard", practiceType: "chord_scales", chordScaleStrategy: "mode_of_moment_enclose", progression: "ii-V-I", key: "A", scale: "major", chordDepth: "seventh", chordOverride: "auto", fretboardSystem: "caged", shape: "E", subdivision: "eighth", bars: "8", direction: "up_down", sequence: "none" });
  const encSorted = enc.notes.slice().sort((a, b) => a.t - b.t);
  let encApplied = 0, encCrossUni = 0;
  for (let i = 1; i < enc.chords.length; i++) {
    const j = encSorted.findIndex(n => Math.abs(n.t - enc.chords[i].t) < 1e-3);
    if (j < 2) continue;
    const target = encSorted[j], above = encSorted[j - 2], below = encSorted[j - 1];
    // Was the enclosure actually applied here? (skipped at nut/edge or by the
    // cross-string-feed guard — both legitimate, so don't demand every change.)
    const isEnc = above.s === target.s && above.f === target.f + 1 && below.s === target.s && below.f === target.f - 1;
    if (!isEnc) continue;
    encApplied++;
    // Among APPLIED enclosures, the note feeding the upper neighbour must not be
    // the same pitch on a different string (the artifact the guard prevents).
    if (j >= 3) { const feed = encSorted[j - 3]; if (feed.s !== above.s && (OPENS_6[feed.s] + feed.f) === (OPENS_6[above.s] + above.f)) encCrossUni++; }
  }
  ok(encApplied >= 3, "the bebop enclosure fires on most changes ([target+1, target-1] on the target's string)", `${encApplied} applied`);
  ok(encCrossUni === 0, "no applied enclosure feeds a cross-string unison (guard works)", `${encCrossUni} found`);
  ok(maxConsecutive(enc.notes) <= 13, "enclosure run has no teleport leap", `max consecutive ${maxConsecutive(enc.notes)}st`);
  // chordScalePositions dedupe: no two consecutive notes WITHIN a bar re-sound the
  // same pitch on different strings (the no-unison rule, applied to chord-scale
  // runs). Seams are skipped — a common-tone pivot across the bar line is allowed.
  const barOf = (t) => { let b = 0; for (let k = 0; k < enc.chords.length; k++) if (t >= enc.chords[k].t - 1e-4) b = k; return b; };
  let inBarCrossUni = 0;
  for (let i = 1; i < encSorted.length; i++) {
    const a = encSorted[i - 1], b = encSorted[i];
    if (barOf(a.t) !== barOf(b.t)) continue;
    if (a.s !== b.s && (OPENS_6[a.s] + a.f) === (OPENS_6[b.s] + b.f)) inBarCrossUni++;
  }
  ok(inBarCrossUni === 0, "no within-bar cross-string unison (chord-scale run is one-per-pitch)", `${inBarCrossUni} found`);

  ok(pageErrs.length === 0, "no uncaught page errors", pageErrs.join(" | "));
  console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  connect keystone: ${fails} failure(s)`);
  process.exit(fails ? 1 : 0);
} finally {
  await browser.close();
}
