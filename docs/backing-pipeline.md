# Virtuoso Backing-Track Pipeline — Generation, Humanization & DSP

> Written to be shareable with the FeedBack host team: a review of how Virtuoso
> turns a chord progression into a sounding backing band, what "humanization"
> means at each stage, and the DSP chain it plays through. Function names refer
> to `screen.js` (§-banners; see `docs/code-map.md`). Accurate as of v0.7.23-dev.

## Design frame

Virtuoso is a practice/learning tool — the backing track is a *means* (a band
to lock against), never the deliverable. Two consequences shape the pipeline:

- **Determinism is a hard rule.** The same config produces a byte-identical
  chart on every regenerate (`chartRng(cfg)` — a mulberry32 stream seeded by
  `resolveHumanSeed(cfg)`). "Random" style choices reroll only when the user
  asks; a `humanSeed` reproduces or varies a roll. Practice requires the same
  exercise twice in a row.
- **Core/shell split.** Everything through chart generation is host- and
  DOM-independent (guarded by a smoke suite that traps `window`/`document`/
  `fetch` and runs every builder). Audio realization is the shell.

The pipeline is four stages: **harmonic plan → band realization → feel/
humanization → sound**.

## Stage 1 — Harmonic plan (the chart timeline)

- **Style → harmony tables.** `STYLE_PALETTES` is the one shared style table
  (progressions, lead scales, chord depth/quality, guide-tone flag, feel,
  `audioProfile`) that pathways, custom configs, and Jam all draw from. A
  startup integrity guard throws on a palette referencing a missing
  progression/scale/profile (same pattern as the no-unison guard).
- **Chord timeline.** `compileChordTimeline(cfg, duration)` expands the
  progression into `chart.timeline`: slot-sorted, contiguous chord events
  covering the chart, with sub-bar harmonic rhythm where the style wants it
  (e.g. 2 chords/bar). `applyTimelinePush` adds anticipation ("push") semantics
  — a chord can sound ahead of its barline, the way a real band leans in.
- **Voicing.** `voiceBackingChord` voices each chord with register discipline;
  `voiceLeadBackingChord` voice-leads chord-to-chord (smallest motion from the
  previous voicing), re-anchoring only at the top of the form and only when the
  comp has drifted — a human comper resets at the form top, never mid-form.
  When a real bass figure plays, the comp *lifts* its low root out of the bass
  register (the `lift` flag) instead of doubling it.
- **Per-block assembly.** Multi-block Workouts assemble every timed array
  (backing, drums, clicks) inside the per-block loop — each block gets its own
  tempo/key backing (the 2026-06-02 desync rule, guarded by a smoke suite).

## Stage 2 — Band realization (role lanes)

A chord event is realized into role-tagged `backingEvents` by three registries,
all sharing one grid schema (authored in 4/4, `div × 4 × bars` steps):

- **Comp — `COMP_GROOVES`.** A declared *cell* re-articulates the comp lane:
  each step says *what* of the voicing sounds (`chord`/`shell`/`root5`/
  `pedal`/`top` — shell = guide tones 3rd+7th+9) and *how* (`stab`/`chug`/
  `sus`/`ring` → per-hit length) with a velocity tier (`accent`/`normal`/
  `ghost`). Cells are genre-vetted before shipping (e.g. the Charleston accents
  the &-of-2 push, not beat 1; boogie stabs lean backbeat-side). A style with
  no vetted cell yet falls back to the **legacy coalesced pad** — consecutive
  identical chords merge into one sustained event so the pad doesn't pump.
- **Bass — `BASS_FIGURES`.** Pattern figures (ostinato, kick-locked) step the
  same grid; the **walking generator** builds real lines under rules locked
  with the bass-pedagogy lane: beat 1 = the root on every change, the last
  beat approaches the *next* chord's actual landing (chromatic ±1 weighted
  highest, then the dominant, then scalar), middle beats walk chord tones, no
  adjacent repeats, range-clamped to the instrument.
- **Drums — `DRUM_GROOVES`.** Style grooves + fills over a kit-piece
  vocabulary that mirrors the host's `lib/drums.py` PIECES names (snake_case,
  GM percussion notes where we overlap) so a drum event maps 1:1 onto the
  host's kit with no translation.

Lane suppression keeps the band honest: a strum-comp drill *is* the comp (no
backing harmony doubling the player), and when the player is the bassist the
bass figure mutes. Exactly one event per chord change carries the label/theory
payload (name, roman numeral, function) for the UI consumers.

## Stage 3 — Feel & humanization

What's **built**:

- **Swing post-process.** `applySwingToBundle`/`swingNotesBacking` displace
  the off-beat subdivisions after generation (shuffle/swing per the style's
  `feel`), so the same generator yields straight or swung output.
- **Anticipation.** `applyTimelinePush` (Stage 1) — chords pushed ahead of the
  barline where the idiom wants it.
- **Velocity tiers.** Every cell hit carries `vel` (accent 1.0 / normal 0.78 /
  ghost 0.45) into the scheduler — the difference between a groove and a grid.
- **Articulation-derived lengths.** Note length comes from the hit's
  articulation (a chug is ~22% of its step; sus holds to the next strike), not
  from bar length.
- **Inter-block breathing.** `interBlockBreakBars()` inserts a tempo-locked
  count-in break between Workout blocks; a gain envelope on the backing group
  fades the band out into the break and back in on the downbeat.
- **Count-in / loop tiling.** The count-in is baked lead-in rest bars
  (`applyCountIn`); loops wrap seamlessly via tail-note copies.

What's **designed, not yet built** (the next humanization tranche):

- **Per-hit envelope layer** on the sampler — `queueWaveTable` returns a
  GainNode envelope, so per-hit attack/hold/release (true muted chucks, skank
  gates, horn stabs) is AudioParam automation with zero extra nodes.
- **Round-robin micro-variation** — ±detune/±gain/±start-offset jitter per
  repeat to kill the machine-gun effect (params, not new samples).
- **Noise-transient "chk"** for muted comp attacks (reuses the drum-synth
  noise path).

## Stage 4 — Sound (the DSP chain)

**Instrument sourcing** is per-voice with an always-on fallback ladder:

- **Sampled voices — WebAudioFont.** The melodic backing (comp, bass, guide
  voice) plays GM multisample presets in the **WebAudioFont** format —
  JavaScript preset files converted from SF2 SoundFonts. We bundle the 14
  melodic programs we actually use plus the drum one-shots, all from the
  **FluidR3_GM** soundfont (MIT — provenance in `static/wafonts/README.md`;
  the previously-bundled JCLive variants were removed 2026-06-12 over
  unverifiable sound-data provenance), self-hosted under `static/wafonts/`
  and served by our own plugin route — no CDN, offline-safe. This mirrors how
  the host's piano/drums plugins make sound.
- **Synthesis fallbacks/voices.** Until a preset's async load lands (or if it
  fails), each voice independently falls back to a synthesized stand-in:
  additive-sine organ, a Rhodes-style e-piano, a filtered triangle+saw pad
  (`scheduleHarmonyPad`), plucked-string for bass/notes. Drums also have
  procedural 808/909 kits (zero-asset, the never-silent failover).
- **Planned distorted chain.** Metal/djent backing currently plays the pad
  placeholder. The designed chain: synth DI → gate → HPF tighten → WaveShaper
  (tanh) → cab-IR `ConvolverNode` → post-EQ → faked double-track (12–20 ms
  L/R, ±cents) — in-house and first-class, with the host `nam_tone` plugin's
  NAM WASM worklet as a feature-detected *upgrade* when a user has it
  installed plus a model (the borrow protocol is proven live; nam_tone is an
  external plugin now, so it can't be the default path).

**Bus architecture** (`ensureAudioBus`/`trackBus`):

```
voice → per-track gain (mixer fader)
      → register carve (comp/keys HPF 180 Hz; bass LPF 2.2 kHz)   [backing buses]
      → StereoPanner (mixer pan pot; defaults = stage offsets)
      → AnalyserNode tap (console meter, passive)
      → backing group (break fade envelope)  |  notes/click bypass straight to master
      → master gain (0.85 trim × master fader)
      → DynamicsCompressor safety limiter (−6 dB thresh, 6:1) → destination
```

- The **drum sub-bus** adds its own compressor (punch lives here, never in a
  looser master limiter) + a −3 dB high-shelf >8 kHz so hats stay out of the
  player's pick-attack band, and a small reverb send.
- One **shared zero-asset reverb** (generated noise-decay IR, ~0.9 s) glues
  the band; sends are post-carve, pre-pan.
- The **register carve** is mix policy: comp out of the bass's lane, both out
  of the player's note band — the player's own instrument always has space.
- Per-voice levels scale by 1/√(chord size) so dense comps don't sum hot.

**Scheduling** is a rolling window (not whole-pass): a 30-minute session
schedules a bounded number of nodes per window instead of tens of thousands up
front (measured: 39k nodes / 1.6 s main-thread block before; ~1.5–2.5k live
nodes after). The safety limiter makes sudden full-density peaks inaudible as
clipping — normalized, no-surprise output is a project constraint.

**The console mixer** (the `M` panel) exposes the buses: one vertical strip
per lane (Guide / Rhythm / Keys / Bass / Drums / Click) + Master, each with a
dB-taper fader, pan pot, mute/solo, per-bus instrument override, and live
post-fader peak meters (drawn only while the mixer is open). Comping cells
play on the Rhythm bus; the sustained pad layer plays on the Keys bus —
articulation-routed, so the future distorted riff has its own lane.

## Verification

Behavioural smoke suites (Playwright, all in `npm test`) own the system:
`smoke-backing-engine` (timeline validity per style, push semantics, seeded
determinism, per-block assembly, the scheduler node ceiling),
`smoke-session-sync` (multi-block phase lock), `smoke-generators` (every
practice type + session), plus startup guards that throw on load for invalid
cells/palettes/voicings (the no-unison rule).
