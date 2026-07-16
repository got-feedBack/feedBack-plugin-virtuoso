#!/usr/bin/env node
// Regression guard for the prescriptive COACH LOOP (PR 1.3; npm run smoke:coach,
// in npm test). The results modal turns the already-computed diagnostic data
// (heat.fgMiss / transMiss, leanMs, nearMiss, the bass felt verdict) into ONE
// prescriptive next-drill. This suite unit-tests the PURE fault→drill mapping via
// the window.__virtuosoCoach.coachRxFor hook — it takes a fault FIXTURE directly,
// so it is immune to the "smoke mocks the verifier" blind spot (no real detector
// needed). It also asserts every prescribed pathway id is a real #virtuoso-pathway
// <option> so the load button can never dead-end.
//
// The mapping was validated 2026-07-14 by guitar-pedagogy, bass-pedagogy, and
// learning-design agents (see the coachRxFor comments in screen.js). (host up via
// launch.ps1.)
import { chromium } from "playwright";
const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
let fails = 0;
const ok = (c, l, d) => { console.log(`  [${c ? "PASS" : "FAIL"}] ${l}${d ? "  " + d : ""}`); if (!c) fails++; };

const b = await chromium.launch({ headless: true });
try {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. launch.ps1 first.`);
  const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const pageErrs = []; page.on("pageerror", e => pageErrs.push(e.message));
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => typeof window.showScreen === "function");
  await page.evaluate(() => window.showScreen("plugin-virtuoso"));
  await page.waitForSelector("#virtuoso-root", { state: "attached" });
  await page.waitForFunction(() => window.__virtuosoCoach && typeof window.__virtuosoCoach.coachRxFor === "function", { timeout: 10000 });

  // The fault fixtures → expected prescription. Each `info` mirrors the shape the
  // scorer stashes on _ptRunInfo (heat/leanMs/leanN/nearMiss); felt is the bass
  // felt-hold verdict. curPw = the rung just run (drives the never-repeat-it rule).
  const GTR = false, BASS = true;
  const heat = (o) => Object.assign({ missTotal: 0, fgMiss: {}, transMiss: {}, opens: [] }, o);
  const cases = [
    // guitar — a dropped fretting finger → the chromatic warm-up; pinky named.
    { n: "gtr pinky finger", ctx: { isBass: GTR, curPw: "pent_foundation", info: { heat: heat({ missTotal: 5, fgMiss: { 4: 4 } }) } }, id: "chromatic_warmup", why: /pinky/ },
    // guitar — same fault but they JUST ran chromatic_warmup → sibling spider.
    { n: "gtr finger, avoid repeat", ctx: { isBass: GTR, curPw: "chromatic_warmup", info: { heat: heat({ missTotal: 5, fgMiss: { 4: 4 } }) } }, id: "fs_spider_adjacent" },
    // guitar — a fumbled adjacent crossing → alternate picking (NOT string-skip).
    { n: "gtr string crossing", ctx: { isBass: GTR, curPw: "pent_foundation", info: { heat: heat({ missTotal: 4, fgMiss: { 1: 1 }, transMiss: { "0>1": 4 }, opens: [40, 45] }) } }, id: "pick_alternate", why: /E→A/ },
    // guitar — a timing lean ahead of the click → the single-string pulse.
    { n: "gtr rush", ctx: { isBass: GTR, curPw: "pent_foundation", info: { heat: null, leanN: 20, leanMs: -45, nearMiss: 0 } }, id: "rhy_single_string", why: /ahead/ },
    // guitar — timing SCATTER (near-miss) → the subdivision grid.
    { n: "gtr scatter", ctx: { isBass: GTR, curPw: "pent_foundation", info: { heat: null, leanN: 5, leanMs: 5, nearMiss: 6 } }, id: "rhy_subdivision" },
    // PR 1.4 — a lean that LOCALIZES to a hot region names the bars…
    { n: "gtr drag localized", ctx: { isBass: GTR, curPw: "pent_foundation", info: { heat: null, leanN: 20, leanMs: 40, nearMiss: 0,
        leanBars: { bars: [{ i: 0, lean: 5, n: 4 }, { i: 1, lean: 8, n: 4 }, { i: 2, lean: 10, n: 4 }, { i: 3, lean: 12, n: 4 }, { i: 4, lean: 60, n: 4 }, { i: 5, lean: 58, n: 4 }, { i: 6, lean: 9, n: 4 }, { i: 7, lean: 7, n: 4 }] } } }, id: "rhy_single_string", why: /dragged most in bars 5–6/ },
    // …but a WHOLE-RUN lean stays generic (not "bars 1–8").
    { n: "gtr drag global", ctx: { isBass: GTR, curPw: "pent_foundation", info: { heat: null, leanN: 20, leanMs: 40, nearMiss: 0,
        leanBars: { bars: [{ i: 0, lean: 38, n: 4 }, { i: 1, lean: 42, n: 4 }, { i: 2, lean: 40, n: 4 }, { i: 3, lean: 41, n: 4 }, { i: 4, lean: 39, n: 4 }, { i: 5, lean: 43, n: 4 }] } } }, id: "rhy_single_string", why: /behind the click/ },
    // guitar — never send a timing-faulted rhy_single_string run back to itself.
    { n: "gtr rush, avoid repeat", ctx: { isBass: GTR, curPw: "rhy_single_string", info: { heat: null, leanN: 20, leanMs: -45, nearMiss: 0 } }, id: "rhy_subdivision" },
    // bass — a weak pinky routes to the hammer-on/pull-off strengthener (copy too).
    { n: "bass pinky", ctx: { isBass: BASS, curPw: "bass_scale_one_box", info: { heat: heat({ missTotal: 5, fgMiss: { 4: 4 } }) } }, id: "bass_finger_legato", why: /pinky.*hammer-ons/ },
    // bass — any other finger → the fretting-hand Finger Gym, one clean finger/fret.
    { n: "bass middle finger", ctx: { isBass: BASS, curPw: "bass_scale_one_box", info: { heat: heat({ missTotal: 5, fgMiss: { 2: 4 } }) } }, id: "bass_finger_gym", why: /middle.*one clean finger/ },
    // bass — the felt DRAGGING verdict → the above-floor i–m motor (root_click's
    //        sub-70 Hz open roots are the sibling fallback only).
    { n: "bass felt drag", ctx: { isBass: BASS, curPw: "bass_scale_one_box", info: { heat: null, leanN: 0, nearMiss: 0 }, felt: { verdict: "dragging" } }, id: "bass_rh_pulse", why: /behind/ },
    { n: "bass drag, avoid repeat", ctx: { isBass: BASS, curPw: "bass_rh_pulse", info: { heat: null, leanN: 0, nearMiss: 0 }, felt: { verdict: "dragging" } }, id: "bass_root_click" },
    // a clean run (nothing crosses threshold) → no nag.
    { n: "clean run → null", ctx: { isBass: GTR, curPw: "pent_foundation", info: { heat: null, leanN: 5, leanMs: 5, nearMiss: 0 } }, id: null },
  ];

  const results = await page.evaluate((cs) => cs.map(c => {
    const rx = window.__virtuosoCoach.coachRxFor(c.ctx);
    return { n: c.n, pathwayId: rx ? rx.pathwayId : null, why: rx ? rx.why : "" };
  }), cases);

  const prescribed = new Set();
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i], got = results[i];
    ok(got.pathwayId === c.id, c.n, `→ ${got.pathwayId} (want ${c.id})`);
    if (c.why) ok(c.why.test(got.why), `${c.n}: copy`, `“${got.why}”`);
    if (got.pathwayId) prescribed.add(got.pathwayId);
  }

  // Every prescription the mapping can EVER emit must be a real pathway option, or
  // the load button dead-ends. Assert the full target set (not just the fired ones).
  const targets = ["chromatic_warmup", "fs_spider_adjacent", "pick_alternate", "pick_economy",
    "rhy_single_string", "rhy_subdivision", "bass_finger_legato", "bass_finger_gym",
    "bass_rh_crossing", "bass_rh_pulse", "bass_root_click"];
  const opts = await page.evaluate(() => Array.from(document.querySelectorAll('#virtuoso-pathway option')).map(o => o.value));
  for (const t of targets) ok(opts.includes(t), `target is a real pathway option: ${t}`);

  // ── PR 1.5 · Bass Pocket-Diagnosis — the felt { verdict, leanMs, driftMs,
  //    jitterMs, untight } → the SPECIFIC pocket sentence (drift → lean → jitter,
  //    matching feltHoldAnalyze's own verdict bucketing).
  const pocket = [
    { n: "locked → good", felt: { verdict: "locked", leanMs: 5, driftMs: 5, jitterMs: 10 }, tone: "good", text: /Dead in the pocket/ },
    { n: "drift late", felt: { verdict: "dragging", leanMs: 10, driftMs: 50, jitterMs: 20 }, tone: "work", text: /slips later.*slowing down.*keep the subdivision moving/ },
    { n: "drift early", felt: { verdict: "rushing", leanMs: -5, driftMs: -50, jitterMs: 20 }, tone: "work", text: /creeps ahead.*speeding up.*don't chase it/ },
    { n: "drift wins over lean", felt: { verdict: "dragging", leanMs: 40, driftMs: 50, jitterMs: 20 }, tone: "work", text: /across the phrase/ },
    { n: "lean behind", felt: { verdict: "dragging", leanMs: 35, driftMs: 5, jitterMs: 20 }, tone: "work", text: /behind the beat.*Lean in a hair earlier/ },
    { n: "lean ahead", felt: { verdict: "rushing", leanMs: -25, driftMs: 5, jitterMs: 20 }, tone: "work", text: /ahead of the beat.*Relax/ },
    { n: "settling jitter", felt: { verdict: "settling", leanMs: 5, driftMs: 5, jitterMs: 38 }, tone: "work", text: /uneven.*not locked yet/ },
    { n: "untight", felt: { verdict: null, untight: true, leanMs: 5, driftMs: 5, jitterMs: 60 }, tone: "work", text: /uneven/ },
    { n: "low evidence → null", felt: { verdict: null, untight: false, leanMs: 5, driftMs: 5, jitterMs: 10 }, tone: null, text: null },
    { n: "no felt → null", felt: null, tone: null, text: null },
  ];
  const pres = await page.evaluate((ps) => ps.map(p => {
    const d = window.__virtuosoCoach.buildPocketDiagnosis(p.felt);
    return { n: p.n, tone: d ? d.tone : null, text: d ? d.text : "" };
  }), pocket);
  for (let i = 0; i < pocket.length; i++) {
    const p = pocket[i], got = pres[i];
    ok(got.tone === p.tone, `pocket: ${p.n}`, `tone=${got.tone} (want ${p.tone})`);
    if (p.text) ok(p.text.test(got.text), `pocket: ${p.n} copy`, `“${got.text}”`);
    else ok(got.text === "", `pocket: ${p.n} suppressed`);
  }

  // ── anti-thrash hysteresis — keep the player on ONE fix across runs. Given a
  //    ranked candidate list + last run's focus { cat, streak }, decide which
  //    fault to prescribe now and the focus to persist.
  const F = { fault: "finger", pathwayId: "chromatic_warmup", why: "f" };
  const T = { fault: "timing", pathwayId: "rhy_single_string", why: "t" };
  const hyst = [
    // last run said finger; timing now tops but finger still trips → REINFORCE finger.
    { n: "reinforce prior focus", cands: [T, F], prev: { cat: "finger", streak: 0 }, chosen: "finger", streak: 1 },
    // …but not forever: after 2 reinforcements, let the new top take over.
    { n: "release after 2 holds", cands: [T, F], prev: { cat: "finger", streak: 2 }, chosen: "timing", streak: 0 },
    // prior focus no longer trips a threshold → switch to the top.
    { n: "prior focus gone → top", cands: [T], prev: { cat: "finger", streak: 0 }, chosen: "timing", streak: 0 },
    // no history → the top, fresh streak.
    { n: "no history → top", cands: [F, T], prev: null, chosen: "finger", streak: 0 },
    // same fault two runs running → natural reinforcement, streak grows.
    { n: "same top → streak grows", cands: [T], prev: { cat: "timing", streak: 1 }, chosen: "timing", streak: 2 },
    // nothing to prescribe → keep the prior focus untouched, no pick.
    { n: "no candidates → null", cands: [], prev: { cat: "timing", streak: 1 }, chosen: null, streak: 1 },
  ];
  const hres = await page.evaluate((hs) => hs.map(h => {
    const r = window.__virtuosoCoach.applyCoachHysteresis(h.cands, h.prev);
    return { n: h.n, chosen: r.chosen ? r.chosen.fault : null, streak: r.focus ? r.focus.streak : null };
  }), hyst);
  for (let i = 0; i < hyst.length; i++) {
    const h = hyst[i], got = hres[i];
    ok(got.chosen === h.chosen && got.streak === h.streak, `hysteresis: ${h.n}`, `chosen=${got.chosen} streak=${got.streak}`);
  }

  // ── REGRESSION (v0.2.5): the run-end _lastEndedSession snapshot must carry
  //    pathway_id + practice_type. The bug: the snapshot copied `mode` but dropped
  //    those two, so buildCoachRx's `curPw = s.mode==='pathway' ? s.pathway_id : null`
  //    was ALWAYS undefined → the anti-self-prescribe pick() was a no-op (it
  //    re-prescribed the just-run rung) and the hysteresis bucket key collapsed to
  //    one shared "pathway:" bucket. The pure hooks above take an explicit ctx.curPw,
  //    so they could not catch it — this drives a REAL pathway run and inspects the
  //    actual _lastEndedSession → curPw seam.
  console.log("\n-- run-end snapshot → curPw seam (drives a real run) --");
  const RUNG = "chromatic_warmup", SIBLING = "fs_spider_adjacent";
  await page.evaluate((id) => {
    try { localStorage.removeItem("virtuoso.coach_focus"); } catch (_) {}   // clear hysteresis so the behavioral assert is fresh
    const sel = document.querySelector("#virtuoso-pathway");
    sel.value = id; sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, RUNG);
  await page.waitForTimeout(300);
  // Start, hold > 2s (sessionEnd discards sub-2s blips), then Stop (session end).
  await page.click("#virtuoso-play");
  const started = await page.waitForSelector("#virtuoso-stop:not([disabled])", { timeout: 8000 }).then(() => true).catch(() => false);
  ok(started, "real pathway run started (stop button armed)");
  await page.waitForTimeout(4200);   // clear the 2s duration gate even with a count-in
  await page.click("#virtuoso-stop");
  await page.waitForTimeout(400);

  const snap = await page.evaluate(() => {
    const s = window.__virtuosoCoach.lastEndedSession();
    return s ? { mode: s.mode, pathway_id: s.pathway_id, practice_type: s.practice_type } : null;
  });
  ok(!!snap, "a >2s pathway run produced a _lastEndedSession snapshot");
  ok(!!snap && snap.mode === "pathway", "snapshot.mode === 'pathway'", snap && `mode=${snap.mode}`);
  ok(!!snap && snap.pathway_id === RUNG, "snapshot carries pathway_id (the dropped field)", snap && `pathway_id=${snap.pathway_id}`);
  ok(!!snap && !!snap.practice_type, "snapshot carries practice_type (the other dropped field)", snap && `practice_type=${snap.practice_type}`);

  // Behavioral: feed the REAL snapshot + a finger fault through the REAL buildCoachRx.
  // The whole point of the fix — it must NOT re-prescribe the rung just run.
  const rx = await page.evaluate(() => {
    const s = window.__virtuosoCoach.lastEndedSession();
    if (!s) return { err: "no snapshot" };
    const info = { heat: { missTotal: 5, fgMiss: { 4: 4 }, transMiss: {}, opens: [] } };   // dropped-pinky fault
    const r = window.__virtuosoCoach.buildCoachRx(s, { judgedPassed: 10 }, info);
    return { pathwayId: r ? r.pathwayId : null };
  });
  ok(rx.pathwayId && rx.pathwayId !== RUNG, "coach does NOT re-prescribe the just-run rung (curPw honored)", `→ ${rx.pathwayId}`);
  ok(rx.pathwayId === SIBLING, "a finger fault on chromatic_warmup falls to its sibling", `→ ${rx.pathwayId} (want ${SIBLING})`);

  ok(pageErrs.length === 0, "no uncaught page errors", pageErrs.join(" | "));
  console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  coach prescription: ${fails} failure(s)`);
  process.exit(fails ? 1 : 0);
} finally { await b.close(); }
