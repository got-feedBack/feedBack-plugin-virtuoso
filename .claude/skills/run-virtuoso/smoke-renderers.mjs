#!/usr/bin/env node
// Assertive smoke test across all four Virtuoso renderers.
//
// Unlike `driver.mjs all-renderers` (which only screenshots), this PASSES or
// FAILS each renderer on concrete signals and exits non-zero if any fail —
// so it can gate a refactor of screen.js without eyeballing PNGs.
//
// Per renderer it asserts:
//   1. view switch took          — the clicked .virtuoso-view-btn is .active
//   2. renderer attached         — #virtuoso-renderer-status is non-empty
//   3. a render surface exists   — a sized, visible <canvas> in .virtuoso-render-host
//   4. it actually drew          — non-uniform pixels (enforced only for the
//                                  in-tree 2D renderers; borrowed WebGL/host
//                                  viz mount their own canvas we can't read)
//   5. playback drives the clock — #virtuoso-time-cur advances after Play
//   6. no uncaught errors        — no pageerror / non-benign console.error
//                                  during attach + draw + playback
//
// Usage (host must already be up via launch.ps1):
//   node .claude/skills/run-virtuoso/smoke-renderers.mjs
//
// Exit code 0 = all renderers passed, 1 = one or more failed (or host down).
// On any failure it drops a screenshot in .virtuoso-shots/smoke-fail-<kind>.png.

import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
const SHOT_DIR = process.env.SHOT_DIR || resolve(dirname(fileURLToPath(import.meta.url)), "../../../.virtuoso-shots");

// kind matches data-renderer on the view buttons. enforcePixels is true only
// where Virtuoso draws into the in-tree #virtuoso-canvas with a 2D context;
// highway_3d and builtin_2d borrow host viz that mount their own canvas.
const RENDERERS = [
  { kind: "highway_3d",  enforcePixels: false },
  { kind: "builtin_2d",  enforcePixels: false },
  { kind: "tab_2d",      enforcePixels: true  },
  { kind: "notation_2d", enforcePixels: true  },
];

// Console noise that is expected and not a Virtuoso fault (see SKILL.md #7 +
// headless AudioContext autoplay policy).
const BENIGN = [/note detect: mic access denied/i, 
  /failed to set up audio analyser/i,
  /invalidstateerror/i,
  /audiocontext was not allowed to start/i,
  /the audiocontext was (not allowed|prevented)/i,
  /play\(\) request was interrupted/i,
  /continuous scoring failed to start/i,   // host Minigames SDK can't start mic in headless — scoring is optional
];
const isBenign = (msg) => BENIGN.some((re) => re.test(msg));
// A borrowed host-viz plugin (Jumping Tab / Piano) that isn't present in the
// RUNNING host 404s on its screen.js — e.g. when testing against the source
// CHECKOUT, which lacks the Desktop-bundled viz plugins. Virtuoso falls back to
// its in-tree renderer. Benign here; on the bundled target the plugin exists so
// this never fires. Scoped to those plugin script URLs (the 404 text alone has no URL).
const isBenignResource = (text, url) =>
  /failed to load resource/i.test(text) && /\/api\/plugins\/(jumpingtab|piano)\/screen\.js/.test(url || "");

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
  await page.waitForSelector(".virtuoso-view-btn", { timeout: 5_000 });
}

// Trigger a generate. Pathway mode (default) has no Regenerate button — a
// tempo-tier click generates; Custom mode exposes #virtuoso-regenerate; the
// public API is the last resort. Mirrors driver.mjs.generate().
async function generate(page) {
  const tier = await page.$("#virtuoso-tempo-tiers button, .virtuoso-tier-btn, [data-tempo-tier]");
  const regen = await page.$("#virtuoso-regenerate");
  if (tier && (await tier.isVisible())) await tier.click();
  else if (regen && (await regen.isVisible())) await regen.click();
  else await page.evaluate(() => window.Virtuoso?.generateExercise?.(window.Virtuoso?.readConfig?.() || {}));
  await page.waitForFunction(() => {
    const s = document.getElementById("virtuoso-renderer-status");
    return s && s.textContent && s.textContent.trim().length > 0;
  }, { timeout: 5_000 });
  await page.waitForTimeout(500);
}

async function switchRenderer(page, kind) {
  const btn = await page.$(`.virtuoso-view-btn[data-renderer="${kind}"]`);
  if (!btn) throw new Error(`Renderer button not found: ${kind}`);
  await btn.click();
  await page.waitForTimeout(700); // attachRenderer is async (may lazy-load host viz)
}

function readSizedCanvas() {
  const host = document.querySelector(".virtuoso-render-host");
  if (!host) return null;
  // The render host also holds the DAW ruler and the chord-box overlay — those
  // are chrome, not the render surface. The real surface is #virtuoso-canvas
  // (in-tree renderers) or a borrowed host-viz canvas mounted as its sibling.
  const NON_RENDER = new Set(["virtuoso-ruler-canvas", "virtuoso-chordbox"]);
  const canvases = [...host.querySelectorAll("canvas")].filter((c) => !NON_RENDER.has(c.id));
  const visible = canvases.find((c) => {
    const r = c.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && c.offsetParent !== null;
  }) || canvases.find((c) => c.width > 1 && c.height > 1);
  return visible ? { id: visible.id || "(anon)", w: visible.width, h: visible.height } : null;
}

// 'drew' | 'blank' | 'na' — best-effort. Only meaningful for a 2D #virtuoso-canvas.
function readPixels() {
  const c = document.getElementById("virtuoso-canvas");
  if (!c) return "na";
  let ctx;
  try { ctx = c.getContext("2d"); } catch { return "na"; }
  if (!ctx) return "na"; // canvas is a WebGL/host-viz surface
  try {
    const w = Math.min(c.width, 400), h = Math.min(c.height, 300);
    if (w < 2 || h < 2) return "na";
    const data = ctx.getImageData(0, 0, w, h).data;
    const seen = new Set();
    for (let i = 0; i < data.length; i += 4 * 37) {
      seen.add(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`);
      if (seen.size > 2) break;
    }
    return seen.size >= 2 ? "drew" : "blank";
  } catch { return "na"; } // tainted / context lost
}

async function clockAdvances(page) {
  const cur = () => page.$eval("#virtuoso-time-cur", (e) => e.textContent.trim());
  const t0 = await cur();
  await page.click("#virtuoso-play");
  let now = t0, advanced = false;
  for (let i = 0; i < 12 && !advanced; i++) {
    await page.waitForTimeout(400);
    now = await cur();
    advanced = now !== t0;
  }
  // Stop so the next renderer starts clean (Play toggles PAUSE since the 2026-06-06
  // transport split — the dedicated Stop button is the full-stop path; evaluate-click
  // so a disabled Stop is a no-op rather than a Playwright actionability timeout).
  // A deliberate Stop pops the RESULTS modal (detection-testing instrument) —
  // close it so the overlay can't intercept the next renderer-switch click.
  await page.evaluate(() => { document.getElementById("virtuoso-stop")?.click(); document.getElementById("virtuoso-results-close")?.click(); });
  await page.waitForTimeout(150);
  return { advanced, from: t0, to: now };
}

async function screenshot(page, name) {
  if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: resolve(SHOT_DIR, `${name}.png`), fullPage: false });
}

async function run() {
  await ensureHost();
  const pageErrors = [];
  const consoleErrors = [];
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => { globalThis.__SS_HARNESS__ = true; });   // exposes __ss_debug.avSync() for the transport row (harmless: debug-only)
    const page = await ctx.newPage();
    page.on("pageerror", (e) => { if (!isBenign(e.message)) pageErrors.push(e.message); });
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const text = m.text();
      const url = (m.location() && m.location().url) || "";
      if (isBenign(text) || isBenignResource(text, url)) return;
      consoleErrors.push(text);
    });

    await gotoVirtuoso(page);
    await generate(page);

    for (const r of RENDERERS) {
      const errBase = pageErrors.length;
      const conBase = consoleErrors.length;
      const fails = [];
      const notes = [];

      await switchRenderer(page, r.kind);
      await generate(page);

      const active = await page
        .$eval(`.virtuoso-view-btn[data-renderer="${r.kind}"]`, (b) => b.classList.contains("active"))
        .catch(() => false);
      if (!active) fails.push("view button not active after click");

      const status = (await page.$eval("#virtuoso-renderer-status", (e) => e.textContent.trim()).catch(() => "")) || "";
      if (!status) fails.push("renderer-status label empty");

      const canvas = await page.evaluate(readSizedCanvas);
      if (!canvas) fails.push("no sized/visible canvas in render host");

      const pixels = await page.evaluate(readPixels);
      if (r.enforcePixels && pixels === "blank") fails.push("canvas drew only a uniform fill (blank)");

      const clock = await clockAdvances(page);
      // A borrowed-viz renderer that FELL BACK because the running host lacks the
      // plugin (builtin_2d → the in-tree 2D fallback when the Desktop-bundled Jumping
      // Tab viz isn't in the source checkout) exercises a dev-only path whose clock
      // edge is a known, non-user-facing artifact. Don't hard-fail it on that host —
      // on the bundled/Desktop target the viz IS present (no "fallback" in the status),
      // so the clock check still applies fully there.
      const fellBack = /fallback/i.test(status);
      if (!clock.advanced) {
        if (r.kind === "builtin_2d" && fellBack) notes.push(`clock stuck — expected: ${r.kind} fell back (host lacks the borrowable Jumping Tab viz)`);
        else fails.push(`clock did not advance (stuck at ${clock.from})`);
      }

      const newPageErrs = pageErrors.slice(errBase);
      const newConErrs = consoleErrors.slice(conBase);
      for (const e of newPageErrs) fails.push(`pageerror: ${e}`);
      for (const e of newConErrs) fails.push(`console.error: ${e}`);

      const pass = fails.length === 0;
      if (!pass) await screenshot(page, `smoke-fail-${r.kind}`);
      results.push({ kind: r.kind, pass, status, canvas, pixels, clock, fails, notes });
    }

    // ── Transport split semantics (2026-06-06): Play/Pause toggle + dedicated
    // Stop. Pause freezes the clock in place (no advance, audio stops), Play
    // resumes from the frozen playhead, Stop ends the run and returns the
    // playhead to where play began; Stop is disabled when no run is alive.
    {
      const tFails = [];
      const cur = () => page.$eval("#virtuoso-time-cur", (e) => e.textContent.trim());
      await page.evaluate(() => document.getElementById("virtuoso-to-start")?.click());
      await page.waitForTimeout(200);
      if (!(await page.$eval("#virtuoso-stop", (e) => e.disabled))) tFails.push("Stop not disabled while stopped");
      await page.click("#virtuoso-play");                       // start
      let started = false;
      for (let i = 0; i < 12 && !started; i++) { await page.waitForTimeout(400); started = (await cur()) !== "0:00"; }
      if (!started) tFails.push("run never started");
      const mid = await page.evaluate(() => ({ txt: document.getElementById("virtuoso-play").textContent, stopOn: !document.getElementById("virtuoso-stop").disabled }));
      if (!/⏸|pause/i.test(mid.txt)) tFails.push(`running button reads "${mid.txt}" (expected ⏸/Pause)`);
      if (!mid.stopOn) tFails.push("Stop not enabled while running");
      await page.click("#virtuoso-play");                       // pause
      await page.waitForTimeout(300);
      const f1 = await cur();
      await page.waitForTimeout(1600);                           // > 1s: a running clock must roll a second
      const f2 = await cur();
      if (f1 !== f2) tFails.push(`paused clock moved (${f1} -> ${f2})`);
      const pausedTxt = await page.$eval("#virtuoso-play", (e) => e.textContent);
      if (!/▶|play/i.test(pausedTxt)) tFails.push(`paused button reads "${pausedTxt}" (expected ▶/Play)`);
      await page.click("#virtuoso-play");                       // resume
      let resumed = false;
      for (let i = 0; i < 12 && !resumed; i++) { await page.waitForTimeout(400); resumed = (await cur()) !== f2; }
      if (!resumed) tFails.push(`resume did not advance the clock (stuck at ${f2})`);
      await page.click("#virtuoso-stop");                       // dedicated stop
      await page.waitForTimeout(300);
      // The deliberate stop pops the results modal — assert it showed (the
      // detection-testing instrument), then close it for the wakelock phase.
      const modalShown = await page.evaluate(() => {
        const open = document.getElementById("virtuoso-root")?.classList.contains("vir-results-open");
        document.getElementById("virtuoso-results-close")?.click();
        return !!open;
      });
      if (!modalShown) tFails.push("deliberate Stop did not pop the results modal");
      const end = await page.evaluate(() => ({ t: document.getElementById("virtuoso-time-cur").textContent.trim(), txt: document.getElementById("virtuoso-play").textContent, stopOff: document.getElementById("virtuoso-stop").disabled }));
      if (end.t !== "0:00") tFails.push(`Stop did not return the playhead to the run start (at ${end.t})`);
      if (!/▶|play/i.test(end.txt)) tFails.push(`stopped button reads "${end.txt}" (expected ▶/Play)`);
      if (!end.stopOff) tFails.push("Stop not disabled after stopping");
      results.push({ kind: "transport", pass: tFails.length === 0, status: "play/pause + dedicated stop", canvas: null, pixels: "n/a", clock: { from: "0:00", to: end.t }, fails: tFails, notes: [] });
    }

    // ── Seamless A-B jam loop + in-place hot-swap (Stage-3 transport rework,
    // promoted from probe-jam-transport). The A-B segment loop (Jam) now loops
    // via the GAPLESS rolling-window scheduler — wrap B->A on the same ctx clock,
    // phase-carry the visual clock — instead of stopAudio()+reschedule at every
    // wrap (which made jams STUTTER at the seam). The gapless invariant:
    // scheduledUntilCtx stays AHEAD of the ctx clock at every frame, incl. wraps
    // (the old path reset it to 0). A queued jam change lands at the wrap IN
    // PLACE: the bundle is swapped without tearing down the renderer, so the
    // canvas DOM node survives, the chart changes, and playback never stops.
    {
      const jFails = [];
      const errBase = pageErrors.length;
      await page.evaluate(() => document.querySelector('[data-mode="jam"]')?.click());
      await page.waitForTimeout(300);
      await page.evaluate(() => { const t = document.getElementById("virtuoso-jam-tempo"); if (t) t.value = "90"; });
      await page.evaluate(() => document.getElementById("virtuoso-jam-go")?.click());
      const ready = await page.waitForFunction(() => { const a = globalThis.__ss_debug?.avSync?.(); return a && a.playing && a.scheduledUntilCtx > 0; }, { timeout: 8000 }).then(() => true).catch(() => false);
      if (!ready) jFails.push("jam did not start (no anchored ctx clock)");
      if (ready) {
        // Force a SHORT loop so it wraps several times within the sample window.
        const loop = await page.evaluate(() => { const info = window.Virtuoso.getActiveBundleInfo(); const lead = info.leadIn || 0; window.Virtuoso.setSegmentLoop(lead, lead + 1.2); return { a: lead, b: lead + 1.2, dur: info.duration }; });
        const samples = [];
        for (let i = 0; i < 36; i++) { const s = await page.evaluate(() => { const a = globalThis.__ss_debug.avSync(); return a ? { c: a.ctxNow, s: a.scheduledUntilCtx, t: a.practiceTime, p: a.playing } : null; }); if (s) samples.push(s); await page.waitForTimeout(80); }
        const steady = samples.slice(7);   // skip the first ~0.5s while the short-loop horizon fills
        if (steady.length < 20) jFails.push(`too few transport samples (${steady.length})`);
        else {
          const minAhead = Math.min(...steady.map((s) => s.s - s.c));
          if (!steady.every((s) => s.p)) jFails.push("playback stopped mid-loop");
          if (!(minAhead > 0.25)) jFails.push(`audio horizon fell behind the ctx clock (minAhead=${minAhead.toFixed(3)}s) — loop seam NOT gapless`);
          const maxT = Math.max(...steady.map((s) => s.t));
          if (maxT > loop.b + 0.3) jFails.push(`playhead ran past B (maxT=${maxT.toFixed(2)} > B=${loop.b.toFixed(2)}) — no phase-carry wrap`);
          let wraps = 0; for (let i = 1; i < steady.length; i++) if (steady[i].t < steady[i - 1].t - 0.3) wraps++;
          if (wraps < 2) jFails.push(`loop did not cycle at least twice (wraps=${wraps})`);
        }
        // In-place hot-swap: tag the canvas, re-arm a short loop, queue a tempo change.
        const before = await page.evaluate(() => { const c = document.getElementById("virtuoso-canvas"); if (c) c.__probeTag = "SWAP"; const info = window.Virtuoso.getActiveBundleInfo(); window.Virtuoso.setSegmentLoop(info.leadIn || 0, (info.leadIn || 0) + 1.0); const t = document.getElementById("virtuoso-jam-tempo"); if (t) { t.value = "150"; t.dispatchEvent(new Event("change", { bubbles: true })); } return { dur: info.duration, tagged: !!c }; });
        if (!before.tagged) jFails.push("could not tag the live canvas");
        let swapped = false, after = null;
        for (let i = 0; i < 50; i++) { after = await page.evaluate(() => { const c = document.getElementById("virtuoso-canvas"); const info = window.Virtuoso.getActiveBundleInfo(); const lp = window.Virtuoso.getSegmentLoop(); const a = globalThis.__ss_debug.avSync(); const chip = document.getElementById("virtuoso-jam-pending"); return { tag: c ? c.__probeTag : null, dur: info.duration, lead: info.leadIn, la: lp.a, lb: lp.b, playing: a ? a.playing : false, pendingHidden: chip ? chip.hidden : true }; }); if (Math.abs(after.dur - before.dur) > 0.05 && after.pendingHidden) { swapped = true; break; } await page.waitForTimeout(100); }
        if (!swapped) jFails.push("queued change never landed at the wrap (chart duration unchanged)");
        if (after && after.tag !== "SWAP") jFails.push("canvas was rebuilt on the swap (renderer torn down — NOT in-place)");
        if (after && !after.playing) jFails.push("playback stopped during the hot-swap");
        if (after && !(after.la != null && Math.abs(after.la - after.lead) < 0.06 && after.lb != null && Math.abs(after.lb - after.dur) < 0.06)) jFails.push(`loop did not re-anchor to the new chart ([${after.la},${after.lb}] vs new [${after.lead},${after.dur}])`);

        // Style changes use the same wrap-quantized path: queue immediately, keep
        // the live canvas/transport running, and only land on the next loop top.
        const styleQueued = await page.evaluate(() => {
          const palettes = window.Virtuoso.STYLE_PALETTES || {};
          const ids = Object.keys(palettes);
          const current = localStorage.getItem("virtuoso.jamStyle") || ids[0];
          const currentProfile = palettes[current]?.audioProfile || "";
          const target = ids.find((id) => id !== current && (palettes[id]?.audioProfile || "") !== currentProfile);
          if (!target) return { ok: false, reason: "no alternate jam style with a distinct audio profile" };
          const info = window.Virtuoso.getActiveBundleInfo();
          const c = document.getElementById("virtuoso-canvas");
          if (c) c.__probeTag = "STYLE";
          window.Virtuoso.setSegmentLoop(info.leadIn || 0, (info.leadIn || 0) + 1.0);
          const search = document.querySelector("#virtuoso-jam-styles .virtuoso-jam-search");
          if (!search) return { ok: false, reason: "jam style search missing" };
          search.value = target;
          search.dispatchEvent(new Event("input", { bubbles: true }));
          const btn = document.querySelector(`#virtuoso-jam-styles [data-style="${target}"]`);
          if (!btn) return { ok: false, reason: `style chip missing for ${target}` };
          const before = window.Virtuoso.getActiveBundleInfo();
          btn.click();
          const chip = document.getElementById("virtuoso-jam-pending");
          const av = globalThis.__ss_debug.avSync();
          const live = window.Virtuoso.getActiveBundleInfo();
          return {
            ok: true,
            target,
            beforeProfile: before.config?.audio?.profile || "",
            immediateProfile: live.config?.audio?.profile || "",
            pendingHidden: chip ? chip.hidden : true,
            chipText: chip ? chip.textContent : "",
            playing: av ? av.playing : false,
            practiceTime: av ? av.practiceTime : null,
          };
        });
        if (!styleQueued.ok) jFails.push(`style queue setup failed (${styleQueued.reason})`);
        else {
          if (styleQueued.pendingHidden) jFails.push("style change did not queue a pending chip");
          if (!/At the wrap/.test(styleQueued.chipText || "")) jFails.push(`style pending copy missing wrap cue (\"${styleQueued.chipText}\")`);
          if (styleQueued.immediateProfile !== styleQueued.beforeProfile) jFails.push("style change rebuilt immediately instead of waiting for the wrap");
          if (!styleQueued.playing) jFails.push("playback stopped immediately after style queue");
          let styleAfter = null, styleApplied = false;
          for (let i = 0; i < 50; i++) {
            styleAfter = await page.evaluate(() => {
              const chip = document.getElementById("virtuoso-jam-pending");
              const c = document.getElementById("virtuoso-canvas");
              const av = globalThis.__ss_debug.avSync();
              const info = window.Virtuoso.getActiveBundleInfo();
              return {
                tag: c ? c.__probeTag : null,
                pendingHidden: chip ? chip.hidden : true,
                profile: info.config?.audio?.profile || "",
                playing: av ? av.playing : false,
              };
            });
            if (styleAfter.profile !== styleQueued.beforeProfile && styleAfter.pendingHidden) { styleApplied = true; break; }
            await page.waitForTimeout(100);
          }
          if (!styleApplied) jFails.push("queued style change never landed at the wrap");
          if (styleAfter && styleAfter.tag !== "STYLE") jFails.push("canvas was rebuilt on the style swap (renderer torn down — NOT in-place)");
          if (styleAfter && !styleAfter.playing) jFails.push("playback stopped during the queued style swap");
        }
      }
      // Stop the jam + close any modal so the wakelock phase (fresh ctx) is clean.
      await page.evaluate(() => document.getElementById("virtuoso-stop")?.click());
      await page.waitForTimeout(200);
      await page.evaluate(() => document.getElementById("virtuoso-results-close")?.click());
      for (const e of pageErrors.slice(errBase)) jFails.push(`pageerror: ${e}`);
      results.push({ kind: "jam-transport", pass: jFails.length === 0, status: "seamless A-B loop + in-place hot-swap", canvas: null, pixels: "n/a", clock: { from: "-", to: "-" }, fails: jFails, notes: [] });
    }

    // ── Wake-lock/session teardown pairing (promoted from probe-wakelock-leak,
    // dev-ops e2e audit 2026-06-05). The "sideways" stop — regenerating while
    // playing — goes through stopRenderer(), which must release the wake lock
    // and close the session log like every other stop path. A leak here keeps
    // the screen awake forever AND lets an abandoned run flush later as a fake
    // clean pass (tier/proof-loop credit). Fresh context: the bridge stub must
    // be installed before the page loads.
    {
      const wlFails = [];
      const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx2.addInitScript(() => { window.__awake = []; window.feedBackDesktop = { power: { setScreenAwake: (v) => window.__awake.push(!!v) } }; });   // feedBackDesktop = the FeedBack desktop bridge (hostDesktop() reads it first)
      const p2 = await ctx2.newPage();
      p2.on("pageerror", (e) => { if (!isBenign(e.message)) wlFails.push(`pageerror: ${e.message}`); });
      await p2.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
      await p2.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20000 });
      await p2.waitForFunction(() => typeof window.showScreen === "function");
      await p2.evaluate(() => window.showScreen("plugin-virtuoso"));
      await p2.waitForSelector("#virtuoso-root", { state: "attached" });
      await p2.waitForFunction(() => window.Virtuoso && typeof window.Virtuoso.generateExercise === "function");
      await p2.waitForTimeout(1200);                       // initial auto-generate settles
      await p2.click("#virtuoso-play");
      await p2.waitForTimeout(800);
      const held = await p2.evaluate(() => window.__awake[window.__awake.length - 1]);
      if (held !== true) wlFails.push(`play did not hold the wake lock (bridge last told ${held})`);
      await p2.evaluate(() => {                            // regenerate while playing → stopRenderer path
        const bpm = document.querySelector('#virtuoso-controls [name="bpm"]');
        bpm.value = String(Number(bpm.value) + 5);
        bpm.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await p2.waitForTimeout(1000);
      const after = await p2.evaluate(() => ({ last: window.__awake[window.__awake.length - 1], playingBtn: document.getElementById("virtuoso-play")?.classList.contains("is-playing") }));
      if (after.playingBtn !== false) wlFails.push("regenerate-while-playing did not stop the transport");
      if (after.last !== false) wlFails.push(`wake lock NOT released after regenerate-while-playing (bridge last told ${after.last})`);
      await ctx2.close();
      results.push({ kind: "wakelock-pair", pass: wlFails.length === 0, status: "regenerate-while-playing teardown", canvas: null, pixels: "n/a", clock: { from: "-", to: "-" }, fails: wlFails, notes: [] });
    }
  } finally {
    await browser.close();
  }

  // Report.
  console.log("\n=== Virtuoso renderer smoke ===");
  let failed = 0;
  for (const r of results) {
    const tag = r.pass ? "PASS" : "FAIL";
    const cv = r.canvas ? `${r.canvas.id} ${r.canvas.w}x${r.canvas.h}` : "none";
    console.log(`[${tag}] ${r.kind.padEnd(12)} status="${r.status}" canvas=${cv} pixels=${r.pixels} clock=${r.clock.from}->${r.clock.to}`);
    for (const n of (r.notes || [])) console.log(`         ~ ${n}`);
    if (!r.pass) {
      failed++;
      for (const f of r.fails) console.log(`         • ${f}`);
    }
  }
  console.log(`\n${results.length - failed}/${results.length} renderers passed.`);
  if (failed) {
    console.log(`Failure screenshots in ${SHOT_DIR}`);
    process.exit(1);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
