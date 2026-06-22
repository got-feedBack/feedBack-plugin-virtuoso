# Triad Mastery — Skill Ladder band spec (2026-06-03)

> **Status: curation slice BUILT (2026-06-03, uncommitted)** — the 4-rung `concept_triads`
> band (`triad_inversions` → `triad_five_shapes` → `triads_over_changes` → `triad_pairs`) ships
> in a new **Concepts** pack family (opt-in via the Pack manager); verified by smoke + `probe-triads.mjs`.
> The **R7 upper-structure-over-bass** rung (the differentiator) + optional re-home of
> `diatonic_triad_drill` remain the follow-on. Original spec below.
> Designed by guitar-pedagogy-expert + harmony-theory-architect
> (round-table re-run, 2026-06-03) after the Triad Lab competitive read. The durable, on-mission
> thing to take from Triad Lab: teach **triads as a named, first-class ladder** — but improve on it
> by teaching triads as *harmonic function* wired to the mirror, not isolated shapes. Memory:
> `project_python_generator_reconciliation`.
>
> **Terminology:** user-facing this is a **Skill Ladder** band (the v0.7.1 "Pathways → Ladder"
> rename — header reads "Skill Ladder"). **In code the rename is labels-only:** it's a
> `PATHWAY_BANDS` entry + `PATHWAYS` rungs, `data-mode="guided"`, `renderPathwayList`,
> `virtuoso.lastPathway` — all UNCHANGED. This doc says "ladder/rung" for the user surface and
> "`PATHWAYS`/band" for the code.

---

## 1. Why (the gap + the differentiator)

We already have the **bricks** — `diatonic_triad_drill`, `triadic_pairs`, `CAGED_SHAPES.chordTemplates`,
the `voiceChord` voicing engine, the Connect voice-leading machinery — but not the **building**: a
sequenced ladder that takes a player from "name the inversion" to "own triads as a view of the whole
neck and use them as harmonic function." Triad Lab stops at the drill (quality ID + inversion cycling
+ string-set targeting, all techniques `false`, single-BPM-flat). **Our edge a point-tool can't match:
triads don't live in a silo — they connect to CAGED, to arpeggios, and to Jam comping, and they teach
the grammar of extensions** ("a D triad over a C bass *is* Cmaj9♯11 — the lush chord is a simple triad
you already own, relocated").

**The one differentiating concept: upper-structure triads over a moving bass.** Light the bass one
colour and the triad another, name the resulting slash-chord, and the player *hears* a familiar triad
become an extended chord by changing only the bass. That reframes the whole `CHORD_FORMULAS` extension
stack as "find the triad inside" — exactly the off-screen transferable skill the north star wants.

---

## 2. The ladder (easy → mastery rungs)

Ranked by transfer value (guitar-pedagogy). Each rung names the skill in its goal-card.

| Rung | Skill | Build | Generator |
|---|---|---|---|
| **R1 — String-set triads** | Closed-voiced triads on each set (1-2-3 / 2-3-4 / 3-4-5 / 4-5-6) — four fingering vocabularies, not one shape moved. Start the **outer** sets (easiest). | Curation — `diatonic_triad_drill` constrained to one string-set + a fret window | existing |
| **R2 — The 3 inversions per set** | Root / 1st / 2nd inversion in one position; hear which voice is on top. | Curation — existing triad drill, inversion-cycle | existing |
| **R3 — Connect inversions UP a set** | Root→1st→2nd climbing one string-set up the neck — *the single highest-payoff skill* (how you see the neck + comp in any register). | **New axis** — walk one string-set; highlight the *changing* voice between inversions | **M (new)** |
| **R4 — Triads ACROSS sets at one position** | Same chord, different string-set = register/voicing choice. | Curation — across-set selection | existing |
| **R5 — Triads inside CAGED** | The "aha": a triad is the top 3 strings of a barre chord you already know. **Our structural advantage.** | Curation + the **fretboard-strip mirror** overlaying the triad inside the full CAGED shape | existing + mirror |
| **R6 — Triads over a progression** | Diatonic, then borrowed; land the right inversion on each chord (nearest-voice). | Curation — triad drill over `COMMON_PROGRESSIONS` + Connect voice-leading | existing |
| **R7 — Upper-structure over a moving bass** ★ | The differentiator: a *triad* voiced over the chord's root/bass; named slash-chord readout; lit on the mirror. | **New generator** — per progression chord, pick a target triad (not the root), voice it over the bass; reuse `chordRootForDegree` (bass) + `connectStartIdx` (voice-lead the triad's top note chord-to-chord) | **M (new)** |
| **R8 — Triad pairs over a chord** | Two triads a tone/3rd apart superimposed = hexatonic / "So What" lead vocabulary. | Extends `triadic_pairs` with a held backing chord + scale-source | **L (new)** |

**Mastery = Jam:** triads-over-changes as a Jam mirror — improvise in the pocket, reading the moving
harmony unaided, with the triad's role lit on the fretboard strip (no score; mirror, not judge).

---

## 3. What's curation vs new code

- **~80% curation.** R1–R2, R4–R6 are the existing triad/CAGED primitives **sequenced** into rungs with
  goal-cards + string-set/fret-window constraints. No new generator. This is the **ship-first** slice —
  it validates demand with near-zero code.
- **New code, in priority order:**
  1. **R7 upper-structure-over-bass** (M) — the differentiator, and the *smallest* new-code surface
     because Connect already does the hard voice-leading. A `chord_scales`-adjacent variant that targets
     a triad over the chord root + emits the named slash-chord; lights the triad PCs on the mirror.
  2. **R3 inversion-connection axis** (M) — walk one string-set up the neck; highlight the changing voice.
  3. **R8 triad-pair-over-chord generator** (L) — defer; advanced lead vocabulary.

---

## 4. Playability guardrails (guitar-pedagogy — must hold when built)

- **Inner string-sets (2-3-4, 3-4-5) are the awkward ones** — close-voiced shapes there often need a
  small barre or a finger-roll on adjacent same-fret strings. **Do not render them as four-finger
  blocks.** (Hand the resolved shapes to guitar-pedagogy for review at build time.)
- **Start the outer sets (1-2-3, 4-5-6)** — easiest; sequence inner sets later.
- **The B-string offset** reshapes 1st-inversion major on the top set (standard-tuning major-3rd tuning
  gap) — get the fingering right.
- **2nd-inversion major/aug on the wound sets (4-5-6) gets muddy** — flag *register*, not theory; prefer
  the upper sets for those qualities.
- No-unison rule still holds (the engine guards it); triads are 3 distinct PCs, so the run-seam dedupe
  applies as usual.

---

## 5. Where it slots in the Skill Ladder

- A dedicated **`PATHWAY_BANDS` entry** (the Skill Ladder's two-level picker). Recommended as a
  **concept band** that builds on Core-Intermediate `major_scale_caged` (CAGED is the prerequisite for
  R5) — surfaced via the existing "Builds on …" soft hint, never a lock.
- **Open taxonomy call (defer to learning-design at build):** is "Triad Mastery" a pinned **Core**
  concept band (it's foundational, cross-genre harmony, not a style) or a **Style-family** pack? Lean
  Core-adjacent — it's a fretboard/harmony competency like CAGED, not a genre. Whichever, it declares a
  `family` + `buildsOn` if `kind:'style'` (the pack integrity guard requires both).
- Adding it = a `PATHWAY_BANDS` entry + the R1–R8 `PATHWAYS` rungs + (for R3/R7/R8) the new
  generators wired into `buildSingleChart` + the `practiceType` `<option>`s in `screen.html`. Per the
  agent-workflow: guitar-pedagogy reviews the resolved shapes, harmony-theory reviews R7's slash-chord
  spelling, before "done." Smoke coverage: extend `smoke-generators.mjs` over the new practice types.

---

## 6. Build order (when greenlit)

1. **R1–R6 as curation** (S) — sequence existing primitives into the ladder + goal-cards; ship + validate.
2. **R7 upper-structure-over-bass generator** (M) — the differentiator; harmony spells the slash-chord,
   guitar-pedagogy checks the shapes, mirror lights the triad role.
3. **R3 inversion-connection axis** (M).
4. **R8 triad pairs** (L) — defer behind the rest.

On-mission throughout: it *names the device* (string-set, inversion, "D/C = Cmaj9♯11"), teaches a
finite recombinable grammar, and ends in creative application (Jam) — practice/learning, never song-gen.
