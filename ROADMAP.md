# Virtuoso — Roadmap

> **Virtuoso is a practice-studio plugin for the FeedBack host** — it generates guitar/bass (piano/drums in scope) practice routines and plays them back inside the plugin. It relaunched at **v0.1.0** as a clean-history rebrand of a mature codebase (formerly developed under another name; the full pre-0.1.0 development history is preserved in the original private archive repo). This file is the authoritative **"shipped vs planned"** record and the cross-session handoff log — **read it at session start.**
>
> Architecture + conventions live in `CLAUDE.md` (the constitution) and `docs/`; the user-facing feature list is in `README.md`. Don't duplicate those here.

## Where this is (v0.1.0)

Virtuoso ships a mature, working feature set inherited at relaunch — **this is not a greenfield 0.1.0**, it's an established plugin renamed and re-homed:

- **Four-mode DAW shell** — **Ladder** (curated skill pathways), **Custom** (full manual config), **Workout** (timed multi-block sessions), **Jam** (play-along over a procedural backing band). One shared shell; **contained playback** (Virtuoso owns its own transport/clock/Web-Audio + pitch tracker — no host-player handoff).
- **Generation engine** — the host- and DOM-independent core (`screen.js` §1–§10): scales/modes, arpeggios, chords, rhythm/technique drills, riff-vocabulary, CAGED/3NPS/Open shapes, the voicing engine, and the procedural backing band (29 genre styles via `STYLE_PALETTES`→`ARRANGEMENT_RECIPES`). The **chart** is the portable artifact.
- **Four renderers** — 3D Highway (borrowed host viz), 2D Highway, Tab, Notation.
- **Grading** — consumes the host **note_detect** verifier (the *consume-the-host-judge* rule — no parallel grader). Plus hand-marks, the proof-loop, XP/leveling/badges, custom tunings, sample-bank instruments, and the amp/cab "Rig".
- **Audio** — self-hosted WebAudioFont GM sampler + sampled electric-DI + in-browser amp/cab IRs under a master limiter; optional host `nam_tone` borrow for the live input tone.

Verification: 18 Playwright smoke suites (`.claude/skills/run-virtuoso/`, `npm test`) + the in-`screen.js` startup guards. **Smoke 18/18 green at relaunch.**

## Open threads

- **⚠ Name not yet cleared — gating for any PUBLIC launch.** "Virtuoso" hasn't passed a trademark / domain / store-name screen, and it's a common music word (likely crowded in classes 9 / 41 / 42). The private 0.1.0 id cutover is done; run a USPTO/EUIPO TM screen + `.com`/`.app` + App/Play store-name + a dictation test **before** any public launch. (A further rename would be another `virtuoso`-id data migration, so clear the name before promoting widely.)
- **Host-org governance.** Canonical repo now lives in the **got-feedback** org as `feedBack-plugin-virtuoso`. Settle with Byron how FeedBack bundles it (read-only mirror / submodule vs. user-installed), and retire the stale pre-rebrand plugin fork still in that org. **`main` HEAD is a published artifact** — FeedBack's `update_manager` zips the default-branch HEAD on update, so keep WIP on a branch, land on `main` only when green, and bump `plugin.json` **and** `VIRTUOSO_VERSION` together on every shippable change.
  - **Two host-side PRs open to land the bundle swap + keep first-class menu status (2026-06-22) — MUST MERGE TOGETHER:** (1) **`feedBack-desktop#31`** — `build-common.sh` bundled-plugins list `slopscale-fork` → `virtuoso` (diff correct + tidied; CI red is the org Actions **billing** block, not the code). (2) **`feedBack#554`** — `static/v3/shell.js` NAV + `PROMOTED_PLUGINS` slot `slopscale` → `virtuoso`; without it `renderPromotedNav()` finds no `slopscale` in `/api/plugins` and Virtuoso silently drops from its dedicated sidebar slot to the generic Plugins gallery. Shipping either alone regresses the practice plugin in the UI.
- **Beta channel.** `scripts/cut-beta.mjs` is re-tokened (`virtuoso` / `virtuoso_beta` / `virtuoso-beta`, source default `virtuoso-dev`). To use it, create the `virtuoso-dev` working branch and decide whether the relaunch wants a beta channel yet (`docs/beta-testing.md`).
- **Detector forward-watch.** Our outbound contributor events are `virtuoso:tier:unlocked` / `virtuoso:progress` (nothing consumes them yet). If the host ships progression spec 011 with a listener, coordinate the event names then. The note_detect verify / contained-verifier path is current and green (web 1.15.2).
- **Carry-over by-ear dogfood (from pre-relaunch):** the classic synth-palette voices; the "grading feels a touch tight" tunable (the silence floor / timing window); and desktop note_detect needs the input device selected in the FeedBack desktop audio settings (a native-input gotcha, not a code bug).
- **Local (post-relaunch):** regenerate `.claude/settings.local.json`'s allow-list for the renamed `run-virtuoso/` skill paths.
- **Repo relocated locally (2026-06-22).** Working copy moved out of the sibling-repos collection (`C:\dev\feedback\repos\feedback-plugin-virtuoso`) to a standalone `C:\Dev\feedback-plugin-virtuoso`. Git/remote/branch-tracking and all scripts are self-locating (`launch.ps1` `$PSScriptRoot`, `cut-beta.mjs` `import.meta.url`) — unaffected. The one thing the move broke: the dev-host junction `%LOCALAPPDATA%\Slopsmith\plugins-dev\virtuoso` still pointed at the old path. **Gotcha for any future move:** `launch.ps1` leaves an existing junction *as-is*, so it won't self-heal — re-point it (`cmd /c rmdir` the link, then `mklink /J` to the new path), or delete it so the next launch recreates it. Fixed + verified: smoke **18/18** green from the new location.

## Session ritual

**At start** — read the above + check Open threads / any **STOPPED HERE** marker. Project memory (`MEMORY.md` index) loads automatically; verify anything a memory names still exists before acting on it.

**At end** — move finished items here; log new **Open threads** or a **STOPPED HERE** handoff. Write durable *decisions* to project memory. Keep `CLAUDE.md` / `AGENTS.md` in sync. If `screen.js` changed, run `node --check screen.js` + the smoke suite. Commit working changes in Conventional-Commits style; **commit/push only when asked.**

## STOPPED HERE (v0.1.0 relaunch)

Clean-history rebrand + relaunch landed as the **genesis commit** (plugin id `virtuoso`, `v0.1.0`) in `got-feedback/feedBack-plugin-virtuoso`. The full pre-0.1.0 development history is preserved in the original private archive repo. `node --check` clean · smoke **18/18** green · 3-agent pre-push audit (host-compat / detector / operability) clean. **NEXT:** work the Open threads above — **name clearance before any public launch** is the gating one.
