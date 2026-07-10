#!/usr/bin/env node
// Virtuoso plugin driver.
//
// Launches the FeedBack host with the plugin junctioned into its plugin dir,
// drives the Virtuoso screen with Playwright, and takes screenshots.
//
// Usage (run via "npx playwright" so deps resolve):
//   node .claude/skills/run-virtuoso/driver.mjs smoke
//   node .claude/skills/run-virtuoso/driver.mjs screenshot <renderer>
//     renderer ∈ { highway_3d | builtin_2d | tab_2d | notation_2d }
//   node .claude/skills/run-virtuoso/driver.mjs all-renderers
//
// Prerequisites (one-time, see SKILL.md):
//   - The FeedBack host running via launch.ps1 (defaults to the FeedBack
//     checkout at C:\dev\feedback\repos\feedback; junctions this plugin in)
//   - "npm i playwright" available via npx (auto-installs on first run)
//
// The driver expects an already-running host. If the port is closed, it
// errors with a hint to launch via launch.ps1.

import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = process.env.SLOPSMITH_HOST || "http://127.0.0.1:8765";
const SHOT_DIR = process.env.SHOT_DIR || resolve(dirname(fileURLToPath(import.meta.url)), "../../../.virtuoso-shots");

const RENDERERS = ["highway_3d", "highway_2d", "builtin_2d", "tab_2d", "notation_2d"];

async function ensureHost() {
  const r = await fetch(`${HOST}/api/plugins/virtuoso/status`).catch(() => null);
  if (!r || !r.ok) {
    throw new Error(`Host not reachable at ${HOST}. Start it with launch.ps1 first.`);
  }
  const body = await r.json();
  if (!body.ok) throw new Error(`Plugin status not ok: ${JSON.stringify(body)}`);
}

// FeedBack (v0.3.0+) can show a first-run #v3-onboarding modal (a fixed,
// full-screen overlay) that intercepts pointer events and blocks every click.
// launch.ps1 completes onboarding via /api/profile so it normally never
// renders; this is a belt-and-suspenders removal for a host where it wasn't
// pre-completed (e.g. a fresh config dir or a manually-started host).
async function dismissOnboarding(page) {
  await page
    .evaluate(() => document.getElementById("v3-onboarding")?.remove())
    .catch(() => {});
}

async function gotoVirtuoso(page) {
  // FeedBack is an SPA — load the shell, then wait for loadPlugins() to
  // inject the plugin's <section id="virtuoso"> into the DOM, then call
  // showScreen() to activate it. plugin.json declares nav.screen = "virtuoso".
  await page.goto(`${HOST}/`, { waitUntil: "domcontentloaded" });
  await dismissOnboarding(page);
  // FeedBack mounts each plugin screen under #plugin-<id>. The plugin's own
  // root markup (#virtuoso-root, from screen.html) lives inside that.
  // Screen sections are display:none until activated — wait on "attached".
  await page.waitForSelector("#plugin-virtuoso", { state: "attached", timeout: 20_000 });
  await page.waitForFunction(() => typeof window.showScreen === "function", { timeout: 5_000 });
  await page.evaluate(() => window.showScreen("plugin-virtuoso"));
  await dismissOnboarding(page);
  await page.waitForSelector("#virtuoso-root", { state: "attached", timeout: 10_000 });
  // The bootstrap script in screen.html runs bind() on DOMContentLoaded; give
  // it a moment to wire up everything (pathway dropdown, view-switcher).
  await page.waitForSelector("#virtuoso-view-select", { timeout: 5_000 });
}

async function generate(page) {
  // In pathway mode (the default), there is no Regenerate button — the
  // tempo-tier buttons (Slow/Med/Fast/Challenge) trigger generation. The
  // first one is always present once the pathway has loaded.
  // Custom mode does expose #virtuoso-regenerate; fall back to that when
  // tempo tiers aren't visible.
  const tier = await page.$("#virtuoso-tempo-tiers button, .virtuoso-tier-btn, [data-tempo-tier]");
  const regen = await page.$("#virtuoso-regenerate");
  if (tier && await tier.isVisible()) {
    await tier.click();
  } else if (regen && await regen.isVisible()) {
    await regen.click();
  } else {
    // Force a regenerate via the public API exposed on window.Virtuoso.
    await page.evaluate(() => window.Virtuoso?.generateExercise?.(window.Virtuoso?.readConfig?.() || {}));
  }
  // Wait for the renderer label to update as confirmation.
  await page.waitForFunction(() => {
    const s = document.getElementById("virtuoso-renderer-status");
    return s && s.textContent && s.textContent.trim().length > 0;
  }, { timeout: 5_000 });
  // Tick a few RAFs so the renderer has actually drawn at least one frame.
  await page.waitForTimeout(600);
}

async function switchRenderer(page, kind) {
  // View selector is a dropdown (v0.1.13): set the value + dispatch change,
  // the same event path a user pick takes (change → onViewSwitch).
  const ok = await page.evaluate((k) => {
    const sel = document.querySelector("#virtuoso-view-select");
    if (!sel || ![...sel.options].some((o) => o.value === k)) return false;
    sel.value = k;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, kind);
  if (!ok) throw new Error(`Renderer option not found: ${kind}`);
  await page.waitForTimeout(600); // attachRenderer is async; let it settle
}

async function screenshot(page, name) {
  if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true });
  const path = resolve(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path, fullPage: false });
  console.log(`shot -> ${path}`);
}

async function withBrowser(fn) {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.error("[page error]", e.message));
    page.on("console", (m) => {
      const t = m.type();
      if (t === "error" || t === "warning") console.log(`[console.${t}]`, m.text());
    });
    await fn(page);
  } finally {
    await browser.close();
  }
}

async function cmdSmoke() {
  await ensureHost();
  await withBrowser(async (page) => {
    await gotoVirtuoso(page);
    await generate(page);
    await screenshot(page, "smoke");
    console.log("smoke OK");
  });
}

async function cmdScreenshot(kind) {
  if (!RENDERERS.includes(kind)) {
    throw new Error(`Unknown renderer: ${kind}. Expected one of ${RENDERERS.join(", ")}`);
  }
  await ensureHost();
  await withBrowser(async (page) => {
    await gotoVirtuoso(page);
    await switchRenderer(page, kind);
    await generate(page);
    await screenshot(page, kind);
  });
}

async function cmdAllRenderers() {
  await ensureHost();
  await withBrowser(async (page) => {
    await gotoVirtuoso(page);
    await generate(page);
    for (const kind of RENDERERS) {
      await switchRenderer(page, kind);
      await page.waitForTimeout(300);
      await screenshot(page, kind);
    }
  });
}

const [, , cmd, ...rest] = process.argv;
const runners = {
  smoke: cmdSmoke,
  screenshot: () => cmdScreenshot(rest[0]),
  "all-renderers": cmdAllRenderers,
};
const fn = runners[cmd];
if (!fn) {
  console.error("Usage: driver.mjs <smoke|screenshot <renderer>|all-renderers>");
  process.exit(2);
}
fn().catch((e) => { console.error(e); process.exit(1); });
