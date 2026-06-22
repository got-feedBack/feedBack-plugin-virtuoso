# Genre Vocabulary Playbook — adding a riff/motif pack WITHOUT a charette

*2026-06-12. The reusable process distilled from the full riff-vocabulary charette (all 29 genre-idiom agents + the 6-lane cross-cutting panel — see `docs/riff-vocabulary-roundtable.md` for that charette's spec and decision log). This playbook is the deliverable Christian asked for: once the MOTIF_CELLS engine exists, adding a genre/subgenre vocabulary pack is a CHECKLIST plus a handful of named consults — never a full charette, unless an escalation trigger fires.*

## What a vocabulary pack is

The missing **vocabulary layer** of a genre ladder (vocabulary → technique → application → improv): rungs that teach a genre's trademark riff/lick/motif **devices** as transferable skills. Every motif rung is one arc:

**NAME → DRILL → VARY → CONSTRUCT → JAM**

| Step | Maps to | Rule |
|---|---|---|
| NAME | the goal-card | Carries the whole anti-library load (see card standard below). |
| DRILL | `base` + `tempoTiers` | The cell in one key/position. Honor the beginner density floor — a busy figure enters half-time/augmented at tier 0. |
| VARY | `vary[]` | **One axis per rung** (heterogeneous vary[] = design smell), labelled by axis: Transposition / Ending-resolution / Rhythmic-placement. |
| CONSTRUCT | a `call_response` variant | **Non-negotiable, ships day one** in every pack: backing plays a phrase using the device; the player assembles THEIR OWN answer from it. |
| JAM | the genre's existing Jam rung | Hand off by prereq edge — never duplicate the jam. |

**Tier policy (inverted from the rest of the app): TRANSPOSITION-coverage is the primary mastery axis for a motif, not tempo.** A lick clean in 5 keys is a transferable device; the same lick at 200 BPM in one key is a parlor trick. tempoTiers stay but short (2–3) and secondary.

**A pack is NOT a band.** Devices deepen the genre's existing pack (3–5 motif rungs slotted after the enabling technique rung, before/beside the application rung, with prereq edges both ways). A new band only when the genre has no ladder at all (the "bootstrap" case — then a small `concept_<genre>_*` pack mirroring `concept_intervals`).

## The four bright-line checks (market-analyst's tripwires — every reviewer applies these as yes/no)

1. **Construction-step present?** Is there ≥1 rung where the *player* assembles the device into their own phrase (chooses notes/order/rhythm)? No construction rung = faucet → **reject**.
2. **No canned song?** Every exemplar ≤ ~2 bars, names the device, no recognizable hook. *The test: if a reasonable player would name a real song on hearing it, it's a de-facto cover → FAIL.* A device exemplar should be **forgettable as music and clear as grammar**.
3. **Goal-card transfer claim?** The card names the device in the player's vocabulary AND states what they can build off-screen — never describes the output ("a cool riff").
4. **The silent-audio sniff test (the headline check):** if the generated audio never played, would the rung still teach the device (named grammar + construction task + notation)? If it only "works" because the audio sounds cool, the audio IS the deliverable = faucet.

**Legal lines (always):** no transcriptions of copyrighted recordings; no artist/band/song names in tracked files; allowed classes = **technique device** / **traditional common-stock figure** / **original exemplar written in-style** (subject to check #2).

## The goal-card standard (3 required parts, no boilerplate)

1. **Name the device** — the term a player says out loud.
2. **Why it's idiomatic** — one *device-specific* clause about where it lives in a tune (the turnaround at the end of the 12-bar; the G-run as the punctuation before the vocal). A clause that fits any device fails.
3. **The transfer claim** — what they own off-screen, naming the construct step ("drill it in every key, then build your own from it").

## The pipeline (who does what)

```
1. Genre-idiom agent → DEVICE MAP (standardized format below)
2. harmony-theory-architect → verify cells (degree spelling, anchors, the resolution landing)
3. [conditional] rhythm-meter-architect → verify time (only swing-unusual / pickup-heavy / displacement cells)
4. Target instrument-pedagogy agent → playability pass (the acceptance checklists below)
5. Main thread → author MOTIF_CELLS entries + rungs; wire band/edges; run the smoke net
   (smoke-generators enumerates new rungs for free; assertMotifCellsValid guards the table at load)
6. Bright-line checks 1–4 applied by the main thread before "done"
```

**Mandatory consults (every pack):** the genre's idiom agent · harmony-theory-architect · the target instrument's pedagogy agent.
**Conditional consults:** rhythm-meter (non-trivial time only) · the *other* instrument's pedagogy agent (only if an adapted rung ships) · sound-design (only a new audio profile / tone-dependency) · drum-pedagogy (only a new DRUM_GROOVES feel) · ux (only a new picker/display surface).
**Escalate to a full charette ONLY when:** the genre needs a NEW band · a device needs an engine primitive MOTIF_CELLS can't express (new articulation, non-4/4 meter pre-v2) · the construct surface itself needs redesign.

## The device-map request format (the standardized idiom-agent prompt)

Ask the genre agent for **3–5 trademark devices, ranked by identity-defining-ness × teachability**, each with:

- **Name** (the genre's own term) · **Why idiomatic** (1 line, the goal-card seed) · **Legal class**
- **Cell sketch** — degrees relative to key/chord, rhythm in subdivisions (author straight; swing post-processes), articulations, pickup/anacrusis flagged, open-string dependencies flagged
- **Anchor** — static chord vs follows changes (+ the progression token)
- **Transpose plan** — keys/positions that stay idiomatic; register guidance (bass gradable onsets ≥ D2)
- **Instrument fit** — guitar/bass native / adapted / n-a, and HOW the other instrument realizes it; piano-centric devices flagged piano-banked
- **Feel/backing need** — what the backing must provide; flag if gated on an unshipped backing/drum primitive
- **Construction prompt** — the literal "build your own" instruction

Plus one line on where the pack slots vs the genre's existing ladder. Remind the agent: devices not songs; no artist names; check what the genre already ships and don't duplicate.

## Acceptance checklists (the pedagogy review passes)

**Guitar (guitar-pedagogy-expert):**
1. Span ≤ 4 frets (≤ 3 below fret 5) in every drilled position; 2. no same-finger two-string collision (rolls flagged as rolls); 3. articulation-on-the-right-string (no whole-step bend on low E in position 1; tremolo stays on one string); 4. no-unison guard respected by the resolver; 5. per-articulation `bpmCeiling` (bend cells cap LOW); 6. the **12-key × position transposition sweep** — every result passes 1–5 or falls back to a declared variant.

**Bass (bass-pedagogy-expert):**
1. **Register floor** — gradable (non-`mt`) onsets ≥ D2, else the rung can't be feltGate'd (no lenient path → unclearable) → %-gate + coverage line instead; 2. reach — no >3-fret span under four fingers below fret 5 without a coded shift; 3. RH feasibility at coded tempos (16th motor breaks >~95 BPM; slap flips reliable ≤ 90); 4. one note per onset (a device defined by simultaneity is bass-n-a); 5. octave-shift sanity (`octaveShift:-1` re-seats into a playable box, never below the open string).

**Bass realization policy (by device class, no re-ask needed):** NATIVE = the bassline IS the trademark (soul counter-line, riddim, tumbao, boogie, octave figure) — render verbatim, feltGate default for groove cells; ADAPTED = a single-line melodic device — octave down, %-gate (pitch contour is the skill); n-a = the trademark is chordal/multi-voice (double-stops, harmonized twin leads, rolls). Construct + jam phases are always unscored mirror, every class.

## Open-string devices: the two-rail rule

Every open-string-dependent device ships **two rails**: a key-pinned `open_anchor` variant (valid only in the keys where the opens are scale/chord tones — the authentic sound) AND a movable `closed_required` variant (the transferable drill axis, the rung's real skill). No auto-capo crutch; capo only as an explicit opt-in. An open cell with no closed variant fails the transposition sweep and is blocked from the drill axis.

## Schema cheat-sheet (authoring a MOTIF_CELLS entry)

Full spec: the roundtable doc §schema. Shape: `{ label, genres[], bars (1|2), meter:'4/4' (v1), bind:'static'|'changes', prog (token, owned by the cell), scale, pickup (beats, <1 bar), range:{loMidi,hiMidi} (octave-FOLD, never clip; noFold widens), openPolicy, positionFrame+maxSpan, harmonyInterval ('third'|'sixth' — twin-lead via the harmonize machinery, never a hand-stacked second voice), bpmCeiling, steps:[{a:'key'|'chord'|'target', deg|chr, acc, tgt, oct, stack, d (beats), art…}] }`. Author straight — swing is the feel layer. Time-variation = the two flags `startBeat` + `rhythmScale` only; pitch variants are a second authored entry. The startup guard `assertMotifCellsValid` proves every cell resolves in-range and lands its declared resolution in all 12 keys × declared positions.

## Rollout discipline (market's gate — standing)

Never batch-build the matrix. Pilot first; **batch 2 is gated** on: (a) ≥1 real tester completes the construction step, (b) ≥1 "I made a thing / took it to Jam" signal, (c) nobody says "it gave me a riff" (the drift tell — if testers credit the tool with the output, the framing failed). The honest community framing: *it won't write your riff for you — it teaches you the moves so you can.*
