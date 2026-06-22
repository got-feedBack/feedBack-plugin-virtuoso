# Rhythm Concept Ladder — genre-spanning expansion (round-table spec)

> ~23-agent group-design session, 2026-06-04. Chair: **learning-design-architect**.
> Engine: **rhythm-meter-architect**. Playability: **guitar- / bass- / drum-pedagogy**.
> Content: **18 genre/sub-genre idiom lanes** (metal, punk, surf, blues, jazz, funk,
> latin, reggae, afrobeat, bluegrass, country, gypsy-jazz, new-orleans, norteño,
> tango, flamenco, disco, prog).
> Per-lane detail lives in each `.claude/agent-memory/<agent>/`. Durable synthesis:
> memory `project_rhythm_ladder_design`. **Status: DESIGNED, NOT built.**

## The mandate

Expand the `concept_rhythm` band (today 6 rungs: Subdivisions · 16th Pocket · Swing &
Shuffle · Displacement · Odd Meters · Over the Barline) into a **full genre-spanning,
transferable rhythm curriculum** — a ladder that teaches rhythmic *feel across idioms*,
absorbing a queued **gallop-feels + single-note/single-string rhythm** build-out. Pitch is
held constant (the difficulty axis is rhythm, not notes).

## The hard constraint (drove every verdict)

A rhythm **drill** is a SINGLE melodic line over a steady click — because Virtuoso's
comp/groove backing engine is thin (one pad or the blues boogie) and its rebuild is
designed-not-built (`docs/backing-engine-roundtable.md`). So every device is marked
**buildable-now-as-a-single-line** vs **BACKING-GATED**. Honest framing, repeated by every
lane and the drum conscience: *a single line teaches the TIME of a feel, never the ensemble
INTERLOCK* → goal-cards say **"tap the clave's time," not "play a clave groove."**

---

## Decision 1 — Architecture: ONE spine, three attach points (no bloat)

**The load-bearing decision (chair, unanimous).** There is **ONE genre-neutral ~11-rung
spine.** A genre's rhythmic device attaches in **exactly three ways — never a new band
rung**:

1. a **`vary[]` step** on a spine rung,
2. an **application rung in that genre's own Style pack** (`buildsOn` the spine),
3. a **named idiom in a goal-card**.

This is what keeps 18 idioms from becoming a 30-rung picker. The genre lanes designed *into*
these slots.

## Decision 2 — The spine (4 strata + capstone)

| Stratum | Rungs | Status |
|---|---|---|
| **A · The Grid** | Subdivisions · 16th Pocket | exist |
| **B · The Feel** | Swing & Shuffle · Displacement *(exist)* · **Gallop & Snap** *(new)* · **Accent Displacement** *(new)* | 2 new |
| **C · The Pulse Frame** | **Single-String Pulse** *(new — keystone)* · **Half-Time / Double-Time** *(new, goal-card)* · Odd Meters *(reorder down)* | 2 new |
| **D · Two Pulses At Once** | Over the Barline *(exists)* · Metric Modulation *(GATED)* · Polymeter cell *(GATED ceiling)* | gated |
| **Capstone** | **Trade Bars / Make a Groove** *(new — via `call_response`)* | new |

**New rungs to build:** Gallop & Snap · Accent Displacement · Single-String Pulse ·
Half/Double-Time · the capstone. Plus reorder Odd Meters / Over-the-Barline into C/D.

- **Single-String Pulse = the keystone** (guitar-ped): build it as **ONE note, palm-mute
  default, low string** — a scale reintroduces the fretting variable the rung exists to
  remove.
- **Accent Displacement = the drum crown jewel** (drum-ped): same notes, the accent moves
  — the highest-transfer drumming concept for a melodic player; `hertaAccent` already proves
  the plumbing. It hosts most genre accent-maps (bluegrass roll, funk "the one", tango
  marcato, NOLA big-four, reggae one-drop, djent off-subdivision accent).

## Decision 3 — The substrate: a `RHYTHM_CELLS` data table

**The single highest-leverage build (engine lane).** The real cell engine already exists:
`fillNotesFromSeq`'s `steps[]` path tiles an arbitrary duration array with **no bar-reset**.
`rhythmSteps` is just a 2-entry table feeding it. So **any cell commensurate with the bar is
buildable NOW as a data array** — only *coprime-with-the-bar* polymeter needs new machinery.

**Build a `RHYTHM_CELLS` table** (sibling of `SEQUENCE_PATTERNS`) holding every dotted /
snap / gallop / clave / tresillo / bell cell as a named duration- or onset-array; `rhythmSteps`
falls through to it. This converts the whole Latin/dotted/snap wave from **code-per-feel into
curation-per-feel** — the recombinable-primitive north star.

**HARD INVARIANT (assert at startup, like no-unison):** every cell's durations must sum to a
whole number of beats / bars. The guitar lane caught the proposed Scotch-snap `[q/4, q/2]` as
**wrong** (fills ¾ of a beat) — correct is `[q/4, q*3/4]`. The startup guard
(`assertRhythmCellsValid`, mirroring `assertStrumGripsValid`) rejects any cell that doesn't
close on the bar.

### The cells the panel defined (all bar-commensurate → buildable as data)

| Cell | Definition | Owner / shared |
|---|---|---|
| **tresillo** | `[3,3,2]` eighths = 1 bar (onsets 1, &-of-2, 4) | **THE cross-idiom atom** — Latin/NOLA/tango/norteño/cumbia/reggaeton all point at ONE definition |
| **son clave** | onsets `[0,3,6,10,12]` over 2 bars (16 eighths) | latin — **directional** (3-2 vs 2-3 = bars swapped); store as onset-array + direction label |
| **rumba clave** | onsets `[0,3,7,10,12]` over 2 bars | latin — the lone diff from son (eighth 7 vs 6) IS rumba-vs-son |
| **habanera** | `[0,3,4,6]` / 1 bar (gaps `[3,1,2,2]`) | latin |
| **afrobeat standard bell** | 5-stroke onsets `[0,3,5,7,10]` / 12-pulse (gaps `[3,2,2,3,2]`=12) | afrobeat — *cousin* (not identical) to the 6/8 bembé bell |
| **gallop** / **reverse_gallop** | `[2,1,1]` / `[1,1,2]` sixteenths = 1 beat | metal — **already shipped** in `rhythmSteps` |
| **skip_chug** | `[3,1]` (dotted-8th + 16th) = 1 beat | metal (thrash) — SMALL-ADD |
| **snap** | `[1,3]` (16th + dotted-8th) = 1 beat | metal/country — SMALL-ADD (the rung namesake; country chicken-pickin reads this with the middle ghosted) |
| **gallop_triplet** | `[2,1,1]` in eighth-triplets per beat | metal (NWOBHM) — SMALL-ADD |
| **funk 16th pocket** | one-bar 16-slot accent(`ac`)/ghost(`mt`)/strike/rest map | funk — bass-native via `dead_note_groove` |
| **bluegrass forward roll** | even 8ths, `ac` on `[0,3,6]` (3+3+2) | bluegrass — accent-map, pitch-pinned |
| **flamenco soleá compás** | grouping meter `12/8:3+3+2+2+2` (accents the hemiola) | flamenco — buildable as a **grouping meter** now; literal 3,6,8,10,12 clap-accents = SMALL-ADD 12-slot cell |

## Decision 4 — Goal-card-only devices (no new engine)

- **Downstroke Drive** (punk): an **eighth drill + goal-card + a HARD ~200 bpm tempo gate**
  — there is no stroke-direction field and we are **not** adding one; the wall where
  downstroke must become alternate **IS the top-tier lesson.** Home: a "Downstroke Drive"
  framing on the **Subdivisions (eighth)** rung; a `pm`-toggle `vary[]` on Single-String
  Pulse for the muted-chug-to-open-ring version.
- **Half-Time / Double-Time**: a **feel against a steady click — density changes, the click
  NEVER changes tempo.** This wording is load-bearing and is L&D's to lock on the goal-card.
- **Reggae skank**: *"play the & and trust the empty 1"* — a half-beat (`startAt`=eighth)
  phase offset, goal-card on Single-String Pulse / a `vary[]` on Displacement. (Bass
  **diverges**: the skank is guitar/keys; the bass plays the dropped-one root line — a
  separate bass face, never the guitar skank.)

## Decision 5 — Overlaps resolved (no double-building)

- **Surf = the Tremolo treatment** (guitar-ped + surf lane): NOT a standalone rung. Surf adds
  an *evenness-at-a-sustainable-tempo* nuance (vs metal's burst-to-max) as a goal-card, plus a
  staccato-8ths ("spy riff") Style-pack app rung. Don't double-count.
- **Disco scratch ≈ funk 16th pocket** → point at the 16th Pocket rung. Disco's own device is
  the **octave-jumping bassline** (bass-native, `vary[]` on 16th Pocket over `octave_groove`).
- **Country shuffle = blues shuffle** → point at the shared Swing & Shuffle rung. Country's own
  device = **chicken-pickin'** (the mute-articulated tresillo / `snap` cell) — a `vary[]` on
  Gallop & Snap + a goal-card on the existing `country_chicken_pickin` rung.
- **Gypsy la pompe**: the comp interlock is BACKING-GATED; the pompe *pulse* is a single-line
  SMALL-ADD on Single-String Pulse; manouche swing = a shallower/pushed **knob** on the shared
  Swing rung (not a new cell).
- **Swing/shuffle is cross-idiom** (blues/jazz/country/gypsy) → the genre-neutral Swing rung is
  the shared home; lanes point at it, never duplicate. `shuffle` = an honest **triplet 2:1
  ratio** (0.667), never "dotted-eighth." 12/8 slow-blues = `12/8:3+3+3+3` + `swing:'straight'`
  (don't double-swing an already-triplet grid).

## Decision 6 — Rhythm vs Picking ladder boundary

**WHEN-vs-HOW axis.** The Rhythm ladder stays **single-string, pitch-constant, owning the
accent MAP**; the Picking ladder owns **string-crossing mechanics (the HOW)**. The bluegrass
roll splits cleanly: Rhythm owns the forward/backward **accent map** (pitch-pinned), Picking
owns the crosspicking. The **herta stays in Picking**; **surf double-pick = Tremolo**.

## Decision 7 — Bass parity (≈ zero new build, but a real right-hand divergence)

Time levers (subdivision/swing/displacement/odd-meter) are pitch-independent → transfer to
bass for free via `stringSetup`. But **on bass the right hand IS the rhythm engine**, so the
spine diverges on **three rungs** (not just one):

- **16th Pocket** → the **fingerstyle ghost-note pocket** (`dead_note_groove`), not a 16th
  scale run.
- **Gallop & Snap** → **pick (down-down-up, the canonical metal-bass gallop) OR 3-finger
  burst** — name both; "Snap" = `slap_pop`, gated advanced.
- **Single-String Pulse** → the **root pulse** (`root_fifth_octave`) — bass *owns* this rung.

Rules: **strip `fretboardSystem:'caged'` + `shape` on every bass variant** (bass = movable box
/ root figure, never CAGED). **Keep `tremolo_picking: bass:'n-a'`** (`right_hand_technique`
stamina is the honest substitute). **Right-hand fatigue gates** on 16th-pocket / fast-gallop.
Optional new bass-native rung: **Pick vs Fingers as a feel choice**.

**Bass OWNS the genre cells:** clave/tresillo, second-line, and the motown counter-pulse are
**bass-native** in the real idiom — don't ship them guitar-only; reggae diverges to the
bass dropped-one line.

---

## GATED — spec'd for when the primitives ship (do NOT build near-term)

1. **Per-bar CHANGING-METER array** (prog's flag — *new, elevate this*): a
   `meterSequence:['7/8:2+2+3','4/4','5/8:3+2']` consumed by `measureSeconds`/`buildBeats` in a
   loop. **Simpler than full polymeter** and unlocks the most universally idiomatic prog/math
   device (alternating bars + bar-commensurate cells). Prog's recommendation: **scope it
   separately and AHEAD of full polymeter.**
2. **Polymeter cell** (coprime-with-bar, e.g. 3-over-7) — needs the Tier-3 **decoupled
   phrase-clock** (`@ N/D` clause, scoped not built). On-ramp 3-over-4 → 2-over-3 → 3-over-7;
   the **re-lock VISUAL is load-bearing** (tint the full `lcm(cell,bar)` super-cycle on the
   overview strip so the player sees it "come home"). Metal's long-cycle drift (Meshuggah
   `@`-clock) is the same gate.
3. **Metric modulation** — a **block-seam** concern (single tempo per block); a two-block rung
   where a foregrounded subdivision in block A becomes the new pulse in block B.

## Recurring SMALL-ADD engine asks (flagged by multiple lanes, defer)

- **Per-cell swing / micro-timing offset** — swung tresillo (NOLA), laid-back-vs-on-top funk,
  manouche shallow-push, gypsy. Current swing is **eighth-only global**; a per-cell / per-genre
  swing% + micro-push is small but recurring. Defer behind the spine.
- **Arrastre** (tango) — a dragged grace-note lead-in; no grace-note field, so a `sl`-slide
  approximation works now, the authentic drag is a SMALL-ADD.

---

## Recommended build order

**Batch 1 — curation-clean, buildable now (the spine + substrate):**
1. `RHYTHM_CELLS` table + `assertRhythmCellsValid` startup guard (the substrate).
2. **Gallop & Snap** rung (gallop/reverse exist + `skip_chug`/`snap`/`gallop_triplet`) — the
   queued build-out's home; guitar + bass faces.
3. **Single-String Pulse** rung (keystone — one note, palm-mute, low string; bass = root pulse).
4. **Accent Displacement** rung (hosts bluegrass roll / funk "the one" / tango marcato / NOLA
   big-four / reggae one-drop as `vary[]` + goal-cards).
5. **Half/Double-Time** rung (locked goal-card wording).
6. Reorder Odd Meters / Over-the-Barline into strata C/D; add prog's same-numerator
   re-grouping `vary[]` (2+2+3 vs 3+2+2).
7. The **tresillo shared atom** + clave cells + flamenco compás grouping-meter + the genre
   `vary[]`/goal-cards/Style-pack app rungs that point at them.
8. **Trade Bars / Make a Groove** capstone (depends on whether `call_response` exposes a
   "build your own" surface — L&D's one open question; may need a small UX touch).
9. **Downstroke Drive** goal-card (Subdivisions) + **reggae skank** goal-card (Single-String
   Pulse).
10. Bass parity pass: the 3 right-hand divergences + strip CAGED + optional Pick-vs-Fingers.

**Batch 2 — gated, spec'd for later:** the per-bar changing-meter array (elevate, ahead of
polymeter) → polymeter cell + re-lock visual → metric modulation → per-cell swing/micro-timing.

## Open questions for Christian

- **Capstone surface:** does `call_response` today expose a "now build your own groove" UI, or
  only a fixed app-plays call-and-answer? (Decides whether the capstone is pure curation or
  needs a small `virtuoso-ux-designer` touch.)
- **Elevate the changing-meter primitive?** Prog argues `meterSequence` is simpler than
  polymeter and more idiomatic — worth scoping ahead of the Tier-3 polymeter cell.
- **Build scope now:** all of Batch 1, or a first slice (substrate + Gallop & Snap +
  Single-String Pulse) to ship and dogfood before the rest?
