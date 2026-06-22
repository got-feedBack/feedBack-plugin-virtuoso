# Virtuoso — how the backing band is generated (shareable explainer)

*A dev-team-facing walkthrough of Virtuoso's procedural backing engine, written so the Jam-Session-mode effort can compare against it and we can avoid double-building. Christian / Virtuoso, 2026-06-14.*

## TL;DR
Virtuoso turns **a style + key + chord progression** into **a sounding, idiomatic backing band** — fully **procedural** (no loops/stems), **deterministic** (seeded → byte-identical output), **note-addressable** (the output is a list of timed note events, not opaque audio), and rendered **in the browser** with Web Audio. The current model is **player-follows-band** (you play *over* a steady, correct band to apply vocabulary). 29 styles today.

The portable artifact is **the chart** (a plain JSON object of timed events). Everything downstream — the renderer, the grader, the fretboard mirror, the highlight — consumes that chart. **If the two efforts share one thing, it should be the chart + the "musician" model below; that's the handoff that avoids two band engines.**

---

## 1. The pipeline: a style → a sounding band

It's a layered set of data tables + pure functions. A style "declares" its band; the band is assembled from swappable per-instrument cells.

```
STYLE_PALETTES[style]          → harmony (progressions[], lead scales, chord depth),
                                  feel (swing/backing-style), and an audioProfile id
        │
ARRANGEMENT_RECIPES[style:feel:densityTier]
                                → which CELL each instrument plays at this density tier
                                  (sparse / groove / full) — the "who plays what"
        │
   ┌────┼─────────────┬───────────────┐
COMP_GROOVES    BASS_FIGURES     DRUM_GROOVES        ← the swappable per-instrument cells
(rhythm gtr/keys) (bassline)     (pitch-less kit step-strings: kick/snare/hat/…)
        │
AUDIO_PROFILES[style]          → per-ROLE voice + amp (e.g. jazz: epiano comp + upright
                                  bass + brushed kit; metal: DI-through-Metal-amp chug +
                                  driven bass + galloping kick)
        │
buildBackingEvents() + buildDrumEvents()
                                → THE CHART: a flat list of timed events, each tagged
                                  with a role ('harmony'|'pad'|'bass'|'drums'), midis,
                                  start/end, velocity, articulation. Plus a chord
                                  TIMELINE (roman-numeral + function tags per slot).
```

Key properties:
- **A cell is genre-portable data** — a comp groove or bass figure is a small pattern object; swapping which cell an instrument plays is a one-pointer change. (This is what makes "swap the drummer" cheap — see §4.)
- **Density tiers** (sparse/groove/full) are a built-in arrangement mask — the same hook a section-arc / "energy" control rides.
- **Everything is a pure function of `cfg`** (style+key+progression+feel+seed). No DOM, no host calls in the generation path — it's an extractable engine.

## 2. Rendering: events → sound (Web Audio)

The chart's events are scheduled onto **per-instrument buses** → a master limiter:

- **Buses:** Rhythm (comp gtr) · Keys (pad/piano) · Bass · Drums · Click · Master — each its own gain/pan/meter, mixable live.
- **Voices:**
  - **WebAudioFont** GM samples for most instruments (the host bundles the soundfont).
  - A **CC0 sampled DI electric guitar** (Karoryfer Shinyguitar subset) with **round-robin + velocity layers + double-tracking** for the lead/comp guitar — producer-grade rendering, not GM.
  - An **in-house amp chain**: pre-HP → WaveShaper drive → post-EQ → **convolver cab IR** → makeup/limiter. Per-amp cab IRs (a real V30 4×12 ships; clean/OD are procedural or user-uploaded).
  - The host's **NAM worklet** is borrowable for the drive stage (cab IR carries ~80% of the tone, so NAM is an optional upgrade, not the backbone).
- **Scheduler:** a **rolling-window** scheduler queues ~10s chunks ahead on the AudioContext clock → **gapless loops** and **in-place chart hot-swap** (change the band mid-jam with no stop/rebuild).

## 3. The three things that make it work — and are the moat

1. **Determinism.** Same `cfg` (incl. the humanization seed) → **byte-identical chart**. Reproducible, testable, shareable.
2. **In-engine humanization.** Micro-timing lean (per-genre + per-voice), continuous metric velocity, round-robin sample/detune variation, per-hit articulation envelopes — **all applied at schedule time, in our engine.** This is the key point for the VSTi discussion: **VSTis don't humanize themselves** — you feed them already-humanized MIDI. So humanization lives in the *generator* regardless of which realizer makes the final sound.
3. **Note-addressability.** The output is a **list of addressable notes**, so the grader, the fretboard mirror ("here's what you just played"), and the play-the-changes highlight can all *target individual notes*. An opaque audio loop or a black-box AI render can't be targeted — which is exactly why we stay procedural. (A loop is a jukebox to play *over*; a note-addressable chart is a band you can play *into* and be taught by.)

## 4. "Musicians as params" + the realizer-agnostic RIG seam (the integration point)

This is where the two efforts should meet. Model a band member as a **param object**:

```
Musician = {
  role:        'drums' | 'bass' | 'comp' | 'keys' | 'lead',
  instrument:  voice/sample/GM id,
  rig:         { … },        // ← REALIZER-AGNOSTIC (see below)
  temperament: { microTiming, velocityCurve, ghostDensity, push/pull, fillStyle, … },
  cell:        which COMP/BASS/DRUM groove it plays
}
```

- Swapping a member = swap its `instrument` + `cell` + `temperament`. The black-metal-drummer-onto-EDM idea = bind any musician to any slot (cheap; coherence is a content rule, not an engine limit).
- **The `rig` field is realizer-agnostic — and that's where bundled VSTs plug in:**
  - **on web (Virtuoso plugin):** `rig` = our sample + WaveShaper + cab-IR chain.
  - **on a native host/app:** `rig` could be a **NAM rig** *or a VSTi* (8ridgelite, jdrummer, …). **Same musician object, different realizer.**
- So: **bundling 8ridgelite/jdrummer is the native realizer this seam was built to accept.** It doesn't change Virtuoso's web engine (no VST hosting in a browser), but a native app driving the *same chart + musician model* through VSTs is a clean upgrade path. (License check: JUCE-based open VSTs are often GPL-3 — bundling/forking binaries has copyleft + per-platform implications the host should weigh.)

## 5. Don't double-build — the proposed division of labor
- **Virtuoso owns:** the **band ENGINE** (the tables + builders above), the **chart** (the portable artifact), the **curriculum wiring** (drill → apply → jam), the **note-addressable grader/mirror**, and the **29-style content**. This is the part that's hard, done, and the host will never ship.
- **A native Jam-Session app / the host owns:** the **native realizer** (VSTs/NAM), the **multiplayer transport** (a `multiplayer` plugin already ships on the host — synced rooms + clock-sync + quantized peer audio), and any **reactive detection** (band-follows-player).
- **The handoff = the chart + the Musician model.** If the native app generates its *own* band, we've built the engine twice. If it consumes our chart and renders it through VSTs, we each do our half once.

## 6. Reactive "band follows player" — feasibility note
Our model is player-follows-band (a steady, correct target you apply over). The dev team's band-follows-player is a different job. From our detection lane: the detector is a **target-matcher** (no "what did the player just play" emit), so **key-follow is feasible coarsely** (off a mono pitch stream), **chord-follow needs a new detector read-out**, and **tempo-follow/beat-tracking is research-grade**. Recommendation if reactive is pursued: **"detect-and-SET" (lock key/tempo once, then a rock-steady band), never continuously chase** — chasing a human's timing destroys the steady reference and feels like a dragging bandmate. Frame it as a coaching *mirror*, not auto-accompaniment.

## 7. The trade-solos / Spotlight concept (just shipped)
A Jam **form** (not a new mode, no detection needed): the loop alternates turns — **you solo while the band supports**, then **the band solos while you comp behind it** (the fretboard auto-switches: scale on your turn, chord tones on your comp turn). It gives the "trading licks with the band" feeling and teaches the one skill you can't practice alone (comping behind a soloist) — and it stays a **mirror** (the rotation is shown, never scored).

---

*Deeper internal references (Virtuoso repo): `docs/backing-pipeline.md` (the full generation→humanization→DSP chain), `docs/genre-band-authoring-playbook.md` (how a genre's band is authored), `docs/jam-session-band-follows-player-roundtable.md` (the full panel synthesis behind §4–§6).*
