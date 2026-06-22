# Genre-Band Authoring Playbook

**The repeatable process for building (or fixing) a genre's BACKING BAND in Virtuoso.**
Follow this for every genre as the band rolls out beyond the country/metal/jazz exemplars.
Distilled from the 16-agent genre-band panel + the rhythm-deepening panel (2026-06-13) and
the hard lessons of getting the first three right. Companion to `docs/genre-band-realization-
roundtable.md` (the engine architecture) and `docs/backing-pipeline.md` (the technical pipeline).

> **The one-sentence principle:** *the right notes are not the right band.* A genre's recipe
> cells are the **skeleton**; the FEEL — what makes a player say "yes, that's country" instead
> of "that's reggae" — lives in a handful of **other dimensions** that must EACH be set per
> genre. Get the cells right and skip these and you land "correct but robotic / barely in the
> ballbark" (the exact verdict the first pass earned). This playbook is the checklist that
> stops that happening again.

---

## 0. Who owns what (the consult matrix — convene up front, don't under-scope)

A genre band is a **genre-idiom-led** design. The genre-idiom agent for the style **owns the
band's authenticity** and chairs; the others fill their lane. (CLAUDE.md agent-workflow: a new
genre pathway/band MUST be vetted by its idiom agent; create the agent first if it doesn't exist.)

| Lane | Owns |
|---|---|
| **genre-idiom agent** (the chair) | Which instruments are in the band, each one's idiomatic part + feel, the bright-line that separates this genre from its neighbours, the final "does it sound like the genre" call. |
| **rhythm-meter-architect** | The time engine: the variation mechanism (`vary[]`), swing ratio, the micro-timing `FEEL_TIMING` lean values, meter/grouping. |
| **drum-pedagogy** | The drum groove cells + kit + the ghost/accent dynamics + fills. |
| **bass-pedagogy** | The bass figure(s) + voice + the lock to the kick. |
| **guitar-pedagogy** | The rhythm-guitar comp cell technique + playability + articulation. |
| **piano-pedagogy** | The keys part (Rhodes/organ/clav/piano) — sustain glue vs comp vs rhythmic cell. |
| **harmony-theory** | The comp voicing STYLE + recommended progressions + no-mud rule. |
| **sound-design** | The per-genre MIX (levels/pan/space/EQ) + safe loudness. |
| **audio-engine** | The instrument-SOURCING (which voice/kit/amp; borrow-vs-build). |

The main thread runs the session and synthesizes; **no standing PM agent.** The chair authors
the band as a **whole ensemble, not a stack of solo parts** — the parts are defined by how they
*interlock* (who owns which beat, who leaves space for whom). A bass figure and a comp cell that
are each individually idiomatic can still sound wrong together if they fight for the same real
estate. Specify the **division of labor across the bar**, not just each part in isolation.

---

## 1. The eleven dimensions of a genre band (set EVERY one)

For each genre, the band is fully specified only when all eleven are answered. Most "it's not
idiomatic" misses are a skipped dimension, not a wrong cell.

1. **Instrumentation / ensemble** — which of the ~5 tracks play (comp / bass / drums / keys),
   and which are deliberately OFF (e.g. metal = no keys; bluegrass = no drums). `ensemble` flags.
2. **The cells** (rhythm) — the comp groove, bass figure, drum groove per density tier
   (`sparse`/`groove`/`full`). The recipe.
3. **Placement** — *where in the bar the chord/accent lands.* THE most genre-defining bit and the
   easiest to get wrong: a chord on the **offbeat** (every "&") is a reggae/ska **skank**; on the
   **backbeat** (2 & 4) it's country/rock; on the **downbeat** it's a march; a boom-chuck with the
   boom mis-placed on the "&" drifts to polka/oom-pah. Placement, not the accent, separates
   neighbouring genres. (§2 bright-line test #1.)
4. **Space / density-as-identity** — *what the part deliberately leaves EMPTY.* In many genres the
   silence IS the signature: the country chuck and the soul chank leave beats 1 & 3 empty (the
   bass+kick own them); the reggae skank leaves every downbeat empty. Filling the holes doesn't
   make a part "more" — it erases the idiom (a funk 16th-scratch that hits every 16th stops being
   funk). This is NOT the density tier (#2 = *how busy*); it's *which slots are idiomatically
   forbidden even at full*. Bright-line: if you can fill a hole without anyone noticing, the
   genre's space discipline is wrong.
5. **Voicing style** — the comp chord SHAPE: `triad` (low, tight, root-DOUBLED guitar, sitting a
   register LOWER and close to the bass — strum genres; a high wide triad reads "folk-pop," not
   "tight country band") vs `shell` (rootless mid guide-tones that voice-lead — jazz/funk) vs
   `power` (metal 5ths). One uniform shape makes everything sound jazzy. (`backingVoicingStyle`.)
6. **Variation** — a one-bar cell that loops byte-identical every bar sounds robotic, especially
   for comping genres. Comping/riff genres need `vary:[grid…]` (the engine seed-rotates per bar:
   breathe / anticipate / lay out / drive). Pure pulses (a reggae one-drop, a four-floor) can loop.
7. **The lock / interlock** — how the parts relate across the bar; a genre uses one or both:
   - **Lock (same onsets):** where a genre is "tight," comp+bass+kick hit the SAME onsets (metal
     gallop: `metal_gallop` ↔ `root_gallop` ↔ kick `a.nna`). Three parts → one driving unit.
   - **Interlock (complementary onsets):** where a genre "grooves," parts deliberately fill each
     other's GAPS — bass on 1 & 3, guitar chuck on 2 & 4 (country/soul); the two-guitar afrobeat
     weave; call-and-response. **State which beats each part owns** so they interlock, not collide.
   A genre that should interlock but is authored as a stack of parts all hitting the backbeat is mud.
8. **Dynamics** — a groove vs a march is the accent/ghost RATIO: the time-keeping voice plays
   ghost/normal, only 2–4 hits per bar accent, and **ghosts ramp INTO the backbeat** (`g g g a`).
   `DRUM_VELOCITY` + `acc` already express this; author it, don't leave it flat.
9. **Micro-timing lean** — the pocket: a systematic per-role drag/push (`FEEL_TIMING`). The
   backbeat snare/comp sits a few ms BEHIND the anchored kick+bass (laid-back: country/soul/
   reggae) or AHEAD (tight: funk). The *relative* offset is the feel; the symmetric jitter can't
   make a consistent lean. **Tempo-dependent:** many genres swap sub-feel as tempo climbs (country's
   laid-back cross-stick backbeat at verse tempo → the driving `train_beat` buzz when pushed; a
   shuffle lazy at 70 BPM is frantic at 130). Author whether the genre has tempo-linked sub-feels
   and which tier they map to — don't pin one feel across the whole BPM range.
10. **Timbre / voice** — the actual SOUNDS: the kit, the bass voice (upright / electric /
    overdriven / synth), the comp voice (acoustic / clean / distorted / Rhodes), the keys voice.
    (`AUDIO_PROFILES` per genre.)
11. **Mix** — the loud layers (drums, bass) carry the genre signature; the comp must be PRESENT,
    not buried; per-genre EQ/space/loudness (`MIX_RECIPES`).

### 1.1 The per-genre worksheet (copy + fill — "set every one" as an artifact)

| Genre | Ensemble | Placement | Space (empty slots) | Voicing | Variation | Lock/interlock | Dynamics | Lean | Timbre | Mix | **Load-bearing dims** |
|---|---|---|---|---|---|---|---|---|---|---|---|
| _e.g._ country | comp+bass+drums+steel-pad | chord ON 2 & 4 | beats 1 & 3 empty (bass owns) | triad, low | comp `vary[]` | interlock (boom↔chuck) | ghost→backbeat | snare +13ms drag | acoustic/upright/soft kit | warm, comp present | placement · interlock · lean |

A row left half-blank is a band half-specified. The **load-bearing** column (§3 step 1b) is where
the by-ear tuning should concentrate.

---

## 2. The bright-line tests (run these BY EAR before declaring a genre done)

These are the failure modes the first pass hit. Each is a yes/no listening check, not a metric.

1. **The neighbour test** — *blind, does it sound like the WRONG adjacent genre?* If a listener
   could mistake it for a neighbour, a dimension (usually **placement**, **voicing**, or **space**)
   is wrong. The dangerous pairs to blind-test, and the dimension that MUST separate them:

   | This genre… | …must not sound like | The separating dimension |
   |---|---|---|
   | country chop | **reggae** | placement — backbeat (2&4) NOT every offbeat (the original miss) |
   | country / bluegrass | **polka / oom-pah** | placement — boom on 1 & 3, not the "&" |
   | country | **folk / singer-songwriter** | voicing register + chicken-pick/double-stop twang (a strummed open chord with no twang = folk) |
   | funk | **disco** | space + feel — funk syncopates around "the one" with holes; disco is a relentless four-floor 16th scratch, no holes |
   | blues | **rock** | feel (shuffle/swing vs straight) + voicing (dom7 vs power/triad) |
   | rock | **jazz** | voicing — triad/power, NOT rootless-mid shells (the "everything sounds jazzy" smell) |
   | gospel / neo-soul | **generic pop** | voicing density (extended/altered + passing chords vs plain triads) |
   | latin (bossa) | **lounge / easy-listening** | clave-locked syncopation, not a free rubato comp |
   | bluegrass | **country (drummed)** | ensemble — bluegrass is DRUMLESS, the guitar carries the time |

   When a band fails this test, fix the named dimension — don't re-EQ around it.
2. **The buried-comp test** — solo nothing; can you HEAR the comp's idiomatic rhythm, or only the
   drums + bass? If the comp is >~12 dB under the drums, the idiom is inaudible (mix/dimension 11).
3. **The robot test** — play 8+ bars; does the comp loop byte-identical? If yes and it's a comping
   genre, it needs `vary[]` (dimension 6).
4. **The lock test** — do the bass + kick + comp feel like one tight unit on the genre's pulse, or
   three independent parts? (dimension 7).
5. **The pocket test** — does it sit dead-on-the-grid and stiff, or does it breathe/lean? (dim 9).
6. **The "real band" test** — would a session player recognize their part? (genre-idiom's final call).
7. **The space test** — solo the comp: are the slots the genre leaves empty (beats 1 & 3 for a
   country chuck, etc.) actually empty, or has something crept in? A part with no holes is the most
   common "correct but inert" failure (dimension 4).
8. **The division-of-labor test** — solo the bass + comp together (no drums): do they interlock
   (each owning its beats) or collide (both hammering the backbeat)? Collision = a pile of parts,
   not a band (dimension 7 interlock).

---

## 3. The roll-out procedure (per genre)

1. **Convene** the genre-idiom agent (chair) + the lanes in §0 that apply (always include BOTH
   guitar- AND bass-pedagogy for any playable part; drum-pedagogy if drummed; piano if keys;
   harmony for voicing/progressions). Give them the CURRENT cells + the eleven dimensions.
2. **Name the genre's load-bearing dimensions first.** Before authoring, the chair states the 2–3
   dimensions this genre's identity hangs on (reggae: placement + space; metal: lock + timbre;
   country: placement + interlock + the laid-back lean; jazz: voicing + swing; funk: space +
   micro-timing). Author THOSE to perfection; the rest must merely be *right*. This focuses the
   by-ear tuning where it pays (and fills the worksheet's last column, §1.1).
3. The genre-idiom agent returns the band as **concrete, schema-valid data** (grids in the
   COMP_GROOVES / BASS_FIGURES / DRUM_GROOVES vocabulary; the recipe picks per tier; the
   AUDIO_PROFILES voices; the MIX_RECIPES + FEEL_TIMING values; the voicing style). Reconstruct
   nothing the agent can hand you — ask for the exact grids.
4. **Implement** as data edits to the guarded tables (no new engine unless a dimension needs a
   primitive that doesn't exist — then it's rhythm-meter/audio-engine's call).
5. **Verify**: the startup guards pass; a probe shows the resolved band (cells + voices + mix)
   differs in the data layer — **but treat a passing probe as necessary, NOT sufficient. A probe
   proves the DATA differs; only the EAR proves the BAND differs** (a perfectly-differentiated
   chart can sound identical through one shared kit/voice). Always dogfood by ear against §2.
6. **Tune by ear** (mix/lean values especially — these are first-pass numbers), then ship a beta.
7. **Record** the decisions; update this playbook if a new lesson emerges.

---

## 4. Standing lessons / gotchas (the durable warnings)

- **Probes verify DATA, not perception.** The chart can be perfectly differentiated while the
  audio sounds identical (timbre collapse) or the recipe never reaches playback (a persisted
  override). When a probe disagrees with the user's ear, the gap is real — find it; don't
  re-assert "the data shows it works." See `[[feedback_probes_mask_persisted_state]]`.
- **Persisted config can override the recipe.** Any path that does `Object.assign({}, readConfig(),
  …)` inherits the player's saved form state — and `backingComp`/`backingBass`/`backingDensity`/
  `backingPadDev` OVERRIDE the genre recipe. Jam clears them; audit any new playback path for this.
- **The cells were "correct" and still sounded inert.** Correctness (right onsets) is necessary,
  not sufficient — the feel is dimensions 3–9. Budget for them every time.
- **The "shared timbre masks correct cells" trap is the #1 false-pass.** Three genres can have
  three correct, distinct rhythm fingerprints and sound identical because they share one
  kit-sample-set and one bass voice. Differentiation is cells AND timbre AND mix — the data being
  right is the *floor*, not the finish (literally why "every genre sounded the same" despite a
  correct engine).
- **One uniform default makes every genre sound the same.** The shared jazz-piano voicing, the
  shared `kit_rock`, the silent Keys track, the flat dynamics — each was a "default that fits
  nothing." Per-genre is the rule; a shared default is a smell.
- **Author the band as one the player JOINS, not one that plays AT them.** Leave the player's
  idiomatic role idiomatically OPEN — a country band leaves room for the double-stop lead / the
  chicken-pick; don't fill the lead register with comp. The space the band leaves is where the
  learner plays (north star: the band teaches the idiom by *needing* the player to complete it).
- **Borrow before build** (CLAUDE.md rule 4) and **never build our own chord-detection DSP.**
- **Keep it a practice band, not a jukebox** (the north star) — the band is something to play
  AGAINST and learn the idiom from; no save/export-the-track button, ever.

---

## 5. Known refinements queued for the roll-out (worked examples)

These are deliberately-deferred Tier-2 items — good first tasks that show the playbook in action:

- **Next-chord-aware bass generators** (e.g. country): a `kind:'gen'` bass that walks into the
  ACTUAL next chord's root (vs the pattern's generic 6→♭7 climb). Reuse `bassWalkEvents`' approach
  logic. A per-genre refinement once the pattern is proven.
- **Per-genre `vary[]` banks** for the comping/riff genres beyond jazz+metal (gospel, funk,
  city-pop, afrobeat…) — each its idiom agent's authored set.
- **The P1 sample sets** (brushed kit, modern-metal kit, Latin-percussion kit) — the timbre
  ceiling for several genres; CC0 curation, gitignore-until-cleared.
- **Per-lane consistent timing offsets** beyond the backbeat (a true Dilla/J-pop micro-feel) if a
  genre needs it — rhythm-meter's `FEEL_TIMING` extends naturally.

---

## 6. Genre-agent buy-in

> **country-idiom-architect (2026-06-13) — RATIFIED.** The "right notes ≠ right band" principle is
> sound — it is the exact lesson the country band taught (correct triads, wrong placement = reggae).
> The dimension spine is the right skeleton. Required additions, now folded in: **(1) Space/density-
> as-identity** as a first-class dimension (what a part leaves empty is as genre-defining as what it
> plays); **(2) Interlock** alongside the lock (parts that groove by NOT overlapping — the country
> boom-vs-chuck labor split); **(3) tempo-dependence/sub-feels** on the micro-timing dimension;
> **(4) the concrete neighbour-confusion table** + the space and division-of-labor bright-line tests;
> **(5) the "load-bearing dimensions first" step** + the per-genre worksheet (§1.1). With those, this
> is the checklist that would have caught the reggae-skank miss before ship.

Each genre's band is ultimately its OWN idiom agent's call against this checklist — ratify per genre
as the roll-out reaches it.
