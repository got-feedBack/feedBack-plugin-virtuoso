#!/usr/bin/env node
// REAL-audio end-to-end guard for the SCORING system. The only suite that
// exercises the HOST's actual pitch detector + the host-mirror input-level
// silence GATE with actual audio. smoke-gems injects a fake scorer to stay
// target-independent; this suite is the opposite — it asserts real scoring works
// on CURRENT FeedBack, the false-positive bug is dead, AND (2026-06-09 P0 fix)
// that SUSTAINED real playing scores. The host's gate is a level-only ONE-WAY
// veto with NO onset requirement (note_detect :5550-5588), so a held note must
// credit — the onset gate the 2026-06-08 rebuild added rejected sustained/DI
// playing ("graded in FeedBack, not Virtuoso"); this guards against its return.
//
// THREE fake-audio sources (Chromium takes one file per launch → three browsers):
//   • PLUCKED 110 Hz (A2): sharp attack + ring + gap — a transient note must SCORE
//     (positive + chord + the wrong-pitch negative).
//   • STEADY 110 Hz (A2) at full level, NO attack edge — SUSTAINED real playing.
//     It MUST score (the regression guard: the host needs no onset). Also locks
//     the tuner (a sustained tone holds the chip).
//   • SUB-FLOOR 110 Hz (A2) below the 0.02 silence floor — the inaudible-residual
//     false-positive. The level veto must credit ~nothing ("hands-off → 0 credit").
//
// Policy (dev-ops): an SDK-less host is a hard FAIL, not a skip. (host up via
// launch.ps1 — checkout target has the Minigames SDK + note_detect verifier.)
import { chromium } from "playwright";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
let fails = 0;
const ok = (c, l, d) => { console.log(`  [${c ? "PASS" : "FAIL"}] ${l}${d ? "  " + d : ""}`); if (!c) fails++; };

// ── WAV writer: mono 16-bit 44.1k, 30 s (Chromium loops it). ───────────────
const SR = 44100, SECS = 30, FREQ = 110;
function writeWav(path, env) {
  const nSamp = SR * SECS, pcm = Buffer.alloc(nSamp * 2);
  for (let i = 0; i < nSamp; i++) {
    let s = Math.sin(2 * Math.PI * FREQ * (i / SR)) * env(i / SR);
    if (s > 1) s = 1; else if (s < -1) s = -1;
    pcm.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  writeFileSync(path, Buffer.concat([h, pcm]));
}
// PLUCKED: period 0.4s — 4ms attack → decaying ring to 0.33s → gap (a transient note).
const pluckWav = join(tmpdir(), `virtuoso-pluck-a2-${process.pid}.wav`);
writeWav(pluckWav, (t) => { const ph = t % 0.4; if (ph < 0.004) return (ph / 0.004) * 0.7; if (ph < 0.33) return 0.7 * (1 - 0.5 * (ph - 0.004) / 0.326); return 0; });
// STEADY (full level): a CONSTANT-amplitude A2 — no per-note attack edge anywhere,
// the shape of SUSTAINED real playing (esp. a high-gain/compressed DI). The host's
// gate is level-only, so this MUST score (the 2026-06-09 regression guard); it also
// locks the tuner.
const steadyWav = join(tmpdir(), `virtuoso-steady-a2-${process.pid}.wav`);
writeWav(steadyWav, () => 0.5);
// SUB-FLOOR: a steady A2 far below the 0.02 silence floor (web-tap level ≈ rms×5 ≈
// 0.014) — the inaudible idle-residual. The level veto must credit ~nothing.
const subFloorWav = join(tmpdir(), `virtuoso-subfloor-a2-${process.pid}.wav`);
writeWav(subFloorWav, () => 0.004);

const launchArgs = (wav) => ([
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
  `--use-file-for-fake-audio-capture=${wav}`,
  "--autoplay-policy=no-user-gesture-required",
]);

async function openScreen(browser) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  // Seed the L1 instrument store BEFORE page scripts run: the host-settings
  // sync (v0.1.11) treats an empty localStorage as a fresh install and ADOPTS
  // host config — which persists whatever instrument the PREVIOUS suite's panel
  // drives wrote through (cross-suite contamination; the panel flipped to bass
  // mid-suite). With the store seeded, the local-wins boot path holds the
  // deterministic 6-string default AND heals the host config for later suites.
  await page.addInitScript(() => { try { localStorage.setItem("virtuoso.instrument", JSON.stringify({ stringSetup: "guitar_6_standard", customOpenMidis: "" })); } catch (_) {} });
  const pageErrs = [], consoleErrs = [];
  page.on("pageerror", (e) => pageErrs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text()); });
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => typeof window.showScreen === "function");
  await page.evaluate(() => window.showScreen("plugin-virtuoso"));
  await page.waitForSelector("#virtuoso-root", { state: "attached" });
  await page.waitForFunction(() => window.Virtuoso && typeof window.Virtuoso.makeBundle === "function", { timeout: 10000 });
  // Re-add the harness-only 0-bar count-in option (removed from the product UI
  // 2026-06-09 — players always get ≥1) so these real-audio fixtures keep notes
  // at t=0 (the A2 tone aligns predictably). The count-in path is covered by its
  // own smoke-session-sync row, not here.
  await page.evaluate(() => { const c = document.querySelector('#virtuoso-controls [name="countIn"]'); if (c && !c.querySelector('option[value="0"]')) { const o = document.createElement('option'); o.value = '0'; o.textContent = 'None'; c.insertBefore(o, c.firstChild); } });
  return { page, pageErrs, consoleErrs };
}

const setDrill = (page, opts) => page.evaluate((o) => {
  const set = (name, v) => { const el = document.querySelector(`#virtuoso-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
  set("advancedMode", true);
  for (const [k, v] of Object.entries(o)) set(k, v);
  const b = window.Virtuoso.makeBundle(window.Virtuoso.generateExercise(window.Virtuoso.readConfig()));
  window.__e2eBundle = b;
  const n0 = b.notes[0], midi = (b.openMidis[n0.s] || 0) + n0.f;
  return { midi, n: b.notes.length };
}, opts);

const baseDrill = { practiceType: "rhythm_pulse", scale: "minor_pentatonic", stringSetup: "guitar_6_standard", fretboardSystem: "position", meter: "4/4", subdivision: "quarter", bpm: "60", bars: "8", countIn: "0" };

const browser = await chromium.launch({ headless: true, args: launchArgs(pluckWav) });
try {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. launch.ps1 first.`);

  // ══ CONTEXT A — PLUCKED A2 (onsets throughout): real notes must SCORE. ══════
  const { page, pageErrs, consoleErrs } = await openScreen(browser);
  const sdk = await page.waitForFunction(() => typeof window.slopsmithMinigames?.scoring?.createContinuous === "function", { timeout: 5000 }).catch(() => null);
  ok(!!sdk, "scoring SDK present on this host", sdk ? "" : "no Minigames scoring SDK — run against the checkout target (launch.ps1 default)");
  if (!sdk) throw new Error("SDK absent — remaining assertions unprovable on this host.");

  // POSITIVE: key A → every note expects A2 = the plucked tone.
  const expA = await setDrill(page, { ...baseDrill, key: "A" });
  ok(expA.midi === 45, "positive drill note[0] expects A2 (midi 45 = 110 Hz)", `midi=${expA.midi}`);
  await page.click("#virtuoso-play");
  const pos = await page.evaluate(async () => {
    const b = window.__e2eBundle;
    const out = { provider: false, meterShown: false, meterNote: "", meterAcc: "", lit: null };
    for (let i = 0; i < 120; i++) {
      if (b.getNoteStateProvider() !== null) out.provider = true;
      const meter = document.getElementById("virtuoso-pitch-meter");
      if (meter && meter.style.display !== "none") out.meterShown = true;
      const noteEl = document.getElementById("virtuoso-pitch-note");
      if (noteEl && /A2/.test(noteEl.textContent)) out.meterNote = noteEl.textContent;
      const accEl = document.getElementById("virtuoso-pitch-accuracy");
      if (accEl && /^[1-9]/.test(accEl.textContent)) out.meterAcc = accEl.textContent;
      for (const nn of b.notes.slice(0, 10)) { const st = b.getNoteState(nn); if (st === "hit" || st === "active") { out.lit = st; break; } }
      if (out.provider && out.meterNote && out.lit && out.meterAcc) break;
      await new Promise((r2) => setTimeout(r2, 100));
    }
    return out;
  });
  ok(pos.provider, "(1) the REAL host SDK scorer started (provider non-null)");
  ok(pos.meterShown, "(2a) the pitch meter is visible during play");
  ok(!!pos.meterNote, "(2b) the host detector heard the tone as A2", pos.meterNote || "(meter never showed A2)");
  ok(pos.lit === "hit" || pos.lit === "active", "(3) a PLUCKED note scores through the gate (onset + level + pitch)", `state=${pos.lit}`);
  ok(!!pos.meterAcc, "(4) the accuracy readout counts hits", pos.meterAcc || "(no hits counted)");
  await page.evaluate(() => { document.getElementById("virtuoso-stop")?.click(); document.getElementById("virtuoso-results-close")?.click(); });
  await page.waitForTimeout(200);

  // NEGATIVE control (pitch axis): key D → expects D3 (~-500¢ from A2) → NO hit.
  const expD = await setDrill(page, { ...baseDrill, key: "D" });
  ok(expD.midi !== 45, "negative drill expects a different pitch (not A2)", `midi=${expD.midi}`);
  await page.click("#virtuoso-play");
  const neg = await page.evaluate(async () => {
    const b = window.__e2eBundle;
    const out = { provider: false, hit: null };
    for (let i = 0; i < 40; i++) {
      if (b.getNoteStateProvider() !== null) out.provider = true;
      for (const nn of b.notes.slice(0, 6)) { if (b.getNoteState(nn) === "hit") { out.hit = nn.t; break; } }
      if (out.hit != null) break;
      await new Promise((r2) => setTimeout(r2, 100));
    }
    return out;
  });
  ok(neg.provider, "(5a) scorer also runs in the negative control (so the pass below is meaningful)");
  ok(neg.hit == null, "(5b) the WRONG pitch lights nothing (no pass-everything grader)", neg.hit != null ? `note at t=${neg.hit} wrongly hit` : "");
  await page.evaluate(() => { document.getElementById("virtuoso-stop")?.click(); document.getElementById("virtuoso-results-close")?.click(); });
  await page.waitForTimeout(200);

  // (6) CHORD verify path: pedal_riff in A — pedal singles (A2) must score
  // (onsets present); the 2-note power-chord stabs judged via the verifier
  // (PR #4) when present, else exempt.
  const expC = await page.evaluate(() => {
    const set = (name, v) => { const el = document.querySelector(`#virtuoso-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    set("advancedMode", true);
    set("practiceType", "pedal_riff"); set("chordOverride", "5"); set("progression", "static_i");
    set("scale", "natural_minor"); set("key", "A");
    set("stringSetup", "guitar_6_standard"); set("fretboardSystem", "position");
    set("meter", "4/4"); set("subdivision", "eighth"); set("bpm", "60"); set("bars", "8"); set("countIn", "0");
    const b = window.Virtuoso.makeBundle(window.Virtuoso.generateExercise(window.Virtuoso.readConfig()));
    window.__e2eBundle = b;
    const om = b.openMidis || [];
    const byG = new Map();
    for (const n of b.notes) { const k = n.ch != null ? "c" + n.ch : "t" + n.t; if (!byG.has(k)) byG.set(k, []); byG.get(k).push(n); }
    const chord = [...byG.values()].find((g) => g.length > 1) || [];
    const single = [...byG.values()].filter((g) => g.length === 1).map((g) => g[0])[0];
    return { nChord: chord.length, pedalMidi: single ? (om[single.s] || 0) + single.f : -1 };
  });
  ok(expC.nChord >= 2 && expC.pedalMidi === 45, "(6) chord drill structural: 2-note stabs + A2 pedal singles", `chord=${expC.nChord} pedalMidi=${expC.pedalMidi}`);
  await page.click("#virtuoso-play");
  const chordRes = await page.evaluate(async () => {
    const b = window.__e2eBundle;
    const byG = new Map();
    for (const n of b.notes) { const k = n.ch != null ? "c" + n.ch : "t" + n.t; if (!byG.has(k)) byG.set(k, []); byG.get(k).push(n); }
    const chordNotes = [...byG.values()].filter((g) => g.length > 1).flat();   // ALL chord stabs (credit if ANY lands — robust to per-note web-tap onset jitter)
    const singles = [...byG.values()].filter((g) => g.length === 1).map((g) => g[0]).slice(0, 12);
    const out = { singleHit: null, chordLit: null, meterAcc: "" };
    for (let i = 0; i < 90; i++) {
      for (const n of chordNotes) { const st = b.getNoteState(n); if (st === "hit" || st === "active") out.chordLit = "hit"; else if (st === "miss" && out.chordLit == null) out.chordLit = "miss"; }
      if (!out.singleHit) for (const n of singles) { const st = b.getNoteState(n); if (st === "hit" || st === "active") { out.singleHit = st; break; } }
      const accEl = document.getElementById("virtuoso-pitch-accuracy");
      if (accEl && /^[1-9]/.test(accEl.textContent)) out.meterAcc = accEl.textContent;
      if (out.singleHit && out.meterAcc && i > 45) break;
      await new Promise((r2) => setTimeout(r2, 100));
    }
    return out;
  });
  ok(chordRes.singleHit === "hit" || chordRes.singleHit === "active", "(6a) pedal singles score through the real detector in a chord chart", `state=${chordRes.singleHit}`);
  const verifierMode = await page.evaluate(() => typeof window.noteDetect?.setVerifyTarget === "function");
  if (verifierMode) {
    ok(chordRes.chordLit === "hit" || chordRes.chordLit === "active", "(6b·verifier) chord members ARE judged (exemption lifted)", `lit=${chordRes.chordLit}`);
    ok(!!chordRes.meterAcc, "(6c·verifier) accuracy counts chords in the denominator", chordRes.meterAcc || "(no hits counted)");
  } else {
    ok(chordRes.chordLit == null, "(6b) chord members show NO judgment (exempt — shown, not scored)", `lit=${chordRes.chordLit}`);
    ok(!!chordRes.meterAcc, "(6c) accuracy counts the singles (denominator excludes exempt chords)", chordRes.meterAcc || "(no hits counted)");
  }
  await page.evaluate(() => { document.getElementById("virtuoso-stop")?.click(); document.getElementById("virtuoso-results-close")?.click(); });
  await page.waitForTimeout(300);

  // (6d) IDENTITY-TONE REDUCTION (grading rebuild): the verify target pushed to
  // the host is deduped to DISTINCT PITCH CLASSES so an octave-doubled grip can't
  // inflate the host's fixed 0.5 hit-ratio (a wrong-ROOT chord sharing root/5th
  // would otherwise credit). Hook setVerifyTarget on the power-chord drill (which
  // pushes grouped multi-note targets) and assert every pushed target is
  // distinct-PC. Durable contract: Virtuoso never pushes a dup-PC verify target.
  if (verifierMode) {
    await page.evaluate(() => {
      const set = (name, v) => { const el = document.querySelector(`#virtuoso-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
      set("advancedMode", true);
      set("practiceType", "pedal_riff"); set("chordOverride", "5"); set("progression", "static_i");
      set("scale", "natural_minor"); set("key", "A");
      set("stringSetup", "guitar_6_standard"); set("fretboardSystem", "position");
      set("meter", "4/4"); set("subdivision", "eighth"); set("bpm", "60"); set("bars", "8"); set("countIn", "0");
      window.__e2eBundle = window.Virtuoso.makeBundle(window.Virtuoso.generateExercise(window.Virtuoso.readConfig()));
      window.__vt = [];
      const orig = window.noteDetect.setVerifyTarget;
      window.noteDetect.setVerifyTarget = function (notes, ctx) { if (Array.isArray(notes) && notes.length) window.__vt.push(notes.map((n) => ({ s: n.s, f: n.f }))); return orig.call(this, notes, ctx); };
    });
    await page.click("#virtuoso-play");
    const dres = await page.evaluate(async () => {
      for (let i = 0; i < 70; i++) { if (window.__vt.some((t) => t.length > 1) && window.__vt.length >= 3) break; await new Promise((r2) => setTimeout(r2, 100)); }
      const om = window.__e2eBundle.openMidis || [];
      let allDistinct = true, anyMulti = false, maxT = 0;
      for (const t of window.__vt) {
        if (t.length > 1) anyMulti = true;
        if (t.length > maxT) maxT = t.length;
        const pcs = new Set(t.map((n) => ((((om[n.s] || 0) + n.f) % 12) + 12) % 12));
        if (pcs.size !== t.length) allDistinct = false;
      }
      return { count: window.__vt.length, allDistinct, anyMulti, maxT };
    });
    await page.evaluate(() => { document.getElementById("virtuoso-stop")?.click(); document.getElementById("virtuoso-results-close")?.click(); });
    await page.waitForTimeout(200);
    ok(dres.anyMulti, "(6d) multi-note chord verify targets are pushed (the chord path the dedupe guards)", `pushes=${dres.count} maxTargetSize=${dres.maxT}`);
    ok(dres.allDistinct, "(6d·invariant) every pushed verify target has DISTINCT pitch classes (no octave-padding)", `allDistinct=${dres.allDistinct}`);
  }

  const scoringFailures = consoleErrs.filter((e) => /continuous scoring failed to start|failed to set up audio analyser/i.test(e));
  ok(scoringFailures.length === 0, "no scorer-startup failures on the console (pluck ctx)", scoringFailures.slice(0, 2).join(" | "));
  ok(pageErrs.length === 0, "no uncaught page errors (pluck ctx)", pageErrs.slice(0, 2).join(" | "));
  await browser.close();

  // ══ CONTEXT B — STEADY A2 (full level, NO attack edge): SUSTAINED real playing. ══
  // The host gate is level-only (no onset), so a HELD on-pitch note MUST score —
  // the 2026-06-09 P0 regression guard (the rebuild's onset gate made this 0, which
  // rejected sustained/DI playing). The same sustained tone also locks the tuner.
  const browserB = await chromium.launch({ headless: true, args: launchArgs(steadyWav) });
  try {
    const { page: pageB } = await openScreen(browserB);
    await pageB.waitForFunction(() => typeof window.slopsmithMinigames?.scoring?.createContinuous === "function", { timeout: 5000 });
    const expS = await setDrill(pageB, { ...baseDrill, key: "A" });
    ok(expS.midi === 45, "(8·pre) sustained drill note[0] expects A2 (the tone's pitch)", `midi=${expS.midi}`);
    await pageB.click("#virtuoso-play");
    const steady = await pageB.evaluate(async () => {
      const b = window.__e2eBundle;
      const a2count = b.notes.filter((n) => (b.openMidis[n.s] || 0) + n.f === 45).length;
      const out = { provider: false, meterNote: "", credited: 0, total: b.notes.length, a2count };
      for (let i = 0; i < 110; i++) {   // ~11s: several A2 note windows pass under the steady tone
        if (b.getNoteStateProvider() !== null) out.provider = true;
        const noteEl = document.getElementById("virtuoso-pitch-note");
        if (noteEl && /A2/.test(noteEl.textContent)) out.meterNote = noteEl.textContent;
        let c = 0; for (const nn of b.notes) { const st = b.getNoteState(nn); if (st === "hit" || st === "active") c++; }
        if (c > out.credited) out.credited = c;
        await new Promise((r2) => setTimeout(r2, 100));
      }
      return out;
    });
    ok(steady.provider, "(8a) scorer runs on the steady tone (so the pass below is meaningful)");
    ok(!!steady.meterNote, "(8b) the detector hears the sustained A2 (real, audible signal)", steady.meterNote || "(meter never showed A2)");
    ok(steady.a2count >= 2, "(8·pre2) the chart has ≥2 A2 notes the held tone can match (test is meaningful)", `a2count=${steady.a2count}`);
    // P0 REGRESSION GUARD: the host gate is level-only (no onset), so SUSTAINED on-
    // pitch notes must SCORE. The 2026-08 onset gate made this 0 — it had no rising
    // edge to fire — which is exactly how it rejected real sustained/DI playing.
    ok(steady.credited >= 2, "(8c) SUSTAINED-NOTE GUARD: held on-pitch notes SCORE with no onset (onset-gate regression dead)", `credited=${steady.credited} of ${steady.a2count} A2 notes (was 0 under the onset gate)`);
    await pageB.evaluate(() => { document.getElementById("virtuoso-stop")?.click(); document.getElementById("virtuoso-results-close")?.click(); });
    await pageB.waitForTimeout(200);

    // (7) TARGET-AWARE TUNER on the sustained tone — must name + lock A2.
    await pageB.evaluate(() => { document.getElementById("virtuoso-tune-btn")?.click(); });
    const tuner = await pageB.evaluate(async () => {
      const out = { mode: false, chips: 0, note: "", tunedIdx: -1 };
      for (let i = 0; i < 70; i++) {
        const meter = document.getElementById("virtuoso-pitch-meter");
        out.mode = meter.classList.contains("virtuoso-pm-tuner") && meter.style.display !== "none";
        const chips = [...document.querySelectorAll(".virtuoso-tuner-chip")];
        out.chips = chips.length;
        chips.forEach((c, idx) => { if (c.classList.contains("tuned")) out.tunedIdx = idx; });
        const n = document.getElementById("virtuoso-pitch-note");
        if (n && n.textContent !== "--") out.note = n.textContent;
        if (out.tunedIdx >= 0) break;
        await new Promise((r2) => setTimeout(r2, 100));
      }
      document.getElementById("virtuoso-tuner-done")?.click();
      return out;
    });
    ok(tuner.mode && tuner.chips === 6, "(7a) tuner mode: strip shown with 6 target chips", `chips=${tuner.chips}`);
    ok(tuner.note === "A2" && tuner.tunedIdx === 1, "(7b) A2 stream locks the A-string chip tuned (±5¢ hold)", `note=${tuner.note} tuned=${tuner.tunedIdx}`);
  } finally {
    await browserB.close();
  }

  // ══ CONTEXT C — SUB-FLOOR A2 (below the 0.02 silence floor): false-positive. ══
  // The inaudible idle-residual the rebuild targeted. The host-mirror level veto
  // forces a miss on any window whose peak is < 0.02 — so this credits ~nothing,
  // WITHOUT needing an onset (the level floor alone kills the residual).
  const browserC = await chromium.launch({ headless: true, args: launchArgs(subFloorWav) });
  try {
    const { page: pageC } = await openScreen(browserC);
    await pageC.waitForFunction(() => typeof window.slopsmithMinigames?.scoring?.createContinuous === "function", { timeout: 5000 });
    await setDrill(pageC, { ...baseDrill, key: "A" });
    await pageC.click("#virtuoso-play");
    const sub = await pageC.evaluate(async () => {
      const b = window.__e2eBundle;
      const out = { credited: 0, total: b.notes.length };
      for (let i = 0; i < 90; i++) {
        let c = 0; for (const nn of b.notes) { const st = b.getNoteState(nn); if (st === "hit" || st === "active") c++; }
        if (c > out.credited) out.credited = c;
        await new Promise((r2) => setTimeout(r2, 100));
      }
      return out;
    });
    ok(sub.credited <= 2, "(9) FALSE-POSITIVE GUARD: a sub-floor (inaudible) on-pitch tone credits ~nothing (level veto)", `credited=${sub.credited} of ${sub.total} (≤2 = web-tap jitter; the level veto killed the residual)`);
  } finally {
    await browserC.close();
  }
} catch (e) {
  console.error("SUITE ERROR:", e.message);
  fails++;
} finally {
  try { await browser.close(); } catch (_) {}
  try { unlinkSync(pluckWav); } catch (_) {}
  try { unlinkSync(steadyWav); } catch (_) {}
  try { unlinkSync(subFloorWav); } catch (_) {}
}
console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  scoring-e2e: ${fails} failure(s)`);
process.exit(fails ? 1 : 0);
