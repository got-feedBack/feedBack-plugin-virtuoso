// Assertive smoke: Virtuoso must never trip the host 3D-highway's viz
// settings. The highway is *borrowed* from the host plugin and reads its
// look (fret-column markers, nut/headstock, tuning labels, palette, camera…)
// from shared `h3d_bg_*` localStorage keys that the highway_3d plugin's own
// settings panel owns. Virtuoso must only READ that look, never WRITE it —
// otherwise generating/playing an exercise could silently change the user's
// global highway settings (and diverge from the main game).
//
// This guard snapshots every `h3d_bg_*` key after initial load, then runs a
// full highway exercise lifecycle (switch view → generate → play → stop →
// cycle renderers and back), and asserts the keyset+values are byte-identical.
//
// Run against a live host (start it with launch.ps1 first):
//   node .claude/skills/run-virtuoso/smoke-highway-settings.mjs
// Exits non-zero on any drift.
import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
const SHOT_DIR = process.env.SHOT_DIR || resolve(dirname(fileURLToPath(import.meta.url)), "../../../.virtuoso-shots");

function snapshotH3dBg() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("h3d_bg_")) out[k] = localStorage.getItem(k);
  }
  return out;
}

async function main() {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`).catch(() => null);
  if (!r || !r.ok) throw new Error(`Host not reachable at ${HOST}. Start it with launch.ps1 first.`);

  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => failures.push(`pageerror: ${e.message}`));

    // Load + activate Virtuoso.
    await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20000 });
    await page.waitForFunction(() => typeof window.showScreen === "function", { timeout: 5000 });
    await page.evaluate(() => window.showScreen("plugin-virtuoso"));
    await page.waitForSelector("#virtuoso-root", { state: "attached", timeout: 10000 });
    await page.waitForSelector("#virtuoso-view-select", { timeout: 5000 });

    // Ensure the 3D highway is the active view, then settle. (View selector is
    // a dropdown since v0.1.13 — value + change, the user event path.)
    const setView = (k) => page.evaluate((kind) => {
      const sel = document.querySelector("#virtuoso-view-select");
      if (!sel) return;
      sel.value = kind;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }, k);
    await setView("highway_3d"); await page.waitForTimeout(600);

    // Baseline snapshot AFTER the highway has attached once.
    const before = await page.evaluate(snapshotH3dBg);

    // Full exercise lifecycle: generate → play → wait → stop.
    const tier = await page.$("#virtuoso-tempo-tiers button, .virtuoso-tier-btn, [data-tempo-tier]");
    if (tier && await tier.isVisible()) await tier.click();
    await page.waitForTimeout(500);
    const play = await page.$('#virtuoso-play, [data-action="play"], .virtuoso-play');
    if (play && await play.isVisible()) await play.click();
    await page.waitForTimeout(2500);
    // Stop (same control toggles, or Stop button).
    const stop = await page.$('#virtuoso-play, [data-action="play"], .virtuoso-play, [data-action="stop"]');
    if (stop && await stop.isVisible()) await stop.click();
    await page.waitForTimeout(300);

    // Cycle through the other renderers and back to the highway (attach/detach
    // churn is the most likely place a stray settings-write could hide).
    for (const kind of ["builtin_2d", "highway_2d", "tab_2d", "notation_2d", "highway_3d"]) {
      await setView(kind); await page.waitForTimeout(400);
    }

    const after = await page.evaluate(snapshotH3dBg);

    // Compare keysets + values.
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const k of keys) {
      if (!(k in before)) failures.push(`Virtuoso CREATED host setting ${k}=${after[k]}`);
      else if (!(k in after)) failures.push(`Virtuoso DELETED host setting ${k} (was ${before[k]})`);
      else if (before[k] !== after[k]) failures.push(`Virtuoso MUTATED host setting ${k}: ${before[k]} -> ${after[k]}`);
    }

    const nBg = Object.keys(after).length;
    console.log(`[highway-settings] h3d_bg_* keys present after lifecycle: ${nBg}`);
    if (nBg) console.log(`[highway-settings] keys: ${Object.keys(after).join(", ")}`);

    if (failures.length === 0) {
      console.log("PASS  highway-settings: Virtuoso tripped no host h3d_bg_* setting");
    } else {
      const shot = resolve(SHOT_DIR, "smoke-highway-settings-fail.png");
      await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
      console.log(`FAIL  highway-settings (${failures.length}):`);
      for (const f of failures) console.log("  - " + f);
      console.log(`      shot -> ${shot}`);
    }
  } finally {
    await browser.close();
  }
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
