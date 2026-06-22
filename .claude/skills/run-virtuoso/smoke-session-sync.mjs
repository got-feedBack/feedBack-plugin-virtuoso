#!/usr/bin/env node
// Guard the Workout backing/notes/click alignment. The bug: makeBundle built ALL
// backing from one cfg (the session's first-block metadata) over the whole
// duration, while buildSessionChart assembles notes+beats PER-BLOCK (own
// tempo/meter/key + inter-block breaks) — so block 2+ drifted and the band played
// through the breaks. Fix: assemble backing per-block in buildSessionChart.
//
// W1 (tempo tracking): 2 blocks 60->120 bpm, break off. The CLICK interval halves
//   block1->block2; the BACKING interval must halve TOO (it tracks per-block tempo).
// W2 (break silence): 2 same-tempo blocks, break='always'. ZERO backing events may
//   fall inside the inter-block break gap.
// Control: a single exercise (= Pathways/Custom/Jam, all single-config) stays uniform.
import { chromium } from "playwright";
const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
let fails = 0;
const ok = (c, l, d) => { console.log(`  [${c ? "PASS" : "FAIL"}] ${l}${d ? "  " + d : ""}`); if (!c) fails++; };
const median = (a) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const diffs = (t) => { const s = t.slice().sort((a, b) => a - b); const d = []; for (let i = 1; i < s.length; i++) { const dd = s[i] - s[i - 1]; if (dd > 1e-3) d.push(dd); } return d; };
const seg = (kind, bpm, extra) => ({ kind, config: Object.assign({ bpm, bars: 4, key: "C", scale: "major", meter: "4/4", subdivision: "eighth", progression: "I-IV-V", chordDepth: "triad", direction: "up_down", sequence: "none", fretboardSystem: "caged", shape: "E", audio: { notes: true, harmony: true, metronome: true } }, extra || {}) });

const browser = await chromium.launch({ headless: true });
try {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. launch.ps1 first.`);
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on("pageerror", e => console.log("PAGEERR:", e.message));
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => typeof window.showScreen === "function");
  await page.evaluate(() => window.showScreen("plugin-virtuoso"));
  await page.waitForSelector("#virtuoso-root", { state: "attached" });
  await page.waitForFunction(() => window.Virtuoso && typeof window.Virtuoso.generateSession === "function" && typeof window.Virtuoso.makeBundle === "function");

  const buildSession = (session) => page.evaluate((s) => {
    const S = window.Virtuoso;
    const b = S.makeBundle(S.generateSession(s));
    const live = a => (a || []).filter(x => !x._tail);
    const back = live(b.backingEvents);
    return { lead: b.leadIn || 0, duration: b.songInfo.duration, segmentBounds: b.segmentBounds,
      sections: (b.sections || []).map(x => ({ name: x.name, time: x.time })),
      beats: live(b.beats).map(x => x.time), back: back.map(x => x.t),
      backEv: back.map(x => ({ t: x.t, role: x.role || "harmony", root: (x.midis && x.midis.length) ? (Math.min.apply(null, x.midis) % 12) : null })) };
  }, session);
  const inWin = (t, w) => t >= w[0] - 1e-6 && t < w[1] - 1e-6;
  const PCN = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };

  // ---- W1: tempo tracking (60 -> 120, no break) ----
  const w1 = await buildSession({ version: 1, name: "w1", stringSetup: "guitar_6_standard", interBlockBreak: "off",
    segments: [seg("scale", 60), seg("scale", 120)] });
  console.log(`\n== W1 tempo tracking (block1 60bpm -> block2 120bpm, no break) ==`);
  console.log(`   segmentBounds:`, JSON.stringify(w1.segmentBounds));
  {
    const sb = w1.segmentBounds, b1 = [sb[0].start, sb[0].end], b2 = [sb[1].start, sb[1].end];
    const cm1 = median(diffs(w1.beats.filter(t => inWin(t, b1)))), cm2 = median(diffs(w1.beats.filter(t => inWin(t, b2))));
    const km1 = median(diffs(w1.back.filter(t => inWin(t, b1)))), km2 = median(diffs(w1.back.filter(t => inWin(t, b2))));
    console.log(`   click   median: block1=${cm1.toFixed(3)}s  block2=${cm2.toFixed(3)}s  ratio=${(cm1 / cm2).toFixed(2)} (expect ~2.0)`);
    console.log(`   backing median: block1=${km1.toFixed(3)}s  block2=${km2.toFixed(3)}s  ratio=${(km1 / km2).toFixed(2)} (must MATCH click ratio)`);
    ok(Math.abs(cm1 / cm2 - 2) < 0.25, "click halves between blocks (per-block tempo — correct)", `ratio ${(cm1 / cm2).toFixed(2)}`);
    ok(km1 > 0 && km2 > 0 && Math.abs((km1 / km2) - (cm1 / cm2)) < 0.3, "BACKING tracks the per-block tempo change (the fix)", `backing ratio ${(km1 / km2).toFixed(2)} vs click ${(cm1 / cm2).toFixed(2)}`);
  }

  // ---- W2: break silence (same tempo, forced break) ----
  const w2 = await buildSession({ version: 1, name: "w2", stringSetup: "guitar_6_standard", interBlockBreak: "always",
    segments: [seg("scale", 90), seg("scale", 90, { key: "A" })] });
  console.log(`\n== W2 break silence (2 blocks @90, break=always) ==`);
  console.log(`   segmentBounds:`, JSON.stringify(w2.segmentBounds));
  {
    const sb = w2.segmentBounds, brk = [sb[0].end, sb[1].start], brkSec = brk[1] - brk[0];
    const backInBreak = w2.back.filter(t => t >= brk[0] + 1e-3 && t < brk[1] - 1e-3).length;
    console.log(`   break window [${brk[0].toFixed(2)}, ${brk[1].toFixed(2)}] = ${brkSec.toFixed(2)}s : ${backInBreak} backing events inside`);
    ok(brkSec > 0.1, "an inter-block break actually exists", `${brkSec.toFixed(2)}s`);
    ok(backInBreak === 0, "ZERO backing events inside the break (band silent through the count-in)", `${backInBreak} found`);
  }

  // ---- W3: bpm-ladder block — backing must follow each RUNG's tempo ----
  const w3 = await buildSession({ version: 1, name: "w3", stringSetup: "guitar_6_standard",
    bpmLadder: { enabled: true, bpmStart: 60, bpmTarget: 120, bpmStep: 60, repsPerStep: 1 }, segments: [seg("scale", 80)] });
  console.log(`\n== W3 bpm-ladder (one block, rungs 60 -> 120) ==`);
  {
    // buildSessionChart drops the FIRST sub-section (it collides with the segment
    // marker), so rung-1's start = the segment start; later rungs survive as sections.
    const segStart = (w3.segmentBounds[0] || { start: w3.lead }).start;
    const bpmTimes = w3.sections.filter(s => /BPM$/.test(s.name)).map(s => s.time).sort((a, b) => a - b);
    const bounds = [segStart, ...bpmTimes, w3.duration + 1];
    console.log(`   rung boundaries: ${JSON.stringify(bounds.slice(0, -1))}  duration=${w3.duration?.toFixed?.(2)}`);
    if (bounds.length >= 3) {
      const r1 = [bounds[0], bounds[1]], r2 = [bounds[1], bounds[2]];
      const cm1 = median(diffs(w3.beats.filter(t => inWin(t, r1)))), cm2 = median(diffs(w3.beats.filter(t => inWin(t, r2))));
      const km1 = median(diffs(w3.back.filter(t => inWin(t, r1)))), km2 = median(diffs(w3.back.filter(t => inWin(t, r2))));
      console.log(`   click   median: rung1=${cm1.toFixed(3)} rung2=${cm2.toFixed(3)} ratio=${(cm1 / cm2).toFixed(2)}`);
      console.log(`   backing median: rung1=${km1.toFixed(3)} rung2=${km2.toFixed(3)} ratio=${(km1 / km2).toFixed(2)} (must match click)`);
      ok(km1 > 0 && km2 > 0 && Math.abs((km1 / km2) - (cm1 / cm2)) < 0.3, "ladder backing follows each rung's tempo (per-rung fix)", `backing ${(km1 / km2).toFixed(2)} vs click ${(cm1 / cm2).toFixed(2)}`);
    } else ok(false, "ladder produced >=2 rung regions", `got ${bounds.length - 1}`);
  }

  // ---- W4: key-cycle block — backing must follow each KEY ----
  const w4 = await buildSession({ version: 1, name: "w4", stringSetup: "guitar_6_standard",
    keyCycle: { enabled: true, strategy: "circle_of_fifths", keysPerSession: 2 }, segments: [seg("scale", 90, { key: "C" })] });
  console.log(`\n== W4 key-cycle (one block, keys C -> G) ==`);
  {
    // The start key (C) has no surviving section (first sub-section dropped), so seed
    // it from the segment start; subsequent keys survive as note-named sections.
    const segStart = (w4.segmentBounds[0] || { start: w4.lead }).start;
    const keySecs = w4.sections.filter(s => /^[A-G][#b]?$/.test(s.name)).sort((a, b) => a.time - b.time);
    const regions = [{ name: "C", t0: segStart }].concat(keySecs.map(s => ({ name: s.name, t0: s.time })));
    console.log(`   key regions: ${JSON.stringify(regions.map(r => r.name + "@" + r.t0.toFixed(1)))}`);
    let okKeys = regions.length >= 2;
    for (let i = 0; i < Math.min(2, regions.length) && okKeys; i++) {
      const win = [regions[i].t0, (regions[i + 1]?.t0 ?? w4.duration + 1)];
      const bass = w4.backEv.filter(e => e.role === "bass" && e.root != null && inWin(e.t, win)).sort((a, b) => a.t - b.t);
      const cand = bass.length ? bass : w4.backEv.filter(e => e.role !== "drums" && e.root != null && inWin(e.t, win)).sort((a, b) => a.t - b.t);
      const got = cand.length ? cand[0].root : null;
      const want = PCN[regions[i].name];
      console.log(`   key ${regions[i].name}: first backing root pc=${got} (want ${want}, from ${bass.length ? "bass" : "harmony"})`);
      if (got !== want) okKeys = false;
    }
    ok(okKeys, "key-cycle backing roots on each section's key (per-key fix)", okKeys ? "" : "a region's backing did not root on its key");
  }

  // ---- W5: per-block ANCHOR ZONES — the highway fret-window highlight (the blue
  // hand-position band) must FOLLOW each block, not park at block 1. The bug
  // (2026-06-11 DapperTap report): blocks that don't emit their own anchors
  // (position-mode runs) left the session anchors[] empty, so generateSession's
  // firstCfg fallback built ONE box from block 1's fret window over the whole
  // Workout — "aligns with the first segment, drifts off the following ones".
  const w5 = await page.evaluate(() => {
    const S = window.Virtuoso;
    const pseg = (fretMin, fretMax) => ({ kind: "scale", config: { bpm: 90, bars: 4, key: "C", scale: "major", meter: "4/4", subdivision: "eighth", direction: "up_down", sequence: "none", fretboardSystem: "position", fretMin, fretMax, audio: { notes: true } } });
    const b = S.makeBundle(S.generateSession({ version: 1, name: "w5", stringSetup: "guitar_6_standard", interBlockBreak: "off", segments: [pseg(0, 5), pseg(7, 12)] }));
    return { anchors: (b.anchors || []).map(a => ({ time: a.time, fret: a.fret })), segmentBounds: b.segmentBounds };
  });
  console.log(`\n== W5 per-block anchor zones (block1 frets 0-5, block2 frets 7-12) ==`);
  {
    const sb = w5.segmentBounds, b1 = [sb[0].start, sb[0].end], b2 = [sb[1].start, sb[1].end];
    const a1 = w5.anchors.filter(a => inWin(a.time, b1)).map(a => a.fret);
    const a2 = w5.anchors.filter(a => inWin(a.time, b2)).map(a => a.fret);
    console.log(`   block1 anchor frets: ${JSON.stringify(a1)}  block2 anchor frets: ${JSON.stringify(a2)}`);
    ok(a1.length > 0 && a1.every(f => f === 0), "block-1 anchor zones sit at block-1's fret window (fretMin 0)", `got ${JSON.stringify(a1)}`);
    ok(a2.length > 0 && a2.every(f => f === 7), "block-2 anchor zones FOLLOW to block-2's window (fretMin 7) — not parked at block 1", `got ${JSON.stringify(a2)}`);
  }

  // ---- Workout-love Tier 1 (2026-06-09): count-in + breath + loop-wrap + alt-tuning ----
  // The session path used to drop the count-in (slammed in cold), breathe only on
  // changed seams, never breathe at the loop-wrap, and ignore the player's tuning.
  const wl = await page.evaluate(() => {
    const S = window.Virtuoso;
    const mkSeg = (bpm) => ({ kind: "scale", config: { bpm, bars: 4, key: "C", scale: "major", meter: "4/4", subdivision: "eighth", direction: "up_down", sequence: "none", fretboardSystem: "caged", shape: "E", audio: { notes: true, harmony: true, metronome: true } } });
    const segs = [mkSeg(90), mkSeg(90), mkSeg(90)];
    const mk = (over) => S.makeBundle(S.generateSession(Object.assign({ name: "WL", stringSetup: "guitar_6_standard", segments: segs }, over)));
    const brk = (b) => (b.beats || []).filter(x => x.brk);
    const lastEnd = (b) => Math.max(0, ...(b.segmentBounds || []).map(s => s.end));
    const c2 = mk({ countInBars: 2, interBlockBreak: "off" });
    const n0 = (c2.notes || []).filter(n => !n._tail).sort((a, b) => a.t - b.t)[0];
    const al = mk({ countInBars: 1, interBlockBreak: "always" });
    return {
      lead: c2.leadIn || 0, n0t: n0 ? n0.t : -1,
      alwaysBrk: brk(al).length, wrap: brk(al).filter(x => x.time > lastEnd(al) - 1e-3).length,
      autoBrk: brk(mk({ countInBars: 1, interBlockBreak: "auto" })).length,
      offBrk: brk(mk({ countInBars: 1, interBlockBreak: "off" })).length,
      ddOpen0: (mk({ countInBars: 1, customOpenMidis: "38,45,50,55,59,64" }).openMidis || [])[0],
      stOpen0: (mk({ countInBars: 1 }).openMidis || [])[0],
      finiteRun: mk({ countInBars: 1 }).finiteRun,   // a Workout must END (→ recap), not loop into stale credit
    };
  });
  console.log(`\n== Workout-love Tier 1 ==`);
  ok(wl.lead > 0 && Math.abs(wl.n0t - wl.lead) < 0.05, "Workout has a leading count-in (block-1 count-in plumbed; note[0] at the lead)", `lead=${wl.lead.toFixed(2)} n0=${(wl.n0t).toFixed(2)}`);
  ok(wl.alwaysBrk > 0 && wl.wrap > 0, "inter-block breaks present + a trailing LOOP-WRAP breath after the last block", `brk=${wl.alwaysBrk} wrap=${wl.wrap}`);
  ok(wl.autoBrk > 0, "'auto' breathes every seam (1-bar floor — was 0 for flowing seams)", `auto=${wl.autoBrk}`);
  ok(wl.offBrk === 0, "'off' inserts no break (respects the toggle)", `off=${wl.offBrk}`);
  ok(wl.ddOpen0 === 38 && wl.stOpen0 === 40, "alt-tuning threads into the Workout (drop-D low string = 38/D; standard = 40/E)", `dd=${wl.ddOpen0} std=${wl.stOpen0}`);
  ok(wl.finiteRun === true, "a Workout is FINITE — it ends (→ Tier-3 recap), never loops into stale-credit hits (the ~250 dogfood bug)", `finiteRun=${wl.finiteRun}`);

  // ---- Control: single exercise (Pathways/Custom/Jam are single-config) ----
  const sc = await page.evaluate(() => {
    const S = window.Virtuoso;
    const setForm = (o) => { for (const [k, v] of Object.entries(o)) { const el = document.querySelector(`#virtuoso-controls [name="${k}"]`); if (el) el.value = String(v); } };
    const adv = document.querySelector('[name="advancedMode"]'); if (adv) { adv.checked = true; adv.dispatchEvent(new Event("change", { bubbles: true })); }
    setForm({ stringSetup: "guitar_6_standard", practiceType: "chord_scales", chordScaleStrategy: "mode_of_moment", progression: "I-V-vi-IV", key: "C", scale: "major", chordDepth: "triad", chordOverride: "auto", fretboardSystem: "caged", shape: "E", subdivision: "eighth", bars: 8, direction: "up_down", sequence: "none" });
    const b = S.makeBundle(S.generateExercise(S.readConfig()));
    const live = a => (a || []).filter(x => !x._tail);
    return { duration: b.songInfo.duration, lead: b.leadIn || 0, beats: live(b.beats).map(x => x.time), back: live(b.backingEvents).map(x => x.t) };
  });
  console.log(`\n== Control: single exercise (Pathways/Custom/Jam) ==`);
  const half = (sc.lead + sc.duration) / 2;
  const cm1 = median(diffs(sc.beats.filter(t => t < half))), cm2 = median(diffs(sc.beats.filter(t => t >= half)));
  const km1 = median(diffs(sc.back.filter(t => t < half))), km2 = median(diffs(sc.back.filter(t => t >= half)));
  console.log(`   click 1st/2nd=${cm1.toFixed(3)}/${cm2.toFixed(3)}  backing 1st/2nd=${km1.toFixed(3)}/${km2.toFixed(3)}  backLast=${Math.max(0, ...sc.back).toFixed(2)}/${sc.duration?.toFixed?.(2)}`);
  ok(Math.abs(cm1 - cm2) <= 0.02 && Math.abs(km1 - km2) <= 0.02, "single-config: click & backing uniform throughout (unaffected)", `click ${cm1.toFixed(3)}/${cm2.toFixed(3)} back ${km1.toFixed(3)}/${km2.toFixed(3)}`);
  ok(sc.back.length > 0 && Math.max(0, ...sc.back) >= (sc.lead + sc.duration) * 0.5, "single-config: backing spans the exercise", `to ${Math.max(0, ...sc.back).toFixed(2)}`);

  console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  workout sync: ${fails} failure(s)`);
  process.exit(fails ? 1 : 0);
} finally {
  await browser.close();
}
