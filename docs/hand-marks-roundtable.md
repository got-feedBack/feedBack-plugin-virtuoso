# Hand-Marks Roundtable — pick direction, finger numbering, ergonomics

*2026-06-06. Nine-lane panel (guitar-pedagogy, bass-pedagogy, feedback-compatibility, virtuoso-ux-designer, learning-design + four narrow idiom consults: metal, bluegrass, gypsy-jazz, classical). Full per-lane rulings in each agent's memory (`.claude/agent-memory/<agent>/`); this is the synthesis, schema, and build plan. Christian's call: commit the day's batch, then build Slice 1.*

## HOST CHECK

- **Capability:** pick-direction + finger-numbering data + display.
- **What the host has:** per-note `pkd` (0=down/1=up, `docs/sloppak-spec.md:274`, model `lib/song.py:39` — populated only by arrangement-XML import; **zero renderers**); per-note `rh` (pluck-hand finger, enum 0=p,1=i,2=m,3=a,4=c via the arrangement-XML toolchain; unrendered); chord `templates[].fingers[6]` — **rendered TODAY** by highway_3d's finger ghosts (`highway_3d/screen.js:10425,:11266`, on by default via `h3d_bg_*`), and **our bundle already feeds it** (`makeBundle` passes `chordTemplates` through; CAGED authored `fg` flows end-to-end). No per-note fret-hand field. `gp2rs.py` DROPS GuitarPro `pickStroke` + fingering data (the frontend documents the gap, `static/highway.js:3400`).
- **Evidence + date:** source-read 2026-06-06, feedback-compatibility (memory `reference_fingering_pickdirection_surface`).
- **Verdicts:** chord-fingering display = **BORROW (already live — the work is data quality)**; per-note fret-hand display = **BUILD** (our Tab/Notation/strip); pick-stroke display = **BUILD, but ADOPT the host's `pkd` data contract verbatim** (if the host ever renders it, our notes light up free).
- **Host-ask (upstream, low-cost):** gp2rs read GP `pickStroke` → `pkd` + GP fingerings → `templates[].fingers`.
- **Flips:** a host per-note finger render/spec field; a highway `pkd` glyph; numerals in the host chord-diagram panel.

## Schema (settled by convergence — no invention)

| Field | Range | Meaning | Rules |
|---|---|---|---|
| `fg` | 0–4 (0=open) | fret-hand finger | OPTIONAL — **omitted = no prescription (the honesty rule: a wrong digit is actively harmful; omit on heuristic paths e.g. full_neck Phase 1)**. Keep the resolver's existing name (`fn` collides with harmonic function on backingEvents). |
| `pkd` | 0/1 | pick stroke down/up | host ints verbatim; omitted = player's choice. Never on legato (`ho`/`po`)/tapped/`rh` notes. |
| `rh` | 0–4 | pluck-hand p/i/m/a/c | host enum verbatim; bass i-m/slap/pop + future fingerstyle. |

**Guards (no-unison pattern):** a note sets at most ONE of `pkd`/`rh`; simultaneous notes (same `t`/`ch`) must not share an `fg` at different frets (the double-booked-finger class — shipped twice before in grip data); mechanics asserts (ho/po target ≠ origin finger; full bends re-finger 4→3; sweep same-fret rolls share `fg`); per-policy asserts (gypsy: `pkd:1` ⇒ same string as previous picked note).

## Core rulings (one line each — details in agent memories)

- **Fingering is severed at one line:** resolvers emit validated `fg`; `shapeNotesToPositions` (≈screen.js:4302) drops it. Re-plumb = the bulk of the curriculum for free.
- **Direction-invariance:** fingering belongs to the SHAPE, not the run; a taught box's canonical fingering beats seam optimization; shifts re-anchor (1 ascending / 4 descending); slides fingered from the target side; spider = 1-2-3-4 frames; ONE 3NPS school (the shipped index-anchored lookup).
- **Bass:** dual regime — 1-2-4 below index-anchor fret 5 (Simandl), 1-2-3-4 above — via a new pure `bassFingerFor`; bass NEVER routes through `scaleFingerFor`. **Fix-first: the bass_foundations chromatic window moves frets 1–4 → 5–8 before display ships.** Plucking: `rh` i-m by sequence parity (ghosts count; octave_groove assigns BY STRING i=root/m=octave; rakes = same-finger consecutive descents, tier-gated, no new field).
- **Picking policies are per-genre pure functions, never a universal default:** bluegrass = position-derived (on-beat down; slurs transparent; crosspick `d-d-u` vs alternate behind a flag); gypsy = string-change ⇒ down, ups only same-string fill (strict school default; "hybrid crossings" an explicit flag); metal = alternate + force-`d` on accents/stabs + all-`d` palm-muted 8ths ≤ `downpickCeilingBpm`≈170 with **per-tier policy flips across the ceiling**; gallop `D-DU`; tremolo never re-anchors; sweeps directional (ascend `d`, descend `u`, apex legato); classical = `rh` formula patterns (tremolo p-a-m-i = explicit notes, never the `tr` flag).
- **Display (UX):** Tab = fixed lanes (pick lane above staff, finger lane below, mono ink, canvas-stroke ⊓/∨ glyphs) + **mandatory simile decimation** (at 16th density: bar-initial pair + alternation-breaking strokes only; fingering thins to shifts/crossings). Notation = numerals opposite the stem (`fg` 0 kept in notation, omitted in tab). Strip = finger digits in the HOLLOW pattern dots only (live dot keeps fret); stroke cues on the strip REJECTED; shift telegraph reuses the Jam ghost grammar (dashed, ~1.5 beats, own string colors). 3D highway: data pass-through only, never drawn on.
- **Toggle:** ONE pill ("Fingering"), view-bar after Fretboard view, default ON, persisted (`virtuoso.showHandMarks`), never auto-flipped. Band scaling happens content-side (emission policy), not by flipping the user's switch; the **Clean depth rung** is the player-opted supports-off proving run (its first concrete mechanic).
- **Curriculum (L&D):** scaffold-vs-content per rung (`strokePolicy` declares where glyphs ARE the lesson — pick_alternate — and never fade there); `fg` fades faster than `pkd`; re-scaffold on novel material. One new rung: `pick_economy` (the band's crossing-strategy gap); `chromatic_warmup` declares `strokePolicy:'alternate'`. Claims = "built for [discipline]", NEVER "verified" (stroke direction is structurally undetectable; shown-not-judged, declared at authoring; no self-attest checkbox).
- **Ergonomics:** a `FORM_CUES` library (guitar 12 + bass 9+1), priority rung-specific > tier-triggered (tension cues belong to the Fast/Push stage globally) > band-default; **max one cue per run; cues never fade; goal-card only** (the resting strip is detector-gated and the judging-honesty surface); never mid-run, never detection-triggered ("we cannot see the hands — auto-firing a form cue off a missed note is fake diagnosis").

## The unanimous constitution

**Nothing ever scores, gates, or XPs on `fg`/`pkd`/`rh` — display/teach only, forever** (every lane independently; undetectable = unjudgeable). No prescriptions in Jam. Honesty by omission. Schools that legitimately differ ship as flags/goal-card prose, never silently legislated (proper nouns stay out of tracked files).

## Build plan

**Slice 1 (approved):** re-plumb `fg` through positions→notes · `bassFingerFor` + instrument dispatch · the bass chromatic window fix (5–8) · the load guards · `pkd` for the definitive cases (alternate runs via `strokePolicy:'alternate'` on chromatic_warmup, sweeps, tremolo, gallop via RHYTHM_CELLS `strokes`) · Tab/Notation/strip display + decimation + the Fingering toggle.
**Slice 2:** the policy engine (per-rung `strokePolicy`, per-tier ceiling flips, genre policy functions + flags) · `pick_economy` rung · bass `rh` emission (parity/by-string/rakes) + right_hand_technique drill marks · `FORM_CUES` + the goal-card cue line · the Clean-rung proving affordance · the strip shift telegraph · vary candidates (outside-vs-inside crossings).
**Slice 3 / host asks:** the gp2rs upstream contribution; watch for a host `pkd` renderer + diagram numerals; chord-template heuristic fingers get a pedagogy pass (the already-live ghost borrow's data quality).
