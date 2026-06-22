# Bass Technique Content — synthesis spec (from the Discord bass thread)

*2026-06-10. Main-thread synthesis of a three-lane panel (bass-pedagogy [lead, read the live code] · learning-design [curriculum] · harmony-theory [the 7th-arp boxes]), convened on real Discord feedback: Christian asked the bass community what warmups/exercises/technique they run "when not practicing songs," explicitly to build bass content "relevant to bass, NOT just a mirror of the guitar stuff." Per-lane detail: `.claude/agent-memory/{bass-pedagogy-expert/project_bass_technique_content_discord, learning-design-architect/project_bass_technique_lessons_scaffold, harmony-theory-architect/project_bass_seventh_arp_boxes}.md`.*

## The headline (the surprise): most of it already ships

bass-ped read `screen.js`: **taylor's #1 ask — the 1-2-4 fingering doctrine — is already BUILT** (`bassFingerFor(f,anchor)` / `applyBassFingering` ~5309: a true dual regime — 1-2-4 below the index-anchor fret 5, 1-2-3-4 at/above — wired into the bass `position` box, out-of-regime frets honestly unmarked, never scored; `FORM_CUES.bass` carries `one_two_four`/`floating_thumb`/`pivot_dont_jump`). The full bass ladder ships (rh_pulse → finger_gym → root-fifth-octave → scale boxes → arps → dead-notes → walking → modes/shifts/whole-neck → guide-tones/approach/three-finger/capstone/trade) + a Slap & Funk pack, and **7th arps exist** (`bass_arp_sevenths`: maj7/m7/dom7/m7♭5 + inversions + over-changes). So this is a few targeted deltas, **no rebuild**, mostly config.

## The Discord asks → disposition

| Discord ask | Disposition |
|---|---|
| **1-2-4 fingering** (taylor) | **Already built** (display). Real bug: `bass_finger_gym` contradicts it (below). |
| **Pinky hand-stretches + HO/PO, "not a creative circle of hell"** (Daniel) | **The headline net-new** — a bass legato rung. No bass legato *pathway* exists (only a Workout segment + a guitar-only concept ladder). |
| **7th-chord arpeggio BOXES in all positions** (Gungr) | Extend `bass_arp_sevenths` (it varies by KEY, never by neck POSITION) — pure config. |
| **"shape" training** (Bodhammer) | Mostly served (scale-box + the finger-dot HUD + 1-2-4 display). Framing, not new content. |
| **microshifts / scale length 30–35"** | A microshift cue + a one-line tip. Fret-count isn't modeled (out of scope as a model). |

## The build (reconciled, ordered)

1. **Fix `bass_finger_gym` (fix-first — a live 1-2-4 self-contradiction).** Its `vary` step `{chromaticPattern:'1234', fretMin:0, fretMax:3}` forces a flat four-finger stretch at frets 0–3 — the exact strain its own goal card tells bassists to avoid — and trips a builder bug (`buildChromaticExercise` ~7125 hard-codes guitar 1-2-3-4 + ignores `applyBassFingering`; at fretBase 0 the open string steals the index slot so frets 1/2/3 mislabel). **Decision (D1, bass-ped the authority): a 4-fret chromatic *spider* genuinely needs 1-2-3-4, so don't do it down low — drop/raise the fret-0–3 variant; keep the spider at fret 5+.** (L&D's alternative — synthesize a 3-fret `'124'` chromatic pattern — is rejected: the 1-2-4 doctrine already lives in the *scale box* via `applyBassFingering`; the finger-gym just shouldn't strain. Simpler + correct.)
2. **`fg` plumbing blocker (must land before #3, or the pinky never displays).** `buildLegatoExercise` (~7320) pushes only `{s,f,ho,po}` (drops `n.fg`), AND `SEQ_NOTE_FIELDS` (~7246) omits `'fg'` so `fillNotesFromSeq` would drop it anyway. Add `'fg'` to `SEQ_NOTE_FIELDS` + carry `fg:n.fg` in the legato builder.
3. **`bass_finger_legato` — the headline net-new Core rung (Daniel's ask).** `practiceType:'legato'` over **minor-pentatonic / minor box fragments** (musical, recombinable — NOT chromatic, the "circle of hell"). Geometry truth: the minor-3rd reach in a pentatonic box lands the hammered note on **fg 4 = the pinky**, so the existing legato builder literally produces "pinky hammer-on." Start fret 5–8 (1-2-4 comfortable, pinky reaches with no strain), graduate down. Felt/clean, **never scored on the slur**. Keep in **Core: Bass** — do NOT route bass into the guitar `concept_legato` (it forces CAGED).
4. **7th-arp boxes "in all positions" (Gungr) — extend `bass_arp_sevenths`, pure config.** Tighten the current wide 8-fret window (~5 frets so it reads as a crisp box, not a zone-filled blob) and make `vary[]` **walk the window up the neck** (hold key, positions I→V→VII→X). Optionally a sibling **"Seventh Boxes — All Positions"** rung that isolates one quality at a time (`progression:'static_i'` + `chordOverride:'maj7'|'dom7'|'min7'|'min7b5'` + stepped window) — harmony's **maj7→dom7→min7→m7♭5 one-note-edit chain** (each box flats one tone from the last). Box map (4-string all-4ths, A- & D-rows identical) in harmony's memo. Payoff framing: **"outline the changes with the 7th arpeggio."**
5. **Bass Technique Gym — a new Workout (L&D; the literal "technique for when not practicing songs" ask).** None exists today (current bass Workouts are all groove/style). The arc: warmup (1-2-4 chromatic, fret 5+) → finger gym → `bass_finger_legato` → i-m pulse (`b_tech_right_hand`) → 7th-arp box → root-motion/walking application. A `BUILT_IN_SESSIONS` entry assembled from existing segment templates + the legato one. Length presets scale it. **Guardrail vs the circle of hell:** every technique block runs over a real scale in vary-cycled keys (the refresh engine), and the arc *ends in application*.
6. **Small finishers:** a microshift cue for the within-low-position 1-2-4 span (the shift telegraph only fires on >2-fret leaves); a one-line scale-length tip (short-scale → one-per-fret a touch lower; long-scale/small hands → microshift earlier); shape-framing on the goal cards (name the shapes). No per-instrument fret model.

## North star check
Bass-specific throughout (1-2-4, pinky slurs in *real* boxes, floating thumb, the all-4ths arp box) — explicitly NOT transposed guitar (cut: 3NPS legato, sweep framing, the CAGED concept rung). Recombinable musical cells, never a rote chromatic grind; goal cards name the device; the gym ends in application (deliberate practice with transfer).

## Decision log
- **D1 — finger_gym fix = drop the low 4-fret spider (bass-ped), not synthesize a `'124'` chromatic (L&D).** The 1-2-4 doctrine already ships in the scale box; the fix is to stop the gym straining + contradicting itself.
- **D2 — pinky drill is pentatonic-box legato, not chromatic** (bass-ped + L&D agree): the pentatonic minor-3rd reach IS the pinky hammer-on, and it's musical (avoids Daniel's "circle of hell").
- **D3 — 7th-arp "all positions" = walk the window, hold the key** (harmony + bass-ped): position coverage, not key coverage (key-travel already exists). Pure config, no new generator.

## Build order
finger_gym fix (#1) → fg plumbing (#2) → `bass_finger_legato` (#3) → 7th-arp positions (#4) → Bass Technique Gym (#5) → finishers (#6).

## Follow-up verification (named)
guitar/bass-ped already own the playability (1-2-4 offsets, microshift math, legato feasibility — done here); harmony confirms the 7th-arp box content stays chord-tone-correct; a smoke row in `smoke-generators`/`smoke-strings` for the `fg`-carry + the legato pinky output once built.
