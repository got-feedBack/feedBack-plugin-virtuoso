#!/usr/bin/env node
// Assertive guard for Virtuoso's window.AudioContext patch. Two regressions:
//
// (1) v0.5.0 cross-plugin: the stub was handed to EVERY `new AudioContext()` page-wide
//     whenever Virtuoso's audioCtx merely existed — so the host's stem loader (another
//     plugin/screen) got a context with no decodeAudioData and all stems failed. The fix
//     scopes the stub to when Virtuoso's OWN screen is active → backgrounded Virtuoso
//     yields the REAL thing.
//
// (2) scorer-poisoning (fixed 2026-06-04): the click-suppressing stub also poisoned the
//     Minigames scorer, which opens its OWN `new AudioContext()` for the mic. The stub's
//     resume() is undefined + state 'closed', so createContinuous().start() threw and the
//     tuner / grading / per-note gems silently died — even on a current host with a mic.
//     The fix gates the stub on !ptAvailable(): the fake (a workaround for old hosts whose
//     highway doesn't honor bgReactive:false) is only handed out when NO scoring SDK is
//     present. On a host WITH the SDK, `new AudioContext()` is always real (the highway
//     honors bgReactive:false so no click to suppress, and the scorer needs a real ctx).
//
// So this guard is TARGET-AWARE: on the SDK-having checkout it asserts a real, scorer-usable
// context while Virtuoso is visible; on the SDK-less bundled target it asserts the stub.
//
// (3) host output-device FOLLOW (2026-06-07, Arch+Focusrite report): the shared audioCtx
//     follows the desktop host's JUCE Audio Engine output device (ensureAudioCtx seam →
//     applyHostSink → setSinkId), with a pure name matcher (pickSinkMatch) and a visible
//     mismatch fallback. Rows here: web-host no-op (no bridge → default sink, no mismatch),
//     the matcher's exact/cross-naming/ambiguity/default-class semantics, and a faked
//     desktop bridge at Play → playback still runs + the honest ⚠ mismatch is surfaced
//     (headless has no matching output device, so the can't-follow path is what's exercised).
import { chromium } from "playwright";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
let fails = 0;
const ok = (cond, label, detail) => { console.log(`  [${cond ? "PASS" : "FAIL"}] ${label}${detail ? "  " + detail : ""}`); if (!cond) fails++; };

async function ensureHost() {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. Start it with launch.ps1 first.`);
}

const browser = await chromium.launch({ headless: true });
try {
  await ensureHost();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { globalThis.__SS_HARNESS__ = true; });  // sink rows read __ss_debug
  const page = await ctx.newPage();
  page.on("pageerror", e => console.error("[page error]", e.message));
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20000 });
  await page.waitForFunction(() => typeof window.showScreen === "function");
  await page.evaluate(() => window.showScreen("plugin-virtuoso"));
  await page.waitForSelector("#virtuoso-root", { state: "attached" });
  await page.waitForSelector("#virtuoso-play");

  // Is the Minigames scoring SDK present on this host? It loads lazily after the screen
  // opens — wait briefly. Present ⇔ current/checkout host; absent ⇔ bundled host.
  let hasSDK = false;
  try { await page.waitForFunction(() => typeof window.slopsmithMinigames?.scoring?.createContinuous === "function", { timeout: 4000 }); hasSDK = true; } catch {}

  // Create Virtuoso's audioCtx via a real Play gesture, then stop — the session state
  // that poisoned the global in v0.5.0 (ctx exists, not playing).
  await page.click("#virtuoso-play");
  await page.waitForTimeout(500);
  await page.click("#virtuoso-play");   // stop
  await page.waitForTimeout(300);

  // While Virtuoso is the active screen + its audioCtx exists:
  const visible = await page.evaluate(() => {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const r = { decode: typeof c.decodeAudioData, resume: typeof c.resume, state: c.state };
    try { c.close && c.close(); } catch {}
    return r;
  });
  if (hasSDK) {
    // (2) SDK present: the patch must NOT fake — the scorer's `new AudioContext()` needs a
    //     real, usable context (resume() + decodeAudioData), or tuner/grading/gems die.
    ok(visible.decode === "function" && visible.resume === "function" && visible.state !== "closed",
      "SDK present: REAL AudioContext while Virtuoso visible — scorer/tuner/gems NOT poisoned by the patch",
      `decode=${visible.decode} resume=${visible.resume} state=${visible.state}`);
  } else {
    // (1) No SDK (old host): the highway-click stub is in force while visible.
    ok(visible.decode === "undefined",
      "no SDK: highway-click stub active while Virtuoso visible (and no scorer to break)",
      `decodeAudioData=${visible.decode}`);
  }

  // (v0.5.0 fix, both targets): background Virtuoso → new AudioContext() must be REAL for
  // the host's stem loader (the cross-plugin regression).
  const hidden = await page.evaluate(() => {
    const screen = document.getElementById("plugin-virtuoso");
    const prev = screen.style.display;
    screen.style.display = "none";                       // simulate navigating to another screen
    const c = new (window.AudioContext || window.webkitAudioContext)();
    const decode = typeof c.decodeAudioData;
    try { c.close(); } catch {}
    screen.style.display = prev;
    return { decode };
  });
  ok(hidden.decode === "function", "REAL AudioContext (decodeAudioData present) when Virtuoso is backgrounded — host stem loader works", `decodeAudioData=${hidden.decode}`);

  // ── (3) Host output-device follow ──────────────────────────────────────────

  // 3a. Web-host no-op: no slopsmithDesktop bridge on this target → the sink
  //     follow must leave the ctx on the default sink with no mismatch claim
  //     (byte-identical to pre-feature behavior).
  const noop = await page.evaluate(() => {
    const dbg = globalThis.__ss_debug;
    return {
      hasMatcher: typeof dbg?.pickSinkMatch === "function",
      hasApply: typeof dbg?.applyHostSink === "function",
      state: dbg?.sinkState ? dbg.sinkState() : null,
      bridge: !!window.slopsmithDesktop,
    };
  });
  ok(noop.hasMatcher && noop.hasApply, "sink follow: seam + matcher exposed on __ss_debug", `matcher=${noop.hasMatcher} apply=${noop.hasApply}`);
  ok(!noop.bridge && noop.state && noop.state.appliedId === null && noop.state.mismatch === "",
    "sink follow: web host (no bridge) is a clean no-op — default sink, no mismatch",
    `appliedId=${noop.state?.appliedId} mismatch=${JSON.stringify(noop.state?.mismatch)}`);

  // 3b. The pure matcher's semantics (the unit-testable piece — canned
  //     JUCE-name vs Chromium-label pairs, incl. the Linux cross-naming case).
  const match = await page.evaluate(() => {
    const m = globalThis.__ss_debug.pickSinkMatch;
    const outs = (pairs) => pairs.map(([deviceId, label]) => ({ deviceId, label, kind: "audiooutput" }));
    return {
      exact: m("Scarlett 2i2 USB", outs([["a", "Speakers"], ["b", "Scarlett 2i2 USB"]]))?.deviceId,
      // JUCE-ALSA name vs PipeWire-style label: vendor/product tokens survive both
      cross: m("Scarlett 2i2 USB Analog Stereo", outs([["a", "Built-in Audio Analog Stereo"], ["b", "Focusrite Scarlett 2i2 USB Audio"]]))?.deviceId,
      // sibling outputs with equal claim → ambiguity bails to default
      ambiguous: m("Scarlett 2i2", outs([["a", "Scarlett 2i2 Line 1/2"], ["b", "Scarlett 2i2 Line 3/4"]])),
      // "default"-class device names: zero informative tokens → applyHostSink's
      // sinkTokens gate treats them as the default sink (never reaches matching)
      defaultTokens: globalThis.__ss_debug.sinkTokens("Speakers (High Definition Audio Device)").length,
      defaultName: m("default", outs([["a", "Built-in Audio Analog Stereo"], ["b", "Focusrite Scarlett 2i2 USB Audio"]])),
      unrelated: m("Komplete Audio 6", outs([["a", "Built-in Audio Analog Stereo"], ["b", "Focusrite Scarlett 2i2 USB Audio"]])),
    };
  });
  ok(match.exact === "b", "matcher: exact label match wins", `got=${match.exact}`);
  ok(match.cross === "b", "matcher: JUCE-ALSA vs PipeWire cross-naming resolves via vendor tokens", `got=${match.cross}`);
  ok(match.ambiguous === null, "matcher: sibling-output ambiguity bails to default", `got=${JSON.stringify(match.ambiguous)}`);
  ok(match.defaultTokens === 0 && match.defaultName === null, "matcher: default-class names (all stopwords) → default sink", `tokens=${match.defaultTokens} m(default)=${JSON.stringify(match.defaultName)}`);
  ok(match.unrelated === null, "matcher: unrelated device never false-positives", `got=${JSON.stringify(match.unrelated)}`);

  // 3c. Faked desktop bridge at Play: playback must still run, and since headless
  //     Chromium has no matching output device, the honest can't-follow path fires
  //     (mismatch set + ⚠ in the status line). Routing must never block Play.
  //     NOTE: a real STOP first — the earlier rows leave the transport PAUSED
  //     (play-click #2 pauses since the transport split), and the resume branch
  //     deliberately doesn't re-run the sink steer; the per-run application
  //     happens on a fresh start.
  await page.evaluate(() => {
    window.slopsmithDesktop = { audio: {
      isAudioRunning: async () => true,
      getCurrentDevice: async () => ({ inputType: "ALSA", outputType: "ALSA", input: "", output: "Phantom Interface QX-7" }),
    } };
    const stop = document.getElementById("virtuoso-stop");
    if (stop && !stop.disabled) stop.click();
  });
  await page.waitForTimeout(200);
  await page.click("#virtuoso-play");
  await page.waitForTimeout(250);
  const t0 = await page.evaluate(() => globalThis.__ss_debug.ptPracticeTime());
  await page.waitForTimeout(600);
  const fake = await page.evaluate(() => ({
    t: globalThis.__ss_debug.ptPracticeTime(),
    state: globalThis.__ss_debug.sinkState(),
    status: document.getElementById("virtuoso-status")?.textContent || "",
  }));
  ok(fake.t > t0, "fake bridge: playback clock still advances (sink follow never blocks Play)", `t0=${t0.toFixed(3)} t1=${fake.t.toFixed(3)}`);
  ok(fake.state.appliedId === null && fake.state.mismatch.includes("Phantom Interface QX-7"),
    "fake bridge: unmatchable device → default sink + honest mismatch state", `state=${JSON.stringify(fake.state)}`);
  ok(fake.status.includes("⚠"), "fake bridge: status line surfaces the ⚠ output mismatch", `status=${JSON.stringify(fake.status)}`);
  await page.click("#virtuoso-play"); // stop
  await page.evaluate(() => { delete window.slopsmithDesktop; });

  // 3d. Matched-but-REFUSED switch (the unhandled 'speaker-selection' permission
  //     on feedback-desktop, 2026-06-07 Arch follow-up): the honest mismatch must
  //     fire — previously this died in the outer catch with NO UI state,
  //     indistinguishable from "worked". Stubs: a bridge on a matchable device,
  //     an enumerateDevices carrying it, and a setSinkId that refuses (shadowed
  //     on the live ctx instance — prototype patching can miss it since the
  //     screen-scoped AudioContext patch swaps constructors).
  const blocked = await page.evaluate(async () => {
    window.slopsmithDesktop = { audio: {
      isAudioRunning: async () => true,
      getCurrentDevice: async () => ({ inputType: "ALSA", outputType: "ALSA", input: "", output: "Scarlett 2i2 USB" }),
    } };
    navigator.mediaDevices.enumerateDevices = async () =>
      [{ kind: "audiooutput", deviceId: "sink-x", label: "Focusrite Scarlett 2i2 USB Audio", groupId: "g" }];
    const ctx = globalThis.__ss_debug.audioCtxRef();
    if (!ctx) return { noCtx: true };
    ctx.setSinkId = async () => { const e = new Error("denied"); e.name = "NotAllowedError"; throw e; };
    await globalThis.__ss_debug.applyHostSink();
    return globalThis.__ss_debug.sinkState();
  });
  ok(!blocked.noCtx && blocked.appliedId === null && (blocked.mismatch || "").includes("blocked"),
    "sink follow: matched device + refused setSinkId → honest 'blocked' mismatch (speaker-selection)",
    `state=${JSON.stringify(blocked)}`);

  // 3e. Zero-token engine name ("PipeWire"/"default"-class): deliberately
  //     console-only — default sink, NO UI mismatch (a ⚠ would false-alarm every
  //     legit default-device setup) — and it must RESET a stale mismatch.
  const generic = await page.evaluate(async () => {
    window.slopsmithDesktop.audio.getCurrentDevice = async () => ({ inputType: "ALSA", outputType: "ALSA", input: "", output: "PipeWire" });
    await globalThis.__ss_debug.applyHostSink();
    return globalThis.__ss_debug.sinkState();
  });
  ok(generic.mismatch === "" && generic.appliedId === null,
    "sink follow: zero-token device name → default sink, no UI mismatch (console-only diagnostic), stale mismatch reset",
    `state=${JSON.stringify(generic)}`);
  await page.evaluate(() => { delete window.slopsmithDesktop; });

  console.log(`\n${fails === 0 ? "PASS" : "FAIL"}  audiocontext-sharing: ${fails} failure(s)  [SDK ${hasSDK ? "present" : "absent"}]`);
  process.exit(fails ? 1 : 0);
} finally {
  await browser.close();
}
