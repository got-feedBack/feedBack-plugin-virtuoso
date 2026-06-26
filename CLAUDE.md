# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **This file is split into numbered Parts** — most-stable first, each Part one coherent concern. It is auto-loaded into context every session, so it is kept scannable.

## Parts Index

- **Part 1 — Orientation & Rules** — what Virtuoso is, the design north star, the recurring hard rules, the file map, and the dev/test workflow.
- **Part 2 — Architecture & Code Map** — core data flow, the four-mode shell, the two-lane transport, the string-index convention, and a compact code-map pointer (the full `screen.js`/`routes.py` walkthrough + data schemas live in `docs/code-map.md` / `architecture.md` / `exercise-schema.md`).
- **Part 3 — Constraints, Procedures & Workflow** — the key constraints, the contained-playback model, the "add a pathway / generator" how-tos, and the session-start/end + agent-workflow procedures.

### Adding a Part (do this automatically — no need to ask)

Keep this file in Parts rather than letting one sprawl; it loads every session, so scannability matters.

- **When:** while editing, if a Part would grow past **~2 screens (~150 lines)** — or the whole file past **~340 lines** — split it *before* saving.
- **How:** peel the most self-contained cluster (a whole `##` section, or a coherent group of them) into a new `# ─── Part N — <title> ───` banner and add a one-line entry to the Parts Index above. Never split a single `##` section across Parts.
- **Order:** keep Parts most-stable-first (constitution before code-map).
- **Mirror:** make the identical Part change in `AGENTS.md` the same session (they mirror).
- **Ceiling, not quota:** never pad content to fill a Part.
- **Single sections stay whole:** a single `##` section is never split across Parts — if one grows too large to keep whole, promote its `###` subsections to `##` first, then peel a coherent cluster into the next Part. (Prefer demoting bulky *reference* detail into an on-demand `docs/` file and pointing to it — only always-loaded vs on-demand actually cuts the session context budget, not an in-file Part split.)

# ─── Part 1 — Orientation & Rules ───

## What this is

**Virtuoso** is a **FeedBack plugin** — it is not a standalone app. It generates guitar/bass practice routines (scales, arpeggios, chords, rhythm/technique drills, timed workouts, jam backing) and plays them back inside the plugin (contained playback — see "Contained playback" below). Install by dropping the repo into FeedBack's `plugins/` directory and restarting; the plugin then appears in the FeedBack navigation as "Virtuoso - Practice" (the `nav.label` in `plugin.json`).

The plugin has no build step. There is no `package.json`, no compiler, no bundler. All files are served directly by FeedBack's FastAPI host.

## Design north star

Virtuoso is a **practice & learning tool, not a song/riff generator.** Its purpose is to be the state-of-the-art way to practise and learn an instrument **genre-fluently** — building transferable skills a player takes *off the screen* to write their own songs/solos and to be creative. Generated content is always a means to teach a skill, never the deliverable.

**The filter for every feature, generator, pathway, and agent:** *teach the grammar, not the sentences — build a skill the player owns off the screen; never do the creative work for them.* In practice:

- Every exercise **names or describes** the transferable skill it builds and why it's idiomatic — or, at minimum, is **justifiable against this north star** (the pathway goal-cards are the fullest expression).
- Speak the player's theory vocabulary out loud (name the devices: gallop, i–♭VI–♭VII, twin leads) so they learn the language, not just the fingering.
- Prefer **recombinable primitives** (power chords, gallop, pedal-riffs, harmonized lines) over fixed canned content — give the blocks, let the player assemble their own.
- Keep a deliberate on-ramp to creation: Guided → Custom → Improv/Jam. Drills are the entrance; creativity (improv, call-and-response, master/memory mode) is the destination, not optional polish.
- Realism guardrails (no-unison, the voicing engine, fretboard playability) are mission-critical — they're what make practised skill actually *transfer*, and why the harmony / fretboard / metal-idiom review agents matter.
- **Gamification describes mastery, never substitutes a score for it** — credit named competencies, not rounds/time/rank; a "score to beat" is on-mission only as a *capstone demonstration of a skill already taught*, never the goal of practice. (This is the general principle the no-song-generator rule is a special case of, and the reason Virtuoso is a **practice studio**, not a FeedBack *minigame* — see the 2026-06-03 "stay a plugin, not a minigame" decision in `ROADMAP.md`.)

The planned random-style generator is an **idiom-demonstration / practice-variety engine** (show the genre's grammar to learn from and riff against), never a "make me a song" crutch. And when finalising user-facing docs/description, let this framing show **implicitly** — describe Virtuoso as a way to *learn and practise* an instrument, not as a generator.

## Recurring rules (distilled from session corrections — 2026-06-02)

Promoted from patterns in past-session feedback — the things Christian kept having to repeat. Treat them as hard rules.

1. **Match the established standard — host-first, then DAW / notation convention.** When building or changing ANY UI / rendering / notation / transport element, match how it is *supposed* to look and behave: first **how the SlopSmith host does it** (the 3D Highway look, the transport, section looping, player chrome), then the **Logic-Pro / standard-DAW / standard-music-notation** convention. Do **not** invent non-standard variations. If our output has drifted from the host's default look/behaviour (e.g. a non-standard fret-counter element, a missing nut/headstock, downbeats sitting *on* the bar line instead of *between* bar lines, a 2D tab that doesn't look like plain black-and-white tab), that is a **regression to fix**, not a feature. When unsure, read the host source / look at a real DAW and copy the convention.

2. **Convene the FULL relevant agent panel up front — don't under-scope it.** Christian repeatedly has to add forgotten agents ("don't forget the bass and guitar agents", "we never got input from the slopsmith agent"). When you spin up a design/review panel, include **every** relevant lane the first time. Defaults: any **instrument / playability / exercise / fingering** topic → include **BOTH guitar-pedagogy AND bass-pedagogy** (plus piano-pedagogy when piano is in scope); any **host / integration / borrow-vs-build** topic → include **feedback-compatibility** (and **notedetect-expert** when it touches pitch/chord detection, grading, the verifier, the tuner, or the timing-window inherit); any **genre / harmony / voicing** topic → the relevant **genre-idiom agent(s) + harmony-theory-architect**. Err toward **over-including** a lane rather than making Christian remind you. (Extends "Agent workflow" below.)

3. **Design in the context of the whole pane — never a rip/replace in isolation.** When you change one UI element, design it against the rest of the pane: keep layout, spacing, control families, and design language consistent with the surrounding controls (see `docs/design-system.md`). Don't isolate the change to just swapping out the one element you were pointed at.

## File layout

| File | Role |
|------|------|
| `plugin.json` | FeedBack plugin manifest (id, nav label, screen/script/routes pointers) |
| `screen.html` | Plugin UI — CSS, markup, and a small bootstrap script. Loads before `screen.js`. |
| `screen.js` | All generator logic, CAGED/3NPS data, pathway definitions, built-in renderers, audio playback, and FeedBack integration. Runs in FeedBack page scope. |
| `routes.py` | FastAPI routes under `/api/plugins/virtuoso/…` — preset CRUD, status, and `POST /temp-sloppak` (the chart builder). |
| `settings.html` | Plugin settings panel fragment rendered by FeedBack. |
| `static/` | Self-hosted audio assets served by `routes.py` — `wafonts/` (WebAudioFont sampler assets, committed); `samples/` (license-cleared committed sample subsets, e.g. the CC0 Shinyguitar electric-DI voice — see its README); `irs/` + `nam/` (cab IRs / NAM amp captures, **gitignored** pending licensing). The plugin itself is **AGPL-3.0-only** (`plugin.json` / `LICENSE`), so every *committed* asset must be license-compatible (CC0 / CC-BY / GPL-family). |
| `assets/` | Plugin chrome assets served to the host — `thumb.png`/`thumb.svg` (the nav icon, referenced by `plugin.json` `icon`). Designated home for a compiled `plugin.css` if the host `styles` capability is ever adopted (see the Tailwind constraint in Part 3). |
| `docs/architecture.md` | Integration design — the authoritative spec for how the plugin interacts with FeedBack (incl. the Sloppak on-disk format, field-name translation, audio stem generation). Read this first before changing the launch flow. |
| `docs/code-map.md` | Per-section walkthrough of `screen.js` (the §1–§15 sections) + `routes.py` (routes, storage). **Read before working inside either file.** |
| `docs/testing.md` | The nineteen smoke-suite catalogue (what each suite owns, its `npm run smoke:*` alias, the bug/memory it guards) + how to run them. On-demand companion to Part 1's "Development workflow"; **read before adding or changing a suite.** |
| `docs/exercise-schema.md` | Internal generated exercise/chart JSON schema + the compact note-field key meanings. |
| `docs/practice-pedagogy.md` | Pedagogical rationale behind the curated pathways and build order. |
| `docs/pedagogy-sequencing.md` | Beginner→advanced sequencing rationale for pathways. |
| `docs/fretboard-pedagogy.md` | Guitar fretboard system reference (CAGED, 3NPS, etc.). |
| `docs/position-system-rework.md` | Design notes on the unified position system (CAGED_SHAPES consolidation history). |
| `docs/tuning-model.md` | How tunings are modeled + named (absolute-MIDI canonical, name-resolution layer, host gotchas) — written shareable for the host team. |
| `docs/session-schema.md` | Session/segment data model used by `BUILT_IN_SESSIONS`. |
| `docs/theory-caged.md` / `theory-scales.md` / `theory-arpeggios.md` / `theory-jazz-advanced.md` / `theory-progressions.md` | Distilled theory knowledge base (CAGED, scales, arpeggios, advanced jazz, cross-genre progressions). |
| `docs/genre-framework-guitar.md` | Genre/style framework behind the progression library and random-style generator. |
| `docs/musicality-guardrails.md` | Spec for keeping generated output musically pleasing, not just theoretically correct (voicing engine rationale). |
| `docs/section-looping.md` | Section/segment looping design notes. |
| `docs/ui-session.md` | Session UI design notes. |
| `docs/design-system.md` | GUI style guide (tokens, hierarchy, primary-action parity, theme-safe color rules) — **read before any GUI change**. |
| `docs/session-2026-05-26-shape-system.md` | Shape-system unification session log. |
| `docs/*-roundtable.md`, `docs/triad-mastery-ladder.md`, `docs/proof-loop-slice.md`, `docs/beta-testing.md` | Charette/spec docs for in-flight initiatives (one per initiative — e.g. backing-engine, grading-rebuild, workout-love/engagement, programs-ladder, rhythm/timing-judging, hand-marks, bass-technique/felt-hold). The set grows each session; **`ROADMAP.md` + project memory are authoritative for which exist and their status** — don't enumerate them all here. |
| `docs/backing-pipeline.md` | How a chord progression becomes a sounding backing band (generation → humanization → DSP chain); written shareable for the host team. |
| `docs/audio-output.md` | How the browser-only plugin makes believable tone with Web Audio alone — the layered sound-source stack (synth · self-hosted GM sampler · sampled electric-DI · in-browser amp/cab IR · optional `nam_tone` borrow) under a master limiter; native-instrument support is a planned *additive* layer. Written shareable. |
| `docs/virtuoso-backing-generation.md` | Shareable explainer of the procedural backing engine — style+key+progression → idiomatic band via `STYLE_PALETTES`→`ARRANGEMENT_RECIPES`→ per-instrument cells (`COMP_GROOVES`/`BASS_FIGURES`/`DRUM_GROOVES`); deterministic, the **chart** is the portable artifact. Companion to `backing-pipeline.md`. |
| `docs/riff-vocabulary-playbook.md` | The reusable add-a-genre-vocab-pack process (rung arc, bright-line checks, consult matrix, acceptance checklists) — **future genre packs follow this, no charette needed.** |
| `docs/genre-band-authoring-playbook.md` | The reusable process for building/fixing a genre's **backing BAND** — the 11 dimensions a band must set (placement, space, voicing, lock/interlock, dynamics, micro-timing lean, …), the neighbour-confusion bright-line tests, the consult matrix, the per-genre worksheet. **Genre-band work for the remaining genres follows this; the genre-idiom agent chairs, ratify per genre** (genre-agent buy-in: country-idiom). Distinct from the riff playbook (lead/practice vocab) above. |
| `docs/progression-xp-infrastructure.md` | Dev handover on the progression/XP layer — stores, the credit front doors, the felt-hold engine, XP/levels/badges, invariants. Written shareable. |
| `docs/progression-leveling-detail.md` | The deep-dive companion: tier-ladder mechanics, the full leveling math + Lifer graduation, PBs/recognizers/specBest, the proof loop, summit invite, node states, streaks, woodshed, per-block credit, designed-not-built. |
| `docs/sources/` | Source PDFs — reference material only. |
| `docs/images/` | Screenshots embedded in the docs / README (the four renderers, the modes, result cards). |
| `scripts/cut-beta.mjs` | Regenerates the renamed `virtuoso-beta` branch from `virtuoso-dev` (the beta channel — see Part 3 session-end checklist). |
| `docs/local-dogfood.md` | **Repeatable local dogfood + dev-beta runbook** — the canonical launch pathway (`launch-desktop.ps1` = real desktop with the live repo; `launch.ps1` = headless smoke host), the userData-symlink load mechanism + the stale-link gotcha (the actual cause of "my edits don't show / behaves differently from the game"), and cut-beta. **Read before debugging test-instance inconsistency.** |
| `README.md` | User-facing feature list + install steps. |
| `ROADMAP.md` | Phase plan; **read at session start**. Authoritative for "what's shipped vs planned". |
| `AGENTS.md` | Codex variant; mirrors this file. |

## Development workflow

No build. No dev server. The workflow is:

1. Clone into FeedBack's `plugins/` directory as `virtuoso/`.
2. Restart FeedBack (web: `docker compose restart`; Desktop: relaunch the app).
3. Edit files, then reload the FeedBack page. `screen.js` and `screen.html` changes take effect on page reload. `routes.py` changes require a FeedBack restart.

To run, screenshot, or smoke-test the plugin without doing the clone/restart dance by hand, use the **`run-virtuoso` skill** (`.claude/skills/run-virtuoso/`). `launch.ps1` junctions this repo into the FeedBack plugins dir, starts the bundled-Python host on port 8765, and waits for `/status` to return `ok`; `driver.mjs` drives the Virtuoso screen via Playwright and screenshots any of the four renderers. Server logs land in `%TEMP%\virtuoso\server.log`.

There is **no unit-test or lint suite**. Verification is behavioural, via nineteen Playwright smoke suites in the `run-virtuoso` skill, run against a live host (start it with `launch.ps1` first):

- `npm test` (from `.claude/skills/run-virtuoso/`) runs **all nineteen** suites **in parallel via `run-all.mjs`** (~20s wall; dev-ops audit 2026-06-05: suites are independent chromium processes, host-read-only, so concurrency 4 is safe; suites are *discovered* by the `smoke-*.mjs` glob so a new one can't be silently missed; a failing suite's full output is replayed at the end). `npm run test:seq` keeps the old sequential chain for debugging suspected cross-suite interference. **The per-suite catalogue — what each of the nineteen `smoke-*.mjs` suites owns, its `npm run smoke:*` alias, and the bug/memory it guards — lives in `docs/testing.md`; read it before adding or changing a suite.**
- **Suites are PER-SYSTEM, never per-exercise/per-feature** (growth rule, dev-ops audit 2026-06-05). New content is already covered for free by enumeration (`smoke-generators` drives every practice type + every `BUILT_IN_SESSIONS` entry, with a drawer⇄registry drift guard) and by the startup guards; a new **durable semantic assert** lands as a **row in the suite that owns the system** (e.g. the djent engine semantics live in `smoke-generators` Phase 5; the tuning/instAgnostic plumbing rows in `smoke-strings` §7) — NOT as a new suite file. A new suite file needs a new *system*. Merge the legacy per-rung suites (herta, over-barline, connect, meter-subdiv) only opportunistically when already touching them.

These plus the startup regression guards baked into `screen.js` (e.g. the no-unison check, which throws on load if a resolved shape doubles a pitch) are the safety net before/after any `screen.js` change. **First, the fast gate: `node --check screen.js`** — it's one ~24.7k-line IIFE, so a stray brace/typo anywhere fails the whole plugin silently (the host just doesn't load the script, with no smoke failure to point at the cause); `node --check` flags a syntax error in milliseconds, ahead of the ~20s smoke run.

Alongside the durable `smoke-*.mjs` net, the `run-virtuoso` dir also fills with **ad-hoc `probe-*.mjs` and `shot-*.mjs` scripts** — local-only (gitignored), one per feature. A `probe-X.mjs` asserts a just-built feature's behaviour (the per-feature counterpart to the suites; the standard way recent work is verified — see the `probe-…` citations throughout `ROADMAP.md`); a `shot-X.mjs` drives the UI and screenshots a state. They are **not** in `npm test` and may go stale — they are throwaway proofs for the session that built them. When a probe guards something durable, promote it to a `smoke-*.mjs` suite — `npm test` (`run-all.mjs`) auto-discovers it via the `smoke-*.mjs` glob, so the `test` script itself needs no edit; the only package.json additions are an optional `smoke:<name>` alias (to run it solo) and a row in the hand-enumerated `test:seq` fallback chain.

To exercise backend routes directly, hit them via curl or the browser while FeedBack is running:
- `GET /api/plugins/virtuoso/status` — confirms the plugin is loaded
- `GET /api/plugins/virtuoso/presets` — list saved presets
- `POST /api/plugins/virtuoso/temp-sloppak` — build a temp chart; body is `{ "exercise": { ... } }`

# ─── Part 2 — Architecture & Code Map ───

## Architecture

### The core data flow

**Playback is contained entirely inside the plugin.** "Play" does **not** hand off to FeedBack's main player — this is a deliberate divergence from the old launch model (decided 2026-05-30; see "Contained playback" below).

```
User configures routine in screen.html/screen.js
  → generateExercise(cfg) / generateSession(session) dispatch → returns { version, session, chart }
  → makeBundle(exercise) wraps it into a renderer-ready bundle (activeBundle)
  → attachRenderer() mounts the selected renderer onto #virtuoso-canvas (or a borrowed host-viz sibling)
  → onPlayToggle() → startPlayback(): own requestAnimationFrame loop + Web Audio scheduling + pitch tracker
  → renderers, HUD, and live fretboard strip are driven each frame from currentPracticeTime
```

The renderers in `screen.js` are the **actual playback surface**, not just previews — there is no second transport in a host player. `startPlayback()` owns the clock (`currentPracticeTime`, RAF `tick`), audio (count-in clicks + scheduled note/metronome audio), and scoring (Minigames-SDK pitch tracker).

### The four-mode DAW shell (current UI)

The UI is **one DAW-style shell with four modes** (shipped 2026-05-31, commits `bf197c8`→`aca34d8`) — switching modes is a single root-class swap (`ss-mode-*`); the persistent furniture (header top-bar, ruler/transport, stage, Inspector frame) never rebuilds and there is **no second player**. `MODE_META` drives the modes and `selectMode(mode)` does the swap:

- **Ladder** (user-facing label as of v0.7.1; **internal token is `data-mode="guided"`** — a *labels-only* rename of the former "Pathways"/"Guided", `673db57`; the picker header reads **"Skill Ladder"**. `MODE_META.guided.label`/`ss-mode-pathways`/`virtuoso-pathway-*`/`PATHWAYS`/`renderPathwayList`/`virtuoso.lastPathway` are all UNCHANGED — in code it's still "pathways/guided") — the curated `PATHWAYS`, presented via the **pathway picker** (`PATHWAY_BANDS` 6-band map + `renderPathwayList()` + `nodeProgressState()`); the old SVG skill-tree is shelved behind it (`renderSkillTree()` early-returns).
- **Custom** — full manual control; any Custom config is a saveable Workout block.
- **Workout** — timed multi-block sessions, the wall-clock evolution of `generateSession()`/`BUILT_IN_SESSIONS`. The base time primitive is `targetSec` + `fillBlockToDuration()` (tiles whole repetitions to a wall-clock duration, overshooting to the next whole cell — never cutting a run mid-phrase); wired into `buildSessionChart` and `generateExercise`, no-op when absent. The Workout is an **editable working-draft** (`_workoutDraft`, a deep clone — never mutates `BUILT_IN_SESSIONS`): an editable block timeline (reorder/duplicate/remove/re-roll), a slide-up library drawer over `SEGMENT_TEMPLATES`, and a `↻ Refresh` that re-rolls template-ref slots via `refreshWorkout`. **Pacing (2026-06-02):** `interBlockBreakBars()` inserts a tempo-locked count-in BREAK for the incoming block (doubles as the per-block verdict beat; `auto`/`always`/`off`), and `applyLengthPreset()` (Quick/Standard/Woodshed) distributes a total across blocks proportional to natural cell duration → a setup readout, never a countdown.
- **Jam** — pick a style, play along immediately over a looping backing. `jamPlay()` builds a config from `stylePaletteConfig(styleId)` and loops it through the contained player. **Jam is a MIRROR, not a judge** — no score/combo/rank; feedback is a live chord-tone/guide-tone highlight on the fretboard strip (`jamTargetPcs()` + enriched `backingEvents`/`chordHighlightPcs`).

`STYLE_PALETTES` is the **one shared style→harmony table** (`{ progressions[], leadScales[], chordDepth/chordOverride, guideTones, feel{swing,backingStyle}, audioProfile }` per style) that a Pathway, a Custom config, and a Jam style all draw from; `stylePaletteConfig(id, opts)` returns a mergeable partial config, and a startup integrity guard (mirroring the no-unison guard) throws if a palette references a missing progression/scale/profile.

Shell furniture: a **header top-bar** (title · Setup popover `Guitar · Standard ▾` · centered 4-mode segments · progress chip → `P` sheet · ⚙ settings); the rail is purely the per-mode Inspector. **Hotkeys** (each also a visible button + `?` cheat-sheet; reduced-motion aware; never touch Esc; no audio): `M` mixer slide-up (per-bus faders/mute/solo + Backing dim, wired to the audio buses via `mixerGainFor`/`applyMixer`), `P` right-edge progress sheet, `[` Inspector collapse (`setPanelCollapsed`). Loop in/out are `i`/`o` (`[` was freed for collapse). Settings persist an accent theme (`--ss-accent-grad`/`-edge`), default XP mode, and default count-in. The Four-Pillar charette's once-pending pieces are now both **shipped** (verified in-code 2026-06-22): drums as a mixer voice (#4) is a first-class `MIXER_CHANNELS` strip (`{ key:'drums', label:'Drums', kit:true }`) with its own kit selector, and the `virtuoso.progress` XP store (#6) is the built, smoke-guarded (`smoke-progress.mjs`) Depth Ladder.

### The two-lane transport (the DAW arrangement view)

Built 2026-06-02 (commits `c616e72`→`d8281bf`); all modes share `#virtuoso-ruler-canvas`. It is **two lanes**, and matches a real DAW rather than inventing a counter:

1. **Scrolling bars|beats working ruler** — LOCKED to the note renderers' window (`rulerWindow`/`rulerMap` off `chartBeatSeconds` + `AHEAD`/`BEHIND`), playhead fixed ~22% from the left, bars pixel-aligned with the falling notes, ~7 bars on screen so it stays legible at any tempo/length (no decimation). Drawn by `drawRulerFrame()`.
2. **Whole-session overview / marker strip** — `drawOverviewFrame()`/`overviewBands` from `segmentBounds`, each band **role-tinted and NAMED** = the DAW arrangement track (mirrors the host **Section Map** plugin; nothing borrowable, so build-but-mirror). It owns A–B loop **authoring** (drag), click-seek, and a viewport box; the working ruler reflects the loop + off-screen edge chevrons.

In **Jam** (`isJamMode`) the overview becomes the **chord loop** — function-tinted bands of the progression with chord name + roman numeral (from enriched `backingEvents` `rn`/`fn`), current chord bright + NEXT raised, loop-relative bars on the working ruler; the fretboard pre-lights the next chord's guide tones as an amber dashed ghost ~1.5 beats early (`jamNextGuidePcs`) = play-the-changes anticipation. Progressive disclosure: a single Pathway drill shows the simplest transport; Custom/Workout scale the band lane out. **Deferred polish:** tokenize the ruler's raw hex → `--ss-*`; a min:sec readout; decimated bar labels on the overview. Full spec + window math: memory `project_transport_two_lane_redesign`.

### Code map (screen.js + routes.py)

`screen.js` is **one IIFE, ~24k lines** — it loads as a classic `<script>` (no `type="module"`), so it **cannot use `import`/`export`; keep it one file.** Sections are marked with `§N` banner comments and indexed in a **table-of-contents header at the top of the file** (the canonical §1–§15 order) — **grep `§` or read that header to navigate before editing.**

`routes.py` registers FastAPI routes under `/api/plugins/virtuoso/…` (status, preset + tuning CRUD, the dormant `POST /temp-sloppak` chart builder, and the self-hosted `/wafont` `/ir` `/nam` `/sample` audio-asset routes). **Storage is DB-backed** (the shared FeedBack meta-DB via `context["meta_db"]` → tables `virtuoso_presets` + `virtuoso_tunings`), not flat files — the `presets.json`/`tunings.json` declared in `plugin.json`'s `settings.server_files` are **export-snapshots** of those tables (the host bundles them on export / restores them on import: `_snapshot_*` writes DB→JSON, `_migrate_*_from_json` re-imports on startup), NOT the live store.

**The full per-section walkthrough of both files lives in `docs/code-map.md`** (the screen.js §-walkthrough — constants, `CAGED_SHAPES`, `PATHWAYS`, `BUILT_IN_SESSIONS`, the exercise/session builders, voicing engine, renderer factory, fretboard strip, audio engine §14, segment-template engine, public surface — plus the routes.py route list + storage model). **Read it before working in either file.** For the rest: the on-disk **Sloppak format, the `chordTemplates`→`templates` / `handShapes`→`handshapes` field translation, and audio stem generation** are in `docs/architecture.md`; the **exercise/chart JSON schema + the compact note-field key meanings** (`t`/`s`/`f`/`sus`/`bn`/`ho`/`po`/…) are in `docs/exercise-schema.md`.

### String index convention

**In Virtuoso, `s=0` is the lowest string (low E in standard 6-string tuning).** This is the `openMidis` array index in `STRING_SETUPS` and the `s` key in `CAGED_SHAPES.chordTemplates`. This is the opposite of the high-E-first convention (`0` = high E) some other tab tools use — do not cross-apply.

# ─── Part 3 — Constraints, Procedures & Workflow ───

## Key constraints (from docs/architecture.md)

- **Contained playback — one player, owned by Virtuoso.** Under the current model (decided 2026-05-30; see "Contained playback") Virtuoso runs its **own** transport/audio/canvas lifecycle in `screen.js`. Do NOT reintroduce host-player handoff (`window.playSong`), and do NOT build a *second* transport/WebSocket/canvas beyond that one contained player.
- **Backend routes must stay under `/api/plugins/virtuoso/…`.**
- **`window.playSong`, `window.showScreen`, `window.createHighway`, and the host capability bus** are FeedBack's public frontend APIs. Do not monkey-patch them. **Host-global naming (FeedBack re-chrome, swept 2026-06-23):** the bus is `window.feedBack` (legacy `window.slopsmith` is aliased by the host), the scoring SDK `window.feedBackMinigames` (legacy `slopsmithMinigames` is dual-published), the desktop bridge `window.feedBackDesktop` (**no** legacy alias), and viz factories register as `window.feedBackViz_<id>` (**no** legacy alias — the v0.3.0 break that silently dropped the 3D highway to 2D and killed the green hit-flare). Read every host global through the §12 host-aware accessors — `hostBus()` / `hostMinigames()` / `hostDesktop()` / `vizFactoryFor()` (new name first, legacy fallback) — never a bare `window.slopsmith*`. (`goScreen()` navigates via `hostBus().navigate` / `window.showScreen`. The `localStorage['slopsmith_notedetect']` key is note_detect's and is **unchanged** — keep reading it.)
- **Don't globally clobber `window.AudioContext`** (or any shared browser global) in a way that degrades it for other plugins. Virtuoso *does* replace it (`patchAudioContextForSharing`) with a click-suppressing stub for the borrowed highway_3d — but the stub is returned **only while Virtuoso's own screen is active** (`#virtuoso-root` has an `offsetParent`); when Virtuoso is backgrounded, `new AudioContext()` must be the real thing, or the host player's stem loader gets a context with no `decodeAudioData` (the v0.5.0 cross-plugin regression: a too-broad gate poisoned the global session-wide once the pathway-select preload created the ctx). Guarded by `smoke-audioctx.mjs`.
- **Do not override Escape.** FeedBack owns Escape for return-to-menu. The plugin's keyboard handler (`screen.js`) deliberately never touches it. (The old launch model used a `sessionStorage['virtuoso.returnToMenu']` marker to override Escape; that flow is gone with contained playback.)
- **Do not add the temp sloppak to FeedBack's library index.** It lives under `.virtuoso-temp/` specifically to avoid indexing.
- **Tailwind: common core utilities only — no arbitrary-value classes, no CDN/runtime JIT** (host `docs/plugin-styles.md`; verified 2026-06-07). The host serves a prebuilt sheet scanned only from core source, and Virtuoso (runtime-installed) is never scanned — a class core doesn't ship renders unstyled. We're compliant by omission: `screen.html`/`screen.js` use zero Tailwind (self-contained `ss-*` CSS) and `settings.html` uses only common utilities verified present in the host's `static/tailwind.min.css`. If a future change needs a class beyond that set (especially `text-[11px]`-style arbitrary values), adopt the host's `styles` capability properly: compiled `assets/plugin.css` (`preflight: false`, utilities only), `"styles"` in `plugin.json`, version-bump on every CSS rebuild.
- **No-unison rule:** a scale/mode/arpeggio run must never sound the same pitch (same MIDI) twice across strings. Shapes are degree-driven, not fret-window blocks, and there is a startup regression guard that throws `[Virtuoso no-unison] … doubles a pitch` if a resolved CAGED/Open shape doubles a note. When adding or editing shapes, preserve this — don't reintroduce fret-window selection.
- **Core/shell boundary (host-independence) — STRATEGIC.** The **generation path** — `generateExercise`/`generateSession` (§8–§9) and everything they call (the theory data tables §1–§3, the CAGED/3NPS/Open shape resolver §4, chord-depth + voicing engines §5–§6, the exercise builders §7, the pure chart helpers in §10) — is Virtuoso's **host- and DOM-independent engine** and its durable IP / basis for a future standalone app or embeddable library. It consumes a plain `cfg` and returns a plain `{ version, session, chart }` (the **chart** is the portable artifact); it must **never** reference `window`, `document`, `localStorage`, `fetch`, or any `slopsmith*` global. **`makeBundle()` (§10) is the chart→renderer-bundle boundary** — it reads display prefs (highway inverted/lefty/render-scale/look), the first shell step, *not* core. §11–§15 (renderers + host-viz borrows, audio engine, Minigames scorer, navigation, storage, asset URLs) and `routes.py` are the **thin, disposable shell** — FeedBack is *one* implementation behind that boundary, not a dependency woven through the core. `readConfig()` (§15) is the single DOM→`cfg` funnel. **Protect this by discipline, not speculative scaffolding:** keep coupling out of the generation path; do NOT build adapter/standalone abstractions until a second consumer actually exists. **Guarded by `smoke-core-purity.mjs`** (traps the host surface, runs every builder; in `npm test`). (Audited 2026-06-01: the generation path is verified clean — 29/29 builders; the only extraction blocker is the one-file/no-modules packaging. Coupling map + risks: project memory `project_host_independent_core`.)
- **Consume the host judge (no parallel grader) — STRATEGIC.** Note **detection**, hit/miss **judging** (incl. timing), and the per-note scoring **visual** are the host's. Virtuoso consumes note_detect's contained-verifier verdicts (`detected:true`→hit, `detected:false`→miss, `detectedSongTime`→timing, `centsError`→pitch) and the host highway's native hit-flare — it builds **none** of its own and may **not** re-judge or re-render per-note on top. The contained drain credits verdicts **1:1**: no local timing window, silence/level gate, A/V calibration, or level meter may influence credit (the `0.7.43` desktop-DI ~0-credit bug was a local timing-judge — `ptWinSeek` — racing the async engine, beating every hit to an already-missed window). Virtuoso's own layer is **downstream-only**: the CHART (what to play) + the PEDAGOGY that **reads** hit/miss (proof-loop, felt-hold, XP), never re-judging. **Pre-build:** anything touching detection/grading/scoring-viz takes the detector-scope HOST-CHECK (Part 3 agent rule 4) and the answer is *consume, don't build*. **Guarded by `smoke-contained-verifier` (5)** — a LATE verdict still credits; a re-introduced parallel judge race-misses it and the suite goes red. Migration + the consume-only dependency map: project memory `project_consume_host_judge`.

## Contained playback (current model)

**Virtuoso runs as a fully self-contained player; "Play" never launches the host player.** This is a deliberate decision (2026-05-30, commit `e62d02a`) that supersedes the "Launch in Main 3D Player" UX described in older `docs/architecture.md` prose. Practice plays back inside the plugin via `startPlayback()` (own RAF clock + Web Audio + pitch tracker) across the renderers selected by `resolveRendererFactory()`.

Consequence: `screen.js` does **not** call `fetch('/api/plugins/virtuoso/temp-sloppak')` or `window.playSong`. The `POST /temp-sloppak` route in `routes.py` (and the field-translation / sloppak-format machinery documented above) still exists but is **dormant** — kept for reference and possible future re-enablement, not on the live path. Don't "fix" the frontend to call it without confirming the contained-playback decision has been reversed (check `ROADMAP.md` and project memory first).

## Adding a new pathway

1. Add an entry to `PATHWAYS` in `screen.js` with `label`, `goal`, `scales`, `tempoTiers`, `base` config, and `vary[]`. Optional flags: `instAgnostic:true` makes a pure-time rung ADAPT to the player's current instrument instead of forcing its coded `stringSetup` (the per-pathway form of the Rhythm-band adapt); a `customOpenMidis:'csv'` in base/vary applies a tuning override (it's anti-leak defaulted in `applyPathwayConfig`, so it never persists into the next pathway). **Technique/rhythm rungs anchored to the low string code NO key:** `anchor:'open_lowest'` + `anchorFret:0–11` in base (vary steps move `anchorFret`) — the key is DERIVED from the player's actual lowest string at apply time (`applyAnchorPolicy`; a startup guard throws on `key` co-coded with `anchor`). Genuinely keyed lessons (CAGED maps, progressions, blues) keep keys.
2. Add the corresponding `<option>` to the `#virtuoso-pathway` select in `screen.html`, and slot the id into its band's `pathways[]` in `PATHWAY_BANDS` (+ a `SKILL_TREE_EDGES` prereq edge for the "Builds on" hint).
3. No backend changes needed.

## Adding a new generator (practice type)

1. Add the `<option>` to the `practiceType` select in `screen.html`.
2. Implement `buildXExercise(cfg)` in `screen.js` returning an `exercise` object matching `docs/exercise-schema.md`.
3. Wire it into the `generateExercise(cfg)` dispatch function.
4. No backend changes needed unless the new type requires a new route.

## Working sessions (start / end checklist)

A lightweight ritual the **main thread** follows so context survives across sessions — the cheap alternative to a standing PM agent (see the group-design protocol below).

**At session start:**
- Read `ROADMAP.md` — authoritative for shipped-vs-planned; check **"Open threads"** and any **"STOPPED HERE"** handoff marker.
- Project memory (`MEMORY.md` index) loads automatically — skim it; for agent work, read the relevant `.claude/agent-memory/<agent>/`.
- Before acting on anything a memory names (file / function / flag), **verify it still exists** in the current code — memory reflects the past; the code is now.

**At session end (before closing):**
- Update `ROADMAP.md` — move finished items, log new **Open threads** or a **"STOPPED HERE"** handoff for the next session.
- Write durable **decisions** (not ephemeral task state) to project memory; spawned agents update their own `.claude/agent-memory/<agent>/`.
- If conventions changed, keep `CLAUDE.md` and `AGENTS.md` **in sync** (they mirror).
- If `screen.js` changed, run the smoke suites (`npm test` in `.claude/skills/run-virtuoso/`, host running). Commit working changes following the repo's **Conventional Commits** style (`type(scope): …` — e.g. `feat(audio):`, `feat(ui):`, `docs:`); **commit/push only when asked.**
- **`main` HEAD is a PUBLISHED end-user artifact** (since FeedBack Desktop v0.2.9, 2026-06-08): Virtuoso is a bundled host plugin AND the host's `update_manager` zips our default-branch HEAD when a Desktop user updates (the user-dir copy wins over the bundled snapshot). So **keep WIP on a branch; only land on `main` when green**, and **bump `plugin.json` version on every shippable change** (the host caches by id+version) — **AND bump the `VIRTUOSO_VERSION` constant in `screen.js` to match** (it's the header version badge; the host doesn't inject a plugin's own version, so the badge mirrors `plugin.json` by hand — keep them equal). On a NEW FeedBack release, run the **host-release overlap sweep** (ROADMAP standing ritual) before building — it's the recurring counterpart to the per-feature HOST CHECK in "Agent workflow" rule 4. Full mechanics: project memory `project_host_release_v029_audit`. **Beta channel:** to let testers run WIP *alongside* stable, `node scripts/cut-beta.mjs --push` regenerates the renamed `virtuoso-beta` branch (id `virtuoso_beta`, "Virtuoso (Beta)") from `virtuoso-dev` so it coexists with stable; promote dev→`main` on the word. See `docs/beta-testing.md` / memory `project_beta_channel`.

## Agent workflow (required)

Specialist agents in `.claude/agents/` (local) are the project's review/design layer — using them is part of the workflow, not optional. These are judgment-based conventions (they need the Agent tool + musical expertise), not automatable hooks.

1. **New genre pathway → a matching genre-idiom agent must own it.** Every genre pathway is vetted for authenticity by the idiom agent for its style. If a new genre pathway introduces a genre/style not yet covered by an existing genre-idiom agent, **create that agent first** (mirror an existing one, e.g. `metal-idiom-architect`). Agents are scoped per *genre/style*, and one agent owns all of that genre's pathways — do **not** create one agent per pathway (keep the clean matrix in `ROADMAP.md`).
2. **New instrument → create its pedagogy agent.** Adding an instrument beyond guitar/bass/piano requires a matching instrument-pedagogy agent (mirror `guitar-pedagogy-expert` / `bass-pedagogy-expert` / `piano-pedagogy-expert`) that verifies techniques, fingering, and scale/arpeggio patterns for that instrument.
3. **Create or adjust an exercise / generator / genre pathway → run it by the appropriate agents before it's "done."** Review with: the **instrument-playability** agent for the target instrument, the **genre-idiom** agent for its style, and **harmony-theory-architect** when harmony/voicings/progressions are involved. Act on the findings or log them — this is how the metal pack and the backing-track voicings were validated (and how the backing root-transposition bug was caught).
4. **Host check BEFORE building anything in the shell (borrow-before-build).** Any **new capability** outside the generation-path core (§1–§10) — player/transport chrome, audio synthesis/instruments, scoring/detection/judging, visualization, persistence, gamification plumbing — gets a host check **before design starts**: consult `feedback-compatibility` (its memory first — it caches the FeedBack repo/host surface; live-verify against the local `desktop\feedback\repos\` clones when stale or absent). The artifact is a 5-line **HOST CHECK** block in the feature's spec doc (or its ROADMAP entry when there's no doc): *capability · what the host has (file/API, or "nothing found") · evidence + date · verdict BORROW / MIRROR / BUILD · what host change would flip the verdict*. The core generation path never needs one (the host will never ship our USP); fixes to already-shipped shell code don't re-trigger it. In group-design sessions, the HOST CHECK is the chair's first agenda item for any shell-touching initiative. This is the pre-design counterpart of Part 1 rule 1: that rule governs how shell things look/behave; this one governs whether we build them at all. **When the capability ships, quote the HOST CHECK block in the build hand-back to Christian (and in its ROADMAP entry/commit body) — borrow-vs-build must be visible at delivery, not only at design** (adopted 2026-06-06: the tuner's check ran correctly pre-design but produced no visible artifact, so Christian had to ask after the fact). Standing corollary (ratified 2026-06-06): **Virtuoso never builds its own polyphonic/chord-detection DSP** — credit semantics and display surfaces are ours; detectors are host territory. (Why: NAM, the WebAudioFont sampler, highway-settings inheritance, and the scoring SDK were each designed/built before discovering the host already had them — each cost a migration this check costs minutes to prevent.) **Detector-scope consult (added 2026-06-11):** anything crossing the **note_detect** plugin's scope — the verifier/scoring path, the tuner, the **timing-window inherit**, the level meter / **silence gate**, mic-floor / tuning context, or **merging an external grading PR** — gets `notedetect-expert`'s read **before/while building or merging** (its memory first; live-verify against the repo `slopsmith-plugin-notedetect` AND the user's *running build* — merged-upstream ≠ running-for-the-user, his note_detect is pinned). It owns what the detector exposes/requires/plans; Virtuoso consumes it, never builds its own (the corollary above).

**Agent roster & memory.** The specialist agents live in `.claude/agents/*.md` (the genre-idiom set — expanded 2026-05-31 with **19 granular sub-genre agents** (kpop reviewed-and-cut; the broad→granular lane carves recorded in ROADMAP "Granular genre expansion"), the instrument-pedagogy set, and the cross-cutting architects — `harmony-theory-architect` (pitch), `rhythm-meter-architect` (the time/meter engine: subdivision, swing, count-in/loop tiling, odd/polymeter, the long-cycle model), `sound-design-architect` (playback audio quality + safe, normalized output — standard loudness/limiting, no clipping or gratuitous full-volume transients), `audio-engine-architect` (the rendering & instrument-sourcing *method* — synthesis vs amp/cab-modeling vs sampling vs host-engine; distinct from sound-design's mix/aesthetics), `learning-design-architect`, `gamification-architect`, `virtuoso-ux-designer`, and `devops-operability-architect` (operability / test-harness / release / runtime-robustness — "is it solid to run + ship?"; carries target-CURRENT-FeedBack + triage-by-value; defers host-API specifics to `feedback-compatibility`), and `notedetect-expert` (the **note_detect** pitch/chord DETECTION + VERIFICATION engine Virtuoso grades through — the standing reviewer for anything crossing the verifier / tuner / timing-window-inherit / level-gate scope, incl. external grading PRs; sibling to `feedback-compatibility`, which owns the FeedBack host app + its plugin ecosystem)). Each clears a **distinct, non-overlapping lane** and accumulates findings across sessions in `.claude/agent-memory/<agent>/` — a `MEMORY.md` index plus per-topic files (e.g. logged harmony bugs, the blues content audit). Read the relevant agent's memory before spawning it, and skim it when you need the rationale behind a past decision; spawned agents already carry this context. (`.claude/agents/` and `.claude/agent-memory/` are gitignored — local-only.)

**Group-design sessions & synthesis (no standing PM agent).** Cross-cutting initiatives (a new pathway family, an instrument, a Core curriculum) are designed in a *group-design session*: the most relevant cross-cutting architect **chairs** (`learning-design-architect` for curriculum), genre/theory agents **shape content**, instrument-pedagogy agents **verify playability**, the rest **fill gaps**. The **main thread** runs the session, then synthesizes the outputs into one spec + a decision log, reconciles conflicts, updates `ROADMAP.md`, and writes decisions to memory. This coordination is deliberately the main thread's job — there is **no standing "project-manager" agent** (a cold-spawned agent would re-derive all context every time; the main thread already holds it).
