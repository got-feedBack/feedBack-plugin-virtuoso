// Smoke: the backing-engine core — chart.timeline + seeded determinism.
// Owns the backing-engine SYSTEM per the per-system growth rule (CLAUDE.md):
// new backing-engine asserts land as rows HERE, not as new suite files.
//
//   1. chart.timeline structural validity for EVERY style palette — non-empty,
//      slot-sorted, contiguous, durBeats>0, covers the chart, and the bar-locked
//      degenerate case (durBeats == meter numerator) holds when no harmonicRhythm.
//   2. Sub-bar harmonic rhythm ('2/bar') — twice the events, half the slot.
//   3. applyTimelinePush semantics — anticipation moves the SOUNDING start
//      early, truncates the previous chord's tail, clamps at chart time 0.
//   4. Seeded determinism — same cfg => byte-identical chart, even for
//      direction:'random' (the one shuffle in the core); explicit humanSeed
//      reproduces / varies the roll; chart carries humanSeed.
//   5. Key-cycle charts carry a PER-RUNG timeline (keys change across rungs).
//   6. Session charts assemble the timeline PER-BLOCK (the desync rule) —
//      block B's window holds block B's harmony, not block A's.
//   7. Rolling-window scheduler ceiling — Play on a 30-min Woodshed creates a
//      bounded number of audio nodes (was 39k whole-pass) with no second-long
//      main-thread block. Guards backing-engine step 0.
//   8. DRUM_GROOVES (backing-engine step 5) — the groove library tiles to valid
//      events; routing by style/profile; jazz constraints (feathered kick, hat
//      foot, no backbeat); fills (toms, hat-mute, crash); seeded determinism;
//      odd-meter fallback.
import { chromium } from "playwright";
const HOST = process.env.VIRTUOSO_HOST || "http://127.0.0.1:8765";
let pass = 0, fail = 0;
const ok = (cond, label, detail = "") => {
  if (cond) { pass++; }
  else { fail++; console.log(`  FAIL ${label} ${detail}`); }
};

const browser = await chromium.launch({ headless: true });
const step = (s) => console.log(`  .. ${s}`);
try {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    globalThis.__SS_HARNESS__ = true;
    // Audio-node creation counter + longtask log for the scheduler-ceiling row.
    window.__nodeCount = 0;
    const P = (window.AudioContext || window.webkitAudioContext)?.prototype;
    if (P) ["createOscillator", "createGain", "createBufferSource", "createBiquadFilter", "createDynamicsCompressor"].forEach((n) => {
      const orig = P[n];
      if (orig) P[n] = function (...a) { window.__nodeCount++; return orig.apply(this, a); };
    });
    window.__longTasks = [];
    try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__longTasks.push(Math.round(e.duration)))).observe({ entryTypes: ["longtask"] }); } catch {}
  });
  const page = await ctx.newPage();
  // Seed the L1 instrument store BEFORE page scripts run: the host-settings
  // sync (v0.1.11) treats an empty localStorage as a fresh install and ADOPTS
  // host config — which persists whatever instrument the PREVIOUS suite's panel
  // drives wrote through (cross-suite contamination; the panel flipped to bass
  // mid-suite). With the store seeded, the local-wins boot path holds the
  // deterministic 6-string default AND heals the host config for later suites.
  await page.addInitScript(() => { try { localStorage.setItem("virtuoso.instrument", JSON.stringify({ stringSetup: "guitar_6_standard", customOpenMidis: "" })); } catch (_) {} });
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => typeof window.showScreen === "function");
  // showScreen can throw from inside the host if called mid-boot (a race seen
  // intermittently as a minified host error) — retry briefly.
  for (let i = 0; ; i++) {
    try { await page.evaluate(() => window.showScreen("plugin-virtuoso")); break; }
    catch (e) { if (i >= 2) throw e; await page.waitForTimeout(1500); }
  }
  await page.waitForSelector("#virtuoso-root", { state: "attached" });
  await page.waitForSelector("#virtuoso-view-select");
  await page.waitForFunction(() => window.Virtuoso && typeof window.Virtuoso.generateExercise === "function" && globalThis.__ss_debug);
  await page.waitForTimeout(600);   // let the screen's boot settle (first-load race)

  // ── (1)+(2) timeline validity per style palette + bar-lock degenerate ──────
  step("styles");
  const styles = await page.evaluate(() => {
    const S = window.Virtuoso;
    const out = [];
    for (const id of Object.keys(S.STYLE_PALETTES)) {
      const cfg = Object.assign({}, S.readConfig(), S.stylePaletteConfig(id), { practiceType: "chord_scales", keyCycle: "none" });
      let r;
      try {
        const ex = S.generateExercise(cfg);
        const tl = ex.chart.timeline || [];
        const dur = ex.chart.duration || 0;
        let sorted = true, contiguous = true, durOk = true, barLock = true;
        const num = cfg.meter.numerator;
        for (let i = 0; i < tl.length; i++) {
          if (!(tl[i].durBeats > 0)) durOk = false;
          if (i && tl[i].startBeat < tl[i - 1].startBeat) sorted = false;
          if (i && Math.abs((tl[i - 1].startBeat + tl[i - 1].durBeats) - tl[i].startBeat) > 1e-3) contiguous = false;
          if (Math.abs(tl[i].durBeats - num) > 1e-3) barLock = false;   // no palette sets harmonicRhythm yet
        }
        const covers = tl.length && Math.abs(tl[tl.length - 1].endSec - dur) < 0.05;
        r = { id, n: tl.length, sorted, contiguous, durOk, barLock, covers };
      } catch (e) { r = { id, err: String(e && e.message || e) }; }
      out.push(r);
    }
    return out;
  });
  for (const s of styles) {
    ok(!s.err, `style ${s.id}: generates`, s.err || "");
    if (s.err) continue;
    ok(s.n > 0 && s.sorted && s.contiguous && s.durOk && s.covers, `style ${s.id}: timeline valid`, `n=${s.n} sorted=${s.sorted} contig=${s.contiguous} dur>0=${s.durOk} covers=${s.covers}`);
    ok(s.barLock, `style ${s.id}: bar-locked degenerate (durBeats == numerator)`, "");
  }

  step("2/bar");
  const sub = await page.evaluate(() => {
    const S = window.Virtuoso;
    const base = Object.assign({}, S.readConfig(), { practiceType: "chord_scales", progression: "ii-V-I", key: "C", scale: "major", bars: 4, keyCycle: "none" });
    const one = S.generateExercise(base).chart.timeline;
    const two = S.generateExercise(Object.assign({}, base, { harmonicRhythm: "2/bar" })).chart.timeline;
    const num = base.meter.numerator;
    return {
      n1: one.length, n2: two.length,
      halfSlot: two.every(e => Math.abs(e.durBeats - num / 2) < 1e-3),
      contiguous: two.every((e, i) => !i || Math.abs((two[i - 1].startBeat + two[i - 1].durBeats) - e.startBeat) < 1e-3),
    };
  });
  ok(sub.n2 === sub.n1 * 2 && sub.halfSlot && sub.contiguous, "harmonicRhythm 2/bar: twice the events at half the slot", `n1=${sub.n1} n2=${sub.n2} half=${sub.halfSlot} contig=${sub.contiguous}`);

  // ── (3) push semantics (pure helper via the harness debug surface) ─────────
  step("push");
  const push = await page.evaluate(() => {
    const S = window.Virtuoso, D = globalThis.__ss_debug;
    const cfg = Object.assign({}, S.readConfig(), { practiceType: "chord_scales", progression: "ii-V-I", key: "C", bars: 4, keyCycle: "none" });
    const dur = 4 * (cfg.bars ? 1 : 1) * 0 + 8;                       // 8s synthetic window
    const beatSec = (() => { const tl = D.compileChordTimeline(cfg, dur); return (tl[0].endSec - tl[0].startSec) / tl[0].durBeats; })();
    const tl = D.compileChordTimeline(cfg, dur);
    const slot1 = tl[1].startSec, prevEnd0 = tl[0].endSec;
    tl[1].push = 0.5;
    tl[0].push = 4;                                                    // absurd push on the FIRST event -> clamp at 0
    D.applyTimelinePush(tl, cfg, dur);
    return {
      movedEarly: Math.abs(tl[1].startSec - (slot1 - 0.5 * beatSec)) < 1e-3,
      prevTruncated: Math.abs(tl[0].endSec - tl[1].startSec) < 1e-3 && tl[0].endSec < prevEnd0,
      slotUntouched: Math.abs(tl[1].startBeat * beatSec - slot1) < 1e-3,
      firstClamped: tl[0].startSec === 0,
    };
  });
  ok(push.movedEarly, "push: sounding start moves early by push*beatSec", "");
  ok(push.prevTruncated, "push: previous chord's tail truncates at the anticipated start", "");
  ok(push.slotUntouched, "push: the harmonic SLOT (startBeat) is untouched", "");
  ok(push.firstClamped, "push: first event clamps at chart time 0", "");

  // ── (4) seeded determinism ──────────────────────────────────────────────────
  step("determinism");
  const det = await page.evaluate(() => {
    const S = window.Virtuoso;
    const base = Object.assign({}, S.readConfig(), {
      practiceType: "scale", scale: "major", key: "C", fretboardSystem: "full_neck",
      direction: "random", repeatCount: 2, bars: 4, keyCycle: "none", advancedMode: true,
    });
    const j = (cfg) => JSON.stringify(S.generateExercise(cfg).chart);
    const a1 = j(base), a2 = j(base);
    const s1 = j(Object.assign({}, base, { humanSeed: 123 }));
    const s1b = j(Object.assign({}, base, { humanSeed: 123 }));
    const s2 = j(Object.assign({}, base, { humanSeed: 456 }));
    const seedOnChart = S.generateExercise(base).chart.humanSeed;
    return { stable: a1 === a2, seedStable: s1 === s1b, seedVaries: s1 !== s2, seedOnChart: Number.isFinite(seedOnChart) };
  });
  ok(det.stable, "determinism: same cfg => byte-identical chart (direction:'random')", "");
  ok(det.seedStable, "determinism: same humanSeed => identical chart", "");
  ok(det.seedVaries, "determinism: different humanSeed => different roll", "");
  ok(det.seedOnChart, "chart carries humanSeed", "");

  // ── (5) key-cycle: per-rung timeline, keys actually change ─────────────────
  step("key-cycle");
  const kc = await page.evaluate(() => {
    const S = window.Virtuoso;
    const cfg = Object.assign({}, S.readConfig(), {
      practiceType: "scale", scale: "major", key: "C", progression: "ii-V-I",
      keyCycle: "circle_of_fifths", keyCycleLength: 3, bars: 2, advancedMode: true,
    });
    const ch = S.generateExercise(cfg).chart;
    const tl = ch.timeline || [];
    const secs = (ch.sections || []).map(s => s.time);
    const evAt = (t) => tl.find(e => e.startSec >= t - 1e-3);
    const r1 = evAt(secs[0] || 0), r2 = evAt(secs[1] || -1);
    const monotonic = tl.every((e, i) => !i || e.startSec >= tl[i - 1].startSec - 1e-6);
    return { n: tl.length, monotonic, keysDiffer: !!(r1 && r2 && r1.rootPc !== r2.rootPc) };
  });
  ok(kc.n > 0, "key-cycle chart carries a timeline", `n=${kc.n}`);
  ok(kc.monotonic, "key-cycle timeline is time-monotonic", "");
  ok(kc.keysDiffer, "key-cycle timeline changes key per rung (not the start key everywhere)", "");

  // ── (6) session: per-block timeline (the desync rule for harmony) ──────────
  step("session");
  const ses = await page.evaluate(() => {
    const S = window.Virtuoso;
    const session = {
      name: "tl-test", stringSetup: "guitar_6_standard",
      segments: [
        { name: "A", kind: "scale", config: { key: "C",  progression: "ii-V-I", bars: 2, bpm: 100 } },
        { name: "B", kind: "scale", config: { key: "F#", progression: "ii-V-I", bars: 2, bpm: 100 } },
      ],
    };
    const ch = S.generateSession(session).chart;
    const tl = ch.timeline || [], bounds = ch.segmentBounds || [];
    if (tl.length === 0 || bounds.length !== 2) return { n: tl.length, nb: bounds.length };
    const roots = (b) => new Set(tl.filter(e => e.startSec >= b.start - 1e-3 && e.startSec < b.end - 1e-3).map(e => e.rootPc));
    const ra = roots(bounds[0]), rb = roots(bounds[1]);
    const overlap = [...ra].filter(x => rb.has(x));
    const monotonic = tl.every((e, i) => !i || e.startSec >= tl[i - 1].startSec - 1e-6);
    return { n: tl.length, nb: bounds.length, monotonic, ra: [...ra], rb: [...rb], overlap };
  });
  ok(ses.n > 0 && ses.nb === 2, "session chart carries a timeline + bounds", `n=${ses.n} bounds=${ses.nb}`);
  ok(ses.monotonic, "session timeline is time-monotonic", "");
  ok(ses.overlap && ses.overlap.length === 0, "block B's window holds block B's harmony (C vs F# ii-V-I roots disjoint)", `A=${ses.ra} B=${ses.rb}`);

  // ── (8) voice-leading between backing chords (step 2) ──────────────────────
  step("voice-leading");
  const vl = await page.evaluate(() => {
    const S = window.Virtuoso;
    const cfg = Object.assign({}, S.readConfig(), {
      practiceType: "chord_scales", progression: "ii-V-I", key: "C", scale: "major",
      chordDepth: "seventh", chordOverride: "auto", bars: 4, keyCycle: "none",
      audio: { notes: false, metronome: false, harmony: true },
    });
    // Single-exercise backing is synthesized at bundle time (makeBundle), not on
    // the chart — go through it like playback does.
    const bundle = S.makeBundle(S.generateExercise(cfg));
    const pads = (bundle.backingEvents || []).filter(e => !e.role && e.midis && e.midis.length);
    const probs = [];
    let seams = 0, holds = 0;
    for (let i = 1; i < pads.length; i++) {
      const a = pads[i - 1], b = pads[i];
      if (a.name === b.name && a.name) continue;                       // coalesce handles identicals
      const apcs = new Set(a.midis.map(m => m % 12)), bpcs = new Set(b.midis.map(m => m % 12));
      const share = [...apcs].some(pc => bpcs.has(pc));
      if (!share) continue;
      seams++;
      // Common tone must HOLD at the same literal MIDI (the comper's hand).
      if (b.midis.some(m => a.midis.includes(m))) holds++;
      else probs.push(`${a.name}->${b.name}: no literal common tone (${a.midis} vs ${b.midis})`);
      const upper = b.midis.slice(1);
      if (upper.length && (upper[upper.length - 1] - upper[0]) > 14) probs.push(`${b.name}: upper span ${upper[upper.length - 1] - upper[0]} > 14`);
      if (b.midis.length > 5) probs.push(`${b.name}: ${b.midis.length} voices > 5`);
    }
    return { seams, holds, probs: probs.slice(0, 4) };
  });
  ok(vl.seams > 0 && vl.holds === vl.seams, "voice-leading: common tones hold literally at every shared-pc chord seam", `${vl.holds}/${vl.seams} ${vl.probs.join(" | ")}`);

  // ── (9) modal-M1 palette ride-along (funk goes Dorian; rock/jazz tokens) ────
  const m1 = await page.evaluate(() => {
    const P = window.Virtuoso.STYLE_PALETTES;
    return {
      funkDorian: P.funk.progressions[0] === "dorian_vamp" && P.funk.chordOverride === "auto",
      rockMixo: P.rock.progressions.includes("mixolydian_rock"),
      jazzSoWhat: P.jazz.progressions.includes("so_what"),
    };
  });
  ok(m1.funkDorian, "funk palette leads with dorian_vamp + chordOverride auto (the dom7 IV sounds)", "");
  ok(m1.rockMixo, "rock palette carries mixolydian_rock", "");
  ok(m1.jazzSoWhat, "jazz palette carries so_what", "");

  // ── (6b) COMP_GROOVES (step 3): the pad-kill, density, suppression ──────────
  step("COMP_GROOVES (step 3)");
  const c3 = await page.evaluate(() => {
    const S = window.Virtuoso;
    const base = Object.assign(S.readConfig(), {
      practiceType: "scale", mode: "scale", shapeNotes: null, fretboardSystem: "position",
      key: "C", scale: "major", stringSetup: "guitar_6_standard", bpm: 100, bars: 4,
      progression: "I-V-vi-IV", meter: { numerator: 4, denominator: 4, grouping: [4] },
      backingStyle: "pad", swing: "straight", backingComp: "", backingDensity: undefined, backingPadDev: false,
    });
    const gen = (over) => S.makeBundle(S.generateExercise(Object.assign({}, base, over)));
    const harm = (b) => (b.backingEvents || []).filter((e) => e.role !== "drums" && e.role !== "bass");
    const out = {};
    // (a) undeclared cfg keeps the legacy coalesced pad
    const pad = harm(gen({}));
    out.padCount = pad.length; out.padHasVel = pad.some((e) => e.vel != null);
    // (b) a declared cell re-articulates: many short velocity-tiered hits
    const comp = harm(gen({ backingComp: "four_comp" }));
    out.compCount = comp.length;
    out.compVels = [...new Set(comp.map((e) => e.vel))].sort().join(",");
    out.compShort = comp.every((e) => e.end - e.t < 1.5);
    out.compLabeled = comp.filter((e) => e.cpcs).length;
    // continuous metric-contoured velocity (genre-band realism slice 2026-06-13): the
    // 3 flat tiers became a continuous contour — an authored accent stays the 1.0
    // ceiling, non-accent hits lift on the beat / dip off it. Sample two cells.
    const rc = harm(gen({ backingComp: "rock_chug" }));
    out.compVelSet = [...new Set(comp.concat(rc).map((e) => e.vel))].sort((a, b) => a - b);
    out.velAccentCeiling = out.compVelSet.includes(1);
    out.velContinuous = out.compVelSet.filter((v) => v < 1).length >= 2;   // >1 non-accent level = a contour, not one flat tier
    out.velBounded = out.compVelSet.every((v) => v >= 0.2 && v <= 1);
    // (c) the jazz pilot: swung non-boogie cfg auto-picks the Charleston
    const jazz = harm(gen({ swing: "swing_8", backingComp: "" }));
    out.jazzComp = jazz.some((e) => e.comp === "charleston");
    // (d) density 1 = the half-note vamp; density 0 = click only
    const vamp = harm(gen({ backingDensity: 1 }));
    out.vampComp = vamp.length > 0 && vamp.every((e) => e.comp === "vamp_half");
    out.density0 = (gen({ backingDensity: 0 }).backingEvents || []).length;
    // (e) player-is-the-comp: strum_comp suppresses the comp lane
    const sc = gen({ practiceType: "strum_comp", mode: "strum_comp", chordDepth: "triad", chordOverride: "auto", voicingPosition: "open", subdivision: "eighth" });
    out.scComp = (sc.backingEvents || []).filter((e) => e.role !== "drums").length;
    // (f) the A/B dev flag forces the pad even with a cell declared
    const dev = harm(gen({ backingComp: "four_comp", backingPadDev: true }));
    out.devPad = dev.length === pad.length && dev.every((e) => e.vel == null);
    // (g) every comp hit carries its articulation tag (2026-06-12: the sampled
    // guitar voice keys its open↔muted switch off ev.a — a dropped tag silently
    // degrades every artic-aware voice)
    out.articTagged = comp.length > 0 && comp.every((e) => typeof e.a === "string" && e.a.length > 0);
    return out;
  });
  ok(c3.padCount > 0 && !c3.padHasVel, "undeclared cfg keeps the legacy coalesced pad", `events=${c3.padCount}`);
  ok(c3.compCount >= c3.padCount * 3 && c3.compShort, "a declared cell re-articulates the comp (the pad-kill)", `hits=${c3.compCount} vs pad=${c3.padCount}`);
  ok(c3.velAccentCeiling, "an authored accent stays the velocity ceiling (1.0)", `vels=${c3.compVelSet}`);
  ok(c3.velContinuous && c3.velBounded, "comp hits carry a continuous METRIC contour in [0.2,1], not 3 flat tiers", `vels=${c3.compVelSet}`);
  ok(c3.compLabeled > 0, "chord-change labels survive re-articulation (one labeled hit per change)", `labeled=${c3.compLabeled}`);
  ok(c3.jazzComp, "the jazz pilot: swung cfg auto-picks the Charleston cell");
  ok(c3.vampComp, "backingDensity 1 = the half-note vamp");
  ok(c3.density0 === 0, "backingDensity 0 = click only (no backing events at all)", `events=${c3.density0}`);
  ok(c3.scComp === 0, "player-is-the-comp: strum_comp suppresses the comp lane", `comp=${c3.scComp}`);
  ok(c3.devPad, "the pad-vs-comp A/B dev flag forces the legacy pad");
  ok(c3.articTagged, "every comp hit carries its articulation tag (ev.a — the sample voice's artic switch)");

  // ── (6c) BASS_FIGURES (step 4): walking/figures, kick lock, lift, mute ──────
  step("BASS_FIGURES (step 4)");
  const c4 = await page.evaluate(() => {
    const S = window.Virtuoso;
    const base = Object.assign(S.readConfig(), {
      practiceType: "scale", mode: "scale", shapeNotes: null, fretboardSystem: "position",
      key: "C", scale: "major", stringSetup: "guitar_6_standard", bpm: 100, bars: 4,
      progression: "I-V-vi-IV", meter: { numerator: 4, denominator: 4, grouping: [4] },
      backingStyle: "pad", swing: "straight", backingComp: "", backingBass: "", backingDensity: undefined, backingPadDev: false,
    });
    const gen = (over) => {
      const cfg = Object.assign({}, base, over);
      const ex = S.generateExercise(cfg);
      const b = S.makeBundle(ex);
      return { b, tl: ex.chart.timeline || [], lead: b.leadIn || 0 };
    };
    const bass = (b) => (b.backingEvents || []).filter((e) => e.role === "bass");
    const harm = (b) => (b.backingEvents || []).filter((e) => e.role !== "drums" && e.role !== "bass");
    const out = {};
    // (a) the jazz pilot walks: swung cfg → walking line, root on 1 at the
    // chord slot (the kick lock), accent velocity on the landing.
    const jz = gen({ swing: "swing_8" });
    const jzB = bass(jz.b);
    out.walkFig = jzB.length > 0 && jzB.every((e) => e.fig === "walking");
    out.walkRootOn1 = jz.tl.length > 0 && jz.tl.every((c) => {
      const hit = jzB.find((e) => Math.abs(e.t - (c.startSec + jz.lead)) < 1e-3);
      return hit && hit.midis[0] % 12 === ((c.rootPc % 12) + 12) % 12 && hit.vel === 1;
    });
    // (b) range + leap discipline (the bass-pedagogy realism numbers)
    const mids = jzB.map((e) => e.midis[0]);
    out.range = mids.every((m) => m >= 28 && m <= 51);
    let badLeap = 0;
    for (let i = 1; i < mids.length; i++) { const g = Math.abs(mids[i] - mids[i - 1]); if (g > 9 && g !== 12) badLeap++; }
    out.badLeap = badLeap;
    out.noRepeat = mids.every((m, i) => i === 0 || m !== mids[i - 1] || jzB[i].vel === 0.45);
    // (c) approach semantics: the note before each change targets the next root
    // — chromatic ±1, scalar ±2, or the dominant (the next chord's 5th, pc
    // diff 7). Compare pitch classes (octave-agnostic).
    let seams = 0, approaches = 0;
    for (let i = 1; i < jz.tl.length; i++) {
      const c = jz.tl[i], prevHits = jzB.filter((e) => e.t < c.startSec + jz.lead - 1e-3);
      if (!prevHits.length) continue;
      const last = prevHits[prevHits.length - 1].midis[0];
      const diff = ((last % 12) - (((c.rootPc % 12) + 12) % 12) + 12) % 12;
      seams++;
      if ([1, 2, 7, 10, 11].includes(diff)) approaches++;
    }
    out.seams = seams; out.approaches = approaches;
    // (d) the boogie full-recipe migration: cell + figure; the A/B flag keeps
    // the bespoke pre-step-4 builder (no comp/fig tags).
    const bg = gen({ backingStyle: "boogie", swing: "shuffle" });
    const bgB = bass(bg.b), bgH = harm(bg.b);
    out.boogieFig = bgB.length > 0 && bgB.every((e) => e.fig === "bass_ostinato");
    out.boogieCell = bgH.length > 0 && bgH.every((e) => e.comp === "boogie_stab");
    out.boogieShape = bg.tl.slice(0, 4).every((c) => {
      const hits = bgB.filter((e) => e.t >= c.startSec + bg.lead - 1e-3 && e.t < c.endSec + bg.lead - 1e-3).map((e) => e.midis[0]);
      return hits.length >= 4 && hits[1] - hits[0] === 7 && hits[2] - hits[0] === 9 && hits[3] - hits[0] === 10;
    });
    const bgDev = gen({ backingStyle: "boogie", swing: "shuffle", backingPadDev: true });
    out.boogieLegacy = bass(bgDev.b).length > 0 && (bgDev.b.backingEvents || []).every((e) => !e.fig && !e.comp);
    // (e) player-is-the-bassist: a bass cfg mutes the figure, keeps the comp
    const bz = gen({ swing: "swing_8", stringSetup: "bass_4_standard", instrument: "bass" });
    out.bassMuted = bass(bz.b).length === 0 && harm(bz.b).length > 0;
    // (f) register lift: comp drops its folded root when a figure plays
    out.liftOn = Math.min(...harm(jz.b).flatMap((e) => e.midis)) >= 48;
    out.liftOff = Math.min(...harm(gen({}).b).flatMap((e) => e.midis)) < 48;
    // (g) authored figures: motown (ghosts + root on 1), root_pump, two_feel
    const mo = gen({ backingBass: "motown_counter" });
    const moB = bass(mo.b);
    out.motown = moB.length > 0 && moB.every((e) => e.fig === "motown_counter")
      && moB.some((e) => e.vel === 0.45)
      && mo.tl.every((c) => { const h = moB.find((e) => Math.abs(e.t - (c.startSec + mo.lead)) < 1e-3); return h && h.midis[0] % 12 === ((c.rootPc % 12) + 12) % 12; });
    const rpG = gen({ backingBass: "root_pump" });
    const rpB = bass(rpG.b);
    out.rootPump = rpB.length > 0 && rpB.every((e) => e.fig === "root_pump")
      && rpG.tl.slice(0, 2).every((c) => {
        const hits = rpB.filter((e) => e.t >= c.startSec + rpG.lead - 1e-3 && e.t < c.endSec + rpG.lead - 1e-3);
        return hits.length === 8 && hits.every((e) => e.midis[0] % 12 === ((c.rootPc % 12) + 12) % 12);
      });
    const tf = gen({ backingBass: "two_feel" });
    const tfB = bass(tf.b);
    out.twoFeel = tf.tl.length > 0 && tf.tl.slice(0, 2).every((c) => {
      const hits = tfB.filter((e) => e.t >= c.startSec + tf.lead - 1e-3 && e.t < c.endSec + tf.lead - 1e-3).map((e) => e.midis[0]);
      return hits.length === 2 && (hits[1] - hits[0] + 12) % 12 === 7;
    });
    // (h) density 1 (vamp) has no bass figure
    out.density1 = bass(gen({ swing: "swing_8", backingDensity: 1 }).b).length === 0;
    // (i) determinism: the seeded generator rolls the same line every build
    const j1 = JSON.stringify(gen({ swing: "swing_8" }).b.backingEvents);
    const j2 = JSON.stringify(gen({ swing: "swing_8" }).b.backingEvents);
    out.deterministic = j1 === j2;
    // (j) exactly ONE labeled carrier per chord change (no label spam)
    const cars = (jz.b.backingEvents || []).filter((e) => e.cpcs);
    const named = (jz.b.backingEvents || []).filter((e) => e.name);
    out.carriers = cars.length; out.namedN = named.length; out.tlN = jz.tl.length;
    return out;
  });
  ok(c4.walkFig, "jazz pilot: swung cfg walks a role:'bass' line (fig='walking')");
  ok(c4.walkRootOn1, "walking lands the ROOT on beat 1 of every change, at the kick's slot, accented");
  ok(c4.range, "the line stays in the backing-bass register (MIDI 28–51)");
  ok(c4.badLeap === 0, "leaps ≤9 semitones (octave whitelisted)", `bad=${c4.badLeap}`);
  ok(c4.noRepeat, "no repeated adjacent pitches in the walk");
  ok(c4.seams > 0 && c4.approaches === c4.seams, "every change is approached (chromatic/scalar/dominant into the next root)", `${c4.approaches}/${c4.seams}`);
  ok(c4.boogieFig && c4.boogieCell, "boogie full-recipe migration: bass_ostinato figure + boogie_stab cell", `fig=${c4.boogieFig} cell=${c4.boogieCell}`);
  ok(c4.boogieShape, "the boogie figure walks root–5–6–♭7 on the beats (ported verbatim)");
  ok(c4.boogieLegacy, "the A/B dev flag keeps the bespoke pre-step-4 boogie");
  ok(c4.bassMuted, "player-is-the-bassist: a bass cfg MUTES the figure, keeps the comp");
  ok(c4.liftOn && c4.liftOff, "register lift: the comp drops its folded root (≥48) only while a figure plays", `on=${c4.liftOn} off=${c4.liftOff}`);
  ok(c4.motown, "authored motown_counter: root on 1, dead-thumb ghosts at the ghost tier");
  ok(c4.rootPump, "authored root_pump emits the eighth-note pump");
  ok(c4.twoFeel, "authored two_feel: root on 1, the 5th on beat 3");
  ok(c4.density1, "backingDensity 1 (vamp) carries no bass figure");
  ok(c4.deterministic, "the seeded walk is byte-identical across builds (determinism)");
  ok(c4.carriers === c4.tlN && c4.namedN === c4.tlN, "exactly ONE labeled cpcs carrier per chord change", `carriers=${c4.carriers} named=${c4.namedN} changes=${c4.tlN}`);

  // ── (6d) step-4 VETTING fixes (bass-pedagogy / blues / jazz, 2026-06-07) ────
  step("vetting fixes (6d)");
  const c5 = await page.evaluate(() => {
    const S = window.Virtuoso;
    const base = Object.assign(S.readConfig(), {
      practiceType: "scale", mode: "scale", shapeNotes: null, fretboardSystem: "position",
      key: "C", scale: "major", stringSetup: "guitar_6_standard", bpm: 120, bars: 8,
      progression: "ii-V-I", meter: { numerator: 4, denominator: 4, grouping: [4] },
      backingStyle: "pad", swing: "swing_8", backingComp: "", backingBass: "", backingDensity: undefined, backingPadDev: false,
    });
    const gen = (over) => {
      const cfg = Object.assign({}, base, over);
      const ex = S.generateExercise(cfg);
      const b = S.makeBundle(ex);
      return { b, tl: ex.chart.timeline || [], lead: b.leadIn || 0 };
    };
    const bass = (b) => (b.backingEvents || []).filter((e) => e.role === "bass");
    const out = {};
    // (a) the SEAM fix (bass-ped must-fix #1 == jazz's stall bug): the approach
    // targets the next window's ACTUAL landing — never the same pitch across
    // the barline, and a chromatic approach resolves by step in register.
    const w = gen({});
    const wB = bass(w.b);
    let stall = 0, badSeam = 0, accWrong = 0, seamN = 0;
    for (let i = 1; i < w.tl.length; i++) {
      const c = w.tl[i], prevC = w.tl[i - 1];
      const land = wB.find((e) => Math.abs(e.t - (c.startSec + w.lead)) < 1e-3);
      const before = wB.filter((e) => e.t < c.startSec + w.lead - 1e-3);
      if (!land || !before.length) continue;
      seamN++;
      const appr = before[before.length - 1].midis[0], lm = land.midis[0];
      if (appr === lm) stall++;                                        // the cross-barline repeat stall
      const diff = ((appr % 12) - (lm % 12) + 12) % 12;
      const dom = (appr % 12) === ((c.rootPc % 12) + 7) % 12;
      if (!([1, 2, 10, 11].includes(diff) || dom)) badSeam++;
      if ([1, 11].includes(diff) && Math.abs(appr - lm) > 2) badSeam++; // chromatic must resolve by STEP
      // accent semantics: vel 1 exactly when the chord changes
      const changed = c.name !== prevC.name;
      if ((land.vel === 1) !== changed) accWrong++;
    }
    out.seamN = seamN; out.stall = stall; out.badSeam = badSeam; out.accWrong = accWrong;
    // landing accents exist at all (the first window is a change by definition)
    const first = wB.find((e) => Math.abs(e.t - (w.tl[0].startSec + w.lead)) < 1e-3);
    out.firstAcc = !!(first && first.vel === 1);
    // (b) motown natural-6 gate (bass-ped must-fix #2): no natural 6 over a
    // minor-3rd chord (the diatonic vi) — the ♭7 plays as the COLOUR tone.
    // The window's FINAL hit is the chromatic approach into the NEXT chord
    // (e.g. F# into F major) — legitimate approach vocabulary, excluded.
    const mo = gen({ swing: "straight", progression: "I-vi-IV-V", backingBass: "motown_counter" });
    const moB = bass(mo.b);
    let nat6 = 0, minorSeen = 0;
    for (const c of mo.tl) {
      const ivs = c.intervals.map((x) => ((x % 12) + 12) % 12);
      if (!(ivs.includes(3) && !ivs.includes(4))) continue;
      minorSeen++;
      const hits = moB.filter((e) => e.t >= c.startSec + mo.lead - 1e-3 && e.t < c.endSec + mo.lead - 1e-3);
      for (let i = 0; i < hits.length - 1; i++) if (hits[i].midis[0] % 12 === ((c.rootPc % 12) + 9) % 12) nat6++;
    }
    out.minorSeen = minorSeen; out.nat6 = nat6;
    // (c) comp accent placement (blues + jazz one-liners): Charleston accents
    // the '&-of-2' push; boogie stabs accent '&-of-2'/'&-of-4'. Authored on a
    // straight cfg so the grid positions are unwarped by swing.
    const beat = 60 / base.bpm;
    const accPos = (cellId) => {
      const g = gen({ swing: "straight", backingComp: cellId });
      const comp = (g.b.backingEvents || []).filter((e) => e.role !== "drums" && e.role !== "bass" && e.vel === 1);
      const c0 = g.tl[0];
      return comp.filter((e) => e.t >= c0.startSec + g.lead - 1e-3 && e.t < c0.endSec + g.lead - 1e-3)
        .map((e) => +(((e.t - (c0.startSec + g.lead)) / beat)).toFixed(2));
    };
    out.charlestonAcc = accPos("charleston");
    out.boogieAcc = accPos("boogie_stab");
    return out;
  });
  ok(c5.seamN > 0 && c5.stall === 0, "no cross-barline pitch repeat (the seam-stall fix)", `stalls=${c5.stall}/${c5.seamN}`);
  ok(c5.badSeam === 0, "approaches target the ACTUAL next landing (chromatic resolves by step)", `bad=${c5.badSeam}`);
  ok(c5.accWrong === 0 && c5.firstAcc, "walk accents land ONLY on chord changes (accent = 'new chord here')", `wrong=${c5.accWrong}`);
  ok(c5.minorSeen > 0 && c5.nat6 === 0, "motown: no natural 6 over a minor-3rd chord (the ♭7 plays)", `minors=${c5.minorSeen} nat6=${c5.nat6}`);
  ok(JSON.stringify(c5.charlestonAcc) === "[1.5]", "Charleston accent sits on the '&-of-2' push, not beat 1", JSON.stringify(c5.charlestonAcc));
  ok(JSON.stringify(c5.boogieAcc) === "[1.5,3.5]", "boogie stabs accent '&-of-2'/'&-of-4' (backbeat-side)", JSON.stringify(c5.boogieAcc));

  // ── (8) DRUM_GROOVES — backing-engine step 5: the groove library + fills + humanization ──
  step("drum grooves — backing step 5");
  const d5 = await page.evaluate(() => {
    const D = globalThis.__ss_debug;
    const mk = (over) => Object.assign({ meter: { numerator: 4, denominator: 4, grouping: [] }, bpm: 120, swing: "straight", humanSeed: 12345, audio: {} }, over);
    const out = { badTile: [] };
    // every groove tiles to a finite, in-range, non-empty stream (16s = 8 bars @120)
    for (const gid of Object.keys(D.DRUM_GROOVES)) {
      const ev = D.buildDrumEvents(mk({}), 16, gid);
      const good = ev.length > 0 && ev.every((e) => Number.isFinite(e.t) && e.t >= -1e-9 && e.t < 16 && e.velocity > 0 && e.velocity <= 1 && typeof e.voice === "string");
      if (!good) out.badTile.push(gid);
    }
    // routing (style-keyed, NOT bare swing)
    out.routeJazz = D.resolveGroove(mk({ audioProfile: "jazz" }));
    out.routeJazzObj = D.resolveGroove(mk({ audio: { profile: "jazz" } }));
    out.routeBareSwing = D.resolveGroove(mk({ swing: "swing" }));
    out.routeShuffle = D.resolveGroove(mk({ swing: "shuffle" }));
    out.routeNone = D.resolveGroove(mk({ drums: "none" }));
    out.noneEmpty = D.buildDrumEvents(mk({ drums: "none" }), 16, null).length;
    // jazz feathered kick + foot + no backbeat snare
    const jz = D.buildDrumEvents(mk({ audioProfile: "jazz" }), 16, "jazz_swing");
    out.jazzKickMax = Math.max(...jz.filter((e) => e.voice === "kick").map((e) => e.velocity));
    out.jazzRideMin = Math.min(...jz.filter((e) => e.voice === "ride").map((e) => e.velocity));
    out.jazzFoot = jz.some((e) => e.voice === "hh_pedal");
    out.jazzNoBackbeat = !jz.some((e) => e.voice === "snare" && e.accent);
    // fill: straight rock, default every-8 → bar 8 is a tom fill, hats mute, crash next downbeat
    const rk = D.buildDrumEvents(mk({}), 18, "straight_8th_rock");
    const bar8 = rk.filter((e) => e.t >= 14 && e.t < 16);
    out.fillToms = bar8.some((e) => e.voice.startsWith("tom_"));
    out.fillHatsMuted = !bar8.some((e) => e.voice === "hh_closed");
    out.fillCrash = rk.some((e) => e.voice === "crash_l" && Math.abs(e.t - 16) < 0.05);
    out.bar1Hats = rk.filter((e) => e.t < 2).some((e) => e.voice === "hh_closed");
    // cellBars:2 clave spans both bars of the cell
    const bo = D.buildDrumEvents(mk({}), 16, "bossa").filter((e) => e.voice === "snare_xstick");
    out.bossaClave = bo.length > 0 && bo.some((e) => e.t < 2) && bo.some((e) => e.t >= 2);
    // determinism (humanization included)
    out.det = JSON.stringify(D.buildDrumEvents(mk({ audioProfile: "jazz" }), 16, "jazz_swing")) === JSON.stringify(D.buildDrumEvents(mk({ audioProfile: "jazz" }), 16, "jazz_swing"));
    out.seedVaries = JSON.stringify(D.buildDrumEvents(mk({ humanSeed: 1 }), 16, "funk_16th")) !== JSON.stringify(D.buildDrumEvents(mk({ humanSeed: 2 }), 16, "funk_16th"));
    // the loop's "one" is never micro-shifted
    out.oneClean = rk.some((e) => e.t === 0);
    // odd meter → generic keep (no ride lane crammed)
    const seven = mk({ meter: { numerator: 7, denominator: 8, grouping: [2, 2, 3] }, audioProfile: "jazz" });
    const sv = D.buildDrumEvents(seven, 14, D.resolveGroove(seven));
    out.oddN = sv.length; out.oddNoRide = !sv.some((e) => e.voice === "ride");
    return out;
  });
  ok(d5.badTile.length === 0, "every groove tiles to a valid event stream", d5.badTile.join(","));
  ok(d5.routeJazz === "jazz_swing" && d5.routeJazzObj === "jazz_swing", "an explicit jazz audioProfile routes to jazz_swing (both cfg shapes)", `${d5.routeJazz}/${d5.routeJazzObj}`);
  ok(d5.routeBareSwing !== "jazz_swing", "a bare swing:'swing' (non-jazz) does NOT drag in the jazz ride", d5.routeBareSwing);
  ok(d5.routeShuffle === "shuffle_blues", "shuffle feel → the triplet shuffle", d5.routeShuffle);
  ok(d5.routeNone === null && d5.noneEmpty === 0, "drums:'none' → a silent kit (drumless genres)", `${d5.routeNone}/${d5.noneEmpty}`);
  ok(d5.jazzKickMax < d5.jazzRideMin && d5.jazzKickMax < 0.28, "jazz kick is feathered (quieter than the ride)", `kick=${d5.jazzKickMax} ride=${d5.jazzRideMin}`);
  ok(d5.jazzFoot && d5.jazzNoBackbeat, "jazz: hi-hat foot on 2&4, no backbeat snare accent in the base");
  ok(d5.fillToms && d5.fillHatsMuted && d5.fillCrash && d5.bar1Hats, "a fill swaps the phrase's last bar (toms), mutes hats, crashes the next downbeat", `toms=${d5.fillToms} mute=${d5.fillHatsMuted} crash=${d5.fillCrash}`);
  ok(d5.bossaClave, "cellBars:2 grooves tile across the multi-bar cell (bossa clave)");
  ok(d5.det, "same cfg => byte-identical drum events (humanization is seeded)");
  ok(d5.seedVaries, "a different humanSeed varies the humanized roll");
  ok(d5.oneClean, "the loop's 'one' is never micro-shifted");
  ok(d5.oddN > 0 && d5.oddNoRide, "odd meter still falls to the generic groove (no 4/4 cell crammed)", `n=${d5.oddN}`);

  // ── (7) scheduler ceiling: a Woodshed Play stays windowed ───────────────────
  step("scheduler ceiling");
  await page.click("#virtuoso-mode-session");
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const sel = document.getElementById("virtuoso-length-preset");
    if (sel) { sel.value = "woodshed"; sel.dispatchEvent(new Event("change", { bubbles: true })); }
  });
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => ({ n: window.__nodeCount, lt: window.__longTasks.length }));
  await page.click("#virtuoso-launch-session");
  await page.waitForFunction(() => document.getElementById("virtuoso-play")?.classList.contains("is-playing"), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const after = await page.evaluate(() => ({ n: window.__nodeCount, longTasks: window.__longTasks.slice() }));
  const created = after.n - before.n;
  const worst = Math.max(0, ...after.longTasks.slice(before.lt));
  ok(created > 0 && created < 2500, "Woodshed Play schedules a bounded window (was 39k whole-pass)", `nodes=${created}`);
  ok(worst < 800, "no second-long main-thread block at Play (was 1.57s)", `worst longtask=${worst}ms`);
  await page.evaluate(() => document.getElementById("virtuoso-play")?.click());
  await page.waitForTimeout(400);

  // ── (6e) Metal lead-over-backing (band-intel 2026-06-13): the SHIPPED trigger
  // for the distorted-comp double-track. A metal LEAD over a real rhythm section —
  // a metal_chug_8 power-5th comp (low register, under the lead) + a root_pump
  // bass under the metal profile, whose comp resolves the Metal amp insert. This
  // path was LATENT before the metal_lead_* pathways: no shipped pathway emitted
  // distorted comp (riff drills back with a pad; strum_comp suppresses comp). ──
  step("metal lead-over-backing (distorted-comp trigger)");
  const c6e = await page.evaluate(() => {
    const S = window.Virtuoso, D = globalThis.__ss_debug;
    const cfg = Object.assign(S.readConfig(), {
      practiceType: "scale", mode: "scale", shapeNotes: null, fretboardSystem: "position",
      key: "E", scale: "natural_minor", stringSetup: "guitar_6_standard", bpm: 100, bars: 8,
      fretMin: 11, fretMax: 15, direction: "up_down", sequence: "none",
      progression: "metal_i_bVI_bVII", chordOverride: "5", meter: { numerator: 4, denominator: 4, grouping: [4] },
      backingStyle: "pad", swing: "straight", backingComp: "metal_chug_8", backingBass: "root_pump",
      backingDensity: undefined, backingPadDev: false,
      audio: { notes: true, harmony: true, metronome: false, profile: "metal", brightness: 0.42 },
    });
    const ex = S.generateExercise(cfg);
    const b = S.makeBundle(ex);
    const be = b.backingEvents || [];
    const comp = be.filter((e) => e.comp != null);
    const bass = be.filter((e) => e.role === "bass");
    const prof = D.resolveAudioProfile(cfg);
    const compMids = comp.flatMap((e) => e.midis || []);
    return {
      notes: (ex.chart.notes || []).length,
      comp: comp.length,
      allChug8: comp.length > 0 && comp.every((e) => e.comp === "metal_chug_8"),
      allRoot5: comp.length > 0 && comp.every((e) => (e.midis || []).length === 2 && e.midis[1] - e.midis[0] === 7),
      compLow: compMids.length > 0 && Math.max(...compMids) <= 59,
      bass: bass.length,
      sg: !!prof.harmony.sg, amp: prof.harmony.amp, padSynth: !!(prof.pad && !prof.pad.engine),
    };
  });
  ok(c6e.notes > 0, "the metal LEAD generates over the backing", `notes=${c6e.notes}`);
  ok(c6e.comp > 0 && c6e.allChug8, "backing emits the metal_chug_8 comp — the distorted double-track trigger", `comp=${c6e.comp}`);
  ok(c6e.allRoot5, "the comp is power 5ths (root+5th, 3rd-less — clean under high gain)");
  ok(c6e.compLow, "the comp sits LOW (≤ midi 59) so it stays under the lead");
  ok(c6e.bass > 0, "the band has a root_pump bass (not just the comp)", `bass=${c6e.bass}`);
  ok(c6e.sg && c6e.amp === "metal", "the metal profile resolves the DI comp through the Metal amp (the realism)", `sg=${c6e.sg} amp=${c6e.amp}`);
  ok(c6e.padSynth, "the distorted Keys/sustain layer stays the synth pad");

  // ── (6f) ARRANGEMENT_RECIPES — band-intelligence B1 (2026-06-13): the recipe
  // layer that lets a STYLE declare its band (pointers onto comp/bass/drum tables)
  // so an un-wired styled cfg gets a band for free. Additive: authored cfg.backing*
  // and the boogie/swing routes always win, un-recipe'd styles fall through. ────
  step("ARRANGEMENT_RECIPES (band-intel B1)");
  const c6f = await page.evaluate(() => {
    const S = window.Virtuoso, D = globalThis.__ss_debug;
    const out = {};
    // (a) resolveArrangement: the genre recipes resolve their picks at groove tier;
    // a still-un-recipe'd style (city-pop — has a profile, no recipe yet) returns
    // EMPTY picks, so the old logic runs (additive, no regression).
    const metal = D.resolveArrangement({ audio: { profile: "metal" } });
    const djent = D.resolveArrangement({ audio: { profile: "djent" } });
    const blues = D.resolveArrangement({ audio: { profile: "blues" } });
    const jazz = D.resolveArrangement({ audio: { profile: "jazz" } });
    const rock = D.resolveArrangement({ audio: { profile: "rock" } });
    const gospel = D.resolveArrangement({ audio: { profile: "gospel" } });
    const funk = D.resolveArrangement({ audio: { profile: "funk" } });
    const country = D.resolveArrangement({ audio: { profile: "country" } });
    const pop = D.resolveArrangement({ audio: { profile: "pop" } });
    // every shipped profile now has a recipe → use a BOGUS id to prove the
    // empty-picks fallthrough (the additive/no-regression invariant).
    const unrec = D.resolveArrangement({ audio: { profile: "__no_such_style__" } });
    out.metalPicks = metal.picks.comp === "metal_chug_stab" && metal.picks.bass === "root_gallop" && metal.tier === "groove";
    out.djentPicks = djent.picks.comp === "metal_pedal_16" && djent.picks.bass === "root_pump";
    out.genrePicks = blues.picks.comp === "boogie_stab" && jazz.picks.comp === "charleston" && jazz.picks.bass === "walking"
      && rock.picks.comp === "rock_chug" && rock.picks.bass === "root_pump" && gospel.picks.comp === "charleston" && gospel.picks.drums === "gospel_pocket";
    // batch 2 — funk/country/pop, each instrument idiomatic (NOT a generic kit):
    // funk on a 16th funk kit (NOT straight_8th), country boom split (bass two_feel
    // + guitar chuck), pop on an 8th backbeat (NOT four-on-the-floor by default).
    out.genrePicks2 = funk.picks.comp === "funk_chank_16" && funk.picks.bass === "funk_pocket_16" && funk.picks.drums === "funk_16th"
      && country.picks.comp === "country_chuck" && country.picks.bass === "two_feel_walk" && country.picks.drums === "country_backbeat"
      && pop.picks.comp === "pop_push" && pop.picks.bass === "root_pump" && pop.picks.drums === "straight_8th_rock";
    out.popNotFourFloor = pop.picks.drums !== "four_on_floor";   // the mandate: not four-on-the-floor for everything
    out.bluesEmpty = !unrec.picks.comp && !unrec.picks.bass && !unrec.picks.drums;
    // Wave 1 world genres (band-intel 2026-06-13) — each idiomatic, never a generic kit.
    const reggae = D.resolveArrangement({ audio: { profile: "reggae" } });
    const disco = D.resolveArrangement({ audio: { profile: "disco" } });
    const latin = D.resolveArrangement({ audio: { profile: "latin" } });
    const soul = D.resolveArrangement({ audio: { profile: "soul" } });
    const afrobeat = D.resolveArrangement({ audio: { profile: "afrobeat" } });
    out.wave1Picks =
         reggae.picks.comp === "reggae_skank" && reggae.picks.bass === "reggae_riddim" && reggae.picks.drums === "reggae_one_drop"
      && disco.picks.comp === "disco_scratch_16" && disco.picks.bass === "octave_jump_bass" && disco.picks.drums === "four_on_floor"
      && latin.picks.comp === "bossa_comp" && latin.picks.bass === "bossa_bass" && latin.picks.drums === "bossa"
      && soul.picks.comp === "soul_stab_16" && soul.picks.bass === "motown_counter" && soul.picks.drums === "soul_backbeat"
      && afrobeat.picks.comp === "afrobeat_interlock" && afrobeat.picks.bass === "afro_ostinato" && afrobeat.picks.drums === "afrobeat";
    // the mandate: none of the Wave-1 genres falls back to a plain straight-8th rock kit
    out.wave1NotGeneric = [reggae, disco, latin, soul, afrobeat].every((r) => r.picks.drums && r.picks.drums !== "straight_8th_rock");
    // the soul `ballad` feel swaps in the 12/8 triplet drummer
    const soulBallad = D.resolveArrangement({ audio: { profile: "soul" }, arrangementFeel: "ballad" });
    out.soulBallad = soulBallad.picks.drums === "soul_12_8";
    // (c2) THE SUBSTRATE VALUE for a Wave-1 genre: an un-wired reggae cfg gets the
    // offbeat skank + the riddim bass from the recipe alone (the i-iv minor vamp).
    const rcfg = Object.assign(S.readConfig(), {
      practiceType: "scale", mode: "scale", shapeNotes: null, fretboardSystem: "position",
      key: "A", scale: "natural_minor", stringSetup: "guitar_6_standard", bpm: 80, bars: 8,
      fretMin: 5, fretMax: 9, direction: "up_down", sequence: "none",
      progression: "i-iv", chordOverride: "auto", chordDepth: "seventh",
      meter: { numerator: 4, denominator: 4, grouping: [4] },
      backingStyle: "pad", swing: "straight", backingComp: "", backingBass: "",
      backingDensity: undefined, backingPadDev: false,
      audio: { notes: true, harmony: true, metronome: false, profile: "reggae", brightness: 0.58 },
    });
    out.reggaeComp = D.compCellForConfig(rcfg);
    const rbe = (S.makeBundle(S.generateExercise(rcfg)).backingEvents) || [];
    out.reggaeBand = rbe.some((e) => e.comp === "reggae_skank") && rbe.some((e) => e.role === "bass");
    // Wave 2 world genres (band-intel 2026-06-13).
    const w2norteno = D.resolveArrangement({ audio: { profile: "norteno" } });
    const w2tango = D.resolveArrangement({ audio: { profile: "tango" } });
    const w2blue = D.resolveArrangement({ audio: { profile: "bluegrass" } });
    const w2city = D.resolveArrangement({ audio: { profile: "city-pop" } });
    const w2nola = D.resolveArrangement({ audio: { profile: "new_orleans" } });
    out.wave2Picks =
         w2norteno.picks.comp === "bajo_chop" && w2norteno.picks.bass === "oompah_polka" && w2norteno.picks.drums === "straight_8th_rock"
      && w2tango.picks.comp === "marcato4" && w2tango.picks.bass === "habanera_332" && !w2tango.picks.drums
      && w2blue.picks.comp === "banjo_roll" && w2blue.picks.bass === "two_feel" && !w2blue.picks.drums
      && w2city.picks.comp === "citypop_maj9_16" && w2city.picks.bass === "funk_pocket_16"
      && w2nola.picks.comp === "rhumba_boogie" && w2nola.picks.bass === "tresillo_nola" && w2nola.picks.drums === "second_line";
    // DRUMLESS proof: a tango chart emits a bass line but NO drum events.
    const tcfg = Object.assign(S.readConfig(), {
      practiceType: "scale", mode: "scale", shapeNotes: null, fretboardSystem: "position",
      key: "A", scale: "harmonic_minor", stringSetup: "guitar_6_standard", bpm: 90, bars: 8,
      fretMin: 5, fretMax: 9, direction: "up_down", sequence: "none",
      progression: "andalusian", chordOverride: "auto", chordDepth: "seventh",
      meter: { numerator: 4, denominator: 4, grouping: [4] },
      backingStyle: "pad", swing: "straight", backingComp: "", backingBass: "",
      backingDensity: undefined, backingPadDev: false,
      audio: { notes: true, harmony: true, metronome: false, profile: "tango", brightness: 0.5 },
    });
    const tbe = (S.makeBundle(S.generateExercise(tcfg)).backingEvents) || [];
    out.tangoDrumless = !tbe.some((e) => e.role === "drums") && tbe.some((e) => e.role === "bass");
    // Wave 3a — the DRUMLESS solo/technique idioms (band-intel 2026-06-13).
    const w3classical = D.resolveArrangement({ audio: { profile: "classical" } });
    const w3flamenco = D.resolveArrangement({ audio: { profile: "flamenco" } });
    const w3folk = D.resolveArrangement({ audio: { profile: "folk" } });
    const w3gypsy = D.resolveArrangement({ audio: { profile: "gypsy_jazz" } });
    const w3rag = D.resolveArrangement({ audio: { profile: "ragtime" } });
    out.wave3aPicks =
         w3classical.picks.comp === "classical_arp" && !w3classical.picks.drums
      && w3flamenco.picks.comp === "rasgueado_tangos" && !w3flamenco.picks.drums
      && w3folk.picks.comp === "travis_pick" && w3folk.picks.bass === "two_feel" && !w3folk.picks.drums
      && w3gypsy.picks.comp === "la_pompe" && w3gypsy.picks.bass === "two_feel" && !w3gypsy.picks.drums
      && w3rag.picks.comp === "stride_oompah" && w3rag.picks.bass === "two_feel" && !w3rag.picks.drums;
    out.wave3aDrumless = [w3classical, w3flamenco, w3folk, w3gypsy, w3rag].every((r) => r.ensemble.drums === "off");
    // the NEW ragtime_circle token (III7–VI7–II7–V7–I secondary-dominant chain) generates a valid chart
    const rgcfg = Object.assign(S.readConfig(), {
      practiceType: "scale", mode: "scale", shapeNotes: null, fretboardSystem: "position",
      key: "C", scale: "major", stringSetup: "guitar_6_standard", bpm: 90, bars: 8, fretMin: 0, fretMax: 5,
      direction: "up_down", sequence: "none", progression: "ragtime_circle", chordOverride: "auto", chordDepth: "seventh",
      meter: { numerator: 4, denominator: 4, grouping: [4] }, backingStyle: "pad", swing: "straight",
      backingComp: "", backingBass: "", audio: { notes: true, harmony: true, metronome: false, profile: "ragtime", brightness: 0.55 },
    });
    const rgch = S.generateExercise(rgcfg);
    out.ragtimeToken = !!(rgch && rgch.chart && (rgch.chart.notes || []).length);
    // Wave 3b — rock-family bands + meter-driven prog (band-intel 2026-06-13).
    const w3surf = D.resolveArrangement({ audio: { profile: "surf" } });
    const w3shoe = D.resolveArrangement({ audio: { profile: "shoegaze" } });
    const w3emo = D.resolveArrangement({ audio: { profile: "emo" } });
    const w3punk = D.resolveArrangement({ audio: { profile: "punk" } });
    const w3prog = D.resolveArrangement({ audio: { profile: "prog" } });
    out.wave3bPicks =
         w3surf.picks.comp === "metal_chug_8" && w3surf.picks.bass === "root_pump" && w3surf.picks.drums === "straight_8th_rock"
      && w3shoe.picks.comp === "drone_wash" && w3shoe.picks.drums === "straight_8th_rock"
      && w3emo.picks.comp === "emo_twinkle" && w3emo.picks.bass === "motown_counter"
      && w3punk.picks.comp === "punk_down8" && w3punk.picks.bass === "root_pump"
      && w3prog.picks.comp === "charleston" && w3prog.picks.bass === "motown_counter";
    // every Wave-3b genre keeps a drummer (rock-family) — none drumless
    out.wave3bDrummed = [w3surf, w3shoe, w3emo, w3punk, w3prog].every((r) => !!r.picks.drums);
    // (b) tier derivation: full tier picks the heavier djent texture + double kick
    const metalFull = D.resolveArrangement({ audio: { profile: "metal" }, densityTier: "full" });
    out.fullTier = metalFull.picks.comp === "metal_pedal_16" && metalFull.picks.drums === "metal_double_kick";
    // (c) THE SUBSTRATE VALUE: an UN-WIRED metal cfg (no backingComp/backingBass)
    // gets the band from the recipe — comp + bass + drums, no hand-wiring.
    const cfg = Object.assign(S.readConfig(), {
      practiceType: "scale", mode: "scale", shapeNotes: null, fretboardSystem: "position",
      key: "E", scale: "natural_minor", stringSetup: "guitar_6_standard", bpm: 100, bars: 8,
      fretMin: 11, fretMax: 15, direction: "up_down", sequence: "none",
      progression: "metal_i_bVI_bVII", chordOverride: "5", meter: { numerator: 4, denominator: 4, grouping: [4] },
      backingStyle: "pad", swing: "straight", backingComp: "", backingBass: "",   // NOT hand-wired
      backingDensity: undefined, backingPadDev: false,
      audio: { notes: true, harmony: true, metronome: false, profile: "metal", brightness: 0.42 },
    });
    out.compDefault = D.compCellForConfig(cfg);
    const be = (S.makeBundle(S.generateExercise(cfg)).backingEvents) || [];
    out.recipeComp = be.some((e) => e.comp === "metal_chug_stab");
    out.recipeBass = be.some((e) => e.role === "bass");
    // (d) NON-REGRESSION: a blues boogie cfg is byte-identical with vs without the
    // recipe layer (it has no recipe → the boogie route still wins).
    const bz = Object.assign(S.readConfig(), {
      practiceType: "scale", mode: "scale", shapeNotes: null, fretboardSystem: "caged", shape: "E",
      key: "A", scale: "blues", stringSetup: "guitar_6_standard", bpm: 100, bars: 12, fretMin: 0, fretMax: 12,
      progression: "12_bar_blues", chordOverride: "dom7", meter: { numerator: 4, denominator: 4, grouping: [4] },
      backingStyle: "boogie", swing: "shuffle", backingComp: "", backingBass: "",
      audio: { notes: false, harmony: true, metronome: false, profile: "blues", brightness: 0.5 },
    });
    out.bluesComp = D.compCellForConfig(bz);   // still boogie_stab (the boogie route, not a recipe)
    return out;
  });
  ok(c6f.metalPicks, "resolveArrangement: metal → metal_chug_stab + root_gallop @ groove tier");
  ok(c6f.djentPicks, "resolveArrangement: djent → metal_pedal_16 + root_pump");
  ok(c6f.genrePicks, "genre recipes resolve: blues=boogie_stab, jazz=charleston/walking, rock=rock_chug/root_pump, gospel=charleston/gospel_pocket");
  ok(c6f.genrePicks2, "batch 2 idiomatic: funk=funk_chank_16/funk_pocket_16/funk_16th, country=country_chuck/two_feel_walk/country_backbeat, pop=pop_push/root_pump/straight_8th_rock");
  ok(c6f.popNotFourFloor, "the mandate: pop's DEFAULT drummer is NOT four-on-the-floor (that's the dance sub-feel)");
  ok(c6f.bluesEmpty, "a still-un-recipe'd style (city-pop) returns EMPTY picks — the old logic runs (no regression)");
  ok(c6f.fullTier, "the full density tier picks the heavier texture (metal_pedal_16 + metal_double_kick)");
  ok(c6f.compDefault === "metal_chug_stab", "compCellForConfig: an UN-WIRED metal cfg inherits metal_chug_stab from the recipe", `got=${c6f.compDefault}`);
  ok(c6f.recipeComp && c6f.recipeBass, "the un-wired metal cfg gets a full band (comp + bass) from the recipe alone");
  ok(c6f.bluesComp === "boogie_stab", "NON-REGRESSION: a blues boogie cfg still resolves boogie_stab (recipe never overrides the boogie route)", `got=${c6f.bluesComp}`);
  ok(c6f.wave1Picks, "Wave 1 recipes resolve: reggae=skank/riddim/one-drop, disco=scratch/octave/four-floor, latin=bossa×3, soul=stab/motown/backbeat, afrobeat=interlock/ostinato/afrobeat");
  ok(c6f.wave1NotGeneric, "the mandate: NO Wave-1 genre defaults to a plain straight-8th rock kit");
  ok(c6f.soulBallad, "soul `ballad` feel swaps in the 12/8 triplet drummer (soul_12_8)");
  ok(c6f.reggaeComp === "reggae_skank", "compCellForConfig: an un-wired reggae cfg inherits reggae_skank from the recipe", `got=${c6f.reggaeComp}`);
  ok(c6f.reggaeBand, "the un-wired reggae cfg gets the offbeat skank + the riddim bass from the recipe alone");
  ok(c6f.wave2Picks, "Wave 2 recipes resolve: norteno=bajo_chop/oompah, tango=marcato4/habanera (drumless), bluegrass=banjo_roll/two_feel (drumless), city-pop=maj9/funk_pocket, new-orleans=rhumba/tresillo/second_line");
  ok(c6f.tangoDrumless, "DRUMLESS proof: a tango chart emits a bass line but NO drum events (DRUMLESS_PROFILES)");
  ok(c6f.wave3aPicks, "Wave 3a recipes resolve: classical=classical_arp, flamenco=rasgueado_tangos, folk=travis_pick, gypsy_jazz=la_pompe, ragtime=stride_oompah — all drumless");
  ok(c6f.wave3aDrumless, "Wave 3a all 5 solo idioms declare drums:off (DRUMLESS_PROFILES)");
  ok(c6f.ragtimeToken, "ragtime_circle (III7–VI7–II7–V7–I secondary-dominant chain) generates a valid chart");
  ok(c6f.wave3bPicks, "Wave 3b recipes resolve: surf=metal_chug/root_pump, shoegaze=drone_wash, emo=emo_twinkle/motown, punk=punk_down8, prog=charleston/motown");
  ok(c6f.wave3bDrummed, "Wave 3b (rock-family) all keep a drummer (not drumless)");

  // ── (6g) Western swing + Synthwave bands + the noSwing comp-propagation fix
  // (panel 2026-06-15). The two new style recipes resolve their bands + the new
  // all-synth synthwave profile routes; and the ENGINE FIX — a noSwing comp cell
  // (sock_rhythm) stays EXEMPT from the global swing warp under a swing-feel genre
  // (was silently ignored: buildCompCellHits never propagated cell.noSwing). ──
  step("western-swing + synthwave bands + noSwing comp exemption (6g)");
  const c6g = await page.evaluate(() => {
    const S = window.Virtuoso, D = globalThis.__ss_debug;
    const out = {};
    const ws = D.resolveArrangement({ audio: { profile: "western_swing" } });
    const sw = D.resolveArrangement({ audio: { profile: "synthwave" } });
    const swFull = D.resolveArrangement({ audio: { profile: "synthwave" }, densityTier: "full" });
    out.wsPicks = ws.picks.comp === "sock_rhythm" && ws.picks.bass === "walking" && ws.picks.drums === "ws_shuffle";
    out.wsBanjo = (ws.tracks || []).some((t) => t.cell === "tenor_banjo_chop");
    out.wsHasDrums = !!ws.picks.drums && ws.ensemble.drums !== "off";   // NOT drumless (unlike bluegrass)
    out.swPicks = sw.picks.comp === "synth_arp_16" && sw.picks.bass === "octave_jump_bass" && sw.picks.drums === "four_on_floor";
    out.swStab = (swFull.tracks || []).some((t) => t.cell === "synth_stab");
    const swp = D.resolveAudioProfile({ audio: { profile: "synthwave" } });
    out.swSynth = swp.harmony.tone === "pluck" && swp.pad && swp.pad.tone === "sawpad" && swp.bass && swp.bass.engine === "synth";
    // a western_swing chart (swing:'shuffle'): sock comp + bass + drums + the banjo lane.
    const wcfg = Object.assign(S.readConfig(), {
      practiceType: "scale", mode: "scale", shapeNotes: null, fretboardSystem: "position",
      key: "G", scale: "major", stringSetup: "guitar_6_standard", bpm: 170, bars: 8, fretMin: 0, fretMax: 7,
      direction: "up_down", sequence: "none", progression: "ws_sixth_turnaround", chordOverride: "auto", chordDepth: "seventh",
      meter: { numerator: 4, denominator: 4, grouping: [4] }, backingStyle: "pad", swing: "shuffle",
      backingComp: "", backingBass: "", audio: { notes: true, harmony: true, metronome: false, profile: "western_swing", brightness: 0.58 },
    });
    const wbe = (S.makeBundle(S.generateExercise(wcfg)).backingEvents) || [];
    out.wsBand = wbe.some((e) => e.comp === "sock_rhythm") && wbe.some((e) => e.role === "bass") && wbe.some((e) => e.role === "drums");
    out.wsBanjoLane = wbe.some((e) => e.bus === "comp2");
    // THE FIX: sock_rhythm (noSwing) comp hits carry noSwing:true → exempt from the warp.
    const sockHits = wbe.filter((e) => e.comp === "sock_rhythm");
    out.sockN = sockHits.length; out.sockExempt = sockHits.length > 0 && sockHits.every((e) => e.noSwing === true);
    // contrast: a normal swing comp (jazz charleston) does NOT carry noSwing (cell-driven, not blanket).
    const jcfg = Object.assign(S.readConfig(), {
      practiceType: "scale", mode: "scale", shapeNotes: null, fretboardSystem: "position",
      key: "C", scale: "major", stringSetup: "guitar_6_standard", bpm: 120, bars: 8, fretMin: 0, fretMax: 7,
      direction: "up_down", sequence: "none", progression: "ii-V-I", chordOverride: "auto", chordDepth: "seventh",
      meter: { numerator: 4, denominator: 4, grouping: [4] }, backingStyle: "pad", swing: "swing_8",
      backingComp: "charleston", backingBass: "", audio: { notes: true, harmony: true, metronome: false, profile: "jazz", brightness: 0.55 },
    });
    const charl = ((S.makeBundle(S.generateExercise(jcfg)).backingEvents) || []).filter((e) => e.comp === "charleston");
    out.charlN = charl.length; out.charlNotExempt = charl.length > 0 && charl.every((e) => !e.noSwing);
    return out;
  });
  ok(c6g.wsPicks, "western_swing recipe: sock_rhythm + walking + ws_shuffle");
  ok(c6g.wsBanjo, "western_swing declares the tenor-banjo tracks[] lane");
  ok(c6g.wsHasDrums, "western_swing HAS drums (not drumless, unlike bluegrass)");
  ok(c6g.swPicks, "synthwave recipe: synth_arp_16 + octave_jump_bass + four_on_floor");
  ok(c6g.swStab, "synthwave FULL tier adds the brass-stab tracks[] lane");
  ok(c6g.swSynth, "synthwave profile is all-synth: pluck arp + sawpad + synth-engine bass");
  ok(c6g.wsBand, "a western_swing chart emits sock comp + bass + drums");
  ok(c6g.wsBanjoLane, "the tenor-banjo extra lane emits on comp2");
  ok(c6g.sockN > 0 && c6g.sockExempt, "noSwing FIX: sock_rhythm comp hits carry noSwing:true under a swing genre (exempt from the warp)", `n=${c6g.sockN} exempt=${c6g.sockExempt}`);
  ok(c6g.charlN > 0 && c6g.charlNotExempt, "contrast: a normal swing comp (charleston) is NOT flagged noSwing (cell-driven, not blanket)", `n=${c6g.charlN}`);

  step("mix recipes jam wave");
  const c6h = await page.evaluate(() => {
    const D = globalThis.__ss_debug;
    const styles = ["blues", "funk", "reggae", "disco", "pop", "soul", "synthwave"];
    const base = D.resolveMix({ audio: { profile: "__no_such_style__" } });
    const sig = (m) => JSON.stringify(m);
    const out = {};
    for (const id of styles) {
      const mix = D.resolveMix({ audio: { profile: id } });
      out[id] = {
        nonDefault: sig(mix) !== sig(base),
        hasShape: !!((mix.drumkit && (mix.drumkit.hiShelf || mix.drumkit.loShelf))
          || Object.keys(mix.level || {}).length
          || Object.keys(mix.pan || {}).length
          || Object.keys(mix.carve || {}).length
          || Object.keys(mix.send || {}).length),
      };
    }
    return out;
  });
  for (const id of ["blues", "funk", "reggae", "disco", "pop", "soul", "synthwave"]) {
    ok(c6h[id] && c6h[id].nonDefault && c6h[id].hasShape, `mix recipe: ${id} no longer falls back to the flat house mix`);
  }

  if (errs.length) { fail++; console.log(`  FAIL page errors: ${errs.join(" | ")}`); }
} finally { await browser.close(); }

if (fail) { console.log(`FAIL  backing-engine: ${fail} failure(s) (${pass} passed)`); process.exit(1); }
console.log(`PASS  backing-engine: ${pass} checks passed (timeline validity x styles, 2/bar, push, determinism, key-cycle + session assembly, drum grooves + fills, metal lead-over-backing comp, arrangement recipes B1, western-swing/synthwave bands + noSwing comp exemption, Jam mix recipes)`);
