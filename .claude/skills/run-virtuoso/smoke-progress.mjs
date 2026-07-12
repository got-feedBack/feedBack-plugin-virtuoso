#!/usr/bin/env node
// Assertive smoke test for the Depth Ladder + XP store (Phase 8).
//
// Drives window.Virtuoso's progress helpers directly. Validates: XP accrues
// (derived/gained-only), and the TRAVEL axis credits a clean Push pass in a
// not-yet-credited key ONLY when the Speed climb is already cleared — with the
// rung flipping on the 2nd distinct key, no double-credit on a repeat key, no
// credit on an unclean run, and Off mode collapsing the whole layer.
//
// Usage (host must already be up via launch.ps1):
//   node .claude/skills/run-virtuoso/smoke-progress.mjs   # or: npm run smoke:progress
//
// Exit 0 = all checks pass, 1 = a fatal failure / host down.

import { chromium } from "playwright";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
const BENIGN = [/note detect: mic access denied/i, /desktop audio api not available/i, /audiocontext was (not allowed|prevented|suspended)/i, /the audiocontext was not allowed to start/i, /failed to set up audio analyser/i, /continuous scoring failed to start/i];
const isBenign = (m) => BENIGN.some((re) => re.test(m));

async function ensureHost() {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. Start it with launch.ps1 first.`);
  if (!(await r.json()).ok) throw new Error("Plugin status not ok");
}
async function gotoVirtuoso(page) {
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20_000 });
  await page.waitForFunction(() => typeof window.showScreen === "function", { timeout: 5_000 });
  await page.evaluate(() => window.showScreen("plugin-virtuoso"));
  await page.waitForSelector("#virtuoso-root", { state: "attached", timeout: 10_000 });
  await page.waitForFunction(
    () => window.Virtuoso && typeof window.Virtuoso.advanceDepthLadder === "function" && typeof window.Virtuoso.progressLoad === "function",
    { timeout: 5_000 }
  );
}

function runProgressInPage() {
  const S = window.Virtuoso;
  const out = [];
  const ok = (name, cond, detail) => out.push({ name, ok: !!cond, detail: cond ? "" : (detail || "") });
  // A clean Push run in `key` on a 4-tier pathway (topTier=3).
  const sess = (key, over) => Object.assign({ pathway_id: "pent_foundation", key, bpm_tier: 3, duration_ms: 30000, hit_count: 90, miss_count: 10 }, over || {});

  // ── Travel: Speed cleared (highest_tier=3 on a 4-tier pathway) ──────────────
  localStorage.setItem("virtuoso.pathway_tiers", JSON.stringify({ pent_foundation: { highest_tier: 3 } }));
  localStorage.setItem("virtuoso.progress", JSON.stringify({ mode: "casual", xp: 0, byNode: {} }));
  const r1 = S.advanceDepthLadder(sess("A"));   // 1st key → credited, no rung yet
  const r2 = S.advanceDepthLadder(sess("E"));   // 2nd distinct key → rung flips
  const r3 = S.advanceDepthLadder(sess("A"));   // repeat key → no new credit
  const p = S.progressLoad();
  const node = (p.byNode || {}).pent_foundation || {};
  ok("xp accrued (gained-only) over 3 runs", p.xp > 0, `xp=${p.xp}`);
  ok("1st key credited, no rung", r1 && r1.travelKey === "A" && r1.travelRung === false, JSON.stringify(r1));
  ok("2nd distinct key flips the Travel rung", r2 && r2.travelKey === "E" && r2.travelRung === true, JSON.stringify(r2));
  ok("repeat key not double-credited", r3 && r3.travelKey === null, JSON.stringify(r3));
  ok("keysCleared = [A,E]", JSON.stringify(node.keysCleared) === JSON.stringify(["A", "E"]), JSON.stringify(node.keysCleared));
  ok("Travel rung timestamp set", !!(node.depth && node.depth.travel), JSON.stringify(node.depth));
  const nps = S.nodeProgressState("pent_foundation", JSON.parse(localStorage.getItem("virtuoso.pathway_tiers")));
  ok("nodeProgressState exposes depth.travel=true", !!(nps.depth && nps.depth.travel), JSON.stringify(nps.depth));

  // ── No Travel credit when Speed NOT cleared (highest_tier below top) ────────
  localStorage.setItem("virtuoso.pathway_tiers", JSON.stringify({ pent_foundation: { highest_tier: 1 } }));
  localStorage.setItem("virtuoso.progress", JSON.stringify({ mode: "casual", xp: 0, byNode: {} }));
  const rNoSpeed = S.advanceDepthLadder(sess("A"));
  const pNoSpeed = S.progressLoad();
  ok("no Travel credit before Speed cleared", (!rNoSpeed || rNoSpeed.travelKey === null) && ((pNoSpeed.byNode.pent_foundation || {}).keysCleared || []).length === 0, JSON.stringify(rNoSpeed));
  ok("XP still accrues without Speed cleared", pNoSpeed.xp > 0, `xp=${pNoSpeed.xp}`);

  // ── Unclean run earns no Travel credit (even at Push, Speed cleared) ────────
  localStorage.setItem("virtuoso.pathway_tiers", JSON.stringify({ pent_foundation: { highest_tier: 3 } }));
  localStorage.setItem("virtuoso.progress", JSON.stringify({ mode: "casual", xp: 0, byNode: {} }));
  const rDirty = S.advanceDepthLadder(sess("A", { hit_count: 50, miss_count: 50 }));   // 50% < 65%
  ok("unclean run earns no Travel credit", (!rDirty || rDirty.travelKey === null), JSON.stringify(rDirty));

  // ── CLEAN rung (hand-marks Slice 2): the player-opted supports-off run ──────
  // Credit needs marks OFF at sessionBegin (session.hand_marks_on === false)
  // AND still off at credit time (the live pill state) — plus the same bar as
  // Travel (Speed cleared, top tier, clean). One-time flip.
  localStorage.setItem("virtuoso.pathway_tiers", JSON.stringify({ pent_foundation: { highest_tier: 3 } }));
  localStorage.setItem("virtuoso.progress", JSON.stringify({ mode: "casual", xp: 0, byNode: {} }));
  const hmPrev = localStorage.getItem("virtuoso.showHandMarks");
  localStorage.setItem("virtuoso.showHandMarks", "on");
  const rOn = S.advanceDepthLadder(sess("A", { hand_marks_on: true }));
  ok("no Clean credit while marks are on", !rOn || !rOn.cleanRung, JSON.stringify(rOn));
  localStorage.setItem("virtuoso.showHandMarks", "off");
  const rClean = S.advanceDepthLadder(sess("E", { hand_marks_on: false }));
  const rClean2 = S.advanceDepthLadder(sess("E", { hand_marks_on: false }));
  const pClean = S.progressLoad();
  ok("supports-off clean run credits the Clean rung ONCE",
    rClean && rClean.cleanRung === true && (!rClean2 || !rClean2.cleanRung) && !!(((pClean.byNode.pent_foundation || {}).depth || {}).clean),
    JSON.stringify({ rClean, rClean2 }));
  if (hmPrev == null) localStorage.removeItem("virtuoso.showHandMarks"); else localStorage.setItem("virtuoso.showHandMarks", hmPrev);

  // ── Tier C — XP LEVEL readout (legible skill-tier, gained-only/monotonic) ───
  if (typeof S.xpLevelInfo === "function") {
    const l0 = S.xpLevelInfo(0), lMid = S.xpLevelInfo(30000), lTop = S.xpLevelInfo(10000000);
    ok("xpLevelInfo(0) = Level 1, named, has a next", l0.level === 1 && !!l0.name && l0.nextName && l0.nextAt > 0, JSON.stringify(l0));
    ok("xpLevelInfo rises with XP (monotonic)", lMid.level > l0.level && lTop.level >= lMid.level, `${l0.level}<${lMid.level}<=${lTop.level}`);
    ok("top level has no next (no infinite grind)", lTop.nextName === null && lTop.nextAt === null, JSON.stringify(lTop));
  } else ok("xpLevelInfo exposed", false, "missing on window.Virtuoso");

  // ── Tier C — competency BADGES (pure over the gained-only stores) ───────────
  if (typeof S.computeBadges === "function" && typeof S.creditBadges === "function") {
    // A fully-owned pathway (Push + Travel rung + 5 keys + Clean) lights the set.
    localStorage.setItem("virtuoso.pathway_tiers", JSON.stringify({ pent_foundation: { highest_tier: 3 } }));
    localStorage.setItem("virtuoso.progress", JSON.stringify({
      mode: "casual", xp: 0,
      byNode: { pent_foundation: { keysCleared: ["A", "E", "C", "G", "D"], depth: { travel: 1, clean: 1 } } },
    }));
    const earned = S.computeBadges();
    ok("badges derive from real artifacts (first_clear/push/travels/clean/polyglot)",
      ["first_clear", "push", "travels", "clean", "polyglot"].every(id => earned.includes(id)), JSON.stringify(earned));
    ok("breadth badge NOT earned on a single pathway", !earned.includes("breadth"), JSON.stringify(earned));
    // creditBadges persists + diffs gained-only: first call is fresh, repeat is empty.
    const c1 = S.creditBadges();
    const c2 = S.creditBadges();
    ok("creditBadges returns the new-this-run diff", c1 && c1.newBadges.length >= 5, JSON.stringify(c1 && c1.newBadges.map(b => b.id)));
    ok("badges are gained-only (a repeat run earns no new badge)", c2 && c2.newBadges.length === 0, JSON.stringify(c2 && c2.newBadges));
    ok("earned badges persist on the store", Object.keys(S.progressLoad().badges || {}).length >= 5, JSON.stringify(S.progressLoad().badges));
    // No competency yet → no badges (a fresh player isn't handed one for showing up).
    localStorage.setItem("virtuoso.pathway_tiers", JSON.stringify({}));
    localStorage.setItem("virtuoso.progress", JSON.stringify({ mode: "casual", xp: 0, byNode: {} }));
    ok("no badges without any cleared competency", S.computeBadges().length === 0, JSON.stringify(S.computeBadges()));
  } else ok("computeBadges/creditBadges exposed", false, "missing on window.Virtuoso");

  // ── SHARE CARD (honest mirror on EVERY run; no %/rank; image renders) ────────
  // Anti-inflation moved from the BUTTON to the CONTENT (gamification ruling): every
  // logged run is shareable, but an ordinary run is a dignified descriptive log (no
  // ✓, no fabricated claim) while an earned run leads with the green ✓.
  if (typeof S.shareCardText === "function" && typeof S.isShareworthy === "function") {
    const ordinary = { mode: "custom", scale: "minor_pentatonic", key: "A", duration_ms: 60000, bpm: 90 };
    const earnedRun = { mode: "pathway", displayName: "Pentatonic", duration_ms: 60000, bpm: 120, tierCleared: true, clearedTier: 3, key: "A" };
    const workoutRun = { mode: "session", displayName: "Morning Warm-up", duration_ms: 600000, chapters: [{ role: "warmup" }, { role: "technique" }, { role: "cooldown" }] };
    const jamRun = { jam: true, style: "Blues", scale: "blues", key: "A", bpm: 90, duration_ms: 240000 };
    const oCard = S.shareCardText(ordinary), eCard = S.shareCardText(earnedRun);
    ok("ordinary run STILL produces a card (every run is shareable) — but an HONEST log (no ✓, no fabricated claim)", oCard !== "" && !/✓/.test(oCard) && !/proved|cleared/i.test(oCard) && /Practiced/.test(oCard), `card="${oCard}"`);
    ok("an earned run LEADS with the green ✓ (isShareworthy = leads-with-achievement)", S.isShareworthy(earnedRun) && /✓/.test(eCard) && /Cleared/.test(eCard), eCard);
    ok("a completed Workout card reads 'Completed …' (descriptive, no green hero)", /Completed Morning Warm-up/.test(S.shareCardText(workoutRun)), S.shareCardText(workoutRun));
    ok("Jam card is descriptive (mirror — never a judge)", /Jammed over/.test(S.shareCardText(jamRun)) && !/✓/.test(S.shareCardText(jamRun)), S.shareCardText(jamRun));
    const all = [oCard, eCard, S.shareCardText(workoutRun), S.shareCardText(jamRun)].join("\n");
    ok("NO %/rank/leaderboard on ANY card (public-artifact rule)", !/\d%/.test(all) && !/leaderboard|\brank\b|beat me|#\d+\b/i.test(all), all.replace(/\n/g, " | "));
    if (typeof S.renderShareCardImage === "function") {
      const cv = S.renderShareCardImage(earnedRun);
      ok("renderShareCardImage returns a 1200×630 canvas", cv && cv.width === 1200 && cv.height === 630, cv ? `${cv.width}x${cv.height}` : "null");
    }
  } else ok("shareCardText/isShareworthy exposed", false, "missing on window.Virtuoso");

  // ── Bass FELT-HOLD analyzer + credit (the engagement foundations build) ─────
  if (typeof S.feltHoldAnalyze === "function" && typeof S.creditFeltRung === "function") {
    // Synthetic dev vectors: barSec=1 → MIN_BARS=4 needs ≥4s span; 16 samples @0.5s = 7.5s.
    const vec = (fn) => Array.from({ length: 16 }, (_, i) => ({ t: i * 0.5, d: fn(i) / 1000 }));
    const opts = { barSec: 1 };
    const locked = S.feltHoldAnalyze(vec(i => (i % 2 ? 10 : -10)), opts);          // tight, centered
    const settling = S.feltHoldAnalyze(vec(i => (i % 2 ? 25 : -25)), opts);        // jitter ~37
    const untight = S.feltHoldAnalyze(vec(i => (i % 2 ? 55 : -55)), opts);         // jitter >45
    const dragging = S.feltHoldAnalyze(vec(() => 35), opts);                       // steady +35ms late
    const rushing = S.feltHoldAnalyze(vec(() => -25), opts);                       // steady -25ms early
    const drift = S.feltHoldAnalyze(vec(i => 40 - (i / 15) * 80), opts);           // slides +40→-40 (median ~0)
    const sparse = S.feltHoldAnalyze(Array.from({ length: 8 }, (_, i) => ({ t: i * 0.5, d: 0 })), opts);
    ok("feltHold: tight+centered → LOCKED", locked.verdict === "locked", JSON.stringify(locked));
    ok("feltHold: medium jitter → SETTLING", settling.verdict === "settling", JSON.stringify(settling));
    ok("feltHold: loose+centered → null+untight (no shame, no flip)", untight.verdict === null && untight.untight === true, JSON.stringify(untight));
    ok("feltHold: steady late lean → DRAGGING (+ = behind)", dragging.verdict === "dragging", JSON.stringify(dragging));
    ok("feltHold: steady early lean → RUSHING (− = ahead)", rushing.verdict === "rushing", JSON.stringify(rushing));
    ok("feltHold: center-crossing slide → drift caught (RUSHING), not Locked", drift.verdict === "rushing", JSON.stringify(drift));
    ok("feltHold: < MIN_N evidence → null, not untight", sparse.verdict === null && sparse.untight === false, JSON.stringify(sparse));

    // creditFeltRung — bass_walking is feltGate (tempoTiers [65,85,105,125]).
    localStorage.setItem("virtuoso.pathway_tiers", JSON.stringify({}));
    const cLock = S.creditFeltRung("bass_walking", 105, { verdict: "locked" });    // tier 2 + feltBpm
    const ptW = JSON.parse(localStorage.getItem("virtuoso.pathway_tiers") || "{}").bass_walking || {};
    ok("creditFeltRung LOCKED flips the rung + raises feltBpm", cLock && cLock.flip === true && cLock.tier === 2 && ptW.feltBpm === 105 && ptW.highest_tier === 2, JSON.stringify({ cLock, ptW }));
    localStorage.setItem("virtuoso.pathway_tiers", JSON.stringify({}));
    const cSet = S.creditFeltRung("bass_walking", 85, { verdict: "settling" });    // flips, no feltBpm
    const ptS = JSON.parse(localStorage.getItem("virtuoso.pathway_tiers") || "{}").bass_walking || {};
    ok("creditFeltRung SETTLING flips the rung, no feltBpm PB (D2)", cSet && cSet.flip === true && cSet.feltPB === false && ptS.feltBpm == null, JSON.stringify({ cSet, ptS }));
    const cDrag = S.creditFeltRung("bass_walking", 85, { verdict: "dragging" });   // no flip
    ok("creditFeltRung DRAGGING flips nothing (descriptive only)", cDrag === null, JSON.stringify(cDrag));
    const cNon = S.creditFeltRung("pent_foundation", 105, { verdict: "locked" });  // not a feltGate pathway
    ok("creditFeltRung on a non-feltGate pathway → null", cNon === null, JSON.stringify(cNon));

    // ── Felt-hold FINISHERS (2026-06-12) ────────────────────────────────────────
    // D3 speak-budget lean correction: a steady +45ms RAW lean carried on a
    // low-register speak excess (sb = 31ms — a D2-ish string speaking late) is the
    // STRING's latency, not the player's — corrected it reads in the pocket;
    // the same vector without sb stays an honest Dragging.
    const vecLowReg = Array.from({ length: 16 }, (_, i) => ({ t: i * 0.5, d: 0.045, sb: 0.031 }));
    const vecRawLate = Array.from({ length: 16 }, (_, i) => ({ t: i * 0.5, d: 0.045 }));
    const d3c = S.feltHoldAnalyze(vecLowReg, opts), d3r = S.feltHoldAnalyze(vecRawLate, opts);
    ok("D3: low-string speak excess subtracted — +45ms raw w/ 31ms sb is LOCKED, not Dragging", d3c.verdict === "locked", JSON.stringify(d3c));
    ok("D3: the same +45ms lean WITHOUT sb stays DRAGGING (correction is register-keyed)", d3r.verdict === "dragging", JSON.stringify(d3r));

    // feltGate tag pass (bass-ped ruling 2026-06-12, agent-memory project_felt_gate_tag_pass):
    // the 7 felt rungs flip via the felt door; the NEVER rungs (sub-floor /
    // ghost-note / mirror) must keep the %-gate — tagging bass_root_click would
    // make it permanently unclearable (no lenient path on felt).
    const TAGGED = ["bass_walking", "bass_lc_roots", "bass_lc_approach", "bass_lc_capstone", "bass_octave_groove", "bass_root_fifth_octave", "bass_slap"];
    const NEVER = ["bass_root_click", "bass_dead_notes", "bass_rh_funk_pocket", "bass_lc_trade"];
    const tagBad = TAGGED.filter((id) => {
      localStorage.setItem("virtuoso.pathway_tiers", "{}");
      return !((S.creditFeltRung(id, 200, { verdict: "settling" }) || {}).flip);
    });
    ok("tag pass: all 7 felt rungs complete via the felt door", tagBad.length === 0, "failed: " + tagBad.join(","));
    const nevBad = NEVER.filter((id) => S.creditFeltRung(id, 200, { verdict: "settling" }) !== null);
    ok("tag pass: NEVER rungs (sub-floor/ghost/mirror) keep the %-gate", nevBad.length === 0, "wrongly felt: " + nevBad.join(","));

    // Per-block felt (the Workout finisher): a block whose template credits a
    // feltGate rung analyzes ITS OWN dev slice at ITS OWN barSec; devs outside
    // the block never count; an untagged block falls through to the %-gate.
    const D = globalThis.__ss_debug;
    if (D && typeof D.blockFeltInfo === "function") {
      const blk = { templateId: "b_app_walking", role: "application", start: 0, end: 8, barSec: 1, bpm: 85 };
      const devsIn = Array.from({ length: 16 }, (_, i) => ({ t: i * 0.5, d: 0 }));
      const fIn = D.blockFeltInfo(blk, devsIn);
      ok("per-block felt: a feltGate-crediting block reads its own slice → LOCKED", fIn && fIn.pwId === "bass_walking" && fIn.felt.verdict === "locked", JSON.stringify(fIn));
      const fOut = D.blockFeltInfo(blk, devsIn.map((x) => ({ t: x.t + 20, d: x.d })));
      ok("per-block felt: devs OUTSIDE the block don't count (verdict null)", fOut && fOut.felt.verdict === null, JSON.stringify(fOut));
      ok("per-block felt: an untagged block → null (falls to the %-gate)", D.blockFeltInfo({ templateId: null, start: 0, end: 8, barSec: 1 }, devsIn) === null, "expected null");
    } else ok("__ss_debug.blockFeltInfo exposed", false, "missing — harness flag or export gone");

    // segmentBounds carry barSec (the per-block felt span unit; the desync rule).
    if (typeof S.generateSession === "function" && S.BUILT_IN_SESSIONS) {
      const sid = Object.keys(S.BUILT_IN_SESSIONS)[0];
      const sch = S.generateSession(S.BUILT_IN_SESSIONS[sid]);
      const sb2 = (sch.chart && sch.chart.segmentBounds) || [];
      ok("segmentBounds carry the block's own barSec", sb2.length > 0 && sb2.every((b) => b.barSec > 0), JSON.stringify(sb2.map((b) => b.barSec)));
    }
  } else ok("feltHoldAnalyze/creditFeltRung exposed", false, "missing on window.Virtuoso");

  // ── Off mode collapses the layer (no xp/depth/return; no badge credit) ──────
  S.progressSetMode("off");
  const xpBefore = S.progressLoad().xp;
  const rOff = S.advanceDepthLadder(sess("D"));
  ok("Off mode returns null (no advance)", rOff === null, JSON.stringify(rOff));
  ok("Off mode accrues no XP", S.progressLoad().xp === xpBefore, `xp ${xpBefore}→${S.progressLoad().xp}`);
  if (typeof S.creditBadges === "function") {
    localStorage.setItem("virtuoso.pathway_tiers", JSON.stringify({ pent_foundation: { highest_tier: 3 } }));
    ok("Off mode credits no badges (layer collapsed)", S.creditBadges() === null, "creditBadges should be null in Off");
  }
  S.progressSetMode("casual");

  return out;
}

async function run() {
  await ensureHost();
  const pageErrors = [];
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
    await page.addInitScript(() => { window.__SS_HARNESS__ = true; });   // exposes __ss_debug (blockFeltInfo rows)
    page.on("pageerror", (e) => { if (!isBenign(e.message)) pageErrors.push(e.message); });
    page.on("console", (m) => { if (m.type() === "error" && !isBenign(m.text())) pageErrors.push(m.text()); });
    await gotoVirtuoso(page);
    rows = await page.evaluate(runProgressInPage);
  } finally {
    await browser.close();
  }
  console.log("\n=== Virtuoso depth-ladder / progress smoke ===\n");
  let fail = 0;
  for (const r of rows) {
    console.log(`  [${r.ok ? "PASS" : "FAIL"}] ${r.name}`);
    if (!r.ok) { fail++; if (r.detail) console.log(`         x ${r.detail}`); }
  }
  for (const e of pageErrors) { console.log(`  [FAIL] pageerror: ${e}`); fail++; }
  console.log(`\n${rows.length - rows.filter((r) => !r.ok).length}/${rows.length} progress checks passed.`);
  if (fail) process.exit(1);
}
run().catch((e) => { console.error(e); process.exit(1); });
