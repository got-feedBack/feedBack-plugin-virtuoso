# Practice Pedagogy and Automation Map

This document grounds Virtuoso's feature design in established guitar pedagogy. It exists so that as Virtuoso grows, every new generator/exercise has an explicit pedagogical reason to exist, and the practice-routine UX maps cleanly onto how serious players actually train.

It is also a teaching reference — beginners reading Virtuoso's docs should be able to understand *why* the plugin generates what it generates.

## Principles of effective practice

Five principles, drawn from established music pedagogy, motor-learning research (deliberate practice methodology), and adjacent sports-psychology literature.

### 1. Deliberate practice, not noodling
Noodling reinforces what you already do. Deliberate practice has four traits:
- **A specific, narrow goal** for the next 5–15 minutes
- **Full attention** — no autopilot
- **Immediate feedback** — metronome, recording, scoring, or ear
- **At the edge of current ability** — fast enough to fail, slow enough to succeed most reps

The single biggest predictor of guitarist progress is *time spent in deliberate practice*, not *time spent with the instrument*.

### 2. Slow practice with a metronome ladder
- Start 30–50% below target tempo
- Play the figure cleanly for N reps (typically 3–5)
- Step up 4–6 BPM, repeat
- Once you exceed target BPM by ~10%, drop back to target — it now feels easy

This works because motor patterns are built from clean repetitions. Speed practice with errors trains errors.

### 3. Chunking
Break difficult phrases into 2–4 note chunks. Master each chunk slowly, then connect them. **Backward chaining** — start with the last chunk, add the previous chunk before it — is especially effective for runs and sweep arpeggios because it inverts the usual "I lose it near the end" failure mode.

### 4. Spaced repetition over all 12 keys
Most amateurs build a deep groove in E/A/D minor and never leave. Cycling exercises through all 12 keys — chromatic or by circle of fourths — forces unfamiliar fingerings and reveals weak positions. Even 1 bar per key in a 12-bar exercise is more honest practice than 12 bars in your favorite key.

### 5. Application > pure technique
Above a basic threshold, soloing over backing tracks, recording yourself, and playing songs cement skills faster than another lap of scales. A useful target ratio is roughly **40% technique drill, 60% musical application**.

## Skill progression and what to drill

### Beginner (0–12 months)

| Skill | Why | Automatable in Virtuoso |
|-------|-----|--------------------------|
| 1-2-3-4 chromatic across all strings | Picking + finger-independence baseline | **Yes** — needs a chromatic-warmup generator |
| Minor pentatonic box 1 (E shape) | Universal soloing vocabulary | **Yes — exists** (scale + pentatonic minor) |
| Minor pentatonic in all 5 boxes | Fretboard literacy | **Yes** — needs CAGED-aware scale paths (in flight) |
| Open chord transitions (C/G/Am/F/Em/D) | Rhythm foundation | Not the Virtuoso focus — FeedBack handles songs |
| Major scale single-octave in C | Theory anchor | **Yes — exists** (scale + major) |
| Bending to pitch (whole step, half step) | Expression | **Yes** — needs bending-drill generator |
| Sustain and vibrato | Tone | Hard to grade without mic input |

**Recommended beginner session (20 min):**
1. 3 min — 1-2-3-4 chromatic at comfortable BPM
2. 5 min — minor pentatonic box 1 in A, ascending/descending
3. 5 min — same pattern, cycle through 4 keys (A, E, D, G)
4. 5 min — bend-to-pitch drill on the b3 of the pentatonic (5th fret G string → bend to A)
5. 2 min — improv in A minor pentatonic over a slow backing

### Intermediate (1–3 years)

| Skill | Why | Automatable in Virtuoso |
|-------|-----|--------------------------|
| Major scale in 5 CAGED positions | Fretboard literacy across the neck | **Yes** — CAGED generator (next build step) |
| 3-notes-per-string major scale | Picking velocity + position shifting | **Yes** — 3NPS generator (planned) |
| Sequence patterns (1234, 1-3-5, etc.) | Adds melodic variety to scales | **Yes** — sequence-pattern post-processor |
| Diatonic triad arpeggios in inversions | Chord-tone soloing | **Yes — exists** (diatonic_arpeggios) |
| Seventh-chord arpeggios | Jazz/fusion vocabulary | **Yes — exists** (chord depth: seventh) |
| Modes of the major scale | Modal harmony | **Yes — exists** (Dorian, Phrygian, etc.) |
| Alternate picking endurance | Right-hand stamina | **Yes** — picking-metadata generator |
| String-skipping | Wider intervals, breaks linear habit | **Yes** — string-set restrictions (planned) |
| Hybrid picking basics | Country/fusion sound | Hard to automate notation; mark in techniques |

**Recommended intermediate session (45 min):**
1. 5 min — chromatic warmup with picking pattern variation (1234, 1324, 4321)
2. 10 min — C major scale through all 5 CAGED positions
3. 10 min — sequence pattern (1-2-3-1, 2-3-4-2…) applied to a chosen position
4. 10 min — diatonic triads through I-IV-V-I in 4 keys
5. 10 min — improv over a I-vi-IV-V backing using the day's scale

### Advanced (3+ years)

| Skill | Why | Automatable in Virtuoso |
|-------|-----|--------------------------|
| Sweep arpeggios (3-, 5-, 6-string) | Speed arpeggio vocabulary | **Yes** — pre-baked CAGED-anchored sweep templates |
| Economy picking | Efficient runs across strings | **Yes** — picking metadata: economy |
| Tapped extensions | One/two-hand tapping | Partially — needs `.tp` flag in notes |
| Guide tones (3rds + 7ths) | Jazz voice leading | **Yes** — guide-tone generator over progression |
| Bebop scale connecting tones | Bop vocabulary | **Yes** — bebop-scale variants |
| Chromatic enclosures | Approach-note vocabulary | **Yes** — enclosure pattern around target |
| Pedal point sequences | Tension/release | **Yes** — pedal-point post-processor |
| Modal interchange / borrowed chords | Sophisticated harmony | **Yes** — extend progression library |
| Outside playing (tritone subs) | Modern jazz/fusion | **Yes** — substitution-aware chord override |

**Recommended advanced session (60–90 min):**
1. 5 min — high-BPM chromatic with economy picking
2. 15 min — sweep arpeggio shape of the day, all 12 keys (BPM ladder)
3. 15 min — ii-V-I in all 12 keys (circle of fourths), guide tones first, then full arpeggios
4. 10 min — modal lines (e.g., Dorian over ii, altered over V)
5. 10 min — bebop scale connecting tones through Rhythm Changes A-section
6. 15 min — improv over a jazz standard backing
7. 10 min — repertoire or composition

## Established practice methods worth automating

### Sweep-picking methodology
Single-direction picking across strings (down-down-down ascending, up-up-up descending). Each arpeggio shape is anchored to a CAGED-derived chord voicing. The plugin can ship 8–12 named sweep templates per chord quality.

### Segmented practice routine
Practice in **30-minute blocks** with a defined focus per block (technique / theory / ear / sight-reading / improv / composition). Even at 1–2 hours, the *segmented* approach beats freeform jamming. Maps directly onto a "Practice Session" feature: a session = ordered list of exercises with durations.

### Two-hand synchronization
Slow practice of scale figures while *consciously* aligning right-hand pick stroke with left-hand fret. Most "sloppy" fast playing is desynchronized hands, not finger weakness. Virtuoso can encode sync drills as low-BPM scale patterns with `ac` (accent) on every pick attack.

### Jazz pedagogy: guide tones first
Before improvising over a progression, play *only the 3rds and 7ths* through the changes (one note per chord). Then add 9ths and 13ths. Then full lines. This builds chord-tone awareness without the noise of full arpeggios. Direct generator feature.

### Bebop scale / passing-tone methodology
The bebop scales add one chromatic passing tone to a 7-note scale so 8-note lines land chord tones on downbeats. The major-bebop scale is `1 2 3 4 5 b6 6 7`. Generator: extend the scale interval table; lines automatically align chord tones to downbeats.

### Circle of fourths key cycling
Jazz tradition: cycle exercises through `C → F → Bb → Eb → Ab → Db → Gb → B → E → A → D → G → C`. This order hits the hardest fingerings (flat keys) before the easy ones. Generator wrapper: regenerate the same exercise in N keys, concatenate, mark each as its own section.

### Loop-and-ramp repeater (BPM ladder)
Loop the figure at 60% tempo, auto-bump 5 BPM each clean pass, until target. Virtuoso can render this statically as a chart whose tempo *steps up* over time, marked by section headers. (FeedBack's scoring would enable the true "pass to advance" version later.)

### Fade-the-notes pattern (memorization)
A fade-the-notes mastery pattern removes visual notes as you master a section. Virtuoso equivalent: generate the same routine N times, removing visual notes from each successive section while keeping the click. Trains internalization.

## How this maps onto Virtuoso's generator

### Existing primitives (already shipped)
- Scale generator (9 scales, 12 keys, configurable position)
- Diatonic arpeggio generator (triad or seventh)
- Progression arpeggio generator (18+ progressions)
- Direction / repeat-count
- Meter and subdivision control
- CAGED shape selector (selector exists; fret logic pending)

### High-impact additions (proposed)

| Feature | Type | Pedagogical anchor | Approx complexity |
|---------|------|-------------------|------------------|
| **Sequence patterns** | Post-processor over scale path | Adds melodic variation; intermediate staple | Low — pure array transform |
| **Chromatic warmup generator** | New exercise type | Universal warmup; every method teaches it | Low — no scale logic needed |
| **Key cycling wrapper** | Generator wrapper | Forces 12-key fluency | Medium — loop + concat |
| **Practice Sessions** | New top-level structure | Segmented practice methodology | Medium — needs data model + UI |
| **BPM ladder** | Per-session-segment modifier | Slow-practice principle | Medium — beat-generation change |
| **Sweep templates** | Pre-baked shape library | Sweep-picking methodology | Medium — hand-authored table |
| **Guide tone mode** | Progression mode variant | Jazz pedagogy | Medium — voice-leading logic |
| **CAGED position-aware paths** | Replaces fallback in `scalePositionsForSystem` | CAGED literacy | Medium — needs offset tables |
| **Bending drill generator** | New exercise type | Beginner essential | Low — fixed note pattern + `bn` field |
| **Bebop scale variants** | Add to SCALE_INTERVALS | Bebop pedagogy | Trivial — data only |
| **Chromatic enclosure** | Post-processor on chord-tone target | Approach-note vocabulary | Low |
| **Fade-the-notes pass** | Visual-only post-pass | Memorization | Low — manipulates `notes[]` |

### Sequence pattern reference

Common sequence patterns to ship, applied to any scale path `[p0, p1, p2, p3, p4, p5, p6, p7]`:

| Name | Pattern indices | Use |
|------|----------------|-----|
| Fours ascending | `0123, 1234, 2345, 3456…` | Universal scale drill |
| Fours descending | `3210, 4321, 5432…` | Reverse facility |
| Triplets ascending | `012, 123, 234…` | 3/4 or eighth-triplet feel |
| 1-3 thirds | `02, 13, 24, 35…` | Diatonic 3rds |
| 1-3-5 broken triads | `024, 135, 246…` | Chord-tone awareness |
| Pedal high | `n,0, n,1, n,2…` | Pedal-point with high pedal |
| Pedal low | `0,n, 1,n, 2,n…` | Pedal-point with low pedal |
| Yngwie 6s | `0123210, 1234321…` | Neoclassical descending six |

### Sweep template reference (to be hand-authored)

| Shape name | Strings | Anchor | Shape data needed |
|------------|---------|--------|-------------------|
| Major 3-string (top) | 3 high | CAGED E or D shape | Root, 3, 5 across 3 strings |
| Minor 3-string (top) | 3 high | CAGED E or D shape | Root, b3, 5 |
| Major 5-string | 5 mid | CAGED A shape | Root, 3, 5, root, 3 |
| Minor 5-string | 5 mid | CAGED A shape | Root, b3, 5, root, b3 |
| Dom7 5-string | 5 mid | CAGED A shape | Root, 3, 5, b7, root |
| Diminished 7 | 4 strings | Symmetric, repeats every 3 frets | 1, b3, b5, bb7 |
| Major 6-string | All 6 | CAGED E shape | Full inversion sweep |
| Tap-extended major | 3 high + tap | CAGED E | Sweep + tapped octave |

### Practice Session data shape (proposed)

```json
{
  "version": 1,
  "name": "Daily 30-minute intermediate",
  "totalDuration": 1800,
  "segments": [
    {
      "id": "warmup",
      "name": "Chromatic warmup",
      "kind": "chromatic_warmup",
      "duration": 180,
      "config": { "pattern": "1234", "bpmStart": 80, "bpmEnd": 100, "bpmStep": 5 }
    },
    {
      "id": "scale-caged",
      "name": "C major across CAGED",
      "kind": "scale",
      "duration": 600,
      "config": { "key": "C", "scale": "major", "fretboardSystem": "caged", "cycleShapes": ["C","A","G","E","D"] }
    },
    {
      "id": "sequence",
      "name": "Fours through G major",
      "kind": "scale",
      "duration": 300,
      "config": { "key": "G", "scale": "major", "sequence": "fours_asc" }
    },
    {
      "id": "ii-V-I",
      "name": "ii-V-I in 12 keys",
      "kind": "progression_arpeggios",
      "duration": 600,
      "config": { "progression": "ii-V-I", "chordDepth": "seventh", "keyCycle": "circle_of_fourths" }
    },
    {
      "id": "improv",
      "name": "Free improv over backing",
      "kind": "improv",
      "duration": 120,
      "config": { "key": "C", "scale": "major", "progression": "I-V-vi-IV" }
    }
  ]
}
```

Each segment generates its own chart fragment. The session is concatenated into one temp Sloppak with section markers per segment so FeedBack's section navigation shows the structure.

## Recommended build order

The following build sequence delivers user-visible value in each pass and avoids large rewrites:

1. **Sequence patterns** (post-processor over scale paths) — finishes the original build-order step 7; unlocks `fours_asc`, `thirds`, `triplets` immediately on every existing scale exercise.
2. **Chromatic warmup generator** — new `practiceType: "chromatic"` with a small pattern library (1234, 1324, 1243, 4321, spider). Beginners need this; advanced players use it daily.
3. **Key cycling wrapper** — `keyCycle` option (`circle_of_fourths` / `circle_of_fifths` / `chromatic` / `random`) on any existing generator. Massive practice-quality multiplier for one bounded feature.
4. **CAGED position-aware scale paths** — uses the existing C/A/G/E/D selector to actually constrain frets. Unlocks the original step 4 of the build order.
5. **Practice Sessions** — the framework. Once we have it, all individual exercises become composable into Steve-Vai-style segmented routines.
6. **BPM ladder** (within a session segment) — slow-practice principle, depends on Sessions existing.
7. **Sweep templates** — pre-baked shape library; pedagogically dense but needs hand-authored data.
8. **Guide-tone mode** — jazz vocabulary; depends on voice-leading helper.
9. **Bending drill, bebop scales, enclosures, pedal points** — smaller additions, sprinkle in after the framework is solid.

## Notes on what NOT to automate

- **Vibrato quality** — needs mic input + pitch-tracking, belongs to FeedBack's scoring layer, not the chart generator.
- **Tone / amp setup** — out of scope; FeedBack Desktop handles tone.
- **Rhythm strumming patterns** — FeedBack owns rhythm tracks; Virtuoso is single-note-line focused.
- **Sight-reading from staff notation** — different rendering, different problem.
- **Ear training** — different UX entirely; consider as a future sibling plugin (`SlopEar`?), not inside Virtuoso.

## References (study material, not citations)

- Anders Ericsson — *Peak: Secrets from the New Science of Expertise* (deliberate practice framework)
- Sweep / economy picking methodology (segmented practice approach)
- Two-hand synchronization and BPM-ladder methodology
- Picking mechanics across genres
- Jazz pedagogy — guide-tone-first chord-tone soloing
- Segmented practice block routines
- Jazz improvisation guide (segmented practice, key cycling)
- Mick Goodrick — *The Advancing Guitarist* (fretboard literacy across CAGED)
- Pat Martino — linear / parental form pedagogy (one shape, all chords)
