# Advanced Jazz Theory Reference

Distilled from established jazz theory pedagogy. Read this alongside
`theory-scales.md` and `theory-arpeggios.md` — those docs handle the
overlapping material; this one covers melodic minor modes, guide tones,
pentatonic superimposition, and advanced chord-scale applications.

---

## Why this is a cornerstone

Advanced jazz theory moves from basic chord construction through the full
altered-dominant vocabulary without ever leaving the practitioner's perspective.
Every concept is explained in terms of how to *use* it — which chord, which
scale, which starting point, what it sounds like to the listener.

For Virtuoso, the value is threefold:
1. A complete **scale-to-chord matching table** that handles every chord quality
   Virtuoso will ever generate an exercise for.
2. The **melodic minor mode vocabulary** — seven scales load-bearing in jazz.
3. A practical **pentatonic superimposition system** that turns five-note scales
   into an advanced improvisation tool.

---

## The melodic minor scale and its seven modes

Advanced jazz theory treats **melodic minor** (1 2 b3 4 5 6 7 — same as major with only a
b3) as the "second parent scale" alongside the major scale. Everything jazz
adds beyond basic diatonic harmony comes from melodic minor and its modes.

**Interval formula: `[0, 2, 3, 5, 7, 9, 11]`** — add to `SCALE_INTERVALS`.

### The seven modes of melodic minor

| Mode | Degree | Common name(s) | Formula vs. major | Semitone intervals |
|------|--------|---------------|-------------------|--------------------|
| I | 1 | Melodic minor / Jazz minor | b3 only | 0 2 3 5 7 9 11 |
| II | 2 | Dorian b2 / Phrygian ♮6 | b2, b3, b7 | 0 1 3 5 7 9 10 |
| III | 3 | Lydian augmented / Lydian #5 | #4, #5 | 0 2 4 6 8 9 11 |
| IV | 4 | Lydian dominant / Lydian b7 | #4, b7 | 0 2 4 6 7 9 10 |
| V | 5 | Mixolydian b6 / Hindu | b6, b7 | 0 2 4 5 7 8 10 |
| VI | 6 | Locrian ♮2 / Half-diminished | b3, b5, b6, b7 | 0 2 3 5 6 8 10 |
| VII | 7 | Altered / Super-Locrian / Diminished whole-tone | b2, b3, b4, b5, b6, b7 | 0 1 3 4 6 8 10 |

**Critical additions for `SCALE_INTERVALS`:**

```
dorian_b2:          [0, 1, 3, 5, 7, 9, 10]
lydian_augmented:   [0, 2, 4, 6, 8, 9, 11]
lydian_dominant:    [0, 2, 4, 6, 7, 9, 10]   ← already present
mixolydian_b6:      [0, 2, 4, 5, 7, 8, 10]
locrian_sharp2:     [0, 2, 3, 5, 6, 8, 10]
altered:            [0, 1, 3, 4, 6, 8, 10]
```

`lydian_dominant` is already in `SCALE_INTERVALS`. The others are not.
`altered` is what the existing `SCALE_INTERVALS` calls nothing — it was
referenced in theory-scales.md as "Diminished whole-tone" without an entry.

### How each melodic minor mode is used

**Mode I — Melodic minor:** Over minMaj7 chords (Cm/maj7). The tonic minor
chord that wants upward resolution. Rarely the home key; used as a passing
sound or in tune types like "Infant Eyes."

**Mode II — Dorian b2:** Over m7 chords with a half-step root motion above
(e.g., D-7 when the bass moves E→D). Sounds more dissonant than plain Dorian.
This mode rarely sounds good over a static m7 chord but works in
motion.

**Mode III — Lydian augmented:** Over maj7#5 chords (and occasionally maj7
chords for color). The augmented fifth replaces the perfect 5th, giving an
"ungrounded" floating quality. Herbie Hancock uses this extensively.

**Mode IV — Lydian dominant:** Over dominant 7th chords that resolve *down a
fifth to a major chord* (especially IV7 → I, "backdoor dominant"). The #4
avoids the avoid-note problem of Mixolydian's perfect 4th. Also used over any
dominant chord that doesn't want the tension of the altered scale — sweet spot
between Mixolydian and Altered. **This is one of the two most important jazz
scales.**

**Mode V — Mixolydian b6:** Over dominant chords resolving to minor (V7 → im).
Produces a Spanish/flamenco quality. Not common in mainstream jazz; shows up
in flamenco-inflected jazz and certain standards.

**Mode VI — Locrian ♮2 (sharp 2):** Over m7b5 (half-diminished) chords. The
standard Locrian has a b2 that clashes badly — Locrian ♮2 is the
correct choice for m7b5 in a minor II-V context. **Critical for minor ii-V-i.**

**Mode VII — Altered scale (Super-Locrian):** Over dominant 7th chords that
resolve up a fourth to any minor or major tonic. Contains every possible
alteration: b9, #9, #11 (=b5), b13 (=#5). Massive tension, must resolve.
**This is the other most important jazz scale — the "outside" sound on V7.**

---

## The complete scale-to-chord matrix

The most practical element of this approach. For each chord quality, which scale(s)
to use, in order of increasing tension (consonant → dissonant):

### Major tonic chords (Imaj7, IVmaj7)

| Scale | Notes vs. major | When to use |
|-------|----------------|-------------|
| Ionian | unchanged | Default; safe; slightly plain |
| Lydian | #4 | More color; the #4 "sings"; preferred by many jazz players over Ionian |
| Lydian augmented | #4, #5 | Over maj7#5 specifically; floating quality |

**Jazz pedagogy recommendation:** Lydian is usually better than Ionian over a major
chord because the natural 4th (=11th) of Ionian is an avoid note — it creates
a minor second clash with the major 3rd. Lydian's #4 avoids this problem.

### Minor tonic chords (i, im7, im/maj7)

| Scale | When to use |
|-------|-------------|
| Dorian | The default; bright minor; works over im7 in most contexts |
| Aeolian (natural minor) | Pure minor; darker than Dorian; over im7 |
| Phrygian | Darkest minor; over chords with b2 in bass; Spanish/flamenco |
| Melodic minor | Over im/maj7 specifically; also for "melodic minor feel" |
| Harmonic minor | Over im7 chords in classical or flamenco context |

**Dorian vs. Aeolian in jazz:** Most jazz musicians default to Dorian even
when the key signature is "minor" — the raised 6th of Dorian makes the scale
sound less "minor scale-y" and more improvisable. Aeolian is reserved for
specific minor tonic sounds where you want the b6.

### Dominant 7th chords (V7, all unresolved dom7)

This is the core of the approach. The standard 8-scale tree
applies, with context for each:

| Scale | Tension | Best when |
|-------|---------|-----------|
| Mixolydian | Low | Chord doesn't resolve soon; bluesy; avoid the 4th |
| Lydian dominant | Low-medium | Resolves to major; sweet dominant sound; #4 replaces avoid-4 |
| Bebop dominant | Medium | Any bebop context; chord tones on strong beats |
| Whole tone | Medium | Impressionistic; dominant 7+5 chords |
| Diminished (HW) | High | Chords with b9, #9, #11; Michael Brecker sound |
| Altered (mode VII mel. min.) | Very high | Resolves to major OR minor; maximum tension |
| Mixolydian b6 | Medium | Resolves to minor specifically |
| Lydian b7 (same as Lydian dominant) | Low-medium | IV7 → I ("backdoor") |

**Avoid note in Mixolydian:** The perfect 4th (=11th) clashes with the major
3rd of the chord. Do not land on the 4th on a strong beat over a dominant 7th
chord. This is why Lydian dominant (#4 instead of natural 4) is often preferred.

### Half-diminished / m7b5 chords (ii° in minor ii-V-i)

| Scale | Notes |
|-------|-------|
| Locrian | Standard; avoid the b2 on strong beats |
| Locrian ♮2 | Preferred choice — the ♮2 is the b9 of the following V7, so it creates forward motion |

### Diminished chords (dim7, fully diminished)

| Scale | Notes |
|-------|-------|
| Diminished (whole-half) | Symmetric; use over static dim7 chords |
| Diminished (half-whole) | Over dominant 7th with b9 (functionally a V7b9 in disguise) |

**Key insight:** A fully diminished 7th chord IS a dominant 7th b9 chord with
the root omitted. G7b9 = {G, B, D, F, Ab} → drop G = {B, D, F, Ab} = Bdim7.
This means a dim7 chord resolves the same way as the V7b9 a half-step below.

---

## The major and minor II-V-I progressions

Both versions receive equal treatment; consider practicing them in
all 12 keys the single highest-leverage jazz exercise.

### Major II-V-I

```
Dm7 → G7 → Cmaj7   (in C major)
ii-7    V7   Imaj7

Scale choices:
  Dm7:   Dorian
  G7:    Mixolydian (basic) or Lydian dominant or Altered
  Cmaj7: Ionian or Lydian
```

### Minor II-V-i

```
Dm7b5 → G7b9 → Cm(maj7)   (in C minor)
iim7b5   V7alt    im

Scale choices:
  Dm7b5:    Locrian ♮2 (preferred) or Locrian
  G7b9:     Diminished (HW) or Altered or Mixolydian b6
  Cm(maj7): Melodic minor or Harmonic minor or Dorian
```

**Critical difference from major II-V-I:** The V7 chord in minor wants a b9
(G7b9, not G7nat9). The altered scale and HW diminished both supply the b9.
This is why G7 sounds "wrong" (too bright) in a minor ii-V-i — it implies
natural 9, which expects to resolve to major.

**For `COMMON_PROGRESSIONS`:** Add `'minor_ii_V_i': [2, 5, 1, 1]` with a flag
that marks it as minor-key, so the generator knows to use m7b5 on degree ii
and altered/dim on degree V. The existing `minor_ii_V_i` entry uses the same
degree numerals but the chord qualities must differ.

---

## Guide tones — the jazz entry point

Guide tones are introduced as the first improvisation exercise for any
progression, before playing scales. The guide tones are the **3rd and 7th**
of each chord.

### Why 3rds and 7ths

The 3rd defines major vs. minor quality. The 7th defines stability (maj7 =
stable; b7 = wants to move; bb7/dim7 = maximum instability). Together they
carry the entire harmonic message of the chord. The root and 5th are "harmonic
overhead" — the ear infers them.

### Voice-leading movement of guide tones through II-V-I

In a major II-V-I (Dm7 → G7 → Cmaj7):

```
Voice A:  C (7th of Dm7) → B (3rd of G7) → B (7th of Cmaj7)  [down a half-step, then stays]
Voice B:  F (3rd of Dm7) → F (7th of G7) → E (3rd of Cmaj7)  [stays, then down a half-step]
```

The guide tones connect by half-step or common tone — maximum smoothness.
This is the core voice-leading logic of jazz. **Virtuoso's guide-tone
generator should produce exactly these two voices, alternating or together.**

### Guide tone exercise format

1. Play only the 3rd of each chord as it changes — one whole note per chord.
2. Then play only the 7th of each chord.
3. Then alternate: 3rd on chord 1, 7th on chord 2, 3rd on chord 3.
4. Finally: play both voices simultaneously (as a two-note chord).
5. Advanced: connect guide tones with scale passing tones between chord changes.

**For Virtuoso:** The guide tone generator produces `s` and `f` values for
the closest 3rd and 7th to the previous guide tone, moving by half-step or
common tone. The "staying close" constraint is the entire point — do NOT jump
to a chord tone an octave away when a half-step move is available.

---

## Pentatonic superimposition

Pentatonic superimposition is one of the most
widely-cited sections. The idea: instead of playing the "obvious" pentatonic
scale (minor pentatonic from the root), play a pentatonic scale rooted on a
*different* note. Each superimposition creates a specific combination of
tensions over the chord.

### The superimposition map

Over each chord type, these pentatonic scales produce the tensions listed:

**Over Cmaj7 (C E G B):**

| Pentatonic | Root | Notes produced over C | Tensions added |
|------------|------|----------------------|----------------|
| C major pentatonic | C | C D E G A | 9, 13 |
| G major pentatonic | G | G A B D E | 9, 13, 7 (=maj7) |
| D minor pentatonic | D | D F A C E | 9, 11, 13 |
| A minor pentatonic | A | A C E G B | 9, 13, maj7 — same as G major pent |
| E minor pentatonic | E | E G B D F# | 3, 5, maj7, 9, #11 — Lydian color |

**Over Cm7 (C Eb G Bb):**

| Pentatonic | Root | Tensions |
|------------|------|----------|
| Eb major pentatonic | Eb | Eb F G Bb C | b3, 4, 5, b7 — all chord tones |
| Bb major pentatonic | Bb | Bb C D F G | b7, 1, 9, 11, 5 |
| F major pentatonic | F | F G A C D | 11, 5, 13, 1, 9 — Dorian color |
| Ab major pentatonic | Ab | Ab Bb C Eb G | b6, b7, 1, b3, 5 — Aeolian color |

**Over G7 (G B D F):**

| Pentatonic | Root | Tensions |
|------------|------|----------|
| G minor pentatonic | G | G Bb C D F | b3 = #9, 4, 5, b7 — bluesy |
| Bb major pentatonic | Bb | Bb C D F G | #9, 11, 5, b7, 1 |
| F major pentatonic | F | F G A C D | b7, 1, 9, 11, 5 — Mixolydian color |
| Db major pentatonic | Db | Db Eb F Ab Bb | b5, b13, b7, #9 — altered/tritone sub |

The **Db major pentatonic over G7** is the "money" superimposition for the
altered dominant sound. Db is the tritone of G — the pentatonic from the
tritone substitution root gives the maximum outside-but-organized sound.

**For Virtuoso:** Add `practiceType: 'pent_superimposition'` as an advanced
generator. The generator takes a target chord type and produces a scale exercise
using a superimposed pentatonic with a configurable "tension level" (consonant
→ outside).

---

## Rhythm Changes

Rhythm Changes is the harmonic template derived from Gershwin's "I Got Rhythm."
After the II-V-I, this is the most commonly used jazz harmonic structure. Over
a thousand bebop heads are written over this form.

### A section (8 bars, repeats twice)

```
Key of Bb major:
|  Bbmaj7  G7  |  Cm7  F7  |  Fm7  Bb7  |  Ebmaj7  Ab7  |
|  Dm7  G7   |  Cm7  F7  |  Bb6  Gm7  |  Cm7     F7   |
```

Abbreviated as: I–VI–II–V  |  I–VI–II–V  |  IV–IV7–I–VI  |  II–V–I–V (turnaround)

More practically in jazz:
- Bar 1-2: Bbmaj7 — G7 — Cm7 — F7  (tonic → VI → ii → V)
- Bar 3-4: Fm7 — Bb7 — Ebmaj7 — Ab7  (temporary iv → IV7 → IV → bVII7)
- Bar 5-6: Dm7 — G7 — Cm7 — F7  (iii → VI → ii → V)
- Bar 7-8: Bb6 — G7 — Cm7 — F7  (tonic → turnaround)

### B section / Bridge (8 bars, one time)

```
|  D7  |  D7  |  G7  |  G7  |  C7  |  C7  |  F7  |  F7  |
  III7     III7   VI7    VI7   II7    II7    V7     V7
```

The bridge is all dominant 7th chords — no tonic resolutions. Each chord is
the V7 of the chord a fourth below. Scale of choice for each: Mixolydian, or
Bebop dominant, or cycle through the V7 scale tree. This is where the chromatic
bebop vocabulary fits perfectly because the chords are all the same quality.

**For `COMMON_PROGRESSIONS`:** Add `rhythm_changes_a` and `rhythm_changes_bridge`
as distinct progressions. The A section is complex enough that it needs the
full 8-chord sequence stored, not just 4 scale degrees.

---

## Coltrane Changes (Giant Steps)

Advanced — included here for completeness and for the "expert" pathway level.

John Coltrane's substitution system divides the octave into three equal parts
(major thirds: B → G → Eb → B). Giant Steps cycles through these three key
centers, each preceded by its own II-V:

```
Bmaj7 | D7  Gmaj7 | Bb7  Ebmaj7 | Am7  D7 |
Gmaj7 | Bb7 Ebmaj7 | F#7  Bmaj7 | Fm7  Bb7 |
```

**Why it's hard:** Traditional improvisation locks you into one key center.
Coltrane changes force a new key every two beats, at any reasonable tempo. The
scale vocabulary switches that fast.

**Virtuoso application:** A "Coltrane Changes" exercise generates arpeggio
exercises over the Giant Steps sequence. Each chord gets its own two-beat
exercise — chord tones only, no scale runs, until the player can outline the
changes. This is a pure arpeggio drill, not a scale drill.

---

## Tritone substitution

A dominant 7th chord can be replaced by the dominant 7th chord a tritone (6
semitones) away. G7 ↔ Db7. They share the same guide tones (B/Cb and F),
inverted.

```
G7: B (3rd) and F (7th)
Db7: F (3rd) and Cb/B (7th)
```

Because the guide tones are identical, the substitution creates smooth voice
leading. The bass moves by half-step instead of a fourth (G → C becomes Db → C).

**Scale implication:** The tritone sub dominant takes the same scale choices
as any other dominant. Db7 resolving to C takes: Db Lydian dominant, or Db
altered (which produces the same notes as G altered from a different root), etc.

**For Virtuoso:** When a pathway uses tritone subs, the `chordOverride` system
can insert the tritone substitution chord. A dedicated `trit_sub` flag on a
progression chord entry would tell the generator to replace V7 with bII7.

---

## Avoid notes

Jazz theory formalizes which scale tones to *not land on* on strong beats for each
chord type. This is distinct from "wrong notes" — avoid notes can be used as
chromatic passing tones but must not sit on a downbeat.

| Chord type | Avoid note | Why |
|------------|-----------|-----|
| maj7 (Ionian) | 4th (=11th) | Minor 2nd clash with major 3rd |
| dom7 (Mixolydian) | 4th (=11th) | Same minor 2nd problem |
| m7 (Dorian) | 6th on some charts | Some players hear the natural 6 as clashing |
| m7b5 (Locrian) | b2nd | Clashes with the root of the following chord |

**Solution:** Use Lydian (not Ionian) for maj7 chords — the #4 removes
the avoid note. Use Lydian dominant (not Mixolydian) for dom7 chords that don't
want the altered sound.

**For Virtuoso:** The scale generator, when targeting a maj7 or dom7 chord,
should default to Lydian / Lydian dominant rather than Ionian / Mixolydian
unless the user explicitly requests the basic mode. This matches what working
jazz musicians actually do.

---

## Modal jazz context

Modal jazz (Miles Davis's *Kind of Blue* era,
Coltrane's *My Favorite Things*, etc.). Modal tunes use one or two chords
sustained for many bars instead of rapid chord changes.

**Key differences from functional jazz:**
- No II-V-I movement; chords are *areas*, not functions
- Scale choice is determined by the chord's quality and the desired mood, not
  by the next chord
- Rhythmic variation and melodic development matter more than harmonic navigation
- The player builds tension through register, rhythm, and note choice — not
  through scale-choice tension/release

**Example: "So What" (D Dorian vamp)**
- 16 bars of Dm7 → 8 bars of Ebm7 → 8 bars of Dm7
- Over Dm7: Dorian. Over Ebm7: Eb Dorian. That's all.
- The interest comes from what you do *within* the Dorian scale, not from
  scale-switching

**For Virtuoso:** Add a `modalVamp` exercise type — one chord, one scale,
configurable duration, no progression changes. The challenge is purely melodic
development within a single scale area. This is also the simplest exercise
to generate (no progression logic at all) and excellent for beginners learning
their first mode in depth.

---

## The "outside" concept

"Playing outside" is treated not as random wrong notes but as controlled
superimposition. Three main approaches:

1. **Play "in" a different key center** — impose a different key over the
   current chord, then resolve back. The further the key, the more "outside."
   Resolution makes "outside" feel like tension, not mistake.

2. **Tritone displacement** — play the same lick but starting from the tritone.
   G7 lick played starting on Db. Instant outside.

3. **Chromatic approach** — enter a target note from a half-step above or below,
   spend one beat "outside," arrive on the chord tone on the next beat.

**For Virtuoso:** The "outside" vocabulary is Phase 3+ territory — it requires
the user to already have solid inside vocabulary. Flag pathways appropriately.
The chromatic approach is already partially handled by the enclosure pattern
concept in `practice-pedagogy.md`.

---

## Quartal harmony — the "So What" chord

McCoy Tyner's quartal voicing vocabulary. Instead of building
chords in thirds (C-E-G), build them in fourths (C-F-Bb-Eb).

The "So What" chord (named for the Miles Davis tune) is:
```
(low to high): A-D-G-C-E
```
Two stacked perfect fourths + a major third on top. This voicing can be moved
around the fretboard as a single block to cover multiple chord types.

**For Virtuoso:** Quartal voicings are a chord/comping exercise type, not a
single-note line exercise. Their application in Virtuoso is in the comping
generator (future Phase 3), not the current melody/arpeggio generators.

---

## Recommended practice sequence

This is the most directly actionable section for Virtuoso's session framework.
This learning order applies universally regardless of level:

### For any new progression or standard:

1. **Listen first.** Know the original recording before playing a note.
   (Virtuoso can't enforce this but can prompt it.)

2. **Shell voicings.** Play the 3rd and 7th of each chord as two-note voicings,
   one per bar. No melody. Just feel the changes with the minimum possible notes.

3. **Guide tones in single notes.** Play the 3rd of every chord (one note per
   chord change) as a melodic line. Repeat with just the 7ths. Then connect
   them.

4. **Chord scales.** Run the appropriate scale for each chord — not as a
   performance line, but as a drill to hear the scale against the chord.

5. **Arpeggios.** Outline the chord tones of each chord, one chord at a time.
   
6. **Connecting arpeggios.** Connect chord-tone arpeggios with scale passing
   tones between chords.

7. **Bebop lines.** Add chromatic bebop passing tones to the scale runs so
   chord tones land on downbeats.

8. **Melodic development.** Use the above vocabulary to actually improvise —
   but with intention: target a chord tone, use approach notes, resolve cleanly.

**This sequence IS the Virtuoso Practice Session template for a jazz pathway.**
Encode it directly: each step is a segment type, and a preset session "II-V-I
Workshop" chains them in this order at a fixed BPM.

---

## What this adds to Virtuoso

### New scale types to add to `SCALE_INTERVALS`

```js
dorian_b2:        [0, 1, 3, 5, 7, 9, 10],
lydian_augmented: [0, 2, 4, 6, 8, 9, 11],
mixolydian_b6:    [0, 2, 4, 5, 7, 8, 10],
locrian_sharp2:   [0, 2, 3, 5, 6, 8, 10],
altered:          [0, 1, 3, 4, 6, 8, 10],
// melodic_minor already in the list if fretboard-pedagogy was applied
```

### New progressions to add to `COMMON_PROGRESSIONS`

- `'minor_ii_V_i'` — already exists but needs a `minor: true` flag so
  generators know degree ii = m7b5 and degree V = dom7alt
- `'rhythm_changes_a'` — the full 8-chord A section (not reducible to 4 degree numbers)
- `'rhythm_changes_bridge'` — III7-VI7-II7-V7 (all dominant)
- `'giant_steps'` — the full Coltrane cycle (advanced)
- `'modal_vamp'` — single chord, configurable duration (degenerate case)

### New exercise types for `generate()` dispatch

| `practiceType` | Description |
|----------------|-------------|
| `guide_tones` | 3rds and/or 7ths of each chord in the standard 4-step sequence |
| `modal_vamp` | One chord, one scale, melodic development focus |
| `pent_superimposition` | Pentatonic from a non-root starting point over a chord type |
| `shell_voicings` | Two-note (3rd + 7th) comping exercise (Phase 3, chord focus) |

### Session structure implication

The 8-step jazz learning sequence maps directly onto a Practice Session template:

```json
{
  "name": "ii-V-I Workshop",
  "segments": [
    { "kind": "guide_tones",  "config": { "voices": "thirds_only" },        "duration": 120 },
    { "kind": "guide_tones",  "config": { "voices": "sevenths_only" },      "duration": 120 },
    { "kind": "guide_tones",  "config": { "voices": "both_alternating" },   "duration": 180 },
    { "kind": "chord_scales", "config": { "chordScaleStrategy": "mode_of_moment" }, "duration": 300 },
    { "kind": "diatonic_arpeggios", "config": { "chordDepth": "seventh" },  "duration": 300 },
    { "kind": "chord_scales", "config": { "scale": "bebop_dominant" },      "duration": 300 },
    { "kind": "scale",        "config": { "sequence": "fours" },             "duration": 300 }
  ]
}
```

This is a concrete, pedagogically sound session template that can ship as a
built-in preset. The structure follows established jazz pedagogy for learning
progressions.

### Default scale choice corrections

Virtuoso should update these defaults:
- **maj7 chords:** prefer Lydian over Ionian (avoids the avoid note on the 4th)
- **dom7 resolving to major:** prefer Lydian dominant over Mixolydian (same reason)
- **dom7 resolving to minor:** use Mixolydian b6 or Altered
- **m7b5 chords:** use Locrian ♮2 (not plain Locrian)
- **Static dom7 chords (modal/vamp):** Mixolydian is fine; avoid note is not
  as problematic without resolution pressure

---

## Notes for Phase 3

Chord voicings and comping patterns are not covered here. Consider a separate
reference doc for Phase 3 chord/comping generator work.
