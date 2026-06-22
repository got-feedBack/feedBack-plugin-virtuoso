#!/usr/bin/env node
// Guard for the CONTAINED-PLAYBACK VERIFIER scoring path (the desktop engine
// harmonic-comb NoteVerifier, the same one the 3D highway rides). On a real
// desktop build Virtuoso pushes its exercise chart + playhead to the host's
// note_detect contained API (setContainedChart / pushContainedPlayhead /
// drainContainedVerdicts) and credits engine-finalized per-note verdicts —
// instead of the timing-free setVerifyTarget. The native engine is desktop-only,
// so this suite injects a MOCK window.noteDetect contained API that returns
// scripted verdicts, and asserts Virtuoso's INTEGRATION:
//   1. with the contained API present, the run enters _ndContainedMode (not the
//      setVerifyTarget fallback);
//   2. detected:true verdicts CREDIT their notes (_ptScoredUnits grows + gems
//      light) — with NO host level source, proving the engine owns the silence
//      gate (the homegrown level veto is bypassed, ptCreditGatePasses);
//   3. a chord window credits via N-of-M from per-member verdicts;
//   4. detected:false verdicts credit NOTHING (no pass-everything grader);
//   5. a LATE verdict (arriving after a local window would expire) STILL
//      credits — the engine owns timing, no local cursor may race it. This is
//      the standing guard for the consume-only rule: if a parallel timing-judge
//      is ever re-introduced it race-misses these and (5) goes red.
// Target-independent: the mock provides the whole contained API, so this runs on
// ANY host that has Virtuoso loaded — it does NOT need a desktop build or the
// updated note_detect branch. (host up via launch.ps1 / a local server.)
import { chromium } from "playwright";
const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
let fails = 0;
const ok = (c, l, d) => { console.log(`  [${c ? "PASS" : "FAIL"}] ${l}${d ? "  " + d : ""}`); if (!c) fails++; };
const BENIGN = [/note detect/i, /audiocontext/i, /failed to set up audio analyser/i, /play\(\) request was interrupted/i, /continuous scoring/i, /invalidstateerror/i, /mic access/i];
const isBenign = (m) => BENIGN.some((re) => re.test(m));

// The mock contained-verifier engine, installed as window.noteDetect. Scripts
// verdicts: pushContainedPlayhead(t) finalizes each charted note once the
// playhead passes its onset; drainContainedVerdicts returns them. `mode='hit'`
// → detected:true; `mode='none'` → detected:false (the negative control).
const INSTALL_MOCK = () => {
  const engine = { chart: null, done: new Set(), buf: [], mode: "hit", pushes: 0, armed: 0 };
  window.__mockEngine = engine;
  // Override any real note_detect: this suite owns the contained lane.
  window.noteDetect = {
    isEnabled: () => true,
    enable: async () => true,
    disable: () => {},
    // presence makes Virtuoso's ndVerifyAvailable() true (umbrella verifier mode)
    setVerifyTarget: () => {},
    getVerifyContext: () => null,
    isContainedVerifierAvailable: () => true,
    setContainedChart: async (notes) => { engine.chart = Array.isArray(notes) ? notes : []; engine.done = new Set(); engine.buf = []; engine.armed++; return true; },
    pushContainedPlayhead: async (t) => {
      engine.pushes++;
      if (!engine.chart) return;
      for (const n of engine.chart) {
        if (typeof t === "number" && t >= n.t && !engine.done.has(n.id)) {
          engine.done.add(n.id);
          engine.buf.push({ id: n.id, detected: engine.mode === "hit", detectedSongTime: n.t, centsError: 0, snr: 8 });
        }
      }
    },
    drainContainedVerdicts: () => { const o = engine.buf; engine.buf = []; return o; },
    releaseContainedChart: () => { engine.chart = null; },
  };
};

const baseDrill = { advancedMode: true, practiceType: "rhythm_pulse", scale: "minor_pentatonic", stringSetup: "guitar_6_standard", fretboardSystem: "position", meter: "4/4", subdivision: "quarter", bpm: "120", bars: "4", countIn: "0", key: "A" };
const applyDrill = (page, opts) => page.evaluate((o) => {
  const set = (name, v) => { const el = document.querySelector(`#virtuoso-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
  for (const [k, v] of Object.entries(o)) set(k, v);
  const b = window.Virtuoso.makeBundle(window.Virtuoso.generateExercise(window.Virtuoso.readConfig()));
  window.__e2eBundle = b;
  return { n: b.notes.length };
}, opts);

const browser = await chromium.launch({ headless: true });
try {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. launch.ps1 first.`);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    globalThis.__SS_HARNESS__ = true;   // expose __ss_debug (ndContainedMode / ptScoredUnits)
    // No mic by design — proves the contained path credits with NO host level
    // source (the engine owns the silence gate; the homegrown level veto is
    // bypassed). getUserMedia rejection → level meter mode 'none'.
    try { if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("smoke-contained: no mic by design")); } catch (_) {}
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => { if (!isBenign(e.message)) errs.push(e.message); });
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => typeof window.showScreen === "function");
  await page.evaluate(() => window.showScreen("plugin-virtuoso"));
  await page.waitForSelector("#virtuoso-root", { state: "attached" });
  await page.waitForFunction(() => window.Virtuoso && typeof window.Virtuoso.makeBundle === "function" && globalThis.__ss_debug);
  // Re-add the harness-only 0-bar count-in (note[0] at t=0).
  await page.evaluate(() => { const c = document.querySelector('[name="countIn"]'); if (c && !c.querySelector('option[value="0"]')) { const o = document.createElement('option'); o.value = '0'; o.textContent = 'None'; c.insertBefore(o, c.firstChild); } });

  // ══ POSITIVE: detected:true verdicts credit through the contained path. ══════
  await page.evaluate(INSTALL_MOCK);
  const single = await applyDrill(page, baseDrill);
  ok(single.n > 0, "positive drill has judged notes", `n=${single.n}`);
  await page.click("#virtuoso-play");
  const pos = await page.evaluate(async () => {
    const D = globalThis.__ss_debug, b = window.__e2eBundle;
    const out = { contained: false, fallback: false, scored: 0, lit: null, armed: 0, pushes: 0 };
    for (let i = 0; i < 120; i++) {
      if (D.ndContainedMode()) out.contained = true;
      if (D.ndContainedFallback && D.ndContainedFallback()) out.fallback = true;
      out.scored = Math.max(out.scored, D.ptScoredUnits());
      for (const nn of b.notes.slice(0, 12)) { const st = b.getNoteState(nn); if (st === "hit" || st === "active") { out.lit = st; break; } }
      if (out.contained && out.scored > 0 && out.lit) break;
      await new Promise((r2) => setTimeout(r2, 100));
    }
    out.armed = window.__mockEngine.armed; out.pushes = window.__mockEngine.pushes;
    return out;
  });
  ok(pos.armed >= 1, "(setup) Virtuoso armed the contained chart (setContainedChart called)", `armed=${pos.armed}`);
  ok(pos.pushes >= 1, "(setup) Virtuoso drove the engine clock (pushContainedPlayhead called)", `pushes=${pos.pushes}`);
  ok(pos.contained && !pos.fallback, "(1) run entered the contained verifier path, NOT the setVerifyTarget fallback", `contained=${pos.contained} fallback=${pos.fallback}`);
  ok(pos.scored > 0, "(2) detected:true verdicts CREDIT (level veto bypassed — no host mic source)", `scoredUnits=${pos.scored}`);
  ok(pos.lit === "hit" || pos.lit === "active", "(2b) credited notes light their gems", `state=${pos.lit}`);
  await page.evaluate(() => { document.getElementById("virtuoso-stop")?.click(); document.getElementById("virtuoso-results-close")?.click(); });
  await page.waitForTimeout(200);

  // ══ CHORD: a power-chord window credits via N-of-M from per-member verdicts. ═
  await page.evaluate(INSTALL_MOCK);
  const chordInfo = await page.evaluate(() => {
    const set = (name, v) => { const el = document.querySelector(`#virtuoso-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
    set("advancedMode", true); set("practiceType", "pedal_riff"); set("chordOverride", "5"); set("progression", "static_i");
    set("scale", "natural_minor"); set("key", "A"); set("stringSetup", "guitar_6_standard"); set("fretboardSystem", "position");
    set("meter", "4/4"); set("subdivision", "eighth"); set("bpm", "120"); set("bars", "4"); set("countIn", "0");
    const b = window.Virtuoso.makeBundle(window.Virtuoso.generateExercise(window.Virtuoso.readConfig()));
    window.__e2eBundle = b;
    const byG = new Map();
    for (const n of b.notes) { const k = n.ch != null ? "c" + n.ch : "t" + n.t; if (!byG.has(k)) byG.set(k, []); byG.get(k).push(n); }
    return { nChord: ([...byG.values()].find((g) => g.length > 1) || []).length };
  });
  ok(chordInfo.nChord >= 2, "chord drill has ≥2-note stabs", `chord=${chordInfo.nChord}`);
  await page.click("#virtuoso-play");
  const chord = await page.evaluate(async () => {
    const b = window.__e2eBundle;
    const byG = new Map();
    for (const n of b.notes) { const k = n.ch != null ? "c" + n.ch : "t" + n.t; if (!byG.has(k)) byG.set(k, []); byG.get(k).push(n); }
    const chordNotes = [...byG.values()].filter((g) => g.length > 1).flat();
    let lit = null;
    for (let i = 0; i < 120; i++) {
      for (const n of chordNotes) { const st = b.getNoteState(n); if (st === "hit" || st === "active") { lit = "hit"; break; } }
      if (lit) break;
      await new Promise((r2) => setTimeout(r2, 100));
    }
    return { lit };
  });
  ok(chord.lit === "hit", "(3) chord members credit via N-of-M from per-member verdicts", `lit=${chord.lit}`);
  await page.evaluate(() => { document.getElementById("virtuoso-stop")?.click(); document.getElementById("virtuoso-results-close")?.click(); });
  await page.waitForTimeout(200);

  // ══ NEGATIVE: detected:false verdicts credit NOTHING. ═══════════════════════
  await page.evaluate(INSTALL_MOCK);
  await page.evaluate(() => { window.__mockEngine.mode = "none"; });
  await applyDrill(page, baseDrill);
  await page.click("#virtuoso-play");
  const neg = await page.evaluate(async () => {
    const D = globalThis.__ss_debug, b = window.__e2eBundle;
    let scored = 0, lit = null;
    // Same 120-iteration (~12s) budget as the positive run: the negative has no
    // early break (it's proving NOTHING scores), so it must give playback the
    // same time to actually run — a shorter budget could pass trivially if
    // startup is slow (nothing scored only because nothing ran yet).
    for (let i = 0; i < 120; i++) {
      scored = Math.max(scored, D.ptScoredUnits());
      for (const nn of b.notes.slice(0, 12)) { if (b.getNoteState(nn) === "hit") { lit = nn.t; break; } }
      if (lit != null) break;
      await new Promise((r2) => setTimeout(r2, 100));
    }
    return { scored, lit, pushes: window.__mockEngine.pushes };
  });
  ok(neg.pushes >= 1, "(setup) the negative run also drove the engine clock (so the pass is meaningful)", `pushes=${neg.pushes}`);
  ok(neg.scored === 0 && neg.lit == null, "(4) detected:false verdicts credit NOTHING (no pass-everything grader)", `scored=${neg.scored} lit=${neg.lit}`);
  await page.evaluate(() => { document.getElementById("virtuoso-stop")?.click(); });
  await page.waitForTimeout(200);

  // ══ RACE-IMMUNITY (the consume-only rule): the ENGINE owns timing. A verdict
  //    that arrives LATE — after a local match window would have expired — must
  //    STILL credit. A re-introduced parallel timing-judge race-misses the
  //    window before the async verdict lands (the desktop-DI ~0-credit
  //    regression fixed in 0.7.43: only a stray FIRST note credited). This pins
  //    credit == the engine's verdicts, never a local timing cursor. If this
  //    goes red, someone re-added a judge on top of note_detect — see CLAUDE.md
  //    "Consume the host judge (no parallel grader)".
  await page.evaluate(INSTALL_MOCK);
  await page.evaluate(() => {
    const e = window.__mockEngine;
    // Finalize each note 0.8s LATE — well past any local match window
    // (rhythm_pulse quarters: matchEnd ≈ onset + ~0.5s).
    window.noteDetect.pushContainedPlayhead = async (t) => {
      e.pushes++;
      if (!e.chart) return;
      for (const n of e.chart) {
        if (typeof t === "number" && t >= n.t + 0.8 && !e.done.has(n.id)) {
          e.done.add(n.id);
          e.buf.push({ id: n.id, detected: true, detectedSongTime: n.t, centsError: 0, snr: 8 });
        }
      }
    };
  });
  const lateN = await applyDrill(page, baseDrill);
  ok(lateN.n > 0, "late-verdict drill has judged notes", `n=${lateN.n}`);
  await page.click("#virtuoso-play");
  const late = await page.evaluate(async () => {
    const D = globalThis.__ss_debug;
    let scored = 0;
    for (let i = 0; i < 160; i++) {
      scored = Math.max(scored, D.ptScoredUnits());
      await new Promise((r2) => setTimeout(r2, 100));
    }
    return { scored, done: window.__mockEngine.done.size };
  });
  await page.evaluate(() => { document.getElementById("virtuoso-stop")?.click(); document.getElementById("virtuoso-results-close")?.click(); });
  ok(late.done >= 3, "(setup) the late run finalized multiple verdicts", `done=${late.done}`);
  ok(late.scored >= 3 && late.scored >= late.done - 1, "(5) LATE verdicts ALL credit — engine owns timing, no local cursor races it (the 0.7.43 regression guard)", `scored=${late.scored} done=${late.done}`);

  ok(errs.length === 0, "no unexpected page errors during the contained-verifier run", errs.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}
process.exit(fails ? 1 : 0);
