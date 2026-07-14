#!/usr/bin/env node
// Regression guard for the DESKTOP false-positive: "guitar off, the scorer still
// counts hits." Root cause — the host bridge `getLevels()` is ASYNC
// (`ipcRenderer.invoke(...)` → Promise; note_detect itself awaits it), but
// startLevelMeter read `.inputLevel` off the Promise SYNCHRONOUSLY → always
// undefined → the desktop input tap bailed to the web meter on the first poll;
// a DI player with no mic then landed at _lvlMode 'none' → the silence gate went
// INACTIVE → an inaudible comb residual's `isHit` credited with the guitar off.
//
// This suite injects an ASYNC getLevels (like the real bridge) + a mock
// note_detect that emits phantom `notedetect:verify {isHit}` frames (the
// residual), with NO mic, and asserts:
//   • NEGATIVE (guitar off): getLevels reports SILENCE → _lvlMode resolves to
//     'desktop' (the async result IS consumed now) and the gate forces 0 credit;
//   • POSITIVE (audible): getLevels reports a real level → the gate passes and a
//     verify hit credits (the fix doesn't over-block).
// Before the fix the desktop tap was discarded → 'web'/'none' → the negative
// CREDITED. (host up via launch.ps1 / a local server.)
import { chromium } from "playwright";
const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
let fails = 0;
const ok = (c, l, d) => { console.log(`  [${c ? "PASS" : "FAIL"}] ${l}${d ? "  " + d : ""}`); if (!c) fails++; };
const BENIGN = [/note detect/i, /audiocontext/i, /analyser/i, /play\(\) request/i, /scoring/i, /invalidstateerror/i, /mic/i, /getusermedia/i];
const isBenign = (m) => BENIGN.some((re) => re.test(m));

// Installed before the Virtuoso run: an ASYNC desktop bridge getLevels (the
// real shape) whose inputLevel is driven by window.__lvl, plus a mock
// note_detect on the timing-free verify path (setVerifyTarget present, no
// contained API → Virtuoso takes the setVerifyTarget fallback). A page-side
// interval fires phantom `notedetect:verify {isHit}` frames — the residual.
const INSTALL = () => {
  globalThis.__lvl = 0;   // 0 = guitar off (silent); >0 = audible
  window.slopsmithDesktop = {
    isDesktop: true, platform: "linux",
    audio: { getLevels: async () => ({ inputLevel: globalThis.__lvl, inputPeak: globalThis.__lvl }) },
  };
  window.noteDetect = {
    isEnabled: () => true, enable: async () => true, disable: () => {},
    setVerifyTarget: () => {}, getVerifyContext: () => null,
    // NO isContainedVerifierAvailable → Virtuoso uses the setVerifyTarget fallback.
  };
  // Phantom residual: emit a verify HIT every 30ms (the inaudible comb firing).
  if (window.__phantom) clearInterval(window.__phantom);
  window.__phantom = setInterval(() => {
    try { window.dispatchEvent(new CustomEvent("notedetect:verify", { detail: { isHit: true, score: 1, hitStrings: 1, totalStrings: 1 } })); } catch (_) {}
  }, 30);
};

// A 1-bar count-in (the production default — players always get ≥1) is
// player-silent, so the level meter warms up (accumulates resting samples)
// BEFORE the first judged note — the gate is armed by note[0], no startup skip.
const baseDrill = { advancedMode: true, practiceType: "rhythm_pulse", scale: "minor_pentatonic", stringSetup: "guitar_6_standard", fretboardSystem: "position", meter: "4/4", subdivision: "quarter", bpm: "120", bars: "4", countIn: "1", key: "A" };
const applyDrill = (page, drill = baseDrill) => page.evaluate((o) => {
  const set = (name, v) => { const el = document.querySelector(`#virtuoso-controls [name="${name}"]`); if (el) { if (el.type === "checkbox") el.checked = !!v; else el.value = String(v); el.dispatchEvent(new Event("change", { bubbles: true })); } };
  for (const [k, v] of Object.entries(o)) set(k, v);
  const b = window.Virtuoso.makeBundle(window.Virtuoso.generateExercise(window.Virtuoso.readConfig()));
  window.__e2eBundle = b; return { n: b.notes.length };
}, drill);

const browser = await chromium.launch({ headless: true });
try {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. launch.ps1 first.`);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    globalThis.__SS_HARNESS__ = true;
    // DI player: no mic. So the ONLY input-level source is the (async) desktop
    // getLevels — exactly the path the bug discarded.
    try { if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("smoke-level-gate-async: no mic by design")); } catch (_) {}
  });
  const page = await ctx.newPage();
  // Seed the L1 instrument store BEFORE page scripts run: the host-settings
  // sync (v0.1.11) treats an empty localStorage as a fresh install and ADOPTS
  // host config — which persists whatever instrument the PREVIOUS suite's panel
  // drives wrote through (cross-suite contamination; the panel flipped to bass
  // mid-suite). With the store seeded, the local-wins boot path holds the
  // deterministic 6-string default AND heals the host config for later suites.
  await page.addInitScript(() => { try { localStorage.setItem("virtuoso.instrument", JSON.stringify({ stringSetup: "guitar_6_standard", customOpenMidis: "" })); } catch (_) {} });
  const errs = [];
  page.on("pageerror", (e) => { if (!isBenign(e.message)) errs.push(e.message); });
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => typeof window.showScreen === "function");
  await page.evaluate(() => window.showScreen("plugin-virtuoso"));
  await page.waitForSelector("#virtuoso-root", { state: "attached" });
  await page.waitForFunction(() => window.Virtuoso && typeof window.Virtuoso.makeBundle === "function" && globalThis.__ss_debug && globalThis.__ss_debug.lvlMode);
  await page.evaluate(() => { const c = document.querySelector('[name="countIn"]'); if (c && !c.querySelector('option[value="0"]')) { const o = document.createElement('option'); o.value = '0'; o.textContent = 'None'; c.insertBefore(o, c.firstChild); } });

  // ══ NEGATIVE — guitar OFF (silent), phantom isHit must credit NOTHING. ══════
  await page.evaluate(INSTALL);
  await page.evaluate(() => { globalThis.__lvl = 0; });
  const neg0 = await applyDrill(page);
  ok(neg0.n > 0, "drill has judged notes", `n=${neg0.n}`);
  await page.click("#virtuoso-play");
  const neg = await page.evaluate(async () => {
    const D = globalThis.__ss_debug;
    let scored = 0, mode = "none";
    for (let i = 0; i < 60; i++) { mode = D.lvlMode(); scored = Math.max(scored, D.ptScoredUnits()); await new Promise((r2) => setTimeout(r2, 100)); }
    return { scored, mode };
  });
  ok(neg.mode === "desktop", "(1) the ASYNC getLevels result IS consumed — _lvlMode resolves to 'desktop' (not bailed to web/none)", `mode=${neg.mode}`);
  ok(neg.scored === 0, "(2) guitar OFF (silent getLevels): phantom isHit credits NOTHING (the silence gate is active)", `scoredUnits=${neg.scored}`);
  await page.evaluate(() => { document.getElementById("virtuoso-stop")?.click(); document.getElementById("virtuoso-results-close")?.click(); });
  await page.waitForTimeout(200);

  // ══ POSITIVE — audible getLevels, the gate must NOT over-block a credit. ════
  await page.evaluate(INSTALL);
  await page.evaluate(() => { globalThis.__lvl = 0.3; });
  await applyDrill(page);
  await page.click("#virtuoso-play");
  const pos = await page.evaluate(async () => {
    const D = globalThis.__ss_debug;
    let scored = 0, mode = "none";
    for (let i = 0; i < 60; i++) { mode = D.lvlMode(); scored = Math.max(scored, D.ptScoredUnits()); if (scored > 0) break; await new Promise((r2) => setTimeout(r2, 100)); }
    return { scored, mode };
  });
  ok(pos.mode === "desktop", "(3) audible run also uses the desktop meter", `mode=${pos.mode}`);
  ok(pos.scored > 0, "(4) audible getLevels (≥ floor): a verify hit DOES credit (the fix doesn't over-block)", `scoredUnits=${pos.scored}`);
  await page.evaluate(() => { document.getElementById("virtuoso-stop")?.click(); if (window.__phantom) clearInterval(window.__phantom); });

  ok(errs.length === 0, "no unexpected page errors", errs.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}
process.exit(fails ? 1 : 0);
