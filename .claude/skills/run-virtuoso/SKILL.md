---
name: run-virtuoso
description: Launch the FeedBack host with Virtuoso loaded, drive the plugin UI, and screenshot any of the four renderers (3D Highway, 2D Highway, Tab, Notation). Use when asked to run, start, screenshot, verify, or smoke-test Virtuoso. Virtuoso is a FeedBack plugin — it cannot run standalone, so this skill brings up the host too.
---

# Run Virtuoso

Virtuoso is a **plugin**, not a standalone app. It needs FeedBack as a host. This skill brings up the host with this repo junctioned in, then drives the Virtuoso screen via Playwright.

The harness (all in this skill dir) does the work:

- `launch.ps1` — kills any prior server on port 8765, junctions this repo into `%LOCALAPPDATA%\Slopsmith\plugins\virtuoso`, starts the bundled-Python server, and waits until `/api/plugins/virtuoso/status` returns `ok`.
- `driver.mjs` — Playwright (Node) driver that navigates to the Virtuoso screen, triggers a generate, and **screenshots** any renderer (never asserts — for eyeballing/visual diffs).
- `smoke-renderers.mjs` + `smoke-generators.mjs` — **assertive** smoke suites (PASS/FAIL per item, non-zero exit on failure). `npm test` runs both. This is the harness for *verifying* a change, not just looking at it.

Paths in this file are relative to the repo root (`<unit>/` in the skill-generator sense).

## Prerequisites

This skill targets the actual machine these tools were built on. From a clean machine on the same Windows host:

- **FeedBack Desktop** installed at `C:\Program Files\Slopsmith\`. The installer ships a working Python 3.12 at `resources\python\python.exe` with every dep already in `site-packages` — we reuse it instead of building a venv.
- **The FeedBack host checkout** at `C:\dev\feedback\repos\feedback\` (the default `checkout` source as of 2026-06-23). It holds `main.py` and is run via the venv python (below); its own `server`/`lib`/`plugins` load. Override with `$env:SLOPSMITH_CHECKOUT` if you keep it elsewhere. (Legacy `bundled` mode still uses the frozen Slopsmith install at `C:\Program Files\Slopsmith\`.)
- **Node.js** + `npm` on PATH. First run of `driver.mjs` requires Playwright + Chromium:
  ```bash
  cd .claude/skills/run-virtuoso
  npm i playwright
  npx playwright install chromium
  ```

That's all the persistent setup. The `package.json` + `node_modules/` inside the skill dir is fine; they're agent tooling.

## Run (agent path)

One command brings the host up:

```powershell
powershell -ExecutionPolicy Bypass -File .claude/skills/run-virtuoso/launch.ps1
```

Output ends with `[launch] up (pid …)` and prints the next command. The server logs to `%TEMP%\virtuoso\server.log`.

Then drive it from Node:

```bash
# Smoke (screenshot whatever renderer is the default — 3D Highway):
node .claude/skills/run-virtuoso/driver.mjs smoke

# Single renderer (one of: highway_3d | builtin_2d | tab_2d | notation_2d):
node .claude/skills/run-virtuoso/driver.mjs screenshot tab_2d

# All four renderers in one run — best for verifying changes to any renderer:
node .claude/skills/run-virtuoso/driver.mjs all-renderers
```

`driver.mjs` only *screenshots* — it never fails. To **assert** the renderers
actually work (gate a refactor, prove a fix), run the smoke test instead:

```bash
node .claude/skills/run-virtuoso/smoke-renderers.mjs   # or: npm run smoke
```

It walks all four renderers and, per renderer, checks: the view switch took
(active button), the renderer attached (non-empty status + a sized render
canvas — ruler/chord-box excluded), it drew (non-uniform pixels, enforced only
for the in-tree 2D `tab_2d`/`notation_2d`), playback advances `#virtuoso-time-cur`,
and **no uncaught pageerror / non-benign console.error** fired (the known
`highway_3d` audio-analyser warning — gotcha #7 — is allowlisted). Prints a
PASS/FAIL line per renderer and **exits non-zero** if any fail, dropping a
`.virtuoso-shots/smoke-fail-<kind>.png` for each failure.

The companion **generator** smoke covers the other half — the chart builders:

```bash
node .claude/skills/run-virtuoso/smoke-generators.mjs   # or: npm run smoke:gen
```

It drives `window.Virtuoso.generateExercise()` directly (fast, no rendering)
across every practice type and every scale, runs a bass pass (string-count
dependent shapes), and launches each built-in session through the UI. Per
chart it checks structure: notes present, each note has finite `t>=0`, an
integer string in range, a sane fret, positive sustain, and a non-empty `beats`
list. The no-unison rule is covered for free — screen.js throws
`[Virtuoso no-unison] …` at load if a resolved shape doubles a pitch, which
surfaces as a pageerror and fails the run. **Gotcha:** when calling
`generateExercise(cfg)` by hand, set BOTH `cfg.mode` and `cfg.practiceType` —
`readConfig()` returns both and the dispatch (`buildSingleChart`) reads `mode`
first, so overriding only `practiceType` silently generates the wrong type.

`npm test` runs both smokes (renderers then generators). Together they're the
closest thing the repo has to a test suite — there is no unit/lint layer.

Screenshots land in `.virtuoso-shots/` at the repo root (gitignored). The driver and smoke test both log each path they write.

To stop the host:

```powershell
Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
```

## Testing against CURRENT FeedBack (bundled vs checkout)

`launch.ps1` can boot **two different FeedBack runtimes**, selected by `SLOPSMITH_SOURCE`:

- **`checkout`** (**DEFAULT**; retargeted to the FeedBack host 2026-06-23) — the FeedBack
  mainline checkout (`C:\dev\feedback\repos\feedback`) run via a **venv python** (no `._pth`
  isolation → the checkout's own code loads). This is our **primary test target: CURRENT
  FeedBack**, which ships the **Minigames scoring SDK** (so on-screen note-detection/grading is
  available — see the Scoring note below) plus the latest host capabilities. **`launch.ps1`
  AUTO-PULLS it current on every launch** (non-fatal: skipped on a dirty tree or when offline;
  refreshes the venv only when `requirements.txt` changed in the pull). On startup it also
  completes first-run onboarding via `/api/profile` so FeedBack's `#v3-onboarding` modal never
  blocks the driver/smoke suites. Needs the one-time venv setup below.
- **`bundled`** — the frozen LEGACY Slopsmith Desktop install at `C:\Program Files\Slopsmith\…`
  (older, pre-FeedBack). Its
  `python312._pth` pins imports to the bundled code, so this tests against **what users on the
  current Desktop release actually run** — notably **WITHOUT the Minigames scoring SDK** (so no
  on-screen note-detection/grading). Use it before a release to verify the installed base:
  ```powershell
  $env:SLOPSMITH_SOURCE = 'bundled'; & .claude\skills\run-virtuoso\launch.ps1
  ```

**One-time setup for the checkout runtime** (a venv at `C:\Users\chris\slopsmith-venv` — named
for history, now serves the FeedBack checkout; overridable via `SLOPSMITH_VENV`):
```powershell
git -C C:\dev\feedback\repos\feedback pull     # FeedBack ships from `main` — pulling IS updating
py -3 -m venv C:\Users\chris\slopsmith-venv
& C:\Users\chris\slopsmith-venv\Scripts\python.exe -m pip install -r C:\dev\feedback\repos\feedback\requirements.txt
```
No build step (Tailwind via CDN, static served as-is). `launch.ps1` sets `PYTHONPATH`
(checkout root + `lib/`, mirroring the bundled `._pth`) and `SLOPSMITH_PLUGINS_DIR`
(the junction dir, so the checkout discovers Virtuoso) for the checkout path.

**Why two targets:** `checkout` (default) develops against current FeedBack — it has the
scoring SDK and the newest capabilities; `bundled` verifies the installed base before a release.

**Scoring note (the SDK is PRESENT on checkout / ABSENT on bundled):** on checkout the SDK tries
to start the mic and — in headless Playwright (no mic) — logs a benign
`[minigames] continuous scoring failed to start: NotSupportedError`; this is allowlisted in the
smoke suites' BENIGN lists. The checkout also lacks the Desktop-bundled `jumpingtab`/`piano` viz
plugins, so `builtin_2d` falls back to the in-tree renderer — `smoke-renderers` **soft-passes
that fallback's clock edge**, but only when the renderer genuinely fell back (status contains
"fallback"); the Desktop target borrows the viz fine, so the clock check still applies there.
(The two-target setup caught real forward-compat issues 2026-06-01: the `borrowHostViz` 404 after
the host's #620 plugin-asset route change, and the scoring `NotSupportedError`.)

## Run (human path)

Just open the FeedBack Desktop app from the Start menu and click Virtuoso in the navigation. This skips the junction step **only if** the Desktop app has already auto-installed a `virtuoso` plugin entry (it may be stale). The agent path replaces that stale copy with a junction every time; the human path may show old code if the user has never pulled.

## Layer the driver covers

`driver.mjs` drives the **user-facing UI** of the plugin — pathway dropdown, view-switcher buttons, renderer canvas. That is the right handle for changes to `screen.html`, `screen.js`, or any of the four renderers in `screen.js`.

For changes to **`routes.py`** (the backend), the faster path is direct HTTP. Examples from a running server:

```bash
curl http://127.0.0.1:8765/api/plugins/virtuoso/status
curl http://127.0.0.1:8765/api/plugins/virtuoso/presets
curl http://127.0.0.1:8765/api/plugins/virtuoso/tunings
# POST /api/plugins/virtuoso/temp-sloppak with an exercise payload to build a chart
# (note: the /temp-sloppak route is dormant under the contained-playback model)
```

The driver doesn't currently exercise `temp-sloppak`. If a PR touches that route, add a `curl --data` test to your smoke run rather than threading it through the UI.

## Gotchas

1. **The bundled Python wins over your source checkout.** `C:\Program Files\Slopsmith\resources\python\python.exe` has `C:\Program Files\Slopsmith\resources\slopsmith\` on its `sys.path` — so when you run `main.py` from `C:\Users\chris\slopsmith\`, Python imports `server`, `lib`, `plugins/__init__.py` from the **Desktop install**, not from your checkout. Plugin search resolves to `%LOCALAPPDATA%\Slopsmith\plugins\`, which is why `launch.ps1` junctions there (not into the user's `slopsmith/plugins/` directory).

2. **`mklink /J` needs `cmd /c`, not pure PowerShell.** PowerShell's `New-Item -ItemType SymbolicLink` requires admin or developer mode. Junctions made via `cmd /c mklink /J` work without elevation and behave the same for reads.

3. **`#virtuoso` is not the screen id — `#plugin-virtuoso` is.** The plugin's `plugin.json` declares `nav.screen: "virtuoso"`, but FeedBack's SPA wraps each plugin in `<div id="plugin-<id>">` and `showScreen()` takes that prefixed form. The driver uses `showScreen("plugin-virtuoso")`.

4. **Don't wait for `#plugin-virtuoso` with the default visibility check.** FeedBack screens are `display: none` until activated. Playwright's default `waitForSelector` waits for visible; we use `state: "attached"` so we can find the element before calling `showScreen`.

5. **Pathway mode hides the Regenerate button.** `#virtuoso-regenerate` is only visible in Custom mode. In pathway mode (the default on first load) you click a tempo-tier button instead, or you call the public API on `window.Virtuoso`. `driver.mjs.generate()` tries all three in order.

6. **The default test bundle needs no DLC.** Virtuoso generates its own exercises, so a *non-empty* DLC dir is not required. `launch.ps1` creates an empty `C:\Users\chris\slopsmith-dlc` if missing — the host scans it (finds nothing) and starts cleanly.

7. **The 3D Highway logs a noisy console warning** (`failed to set up audio analyser: InvalidStateError`) when the driver opens it without playback. It's the `highway_3d` plugin reacting to a missing audio source, not a problem with Virtuoso. Ignore unless a real test depends on the analyser.

## Troubleshooting

**`Bundled Python not found at C:\Program Files\Slopsmith\resources\python\python.exe`**
FeedBack Desktop isn't installed (or installed elsewhere). Install it from the official release, then re-run.

**`FeedBack source not found at C:\dev\feedback\repos\feedback`**
Clone the FeedBack host repo to that path (or refresh it via `C:\Dev\feedback\update-all.ps1`), or set `$env:SLOPSMITH_CHECKOUT` to your clone before running `launch.ps1`. The checkout is run directly via the venv python, so its full `server`/`lib`/`plugins` tree must be present.

**`Failed to load routes for plugin 'virtuoso' … NameError: name 'filename' is not defined`**
Old bug in `routes.py` where FastAPI path parameters in `@app.get(f"…/{filename}")` got eaten by the surrounding f-string. Fixed; if you see it again, double the braces: `f"…/{{filename}}"`.

**`page.waitForSelector('#plugin-virtuoso') Timeout`**
The host loaded but never fetched the plugin's screen. Tail `%TEMP%\virtuoso\server.log` — look for a `Failed to load routes for plugin 'virtuoso'` line. The plugin's `routes.py` is throwing at import time; everything else gets registered but the screen never wires up.

**`page.click('#virtuoso-regenerate') — element is not visible`**
You're in pathway mode and the driver was written assuming custom mode. The current driver handles this; if you write a new one, click a tempo-tier button first, or switch to Custom via the mode toggle.
