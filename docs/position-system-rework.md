# Position-System Rework Proposal

**Status:** Design locked as of 2026-05-26 (all open questions resolved by user). Ready for implementation in a future code change.
**Companion doc:** [fretboard-pedagogy.md](./fretboard-pedagogy.md) — the *why*. This doc is the *what*.

---

## Problem (recap)

Today's Virtuoso treats "position" as a fixed fret window:

```js
const POSITION_PRESETS = {
  open:  { fretMin: 0,  fretMax: 3  },
  '3rd': { fretMin: 3,  fretMax: 6  },
  // ...
};
```

That's pedagogically wrong. The user's feedback:

> "We should anchor off the root note on the 3rd fret of the 6th string / 1st string. Because this is labeled as the open position, the arpeggio fingerings should not go past the third fret… that note anchor on the 3rd fret of the A string should facilitate multiple scale shapes."

The user wants:
- Position chosen by **root anchor**, not fret number.
- One root anchor implies **multiple valid shapes** (open, CAGED, 3NPS, …).
- The fret window is **derived** from the chosen shape, not the input.

---

## Locked design decisions

The user has reviewed and confirmed:

1. **Default fretboard system:** CAGED (5 shapes). Start there; revisit if it doesn't feel natural.
2. **Shape labels in the dropdown:** named by the **shape itself** with the **fret area** as a parenthetical. Example: `E-shape (frets 7–11)`.
3. **3NPS shape names:** modal names — `Position 1 (Ionian)`, `Position 2 (Dorian)`, etc.
4. **Open position:** its own system, not a special case of CAGED. Available only in keys where it makes sense.
5. **Next Variation behavior:** cycles shapes within the same key. (C-shape → A-shape → G-shape → E-shape → D-shape, in the order they appear on the neck for that key.)

---

## Proposed model

### New config fields

| Field | Type | Replaces / adds | Notes |
| --- | --- | --- | --- |
| `fretboardSystem` | `'caged' \| '3nps' \| 'open' \| 'fullNeck'` | Replaces existing `fretboardSystem` | CAGED is default. "open" = open-position-favoring fingering for keys where it works; "fullNeck" = full-neck visualization (not for drilling). |
| `shape` | depends on system | Replaces `cagedShape` + introduces shape ID for non-CAGED systems | CAGED: `'C'\|'A'\|'G'\|'E'\|'D'`. 3NPS: `1\|2\|3\|4\|5\|6\|7` (labeled by mode). Open: implicit per key. |
| (removed) `position` | — | Old `'open'\|'3rd'\|'5th'\|…` dropdown | Gone. The user picks system + shape; fret window is derived. |
| (removed) `fretMin`/`fretMax` as user inputs | — | Still computed internally | They become outputs of `(key, system, shape)`, not inputs. Advanced users could still override with a "custom fret range" escape hatch — but it's no longer the default path. |

### Derivation function

```js
function fretWindowForShape(key, system, shape) {
  // Returns { fretMin, fretMax, rootPositions, allNotes }
  // where rootPositions is an array of {string, fret} for every root of `key`
  // inside the shape, and allNotes is every scale note inside the shape.
}
```

For CAGED, this is a lookup keyed by `(chordShape, key)` — find where the underlying chord shape sits in the key, then return the surrounding 4–5-fret scale box. For 3NPS, it's the strict 3-notes-per-string fingering anchored on the starting scale degree. For Open, it's a key-specific shape table (only populated for keys where open position is sensible).

---

## UI changes

### Controls panel — Key section

Today:
```
Key      Scale       Position
[C  ▼]   [Ionian ▼]  [3rd position (3–6) ▼]
```

Proposed:
```
Key      Scale       Fretboard system    Shape
[C  ▼]   [Ionian ▼]  [CAGED ▼]           [E-shape (frets 7–11) ▼]
```

### Shape dropdown contents (per system)

**CAGED (default):**

For C major, in fret order:
- `C-shape (frets 0–5)`
- `A-shape (frets 2–5)`
- `G-shape (frets 7–10)`
- `E-shape (frets 7–11)`
- `D-shape (frets 12–17)`

The names stay `C-shape / A-shape / …` across all keys — the fret range changes per key. In G major, the same five names appear but in different cyclic order (G → E → D → C → A from low to high).

**3NPS:**

Seven entries, in fret order from low to high in the current key:
- `Position 1 / Ionian (frets X–Y)`
- `Position 2 / Dorian (frets X–Y)`
- `Position 3 / Phrygian (frets X–Y)`
- `Position 4 / Lydian (frets X–Y)`
- `Position 5 / Mixolydian (frets X–Y)`
- `Position 6 / Aeolian (frets X–Y)`
- `Position 7 / Locrian (frets X–Y)`

**Open:**

One option in supported keys:
- `Open position (frets 0–3)` — visible only for keys where it's sensible (C, G, D, A, E, F, Am, Em, Dm).

In unsupported keys, the Open system option is either greyed out or hidden, with a tooltip explaining why.

**Full Neck:**

No shape dropdown — the whole neck is in scope. This is for visualization/recall practice, not drilling.

### Status bar

Examples:
- `Ready — C major, CAGED E-shape (frets 7–11)`
- `Ready — G major, 3NPS Position 1 (frets 3–7)`
- `Ready — D major, Open position`

The system + shape come first; the fret range is parenthetical context.

### Pathway behavior

Pathways pick a default `(system, shape)`. When the user changes Key, the pathway's chosen shape stays — the fret range moves to wherever that shape lives in the new key. (Today the dropdown silently rewrites `fretMin/fretMax` to the new preset — slightly different behavior.)

When the user explicitly changes Shape, the new fret window takes effect; the pathway is marked "modified."

### Next Variation — cycles shapes within a key

The Next Variation button currently rotates `fretMin/fretMax` and sometimes other params. Per user decision, after the rework Next Variation should **cycle through shapes within the same key** in low-to-high fret order. For C major CAGED, the cycle is:

C-shape → A-shape → G-shape → E-shape → D-shape → (back to C-shape)

In G major CAGED:

G-shape → E-shape → D-shape → C-shape → A-shape → (back to G-shape)

(Same cyclic order — CAGED → CAGED → CAGED → CAGED — but starting position differs by key.)

For 3NPS the cycle goes Position 1 → 2 → 3 → … → 7 → 1.

For Open, Next Variation can either:
- Be a no-op (only one Open shape per key) — recommended.
- Cycle to the next key in the circle of fourths, keeping the system as Open. (Possible if the user wants quick comparison across open-position-friendly keys.)

---

## Generator changes

### `scalePositionsForSystem(cfg)`

Today walks the user's `fretMin..fretMax` looking for in-key notes. Proposed: drive entirely from `(key, system, shape)`, return exactly the notes that belong to that shape — including their string assignments (which the shape pre-determines).

This is a real change of authority: today notes happen to fall in a window; tomorrow they're *the shape's notes by definition*.

### Arpeggio extraction (`chordTonePositionsInPosition` etc.)

Same idea. Given `(key, system, shape, chordRoot, quality)`:
1. Get the shape's full note set.
2. Filter to chord tones (1, b3, 5, b7 for m7; etc.).
3. Return them in scale order.

Half-step edges may leave gaps — that's fine. Don't pad with out-of-shape notes to hit a target count.

### `buildChordScaleExercise`

Today calls `chordScalePositions(cfg, rootPc, quality)` per chord with rectangular fret bounds. Proposed:
- For `chord_tone_emphasis` strategy: get the **parent key's scale positions in the active shape** once. Reuse for every chord. Mark chord tones per chord for accent emphasis.
- For `mode_of_moment` strategy (genuinely non-diatonic): recompute scale positions per chord, *but still restricted to the active shape's fret window* — meaning each chord's "mode" uses whatever notes fall inside the shape. This will sometimes produce sparse output, which is musically honest.

### Default strategies per progression

| Progression | Default strategy |
| --- | --- |
| `static_I` | n/a (no progression) |
| `I-IV-V`, `I-vi-IV-V`, `I-V-vi-IV`, etc. (all diatonic) | `chord_tone_emphasis` |
| `ii-V-I`, `I-vi-ii-V`, `vi-ii-V-I` (diatonic) | `chord_tone_emphasis` |
| `12_bar_blues`, `quick_change_blues` (dominant-heavy, mode shifts) | `mode_of_moment` (each chord = its Mixolydian) |
| `i-VI-III-VII`, `i-VII-VI-VII` (modal minor) | `chord_tone_emphasis` (in natural minor) |
| `minor_ii-V-i` | `chord_tone_emphasis` (in natural minor / Dorian for ii) |
| `circle_diatonic` (diatonic cycle) | `chord_tone_emphasis` |
| Future: non-diatonic cycles, chromatic mediants | `mode_of_moment` |

User can override.

---

## Specific pathway fixes

### Chord Tone Targeting (the pathway the user tested)

**Today:** `fretMin: 0, fretMax: 7`, strategy `chord_tone_emphasis`, but the wide fret range lets the arpeggio wander all the way to fret 7 (visible as the messy chord box on the highway).

**Proposed:**
- Replace `fretMin/fretMax` with `(system: 'caged', shape: 'C')` as the pathway default — keeps the user near the open position they were testing.
- Strategy stays `chord_tone_emphasis`.
- Result: in C major, the line stays inside the C-shape (frets 0–5), specifically using the C-shape note set — not "every C major note between 0 and 7." The arpeggio for Cmaj7 will sit on real chord-tone positions within the C-shape and stop at fret 5.
- User can switch shape via the Shape dropdown to drill the same exercise in a different position.
- Next Variation cycles C-shape → A-shape → G-shape → E-shape → D-shape.

### Modal Awareness

**Today:** `fretMin: 0, fretMax: 7`, `mode_of_moment`, diatonic progression. Same wide-range issue.

**Proposed:**
- Default to `(system: 'caged', shape: 'C')` in C; let user move to other shapes.
- Strategy stays `mode_of_moment` since the pedagogy is "feel each mode's distinct color." Each chord's mode uses whatever notes fall inside the active shape.

### Diatonic Triad Drill, Seventh Vocabulary, ii-V-I Workout

Same treatment: pick a sensible default shape per pathway, derive fret window from shape.

### Pent Foundation, Blues Foundation, Major Pent Country, Dorian Groove

These already use 4-fret-ish ranges; they need light touch-up to convert `fretMin/fretMax` into shape selection, but the practice content stays the same.

### Sweep Primer

This one needs care — sweep arpeggios specifically target the **A-shape CAGED** geometry for triad sweeps and the **D-shape** for higher arpeggios. The pathway already specifies `cagedShape: 'A'` — good. The rework just makes that shape selection load-bearing rather than supplementary.

---

## Highway integration

This rework is mostly UI/data-model. The note highway itself doesn't change. But two side benefits fall out:

1. **No more stray arpeggio overlay** — already shipped (handShapes cleared in `makeBundle`).
2. **Future static scale diagram** — once shapes are first-class, the diagram we tried to ship earlier can come back, this time rendering *a known shape's dots* (a real, recognizable fingering grid) rather than whatever notes happen to be in a fret range. This is the second half of what the user asked for in the original "static scale view above the note highway" request.

---

## Migration / backward-compat

- Saved presets and pathways have `fretMin/fretMax`. Map them at load time to the closest `(system, shape)` and keep the raw `fretMin/fretMax` as a fallback for custom-range advanced users.
- Add a "Custom fret range" escape hatch in Advanced mode for users who really want a non-shape window (e.g. for chromatic warmups across a wider zone).
- localStorage entries — leave the existing keys; introduce `virtuoso.fretboardSystem` and `virtuoso.shape` as new keys.

---

## Acceptance criteria for the rework

When this is shipped, the user should be able to:

1. Pick "Chord Tone Targeting" + key C + CAGED + C-shape → see a clean arpeggio-style figure anchored on the C major notes within frets 0–5, with the Cmaj7 / Am7 / Dm7 / G7 chord tones being targeted in turn.
2. Change Shape to "A-shape" → same exercise, hand jumps to frets 2–5, same diatonic chord tones, just in the next position up the neck.
3. Hit Next Variation → cycles to G-shape, then E-shape, then D-shape, then back to C-shape.
4. Change Key to G → the active shape stays selected; the fret range adapts. (C-shape in G sits at frets 7–12.)
5. Switch system to 3NPS → Shape dropdown changes to 7 modal-named positions; picking Position 1 (Ionian) in C major puts the hand at frets 7–11 with strict 3-notes-per-string fingering.
6. Switch to Open system in C major → single option, frets 0–3, uses open strings naturally. Switch key to Bb → Open system option is hidden/greyed (Bb doesn't have a sensible open-position fingering).
7. No more confusion about what "open position" or "3rd position" means — it now says the shape name (e.g. "C-shape") and shows the resulting fret range.

---

## What I'm NOT proposing

- **No change to the highway renderer.** It already takes events; the events just get smarter.
- **No new audio.** Same audio engine, same backing chords.
- **No change to the chord-preview thumbnail** that already renders from `chordTemplates`.
- **No reintroduction of the static scale diagram yet.** That's a follow-up after shapes are in.
- **No removal of pathways.** Same pathway list; they just pick shapes instead of fret windows.
