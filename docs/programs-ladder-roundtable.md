# Programs — chair's synthesis (Tier B #6)

*2026-06-09. Chaired by learning-design-architect for the Workout engagement-maxx
initiative (`docs/workout-engagement-roundtable.md`, Tier B item #6). DESIGN ONLY —
no code. A **Program** = a named, structured multi-stage arc ("own the pentatonic
in two weeks") that pre-commits a SEQUENCE OF SPECS, generator-backed (re-derived to
the player's instrument/rig/level at run time, never locked content), opt-in, and
always hands off so it never dead-ends. Engagement comes from PERSISTENCE + a visible
ARC, never a new score/grade/currency.*

This builds on and does not re-open: `project_workout_framework_and_planner`
(block = role over the 29 primitives), `project_segment_library_and_refresh`
(templates + refresh + the 4 invariants), `project_pathways_feed_workout_blocks`
(PATHWAYS = canonical content; one-way bridge), `project_workout_perblock_credit_mapping`
(the credit gate + tag list), and gamification's `workout_engagement_maxx_thesis`
(no new currency; persistence/accumulation/earning-that-counts; invite-forward).

---

## 0. The one-line model

**A Program is a curated map (a `PROGRAMS` content table) whose progress is a pure
VIEW over the ledger you are already building.** It stores POINTERS (which pathway
rungs / which Workout) + COMPLETION PREDICATES (what the ledger must show), plus one
tiny opt-in bookmark. It adds **zero** new persistence, **zero** new grade, **zero**
new currency. A stage is "proved" only when `pathway_tiers` / `progress.byNode`
genuinely shows the flip the existing strict gate produced — whether the player ran
the rung solo in the Ladder OR via a per-block-credited Workout. The Program is the
ledger, highlighted against an arc.

The load-bearing consequence: **because progress is derived, a Program meets the
player where they are.** A guitarist who already cleared `pent_foundation` to Push
sees the Pentatonic program's first stage pre-ticked the moment they start it — no
busywork, no "redo it." That IS the "re-derive to current level" requirement,
satisfied by reading the ledger instead of storing per-program state.

---

## 1. The Program data model

### 1.1 Shape (a `PROGRAMS` table entry, sibling of `BUILT_IN_SESSIONS`)

```
PROGRAMS = {
  pentatonic_two_week: {
    id, label,
    goal,                        // the transferable COMPETENCY + why (north-star surface)
    instruments,                 // ternary tag {guitar,bass,piano} : 'native'|'adapted'|'n/a'
    denomination,                // 'clean_tempo' (guitar PB) | 'felt' (bass pocket) — sets the recap grammar
    estimate,                    // OPTIONAL descriptive "~2 weeks at 20 min/day" — a hint, never a quota/countdown
    entry: {                     // a SUGGESTION, never a gate (soft gamification)
      suggestPathway,            // the readiness anchor; note says what helps, never blocks
      note
    },
    stages: [                    // the easy→medium→hard→mastery arc (1–4 stages)
      {
        id, label, arc,          // arc ∈ 'easy'|'medium'|'hard'|'mastery' (the spine)
        run: { ... },            // WHAT to run this stage — generator-backed pointer (see 1.3)
        proves: { ... }          // the COMPLETION PREDICATE over the ledger (see 1.4)
      }
    ],
    handoff: {                   // never a dead end (see §3)
      programs: [ ...ids ],      // suggested NEXT programs (invitation, not obligation)
      capstoneJam                // a style id for the transfer destination Jam
    }
  }
}
```

A startup integrity guard (mirrors `validateSegmentTemplates` / `assertCreditTagsValid`)
asserts: every `run.pathway`/`run.segments[].templateId` exists; every `proves.pathway`
is a real `PATHWAYS` id; every `handoff.programs[]` is a real `PROGRAMS` id; the arc
labels are monotonic (no `hard` before `easy`). A mis-authored Program fails loudly
at load, same as a mis-authored credit tag.

### 1.2 The opt-in bookmark (the ONLY new state)

`virtuoso.programs = { active: id|null, started: { <id>: { startedAt } } }` — a
bookmark, not a currency. It records that the player opted in (for the entry
invitation + the "where you are" surface) and which is foregrounded. **Completion is
never stored here — it is always recomputed from the ledger.** Abandoning a program
deletes a bookmark and costs nothing (no decay, no "you gave up"). Multiple programs
may be `started` at once; there is no exclusivity and no lock.

### 1.3 `run` — the generator-backed pointer (three kinds)

A stage's `run` says what to practice; it stores **no content**, only a reference the
existing engine re-derives at launch to the player's instrument/rig/level:

- `{ kind:'pathway', id, target }` — run the Ladder rung. `applyPathwayConfig`
  already re-resolves it to the active instrument (instrument-aware Core), tuning, and
  string count. Credits natively through `advancePathwayTier` (pathway mode).
- `{ kind:'workout', segments:[{templateId}|{pathwayId}...] }` — run a Workout
  assembled from segment-templates / pathway-as-block. The **flow container** (warm-up
  → focus → application + seam breaths) the thesis says is the Workout's real edge.
  Re-derives via `buildSegmentConfig`/`pathwayAsBlock`. Per-block credit fires for
  tagged blocks via `creditBlockTier`.
- `{ kind:'jam', style }` — the mastery/transfer destination. A mirror, not a judge
  (locked doctrine) — completes descriptively (ran it), never a flip/score.

**Why both pathway and workout kinds:** the Program *recommends* a Workout (flow), but
because completion reads the ledger, the player who'd rather climb the rungs in the
Ladder ticks the same stages. The Program presents both affordances and doesn't care
which path produced the flip.

### 1.4 `proves` — the completion predicate (a read, not a write)

Evaluated against `nodeProgressState(pathway, pathwayTiersLoad())` + `progressLoad()`:

| predicate | "proved" when | denomination |
|---|---|---|
| `{ pathway, axis:'speed', tier:N }` | `highestTier >= N` (a real tempo-tier flip) | guitar clean-tempo |
| `{ pathway, axis:'travel', keys:K }` | `progress.byNode[pathway].keysCleared.length >= K` | guitar/bass portability |
| `{ pathway, axis:'clean' }` | `progress.byNode[pathway].depth.clean` | support-off |
| `{ kind:'felt', pathway }` | v1: descriptive ("pocket practiced", logged) — **no flip** (see §4 + the engine gap) | bass felt |
| `{ kind:'descriptive', text }` | the player ran a session of that style this program (Jam capstone) | transfer |

A Program's overall completion = **every non-descriptive `proves` met**, with
descriptive/felt stages counting done once run. **Completion is never "ran N
sessions" / "spent N minutes."** It is a stack of real competency flips + the felt /
transfer stages logged.

### 1.5 How "where you are" renders

The same descriptive grammar as the Tier-3 recap chapter list: a STAGE list with a
3-state glyph computed per stage — **✓ proved · ◐ in progress · ○ not yet** (from
`nodeProgressState` tier dots; `◐` = `highestTier >= 0 && < target`). **No percent,
no countdown, no decay, no quota.** The arc labels (easy→mastery) are visible so the
player sees the scaffold, not a progress bar.

---

## 2. The starter set (5 Programs)

Each names its competency, its stage arc mapped to easy→medium→hard→mastery, the
existing pathways/templates each stage uses, the entry suggestion (not a gate), and
the completion criterion (a real flip, never attendance). **Tag status** flags which
underlying rungs already carry a `creditsPathway` tag (so the Workout credits
in-flight today) vs which need a tag added to credit from inside the Workout (until
then they still credit when run as a Ladder rung — completion works either way).

### P1 · The Pentatonic Two-Week  — guitar, beginner  (FLAGSHIP)
- **Goal:** Own minor-pentatonic box 1 cold and play it in time over a blues — the
  single most useful first-solo skill. You leave with a clean-tempo number to beat and
  a scale you can improvise with.
- **Denomination:** clean_tempo (the guitar "your number").
- **Entry (suggestion):** can fret cleanly and hold a pulse (Core Beginner). Never blocked.
- **Arc:**
  - **Stage 1 (easy) — Own the box.** Workout: chromatic warm-up → pentatonic box →
    pentatonic review. **Proves:** `pent_foundation` speed tier 1 (Med cleared).
    *Tagged today:* `g_review_pentatonic`→`pent_foundation` ✓.
  - **Stage 2 (medium→hard) — Add the blue note & push.** Workout: blues-scale focus →
    over the 12-bar shuffle, climb the tempo. **Proves:** `blues_foundation` speed
    tier 2 (Fast). *Tagged today:* `g_blues_scale`→`blues_foundation` ✓.
  - **Capstone (mastery) — Blues jam.** `{kind:'jam', style:'blues'}`. **Proves:**
    descriptive ("improvised over the 12-bar — the scale is now music").
- **Completion:** pent box clean at Med + blues scale clean at Fast + jammed it. A real
  scale owned, not a recital.
- **Hand-off:** → *Playing the Changes* or *Fretboard Freedom*; capstone jam = blues.

### P2 · Lock the Pocket  — BASS, beginner→intermediate  (REQUIRED bass parity)
- **Goal:** Build the bass's actual foundation — the pocket. Root–5th–octave under any
  chord, the octave bounce locked to the kick, the funk ghost-note groove, then walk
  the changes. You finish a bassist who *grooves*, not one who runs scales.
- **Denomination:** **felt** (hold-tempo / grooves-owned / drummer-as-spine — never a
  score). The drummer-spine (default drums + auto-dropped backing bass) is the engine
  this whole program runs over.
- **Entry (suggestion):** a steady plucking hand (Core Bass Beginner). Never blocked.
- **Arc:** (this is the **parallel journey** to P1, not a transposition — a bassist's
  beginner arc is groove-first, the sanctioned divergence)
  - **Stage 1 (easy) — The frame.** Workout over the drummer: `bass_root_fifth_octave`.
    **Proves:** felt — "held the root–5th–octave pocket" (descriptive in v1; see §4).
  - **Stage 2 (medium) — The bounce.** `bass_octave_groove` locked to the kick.
    **Proves:** felt — "locked the octave bounce."
  - **Stage 3 (hard) — The 16th pocket.** `bass_dead_notes` (ghosts + accents).
    **Proves:** felt — "held the dead-note pocket."
  - **Capstone (mastery) — Walk the changes.** `bass_walking` over ii–V–I — the ONE
    fully-gradeable bass rung. **Proves:** `bass_walking` speed tier 2.
    *Tagged today:* `b_app_walking`→`bass_walking` ✓.
- **Completion:** three pockets held (felt) + walking the changes at tempo (flip). The
  capstone is the one place bass earns a flip; everything before it is felt, by design.
- **Hand-off:** → *Bass: Slap & Funk* elective or a future walking-deepening program;
  capstone jam = a funk/soul groove (drummer-spine, player IS the bass).

### P3 · Playing the Changes  — guitar, intermediate→advanced
- **Goal:** Stop running scales over chords and start *spelling the harmony*. Triads →
  seventh arpeggios → guide tones → connect across the bar line. The skill that makes a
  solo follow the changes.
- **Denomination:** clean_tempo (with the harmony arc as the real cargo).
- **Entry (suggestion):** the CAGED major scale + diatonic triads (Core Intermediate).
- **Arc:**
  - **Stage 1 (easy) — Spell the chords.** `diatonic_triad_drill`. **Proves:** speed tier 1.
  - **Stage 2 (medium) — Add the 7th.** `arp_seventh_shapes`. **Proves:** speed tier 1.
  - **Stage 3 (hard) — The two notes that matter.** `vl_guide_tones` (3rds/7ths).
    **Proves:** speed tier 2.
  - **Capstone (mastery) — Connect & jam.** `vl_connect` (aim for the next chord's
    guide tone across the bar line), then a ii–V–I jam. **Proves:** `vl_connect`
    speed tier 1 **+** descriptive jam.
- **Completion:** can outline and voice-lead a ii–V–I and improvise over it.
- **Tag status:** `diatonic_triad_drill`, `arp_seventh_shapes`, `vl_guide_tones`,
  `vl_connect` are **not yet tagged** — credit in-Workout needs these tags added
  (guitar-ped/harmony pass; on the credit-mapping ruling's "verify-first" list).
  Completion still works when the rungs are climbed in the Ladder.
- **Hand-off:** → *Clean Sweeps* or a future Bebop program; capstone jam = jazz.

### P4 · Fretboard Freedom  — guitar, intermediate
- **Goal:** Get out of the box. One box → CAGED links → position shifts → whole-neck.
  Find any key anywhere and connect zones without a seam.
- **Denomination:** clean_tempo, but the real axis is **Travel** (positions/keys).
- **Entry (suggestion):** one pentatonic box owned + the CAGED major scale.
- **Arc:**
  - **Stage 1 (easy) — One box cold.** `fb_one_box`. **Proves:** speed tier 1.
  - **Stage 2 (medium) — Connect the boxes.** `fb_caged_links`. **Proves:**
    travel — 2 shapes/keys cleared (`keysCleared >= 2`).
  - **Stage 3 (hard) — Travel mid-phrase.** `fb_position_shifts`. **Proves:** speed tier 2.
  - **Capstone (mastery) — The whole neck, any key.** `fb_whole_neck`, then a free jam
    in a non-home key. **Proves:** `fb_whole_neck` travel — 3 keys **+** descriptive jam.
- **Completion:** plays the scale as one connected field, not five boxes.
- **Tag status:** `fb_*` not yet tagged — same note as P3.
- **Hand-off:** → *Playing the Changes* (apply the freedom over changes) or *Clean
  Sweeps*; capstone jam = any style in a fresh key.

### P5 · Clean Sweeps  — guitar, advanced
- **Goal:** Build sweep picking from the arpeggio up — shape first, cleanliness before
  speed. Seventh arps → triads across the neck → 3-string sweep → full sweep
  application.
- **Denomination:** clean_tempo (but cleanliness, not BPM, is the headline — slow tiers
  by design).
- **Entry (suggestion):** can spell a triad/seventh arpeggio across the neck (Arpeggios
  pack).
- **Arc:**
  - **Stage 1 (easy) — Spell it vertically.** `arp_seventh_shapes`. **Proves:** speed tier 1.
  - **Stage 2 (medium) — The shape across strings.** `triad_five_shapes`. **Proves:**
    speed tier 1.
  - **Stage 3 (hard) — The 3-string rake.** `sweep3_triad`. **Proves:** speed tier 1
    (clean at a slow tempo is the win).
  - **Capstone (mastery) — Sweep the changes.** `arp_sweeps` over i–VI–III–VII, then a
    metal/neoclassical jam. **Proves:** `arp_sweeps` speed tier 1 **+** descriptive jam.
    *Tagged today:* `g_tech_sweep`→`arp_sweeps` ✓.
- **Completion:** a clean, fluid sweep through a real progression.
- **Hand-off:** → a future neoclassical/shred program; capstone jam = metal.

---

## 3. The hand-off graph (never a dead end)

Every Program ends in (a) a **Jam capstone** (the mastery rung / transfer destination —
the mirror where the skill becomes music) AND (b) ≥1 **suggested next Program**.
Phrasing is opportunity-not-obligation ("Where this goes next:" / "When you're ready:"),
never loss/threat. The graph (a DAG with a Jam terminal on every node):

```
P1 Pentatonic Two-Week ─┬─→ P3 Playing the Changes ─┬─→ P5 Clean Sweeps ─→ (future Neoclassical) → Jam: metal
   capstone Jam: blues  └─→ P4 Fretboard Freedom ───┘   capstone Jam: jazz
                              capstone Jam: any key

P2 Lock the Pocket (bass) ──→ Bass: Slap & Funk / (future Walking-deepening) → Jam: funk groove
   capstone Jam: funk (drummer-spine)
```

Rules honored: a completed Program never says "now you must"; it offers a door. A
player mid-Program who wanders into free Workout/Ladder/Jam loses nothing and may tick
stages anyway (ledger-derived). No Program is a prerequisite *gate* for another — the
"suggested next" is an arrow, not a lock.

---

## 4. Cross-instrument parity

Parity is enforced at the **role/competency layer**, not content (per
`cross_instrument_workout_structure`). The guitar and bass Programs are **parallel
journeys, not transpositions:**

| | Guitar (P1 Pentatonic) | Bass (P2 Lock the Pocket) |
|---|---|---|
| Beginner competency theme | lead vocabulary in a box | the pocket / groove under the band |
| Denomination | clean-tempo PB ("your number") | felt (hold-tempo / grooves-owned), drummer-as-spine |
| Headline | beat your number | the verdict (Locked/Settling), never a % |
| Earns a flip | every stage (tempo tiers) | only the gradeable capstone (walking); groove stages log felt |
| Engine spine | the falling-note run + scorer | the backing drummer + dropped bass (`jam-drops-bass`) |

Per-step native/adapted/n-a (the ternary tag):
- P1 Pentatonic: guitar **native**; bass **n/a** (a bassist's beginner arc is groove,
  not lead pentatonic — its parallel is P2, not a bass copy of P1).
- P2 Lock the Pocket: bass **native**; guitar **n/a** (groove-bass primitives are
  bass-native; the guitar pocket equivalent is a different program).
- P3 Playing the Changes: guitar **native**; a bass parallel ("Walk & Outline":
  `bass_arp_triads`→`bass_arp_sevenths`→`bass_walking`) is **adapted** and should be a
  near-term sibling Program (bass spells harmony melodically from the root, not as
  voicings) — flagged as the next bass Program after dogfood.
- P4 Fretboard Freedom: guitar **native**; bass **adapted** (the bass scale ladder
  `bass_scale_one_box`→`bass_scale_whole_neck` is the parallel — a future bass Program).
- P5 Clean Sweeps: guitar **native**; bass **n/a** (sweep is guitar-idiom).

**Parity verdict for v1:** ship 1 guitar beginner + 1 bass beginner as true parallels
(P1/P2) so the beginner arc has both instruments; the intermediate/advanced bass
parallels (Walk & Outline, Bass Fretboard) are the immediate follow-on so bass doesn't
skip a stage guitar has. **Flag:** do not let guitar reach 5 Programs while bass sits
at 1 — the next batch must close the bass intermediate/advanced parallels.

---

## 5. Opt-in / pacing UX shape

- **Starting:** Programs surface as a group in the Workout starter picker, above
  "Your routines" / "Starters" (reuses the shipped shelf pattern — cheap, congruent).
  A Program card shows name, goal, the stage arc (descriptive, with the easy→mastery
  labels), and **"Start this program."** Starting sets the bookmark and foregrounds the
  card. It changes no other state.
- **Running a stage:** the card's current stage has a **"Practice this stage"** button
  that launches the stage's `run` (a Workout / Ladder rung / Jam) through the normal
  contained player. The Program is a launcher + a map, not a new playback mode.
- **"Where you are":** the stage list with ✓ / ◐ / ○ glyphs derived from the ledger
  (§1.5). The next stage is highlighted as the growth edge. **No countdown, no
  calendar, no decay, no percent, no quota.** The optional `estimate` ("~2 weeks at
  20 min/day") is descriptive text, never enforced — like the pathway "~8 rungs", not
  "3 hours."
- **Coexistence (the trap-out guard):** a Program never traps the player out of free
  practice. It is a highlighted overlay on the same Ladder/Workout/Jam. Free practice
  still ticks Program stages when it matches (ledger-derived). The player may run
  stages out of order, skip ahead, ignore the Program entirely, or run several Programs
  at once. Abandoning = deleting a bookmark, zero cost.
- **Completion moment:** when every stage is proved, a descriptive **"You own this:
  [competency]"** card (the run-end verdict-modal canvas) + the forward invitation to
  the next Program / capstone Jam. Never a badge/score in v1 (a competency-named badge
  could ride Tier C behind XP-Off — fork below).

---

## 6. Guardrails self-audit

Against the engagement-roundtable **backfire list** and the **north star**:

- **No streak-guilt.** Programs carry no streak, no "you haven't touched this in N
  days," no calendar. ✓
- **No minute-goals.** Stages complete on competency flips / felt-logs / transfer-runs,
  never minutes. The `estimate` is a descriptive hint, not a target. ✓
- **No completion-or-lose-progress.** Progress is the gained-only, no-decay ledger;
  abandoning a Program loses nothing; the bookmark is a bookmark. ✓
- **No fabricated flips.** A stage is "proved" only when the ledger genuinely shows the
  flip (the existing strict ≥8-judged / ≥65% gate). Felt bass stages show a felt verdict
  / log, never a fake %. Jam capstones complete descriptively, never a fake score. ✓
- **No new currency / grade.** Zero new store except the opt-in bookmark; progress is
  100% derived from `pathway_tiers` + `progress.byNode`. ✓
- **No score on a bass groove / no per-note bass flashes.** Bass Program denomination is
  felt; the only bass flip is the gradeable walking capstone. ✓
- **North star — teach the grammar.** Every Program names its transferable competency
  (the `goal`); stages are recombinable primitives (pathway rungs); credit is the named
  competency, not rounds/time; the destination of every Program is a **Jam capstone**
  (improv / transfer), not a finished piece. ✓

---

## 7. Engine gaps + handoffs (flagged, not built)

- **Bass felt-progress has no clearable ledger rung (engine gap).** Guitar stages flip
  on clean-tempo (`bestBpm`/`highest_tier`); bass groove stages have no persistent
  "Locked at tempo X, held across N sessions" artifact — so v1 logs them descriptive
  ("practiced — pocket held"), only the gradeable capstone flips. To make a bass groove
  stage *complete* on a real felt threshold (not just "practiced"), the ledger needs a
  **bass felt-hold PB** primitive (a persisted hold-tempo + drift-variance verdict),
  the bass analog of `bestBpm`. → **gamification + bass-pedagogy.**
- **Tag-expansion coupling.** Programs credit *in-flight* (from inside their Workout)
  only for tagged rungs; P3/P4 target untagged rungs (`diatonic_triad_drill`,
  `arp_seventh_shapes`, `vl_guide_tones`, `vl_connect`, `fb_*`). Completion still works
  when those are climbed as Ladder rungs, but for full in-Workout credit, add their
  `creditsPathway` tags (the credit-mapping ruling's "verify-first" list). → **guitar-
  pedagogy + harmony** verify the tags; independent of Programs shipping.
- **harmony-theory-architect:** verify the harmonic arc of P3 (the triad→7th→guide-tone→
  connect sequence; which progressions/keys to travel in the capstone).
- **genre-idiom agents:** blues-idiom (P1 capstone jam authenticity), jazz-idiom (P3),
  metal-idiom (P5 capstone).
- **gamification-architect:** ratify the no-new-store / derived-progress model, the
  stage-glyph surface (no %, no decay), and the entry-invitation / completion-card copy
  (opportunity-not-obligation).
- **virtuoso-ux-designer:** the Programs shelf, the stage-arc card, the "where you are"
  surface, the "Practice this stage" launcher.

---

## 8. Forks for Christian (his call)

1. **"Weeks" vs "Stages/Phases" naming.** *Rec: Stages/Phases* — decay-free, no calendar
   quota, matches soft gamification; keep an optional descriptive `estimate`. ("Weeks"
   implies a clock the backfire list warns against.)
2. **Completion artifact.** *Rec: ship the descriptive "You own this: [competency]" card
   now* (reuses the verdict-modal canvas) + forward invitation; defer any badge to Tier
   C behind XP-Off. (Alt: no card, just the next-program invite.)
3. **Tag-expansion timing.** *Rec: ship Programs reading the ledger now* (works
   regardless of path) and expand the `creditsPathway` tag list (P3/P4 rungs) in
   parallel as a separate guitar-ped/harmony pass — they're independent and both honest.
4. **UI home.** *Rec: a group in the Workout starter picker for v1* (reuse the routines/
   starters shelf); promote to a dedicated Programs shelf only if it earns it.
5. **Starter count.** *Rec: ship 4 (P1 guitar + P2 bass + P3 + P4)* so guitar doesn't
   outrun bass; P5 Clean Sweeps and the bass intermediate parallels in the next batch.
   (Alt: all 5 now, close the bass parallels immediately after.)
