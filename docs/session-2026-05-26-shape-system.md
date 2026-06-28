# Session log — 2026-05-26: Shape-system rework

This session reframed how Virtuoso thinks about position on the fretboard. The short version: a "position" used to be a fixed fret window like `{ fretMin: 5, fretMax: 9 }`, and the user flagged that this isn't how guitarists actually think about position. A position is a *root-note anchor* that implies one or more valid scale **shapes** around it. The session built that mental model into the codebase end-to-end — pedagogy docs, data model, UI, and chart generator.

This file is the index for the session. The actual reference material lives in the linked docs.

---

## Authoritative reference docs

Read these first if you're touching position, scale, or arpeggio logic:

- **[docs/fretboard-pedagogy.md](./fretboard-pedagogy.md)** — synthesizes established guitar pedagogy (CAGED system, 3-notes-per-string methodology, full-neck modal maps, chord vocabulary, jazz line construction). Explains the two big ideas: position-as-root-anchor, and the multiple shapes that share each anchor.
- **[docs/position-system-rework.md](./position-system-rework.md)** — the implementation proposal that turned the pedagogy into concrete config-model + UI changes. As of this session it's no longer a proposal — it's what was shipped. The acceptance criteria at the bottom are useful for verification.

---

## What changed, in commit order

| Commit  | Subject                                                         | What it does                                                                                                                              |
| ------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| ff4cd9a | feat(diagram): static scale fretboard panel above the note highway | First attempt at the static scale diagram the user originally asked for. Bolted on top of the existing `fretMin`/`fretMax` logic.        |
| 4de3327 | refactor(positions): tighten Position to standard 4-fret hand positions | Reverted the scale diagram (premature) and narrowed Position presets to true 4-fret hand windows. Surfaced a deeper design problem — see below. |
| 9097f79 | docs: add fretboard pedagogy reference + position-system rework proposal | First draft of both reference docs, written after reviewing source material on guitar position systems.                       |
| 336c6d9 | docs: lock position-system design — CAGED default | Resolved the five open questions from the proposal draft; settled on the CAGED system as the default 5-shape framework. |
| c0d1a4c | feat(shapes): unified CAGED + 3NPS + Open shape data model      | First code change. Added `CAGED_SHAPES`, `THREE_NPS_POSITION_DEFS`, resolver functions, smoke tests. Self-contained and inert.            |
| d661370 | feat(shapes): wire shape data model into controls UI + chart generator | Wired the data model into the controls panel (Shape dropdown) and chart generator (`scalePositionsForSystem` uses shape note set). All scale/chord/arpeggio pathways migrated from `'position'` to `'caged'` system. |

---

## Locked design decisions

These came out of the open-questions discussion mid-session and are now baked into the code:

1. **Default fretboard system: CAGED (5 shapes)** — the most universal and the cleanest match for the existing jazz-leaning pathways. The user can switch in Advanced mode.
2. **Shape dropdown labels** show the shape name with the fret range as a parenthetical — e.g. `E-shape (frets 7–11)`. Names stay the same across keys; the fret range moves.
3. **3NPS shape naming** uses modal labels — `Position 1 (Ionian)`, `Position 2 (Dorian)`, etc. — because the lowest note of each position is the tonic of the corresponding mode.
4. **Open position is its own system**, not a special case of CAGED's C-shape. It's offered only in keys that have at least one root in frets 0–3 and at least 7 scale notes in that range (filters out Db and Ab major, for example).
5. **Next Variation cycles shapes within the current key** in the system's cyclic order — for CAGED in C, that's `C → A → G → E → D → C`. For non-shape systems it falls back to the old per-pathway variation rotation.

---

## Architectural rules to keep

If you're adding or modifying anything in the scale/arpeggio/position area, hold these:

- **A position is a root anchor, not a fret window.** Don't reintroduce `POSITION_PRESETS`-style fret rectangles as the primary input to a generator. The fret window is derived from `(key, system, shape)`.
- **Multiple shapes share each root anchor.** A given C root on the A string facilitates the open-position fingering AND the C-shape CAGED AND a 3NPS position — let the user pick which.
- **Shape names are portable across keys.** "E-shape in C major" sits at frets 7–11. "E-shape in G major" sits at frets 2–6. Same shape, same name; the fret range follows the key.
- **For diatonic progressions, stay in the parent scale and emphasize chord tones.** Don't switch modes per chord for ii-V-I or I-vi-ii-V — D Dorian, G Mixolydian, and C Ionian are the same notes. Save `mode_of_moment` for genuinely non-diatonic progressions.
- **Arpeggios live inside shapes.** A chord-tone arpeggio is the chord tones (1, b3, 5, b7 for m7) restricted to the active shape's note set. Half-step gaps are fine — don't pad.
- **String groups are a chord-voicing concept**, not a single-note concept. Keep them out of the scale/arpeggio path.

---

## Source material

Pedagogy synthesized from established guitar instructional material covering: jazz improvisation / 5-shape arpeggio systems / line construction across 12 keys; full-neck modal maps and sweep picking methodology; CAGED fretboard mapping; chord vocabulary and string-group voicings; and various genre-specific technique references (blues, metal, jazz, funk).

Web research:
- [CAGED vs 3 Notes Per String — JustinGuitar](https://www.justinguitar.com/guitar-lessons/caged-vs-3-notes-per-string-3nps-scale-systems-sc-987) <!-- brand-ok: external lesson source citation, not competitive positioning -->
- [3 Notes Per String Major Scale Patterns — Applied Guitar Theory](https://appliedguitartheory.com/lessons/3-notes-per-string-major-scale-patterns/)
- [The 5 Major Scale CAGED Shapes — GuitarHabits](https://www.guitarhabits.com/the-5-major-scale-caged-shapes-positions/)
- [Scale Positions for Guitar — Jens Larsen](https://jenslarsen.nl/scale-positions-for-guitar/)
- [Guitar/Structure of the CAGED scale shapes — Wikibooks](https://en.wikibooks.org/wiki/Guitar/Structure_of_the_CAGED_scale_shapes)

---

## What didn't ship this session (deliberately)

These were considered and pushed to a follow-up:

- **The static scale-diagram panel above the note highway.** The user's original request. Reverted mid-session because rendering "all scale notes in a fret range" produced a scattered grid; rendering a *real shape* requires the shape system to exist first. Now that it does, the diagram can come back driven by the current shape's dot pattern.
- **Pentatonic-specific shape data.** The current code applies the CAGED shape windows with the minor/major-pentatonic scale formula filter. That gives the pentatonic notes inside CAGED shapes — workable but not the canonical 5 pentatonic boxes. Refine later if it doesn't feel right.
- **Custom-range escape hatch UX.** The `'position'` system still works (Custom fret range option in Advanced mode), but the UI doesn't expose `fretMin`/`fretMax` inputs prominently. Beginners shouldn't need it; advanced users who want it should be able to find it. Worth a polish pass.
- **CSS cleanup.** `.virtuoso-caged-shapes`, `.virtuoso-caged-shape-btn`, `.virtuoso-caged-only` rules are still in the stylesheet but no markup uses them. Safe to remove in a follow-up.

---

## Verification checklist

To confirm the rework works as intended:

1. Open Virtuoso → pick **Chord Tone Targeting** → key **C** → the Shape dropdown should show `C-shape (frets 0–5)` selected by default. The Cmaj7 arpeggio bars should stay within frets 0–5; no notes wandering to fret 7.
2. Change Shape to `E-shape` → hand position jumps to frets 7–11.
3. Hit **Next Variation** → cycles through the 5 CAGED shapes in order (C → A → G → E → D → C for the key of C).
4. Change Key to **G** → Shape dropdown reorders so the lowest-fret shape appears first (G → E → D → C → A in G major).
5. Switch system to **3NPS** → dropdown shows 7 positions with modal names. Position 1 (Ionian) in C major sits at frets 7–11 with strict 3-notes-per-string fingering.
6. Switch to **Open position** in C major → single option, frets 0–3, uses open strings. Switch key to **Db** → Open option disappears or shows "(not available in this key)" — Db major has no root in frets 0–3.
7. Switch to **Custom fret range** → the legacy `fretMin`/`fretMax` path is still available for advanced users who want a non-shape window.

If any of these fail, the bug is in the wiring (`screen.js`), not the data model — the data model has smoke tests at the bottom of the shape definitions that assert correctness for known reference cases.
