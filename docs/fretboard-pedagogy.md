# Fretboard Pedagogy

This document is the authoritative reference for how Virtuoso should think about positions, shapes, scales, and arpeggios on the guitar. It exists because "position" was originally implemented as a fixed fret window (e.g. "5th position = frets 5–9"), which is **wrong** — a position is a root-note anchor that implies multiple valid scale shapes around it.

Every position/shape decision in Virtuoso should be traceable back to a principle in this doc. If it isn't, we're making it up.

Sources synthesized: the **CAGED system** (the canonical 5-shape major-scale fingering taught across nearly every modern method), the **3-notes-per-string (3NPS) system** (modern rock/fusion pedagogy), full-neck modal maps, chord vocabulary and string-group voicings, and jazz line-creation methodology.

---

## The two big ideas

### 1. A position is a root-note anchor, not a fret window

When a player says "C major in 5th position," they don't mean "any C major notes between frets 5 and 9." They mean **"my index finger is anchored around the 5th fret, and I'm fingering a specific shape of C major that sits around that root."**

The fret window FOLLOWS from the root anchor and the chosen shape. Two shapes with the same root anchor will occupy different fret windows.

This is the fix for Virtuoso's current bug: the Position dropdown drove `fretMin`/`fretMax` directly, treating position as a fret window. It should drive a *root-anchor + shape choice* instead, and the fret window emerges from those two.

### 2. Multiple shapes share each root anchor

For C major with the root on the **3rd fret of the 5th string** (a low C), the player has *at least three* canonical fingering choices:

| Shape | Fret window | Style |
| --- | --- | --- |
| **Open position fingering** | 0–3 | Mixes open strings with fretted notes. Good for folk/rock vocabulary. |
| **C-shape (CAGED)** | 2–5 | Hand sits across frets 2–5, root on 5th string fret 3. Anchored on the open-C chord shape moved into position. |
| **3NPS Position 1 (Ionian)** | 3–8 | Index at fret 3, spans up to fret 8 across all 6 strings. 18 notes total. Standard rock/fusion 3-notes-per-string fingering. |

These are all **C major in the same key** anchored on the **same root note** — but they imply different fret windows and different fingerings. Virtuoso should expose all three (or however many the chosen system defines).

This is what the user meant by: *"that note anchor on the 3rd fret of the A string should facilitate multiple scale shapes."* Exactly right.

### 3. No unisons — a pitch sounds on only one string in a pattern

Within any single scale/mode pattern (CAGED, 3NPS, Open) — and within any run that **combines** shapes or stitches an arpeggio onto a scale — **the same pitch (same note *and* same octave) must never be played twice on two different strings.** When two adjacent strings overlap in range, the same pitch is reachable on both; the pattern picks one and drops the other.

This is **not** "one root per pattern." The tonic legitimately appears 2–3 times in a box, in **different octaves** — those are distinct pitches and are all kept (the red tonic dots in the reference CAGED/3NPS diagrams confirm this). The rule only forbids true **unisons**: the *same* pitch doubled across strings. The tonic is the headline case because doubling it is the most jarring, but the rule applies to every scale tone.

**Why this was a bug:** a position rendered as a rectangular fret-window block grabs *every* scale note in `[fretMin..fretMax]` on *every* string, so the string-overlap zone produces unisons (e.g. A-major A-shape: B sits on the G string fret 4 *and* the B string fret 0). The fix is to build shapes degree-by-degree (3NPS already does this) and to drop a pitch already placed on a lower string. The lower string wins a shared pitch, keeping the box compact and ascending.

**Fingering methodology (the other half of "canonical"):** each scale shape and arpeggio shape encodes *which finger plays which note* (the CAGED diagrams label fingers 1–4; 3NPS diagrams label scale degrees 1–7). Encoding the per-string note + finger layout — rather than a fret window — is what makes a generated shape match the canonical box and what lets shapes interconnect cleanly (the 7‑3‑6‑2‑5‑1‑4 cycle, with the one‑fret nudge across the G–B string).

**Status (implemented 2026-05-29, pedagogy-validated):**
- **No-unison** enforced in the resolvers (`resolveCAGEDShape`/`resolveOpenShape` drop a pitch already placed on a lower string) and at the run/seam layer (`dedupeUnisons`, also covering arpeggio runs).
- **Nut-clamp octave shift:** a CAGED box whose root resolves so low that the shape clips the nut is bumped `+12` so it lands as a complete fretted box. CAGED boxes are fretted; open-string vocabulary belongs to the separate Open system.
- **Per-string fingering (`fg`)** is attached to every resolved scale-shape note: CAGED/Open via `scaleFingerFor` (one-finger-per-fret from the box anchor, clamped 1–4, with the −1 G→B nudge on the B/high-E strings); 3NPS via `threeNpsStringFingers` (per-string interval lookup: W-W=1-2-4, W-H=1-2-3, H-W=1-3-4). Modes/melodic-minor modes reuse the parent box's fingers (relabel only). The 6-fret-span CAGED boxes (C/E/etc.) clamp the top frets to the pinky — an accepted approximation of the position-shift those boxes really use.
- **Arpeggio shapes** derive from the canonical CAGED chord-tone templates (`chordTemplates`, which carry `fg`): `buildSweepArpeggioExercise` now builds each chord's sweep from `cagedShapeNotesForChord` (contiguous one-note-per-string, the standard CAGED arpeggio box) when a CAGED shape is active, falling back to a greedy-adjacent (contiguous) search otherwise. The HO/PO turnaround reach is capped at +3 frets (a +5 stretch is unplayable low on the neck).

---

## The fretboard systems

There are three systems Virtuoso will support. Each is internally consistent; mixing them in the same exercise tends to confuse beginners.

### System A — CAGED (the default)

**Premise:** The 5 open-position major chord shapes (C, A, G, E, D) can be barred and shifted up the neck to play any major chord. The scale that fits *around* each shifted chord shape becomes a 4–5-fret scale box.

**Shapes:** Five shapes named after the underlying open chord they derive from:

- **C-shape** — root on the 5th string, fingered with the open-C chord geometry shifted up the neck.
- **A-shape** — root on the 5th string, A-chord geometry (often barred).
- **G-shape** — root on the 6th string, G-chord geometry.
- **E-shape** — root on the 6th string, E-chord geometry (the classic barre chord).
- **D-shape** — root on the 4th string, D-chord geometry.

**Cyclic ordering on the neck:** The 5 shapes always appear in the cyclic order **C → A → G → E → D → C → …** as you ascend. The "first" shape in any given key (the one closest to the nut) depends on which chord shape is closest to open position for that key.

For example:
- In C major: order from low to high is C → A → G → E → D → C. The C-shape sits at the nut.
- In A major: A → G → E → D → C → A. The A-shape sits at the nut.
- In G major: G → E → D → C → A → G. The G-shape sits at the nut.

**Span:** Each shape spans roughly 4–5 frets. The five shapes tile the neck — there is no fret on the neck not covered by at least one CAGED shape, and adjacent shapes always share at least one fret of overlap.

**Why 5, not 7?** There are only 5 unique chord shapes available in open position (C, A, G, E, D). The "missing" two scale shapes are absorbed by adjacent ones because of the half-step intervals in the major scale (3→4 and 7→1) — adjacent positions collapse into one shape rather than two.

**Fingering note:** Real-world CAGED scale fingerings often mix 2-notes-per-string and 3-notes-per-string strings within the same shape, depending on which is more comfortable. Virtuoso will lean toward 3-NPS where possible for picking consistency, but won't force it if the result is an awkward stretch.

**Best for:** The default Virtuoso system. Players who want a tight, position-based scale vocabulary with chord-shape anchors. Maps cleanly to both rhythm/comping (the underlying chord) and lead (the scale around it). Chord-tone arpeggios extract cleanly from each shape.

### System B — Three Notes Per String (3NPS)

**Premise:** Every string gets exactly 3 notes. The 7-note major scale fits in 6 strings × 3 notes = 18 notes per shape. There are **7 distinct 3NPS shapes** — one starting on each scale degree on the low E string.

**Shapes:** Seven shapes, named by the mode each begins on (because each starts on a different scale degree of the parent scale):

1. **Position 1 (Ionian)** — starts on the root (1) on the low E string.
2. **Position 2 (Dorian)** — starts on the 2nd degree.
3. **Position 3 (Phrygian)** — starts on the 3rd degree.
4. **Position 4 (Lydian)** — starts on the 4th degree.
5. **Position 5 (Mixolydian)** — starts on the 5th degree.
6. **Position 6 (Aeolian)** — starts on the 6th degree.
7. **Position 7 (Locrian)** — starts on the 7th degree.

(These mode labels reflect the lowest note of the shape, not a re-tonicization — the scale is still the parent major scale. The labels just happen to be useful mnemonics because each position's lowest note matches the tonic of a mode.)

Unlike CAGED, 3NPS keeps all 7 shapes because the strict-3NPS constraint prevents the half-step collapse.

**Span:** Each 3NPS shape spans 5–6 frets. Shapes share considerable overlap with each other.

**Best for:** Speed players, alternate picking, modal soloing, rock/metal/fusion. The uniform fingering (3 notes per string, always) makes sequences (fours, sixes, thirds) much easier to pattern across strings. Same parent scale as CAGED — just a different way to organize the hand.

### System C — Open

**Premise:** Use open strings combined with fretted notes in the lowest few frets. This is *not* a movable system — it's key-specific. Some keys (C, G, D, A, E, F, Am, Em, Dm) have natural open-position fingerings; others (Eb, Ab, Bb, F#) don't and the option won't be useful.

**Shapes:** One per supported key. Virtuoso knows which keys have a sensible open-position fingering and offers it only there.

**Span:** Frets 0–3 (occasionally to fret 4 for stretches like F# on the D string in G major).

**Best for:** Folk, country, classic rock vocabulary. Beginners. Anything that benefits from the ringing/sustain character of open strings.

### Three systems — same scale, different framings

For any given key, all three systems describe the *same* notes on the *same* neck. They differ only in how the player's hand is asked to organize those notes. The user's choice between them is a fingering preference, not a music-theory difference.

**Implication for Virtuoso:** the fretboard-system selector is real and load-bearing. Picking CAGED vs 3NPS vs Open for the same key+scale produces different exercises with different fret windows and different fingerings.

### Full-neck modal map (not a 4th system)

The full-neck modal map approach shows each mode as a single full-neck diagram with every scale note labeled by scale degree (1, 2, 3, etc.). This is **not a competing position system** — it's a different *view* of the same fretboard. The position systems are partitions of this map.

Virtuoso should support both views:
- **Position view** — one shape highlighted at a time (CAGED / 3NPS / Open).
- **Full-neck view** — every scale note across the whole neck, labeled by degree. Useful for understanding before drilling.

---

## How arpeggios live inside shapes

An arpeggio is *the chord tones of a scale, restricted to one shape's fret window.* This is the same insight whether you're working in CAGED, 3NPS, or open position.

For the D-7 arpeggio (D, F, A, C) in C major, played inside the **G-shape CAGED scale position** (which sits around frets 2–5 in C major):

- 6th string: A at fret 5
- 5th string: C at fret 3, D at fret 5
- 4th string: F at fret 3
- 3rd string: A at fret 2, C at fret 5
- 2nd string: D at fret 3
- 1st string: A at fret 5

The same Dm7 arpeggio in the **E-shape position** (around frets 7–10 in C major) uses different notes — same chord tones, different octaves and string locations, fingered with the E-shape hand position.

**Implication for Virtuoso's arpeggio generator:**
- Take the chord tones (1, 3, 5, 7 — with quality modifiers like b3 for minor).
- Restrict to notes inside the chosen shape's note set.
- Render those notes in scale order, ascending then descending.

The current Virtuoso `chordTonePositionsInPosition` does something close to this but driven by a rectangular `fretMin`/`fretMax`. Once shapes anchor on a root, it should restrict to shape membership instead.

**Half-step arpeggio collapse:** Like scale shapes, some arpeggios in some shapes occupy *fewer* notes than others because the chord tones happen to be on the half-step edges. This is fine — the arpeggio is what it is. Don't force a minimum note count.

---

## How lines are built over chord progressions

This is the most important section for Virtuoso, because the current "Chord Tone Targeting" pathway gets this wrong.

### Diatonic progressions: parent scale + chord-tone emphasis

When all chords come from one key (a I-vi-ii-V or ii-V-I in C major: Cmaj7, A-7, D-7, G7), good pedagogy keeps the line **in the parent C major scale the whole time**. The shape stays put for several bars. The change as the chord moves is *which notes get emphasized as targets*, not *which scale is being used*.

A line over Cmaj7 → A-7 → D-7 → G7 in the G-shape position might use the same 18 notes of C major throughout, but land on:
- C, E, G, B (Cmaj7 chord tones) during the Cmaj7 bar
- A, C, E, G (A-7 chord tones) during the A-7 bar
- D, F, A, C (D-7 chord tones) during the D-7 bar
- G, B, D, F (G7 chord tones) during the G7 bar

This is the **chord-tone-targeting strategy**, and it's the right default for diatonic progressions.

### Mode-of-the-moment: only for non-diatonic / modal cycles

The "mode of the moment" approach — where the scale changes per chord — is appropriate for **non-diatonic** chord sequences (e.g. all-dom7 cycles, secondary dominants, modal-jazz tunes that move between key centers).

Example: a four-bar cycle of D7 → G7 → C7 → F7 isn't diatonic to one key. Each chord wants its own Mixolydian. Mode-of-the-moment fits.

But for ii-V-I in C, mode-of-the-moment is wrong: D Dorian, G Mixolydian, and C Ionian are *the same notes*. Forcing the player to "switch modes" on each chord just confuses them when the only thing actually changing is which note to land on.

**Implication for Virtuoso:**
- For diatonic progressions: use `chord_tone_emphasis` by default. Stay in parent scale, accent chord tones.
- For non-diatonic progressions: `mode_of_moment` is correct.
- The current "Chord Tone Targeting" pathway should use `chord_tone_emphasis`, anchor on a single shape, and stay there.

### Shifting between shapes

Many methods include explicit shifting exercises that climb up the neck through adjacent shapes — C-shape → A-shape → G-shape etc. — as a separate drill, not as the default mode of playing.

A good practice progression:
1. Build vocabulary in **one shape**.
2. Once comfortable, transpose the same line to a **different shape, same key**.
3. Once comfortable, **shift between two adjacent shapes** within one phrase.

Virtuoso should expose this as a position-handling option: "stay in one shape" (default) vs. "shift through adjacent shapes" (advanced).

---

## String groups (for chord work, not single-note runs)

String groups are a chord-voicing concept, not a single-note scale concept. The string group `6-4-3-2` means "play a four-voice chord using the 6th, 4th, 3rd, and 2nd strings, skipping the 5th." Different string groups produce different chord-voicing textures:

| String group | Voicing character |
| --- | --- |
| 6-5-4-3 | Bass-heavy, big sound |
| 5-4-3-2 | Mid-register, "Freddie Green" comping range |
| 4-3-2-1 | High-register, chord-melody friendly |
| 6-4-3-2 | Skips the 5th — opens up the mid for vocal/melody |
| 5-3-2-1 | Skips the 4th — bright voicing |

For jazz comping, the same chord (e.g. Dmaj7) can be voiced on any of these groups, and the player chooses based on what register they want and what string the melody/bass needs.

**Implication for Virtuoso:** string-group selectors only make sense in the **chord/comping** path, not the scale/arpeggio path. Keep them separate in the UI.

---

## Mapping to Virtuoso's data model

Translating the above into concrete code-design decisions:

### `Position` is wrong. Use `System` + `Shape`.

Current Virtuoso model:
```
position: 'open' | '3rd' | '5th' | '7th' | '9th' | '12th'
→ fretMin/fretMax window
```

Proposed model:
```
fretboardSystem: 'caged' | '3nps' | 'open' | 'fullNeck'
shape: depends on system
key: NoteName
```

Where `shape` is:
- For CAGED: `'C' | 'A' | 'G' | 'E' | 'D'`
- For 3NPS: `1 | 2 | 3 | 4 | 5 | 6 | 7` (or labeled by mode: Ionian / Dorian / …)
- For Open: implicit (one shape per supported key)
- For Full Neck: no shape needed

The fret window is **derived** from `(key, fretboardSystem, shape)`, not user-specified.

Example resolutions:
- `(C major, CAGED, C-shape)` → fret window 0–5, root C at 5th string fret 3.
- `(C major, CAGED, A-shape)` → fret window 2–5, root C at 5th string fret 3 (same root, different fingering geometry).
- `(C major, CAGED, E-shape)` → fret window 7–11, root C at 6th string fret 8.
- `(G major, CAGED, E-shape)` → fret window 2–6, root G at 6th string fret 3.
- `(C major, 3NPS, Position 1 / Ionian)` → fret window 7–11, hand at 7th fret on low E (the C root).
- `(C major, 3NPS, Position 3 / Phrygian)` → fret window 11–15, hand at 11th fret on low E (the E, 3rd degree).

### Shape ordering on the neck

For any (key, system), there is a deterministic ordering of shapes from low-fret to high-fret. Virtuoso should be able to:
1. List the shapes in that order for the current key.
2. Pick "the lowest shape" by default.
3. Move to the next shape (or previous) on user request.

### Shape dropdown labels

Per user feedback, labels should be based on the **shape area** (where the hand sits). Recommended format:

```
[shape-identifier] (frets X–Y)
```

Examples in C major:
- `C-shape (frets 0–5)`
- `A-shape (frets 2–5)`
- `G-shape (frets 7–10)`
- `E-shape (frets 7–11)`
- `D-shape (frets 12–17)`

Examples in C major, 3NPS:
- `Position 1 / Ionian (frets 7–11)`
- `Position 2 / Dorian (frets 9–13)`
- `Position 3 / Phrygian (frets 11–15)`
- ...

The fret range comes after the shape name so the user knows where their hand goes, but the primary identifier is the shape itself.

### Arpeggios live inside shapes

A `diatonic_arpeggios` exercise needs:
1. A scale (e.g., C major).
2. A shape inside that scale (e.g., G-shape CAGED).
3. A chord quality per scale degree (e.g., triads or 7ths).

For each diatonic chord, take its chord tones and intersect with the shape's note set. Render those notes in scale order.

### Mode of the moment vs. chord-tone emphasis

The `chordScaleStrategy` field should default based on whether the progression is diatonic:
- `progression == 'diatonic'`, `I-IV-V`, `ii-V-I`, `I-vi-ii-V` (within one key) → `chord_tone_emphasis`.
- `progression == '12_bar_blues'` (each chord is a dom7, not strictly diatonic) → `mode_of_moment` (each chord gets its own Mixolydian).
- Modal cycles and circle-of-fourths chains → `mode_of_moment`.

---

## What this means for the immediate Virtuoso rework

(The actual rework lives in [position-system-rework.md](./position-system-rework.md). This section is just the punch list.)

1. Replace `POSITION_PRESETS` (fret windows) with a shape-aware system.
2. Make the fretboard-system selector primary, the shape selector secondary (depends on system).
3. Derive `fretMin`/`fretMax` from `(key, system, shape)` rather than reading from a dropdown.
4. Default the Chord Tone Targeting pathway to `chord_tone_emphasis` strategy with a single shape anchor.
5. Eventually: add the static scale-diagram panel back, this time driven by the *actual current shape* rather than a raw fret range — it will show a recognizable shape, not a scattered grid.

---

## User-confirmed design decisions (2026-05-26)

These were the open questions in the original draft; the user has answered all five:

1. **Default fretboard system:** CAGED (5 shapes). We start there; if it doesn't feel natural in practice we can revisit.
2. **Shape-dropdown labels:** based on the shape area, with fret range. Format: `[shape-name] (frets X–Y)`.
3. **3NPS shape naming:** modal names — `Position 1 (Ionian)`, `Position 2 (Dorian)`, etc.
4. **Open position:** its own system (not a special case of CAGED).
5. **Next Variation:** cycles shapes within the same key (e.g., C-shape → A-shape → G-shape → E-shape → D-shape, in order).

These decisions are now baked into [position-system-rework.md](./position-system-rework.md).

---

## Generator pedagogy rules (audit 2026-05-28)

A full audit of every pattern generator surfaced a handful of places where the
code produced theoretically-wrong or unplayable note choices. These are the
rules the corrected generators now follow. Each is a principle, not a special
case — they apply to *any* key, scale, and string setup.

### 1. Harmonic intervals are chosen by PITCH, not by array index

"Scale in thirds" and "scale in sixths" pair each scale tone with the tone a
third (or sixth) above it. The naive implementation stepped by a fixed array
index (`+2` for a third, `+5` for a sixth). **That is only correct for a 7-note
diatonic scale.** In a 5-note pentatonic, `+2` indices is a 4th and `+5` is an
octave — so "A minor pentatonic in sixths" was silently producing octaves.

**Rule:** pick the partner whose *pitch* is closest to the target interval above
the lower voice (third ≈ 3–4 semitones, sixth ≈ 8–9 semitones), bounded so a 4th
never gets labelled a "third". This yields real thirds/sixths in pentatonic,
blues, modal, and bebop scales alike.

A run of thirds/sixths frequently makes each dyad's upper voice the next dyad's
lower voice (…A-C, C-E…). Rendered as a single-note line that produces a
repeated pitch (…C, C…). **A player never re-articulates that note**, so the
generator collapses immediate same-position repeats.

### 2. Triad pairs use two triads with NO shared tones

The "triad pair" device alternates two adjacent triads. To be a real triad pair
the two triads must share **no** common tones, so together they spell six
distinct scale tones. Use **I and ii** (1-3-5 and 2-4-6). The earlier code paired
I (1-3-5) with iii (3-5-7), which share the 3rd and 5th — producing back-to-back
duplicate pitches and only four distinct tones. Run one triad ascending in full,
then the other.

### 3. Arpeggio inversions are clean, non-overlapping groups

An inversions drill plays root position (1-3-5-7), then 1st inversion
(3-5-7-1), then 2nd (5-7-1-3)… as **distinct ascending groups of exactly N
notes**, each note the next chord tone strictly higher than the last. Don't emit
overlapping windows of the whole chord-tone pool.

### 4. Octave shapes are cross-string and compact

An octave on guitar is the compact two-finger grip (e.g. low-E fret 8 + D-string
fret 10 / G-string fret 5), **not** a 12-fret leap on one string. The octave
generator prefers the cross-string octave with the smallest fret span and only
falls back to a same-string +12 pair if no cross-string octave exists in range.

### 5. Voice-led lines stay in a low, comfortable position

When two fret positions reach the same pitch at equal distance from the previous
note (e.g. D2 at low-E fret 10 or D-string fret 0), prefer the **lower fret**.
This keeps walking-bass lines, guide-tone lines, and shell voicings from
drifting up the neck. (Implemented in the shared `nearestPositionForPc` tie-break.)

### 6. Chromatic enclosures don't re-pick the target

One target's resolution is often the next target's lower chromatic approach
(resolve to B, then approach C from B). Collapse the back-to-back identical
position so the line keeps moving.

### 7. Default chord-scales for "mode of the moment" (verified, unchanged)

This was reviewed and **kept as-is** — it is a deliberate, documented choice, not
a bug. Per [theory-jazz-advanced.md](./theory-jazz-advanced.md) the defaults
favour avoid-note avoidance over the strictly-functional scale:

| Quality | Default scale | Rationale |
| --- | --- | --- |
| maj7 | Lydian | #11 dodges the Ionian 4th avoid-note. |
| dom7 | Lydian dominant | #11 dodges the Mixolydian 4th avoid-note. |
| min7 | Dorian | Most consonant minor chord-scale. |
| m7b5 | Locrian ♮2 | Avoids the plain-Locrian b2 clash. |

These are *auto-selection* defaults; the user can still pick Ionian / Mixolydian
explicitly when a strictly functional sound is wanted.

Reminder from "How lines are built": for a **diatonic** ii-V-I, `chord_tone_emphasis`
(stay in the parent scale, accent chord tones) is the pedagogically correct
default. `mode_of_moment` is reserved for non-diatonic / modal cycles. The
`ii–V–I Workout` pathway intentionally uses `mode_of_moment` as a *teaching
device* (to make Dorian/Mixolydian/Ionian audibly land per chord), which is a
deliberate exception, not the general rule.

### 8. Bebop passing tones keep chord tones on the strong beats

- **Bebop dominant** `[0,2,4,5,7,9,10,11]` — Mixolydian + natural-7 passing tone.
- **Bebop major** `[0,2,4,5,7,8,9,11]` — Ionian + #5/b6 passing tone.
- **Bebop dorian / minor** `[0,2,3,4,5,7,9,10]` — Dorian + natural-3 passing
  tone between b3 and 4; **keeps the b3** so it sits over minor tonalities.

Routing from a source scale: a minor 3rd in the source → bebop dorian; a major
3rd with a b7 (Mixolydian) → bebop dominant; otherwise → bebop major.

### Things confirmed correct (not changed)

- CAGED chord templates (C/A/G/E/D, maj/min/dim) — intervals and fingerings verified.
- 3NPS positions — per-string spans of 3–4 frets, the characteristic 3NPS stretch; tiles the neck correctly. (Big stretches low on the neck, e.g. F major Position 1, are inherent to 3NPS, not a bug.)
- Sweep arpeggios — one chord tone per string, low-E root anchor, HO/PO turnaround at the apex; rolls on same-fret adjacent strings are correct.
- Bends restricted to the top three strings (guitar only); pre-fret = target − bend distance.
- Legato hammer-ons/pull-offs only between notes on the same string.
