# Local dogfood + dev-beta runbook

How to cut a dev beta and dogfood Virtuoso locally against the **real game**, with a
launch that can't silently drift. Written after a session of chasing "detection differs
from the game / green notes don't fire / my edits don't show" ghosts that **all** traced
to a non-reproducible, hand-assembled environment — not to plugin bugs. The cure is the
standard one: **one canonical app, a self-healing/explicit plugin source, and a startup
preflight that fails loudly on drift.**

## TL;DR

| Goal | Command (from repo root) | What it gives you |
|------|--------------------------|-------------------|
| Dogfood in the REAL desktop (live repo) | `.claude/skills/run-virtuoso/launch-desktop.ps1` | `feedback.exe` with your working copy of virtuoso swapped in live |
| Automated smoke / Playwright | `.claude/skills/run-virtuoso/launch.ps1` → then `npm test` in the skill dir | headless host on `:8765` + the 18 smoke suites |
| Cut a dev beta channel | `node scripts/cut-beta.mjs --push` | the `virtuoso-beta` branch/channel (coexists with stable) |

## Launch ONE app — `feedback.exe`

`C:\Dev\feedback\desktop-app\feedback.exe` is the canonical FeedBack desktop. It **bundles
the correct mainline sibling set** (note_detect 1.15.3, highway_3d 3.26.0, minigames), so a
clean launch *is* the shipped game.

**Do NOT** launch the legacy `C:\Program Files\Slopsmith\Slopsmith.exe` — it's an older,
auto-updating install with its **own separate plugin dirs**. Having both is the #1 cause of
"my test instances aren't consistent." Standardize on `feedback.exe`; uninstall the old
Slopsmith install if you can. (`launch-desktop.ps1` also kills any leftover Slopsmith
server, which otherwise squats port 18000 and bumps the desktop to 18001.)

## How the desktop finds plugins (know what you're testing)

`feedback.exe` loads plugins from its Electron userData dir
`%APPDATA%\slopsmith-desktop\plugins\` — each dev plugin is a **symlink to its working
copy**, and a user symlink there **wins over the bundled snapshot** (verified 2026-06-23).
It does **not** honor `$env:SLOPSMITH_PLUGINS_DIR` — that's the *headless* host's lever.

> ⚠️ **The gotcha that cost a session:** when the repo was relocated, that `virtuoso`
> symlink went stale — it still pointed at the old `C:\Dev\feedback\repos\…` clone, which a
> separate `update-all.ps1` keeps pulled to committed HEAD. So the desktop loaded
> *committed* code and **never your uncommitted working-tree edits**. That's the entire
> "my changes don't take / it behaves like the game differently" symptom.
> `launch-desktop.ps1` **self-heals this link to the current repo on every launch** — the
> whole reason to use it instead of double-clicking the exe.

## Dogfood loop

1. Edit `screen.js` / `screen.html` in `C:\Dev\feedback-plugin-virtuoso`.
2. Run `.claude/skills/run-virtuoso/launch-desktop.ps1` (PowerShell). It:
   - points `…\slopsmith-desktop\plugins\virtuoso` at this repo (self-healing any stale link),
   - kills any prior host instance + zombie server (clean, deterministic port),
   - launches `feedback.exe` and confirms virtuoso loaded live, printing
     `virtuoso live on http://127.0.0.1:<port>/ (from C:\Dev\feedback-plugin-virtuoso)`.
3. In the app, open Virtuoso. For further edits: **reload the Virtuoso screen**
   (`screen.js`/`screen.html` are live on reload; **`routes.py` changes need a relaunch**).

## Headless host (for smoke, not human dogfood)

`launch.ps1` boots a headless host on `:8765` with its own dev plugin dir
(`%LOCALAPPDATA%\Slopsmith\plugins-dev`, junctioned to this repo) and runs an
**env-reference preflight** (`env-reference.json`): it asserts the sibling versions match
the mainline reference + that note_detect exposes the contained-verifier API + that exactly
one `id:virtuoso` loads. **CRITICAL drift aborts; borrow-drift only warns.** Then `npm test`
(in the skill dir) runs the 18 smoke suites. Use the headless host to *verify*, the desktop
to *feel*.

## The green-note A/B (is it a real bug or env drift?)

To tell whether a detection/scoring difference is a real Virtuoso bug or environment drift,
run the **same** exercise in both:

- **A — real game:** `launch-desktop.ps1` (note_detect 1.15.3 + highway_3d **3.26.0**).
- **B — headless host:** `launch.ps1` + browser `:8765` (currently ships highway_3d **3.22.0**).

If **A** is right and **B** is wrong, it's the host sibling version, not Virtuoso (the
preflight WARNs the `highway_3d` 3.22.0-vs-3.26.0 gap). Fix by bumping the headless host's
highway, never by editing Virtuoso to match a drifted host.

## Cut a dev beta

`node scripts/cut-beta.mjs --push` regenerates the renamed `virtuoso-beta` branch (id
`virtuoso_beta`, "Virtuoso (Beta)") from `main` (the single trunk since the 2026-07-16
consolidation), or from a feature branch via `--source <branch>` so testers run WIP
alongside stable. See `docs/beta-testing.md` / memory `project_beta_channel`. Land work on
`main` only when green (the smoke suite + the desktop dogfood both clean).
```
