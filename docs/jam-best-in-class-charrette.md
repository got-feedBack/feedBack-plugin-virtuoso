# Jam Best-in-Class Charette — 2026-07-03

## Purpose

Christian asked for a fresh agentic charette on Jam mode: sounds, chord progression options, the jamming experience, weak links, and an action plan. This document is the Codex/Claude Code handoff. It should be read with `docs/jam-mode-roundtable.md`, `docs/virtuoso-backing-generation.md`, and `docs/genre-band-authoring-playbook.md`.

Panel lanes used this session:

- UX / learning design: `slopscale-ux-designer`, `learning-design-architect`, `gamification-architect`, `feedback-compatibility` memory.
- Audio / sound design / backing realism: `audio-engine-architect`, `sound-design-architect`, `drum-pedagogy-expert`, `bass-pedagogy-expert` memory.
- Harmony / progression / genre idiom: `harmony-theory-architect` plus genre-idiom memory.
- Instrument pedagogy: both `guitar-pedagogy-expert` and `bass-pedagogy-expert` memory.
- Devops / host compatibility: `devops-operability-architect`, `feedback-compatibility`, `notedetect-expert` memory.

GitHub orientation: repo `got-feedback/feedBack-plugin-virtuoso`, default branch `main`, no open issues at review time.

## Current Jam Features Verified

Jam is already more than the older redesign brief implies:

- Contained playback path: `buildJamConfig()` -> `jamPlay()` -> `generateExercise()` -> `buildJamChart()` -> `startPlayback()` in `screen.js`.
- Style picker: searchable, family-grouped, recent-aware via `GENRE_FAMILIES`, `renderJamStyles()`, and `currentJamStyleId()`.
- Band strip: names active rhythm/keys/bass/drums roles and supports live voice swaps through `renderBandStrip()` and `commitLiveVoiceSwap()`.
- Harmony source: `STYLE_PALETTES` plus `COMMON_PROGRESSIONS`, with named progression picker and `Mix` per-pass round-robin.
- Living loop basics: `buildJamChart()` creates multi-pass Jam charts with pass re-rolls, seam fills, energy density, bass filtering, and Spotlight turn tags.
- Wrap-queued edits: `jamQueueChange()` and `jamHotSwapAtWrap()` apply key/tempo/feel/progression/depth/energy changes at the loop wrap without rebuilding the renderer.
- Bass role: bass players default to `You're the bassist`, dropping the backing bass; `Drums only` and `Full band` remain available.
- Guide line: silent by default; `+ Guide line` is opt-in, and Spotlight can enable generated notes only for band turns.
- Teaching mirror: `jamTargetPcs()`, `jamNextGuidePcs()`, chord-loop overview, next-chord ghosts, played-note strip ripples, and no-score Jam recap exist.
- Mirror guardrails: `_ptJamRun` suppresses hit/miss paint and credit. Jam uses pitch only as a mirror input, not a judge.

## Blind Spots / Weak Links

### Experience

- Jam still had loop accumulation visible through `#virtuoso-loop-count`. That reads like time-served progress, not creative application.
- Fretboard map can be off even though the README sells Jam around chord/guide-tone lighting. Jam needs the target map to be more discoverable.
- Style changes apply immediately while most setup controls queue to wrap. The mixed apply model needs explicit copy and smoke coverage.
- The pending chip lacks a beats-to-wrap countdown, even though the UI comments point that direction.
- Recap did not show if no pitch was detected. A no-mic or quiet Jam still deserves a descriptive form/intent recap.
- Intent chips are framed before Jam but not strongly reflected at the end.

### Pedagogy

- Guitar Jam reflection records note count and pitch classes, but not target behavior: guide-tone landings, chord-tone choices, root resets, or whether the player actually worked the selected intent.
- Bass target guidance is still too guitar-shaped. Bass needs roots, next roots, approaches, register, and pocket language before 3rds/7ths.
- Bass intent chips are too generic for style transfer. Disco octave engine, reggae space, walking approaches, ghost-note pocket, etc. should vary by style.
- Spotlight's band-turn line is currently generated scale-run material; the form is right, but the content should become sparse, style-aware call phrases.

### Harmony / Progressions

- Several good progression tokens already existed but were not surfaced in Jam palettes.
- Blues needed `jazz_blues` and turnaround options.
- Jazz needed substitution colors: tritone-sub ii-V-I, backdoor ii-V, Tadd Dameron turn, jazz blues.
- Country needed train-beat and secondary-dominant options.
- Afrobeat needed an `I-IV` vamp option instead of over-resolving everything through `I-IV-V`.
- Palette labels were not guarded; a new progression could silently surface as a raw token.

### Sound / Backing

- `MIX_RECIPES` only covers country, metal, and jazz; many genres have correct cells but still share the house mix.
- Acoustic kits are one shared curated bank; rock/soft/jazz differ mainly by level/EQ, not by true brush/metal/Latin/percussion curation.
- Public clean/drive cab realism is weaker than local dogfood because only the V30 4x12 IR is committed.
- `FEEL_TIMING` covers only selected profiles. Latin/afrobeat/funk/soul/disco need explicit feel decisions.
- Live voice swaps are token-guarded, but durability coverage is thin; rapid band-strip and Mixer swaps need a probe/smoke row.

## Decisions

- Jam remains a mirror, not a judge. No score, rank, combo, leaderboard, cleared state, live early/late feedback, or loop-count reward.
- Keep contained playback. Do not call `window.playSong()` and do not revive `/temp-sloppak` for Jam.
- Treat loop wrap as the musical change boundary for setup changes.
- Use host/note_detect detection as a consumed signal only. No local chord/key/tempo-follow DSP.
- The best-in-class wedge is not just more styles. It is drill-to-Jam application plus a band/mirror that teaches target choice while staying out of the player's way.

## Action Plan

### Now: low-risk polish and guardrails

- Hide loop-count accumulation in Jam while keeping loop position and chord-loop overview.
- Always show a descriptive Jam recap, even with no detected notes; include style, key, progression, duration, and selected intent.
- Broaden low-risk Jam progression options using existing engine tokens and add label guardrails.
- Add a Jam live-change probe for rapid band-strip/Mixer swaps, then promote a durable row into `smoke-renderers.mjs` if stable.
- Make the Jam fretboard map harder to miss: auto-enable on first Jam or surface a clear `Map off` affordance in the primary path.

### Next: make the mirror teach target choice

- Add descriptive Jam analysis from existing pitch stream plus `chart.timeline`: chord-tone hits, guide-tone landings, distinct target colors, root restarts, and bass root-on-one / approach behavior. Keep wording descriptive, never graded.
- Add bass-specific highlight modes: root, next root, approach, register band. Keep chord/guide/scale/off for guitar.
- Refine `JAM_INTENTS` by instrument and style. Bass and guitar should get different verbs and roles.
- Replace Spotlight band-turn scale runs with sparse call phrases drawn from motif/style vocabulary.
- Add beats-to-wrap to the pending-change chip.

### Next: audible genre separation

- Expand `MIX_RECIPES` for high-traffic Jam genres first: blues, funk, reggae, disco, pop, soul, synthwave.
- Add per-genre space/saturation decisions without touching the master limiter.
- Expand `FEEL_TIMING` for styles where pocket is load-bearing.
- Curate real kit variants: jazz brushes, metal kick/snare/cymbals, Latin/percussion.

### Later: higher ceiling

- Add section-arc FSM over Jam passes: intro/groove/lift/breakdown with genre-specific fills and dropouts.
- Add opt-in level-driven energy with hysteresis only after manual energy and section arcs are proven.
- Add a pitch-stream phrase memo only as an explicit player action. Avoid raw audio capture unless host/note_detect exposes a safe surface.
- Keep native/VST/NAM realizer work additive through the chart/musician model; do not duplicate Virtuoso's band engine.

## This Session Started

Implemented the first `Now` slice:

- Jam loop-count accumulation is suppressed in Jam.
- Jam recap now appears even without detected pitch and includes progression/intent context.
- Jam palette options expanded for blues, jazz, country, soul, and afrobeat using existing/new progression tokens.
- `JAM_PROG_LABELS` now has a startup guard so every exposed Jam progression gets a musician-readable label.

## Verification Expected

Minimum for any runtime change:

1. `node --check screen.js`
2. `npm run smoke:gen` from `.claude/skills/run-virtuoso` with host running
3. `npm run smoke:backing`
4. `npm run smoke:renderers`
5. Full `npm test` before commit/push or promotion

Manual dogfood still matters: smoke proves charts are valid and deterministic, not that reggae, disco, or metal sound unmistakable.
