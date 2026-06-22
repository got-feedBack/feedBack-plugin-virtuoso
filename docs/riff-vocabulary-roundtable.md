# Riff-Vocabulary Charette — synthesis spec & decision log

*2026-06-12. Main-thread synthesis of the FULL riff-vocabulary charette: a 6-lane cross-cutting panel (learning-design CHAIR · harmony-theory · rhythm-meter · guitar-pedagogy · bass-pedagogy · market-analyst as drift guard) + ALL 29 genre-idiom agents, each returning a standardized 3–5-device map. Per-lane detail lives in each agent's `.claude/agent-memory/<agent>/` (every agent wrote its ruling there). The reusable process this charette distilled is `docs/riff-vocabulary-playbook.md` — future packs use the playbook, not a charette.*

**The initiative:** the missing **vocabulary layer** of genre ladders — a degree-relative `MOTIF_CELLS` table + one `buildMotifExercise(cfg)` generator teaching trademark genre devices (the jazz lick, the bluegrass G-run, blues turnarounds, chicken-pickin' cells, twin-lead phrases…) through the arc **name → drill → vary → construct → jam**. Bright lines: devices not songs; the construction step ships day one; never a riff library/faucet (the market bright-line ruling, reaffirmed this charette).

## HOST CHECK

Not required — `MOTIF_CELLS` + `buildMotifExercise` live in the generation-path core (§1–§10), which never needs one (the host will never ship our USP). The articulation additions ride the existing exercise schema.

## 1 · The reconciled MOTIF_CELLS schema (the build target)

Harmony owns pitch, rhythm-meter owns time, guitar/bass-pedagogy own playability constraints; the main thread reconciled their three specs into ONE cell shape (divergences resolved in the decision log):

```js
some_cell_id: {
  label, genres:[], bars:1|2, meter:'4/4',          // v1 is 4/4-ONLY (D5)
  bind:'static'|'changes', prog:'<token>', scale,   // a changes-cell OWNS its progression (D2-F1)
  pickup: 0.5,                                      // anacrusis in beats, < 1 bar (D4)
  range:{loMidi,hiMidi}, noFold:false,              // octave-FOLD, never clip
  openPolicy:'closed_required'|'open_anchor',       // the two-rail rule (D6)
  positionFrame:'<shape|anchor>', maxSpan:4,        // resolver places; gate rejects overflow (D7)
  harmonyInterval:'third'|'sixth',                  // twin-lead via the HARMONIZE machinery (D8)
  octaveShift:-1,                                   // bass-ADAPT re-seat (never blind −12)
  bpmCeiling: 120,                                  // per-articulation cap (bend cells cap LOW)
  startBeat:0, rhythmScale:1,                       // the ONLY two time-variation flags (D3)
  steps:[ { a:'key'|'chord'|'target', deg|chr, acc, tgt:'3'|'7'|'R'|'5',
            oct, stack:[…], d:0.5, /* + existing art fields, + bt */ } ]
}
```

- **Pitch** (harmony): `a` = the anchor each offset is measured from; `deg` (diatonic degree of the cell's scale, + `acc`) for everything in-scale; `chr` (raw semitones) ONLY for chromatic approaches; `a:'target'`+`tgt` resolves against the chord timeline's `cpcs/gpcs` — the turnaround lick landing the I's 3rd is the same machine Connect proves. `stack` = in-cell double-stops (emitted as same-`t` `ch`-group dyads).
- **Time** (rhythm-meter): per-step `d` in beat-units (quarter=1; sum guard on the bar total); **author straight — swing is the existing post-process feel layer**; held final note = a long `d` → `sus`. `pickup` notes land in the lead-in bar (count-in forced ≥1 bar when `pickup>0`); loop tiling of a pickup is FREE via the existing `_tail` mechanism.
- **Articulation** (guitar-ped): reuse the existing note fields (`sl/slu/ho/po/vb/tr/tp/pm/mt/ac/pkd/rh/ch`). **ONE new field: `bt` (bend intent — up/release/pre-bend/pre-bend-release/round-trip)** + allow `bn:0.25` (the blues quarter-curl). v2 articulation batch (deferred, gates noted in §4): rake-as-field, oblique two-target bends, tremolo-arm gesture, rasgueado/golpe/alzapúa.
- **Guard:** `assertMotifCellsValid` throws at load — every cell × 12 keys × declared positions resolves in-range, AND a `changes` cell's declared resolution step lands on a pc in the resolving chord (`cpcs`). Plus the bar-sum and `pickup < beatsPerBar` guards. The no-unison guard does NOT apply (a motif legitimately repeats pitches; motif emission bypasses the shape resolver).

## 2 · Decision log (main-thread reconciliations)

- **D1 — One steps[] array, per-step `d`.** Harmony put duration in the step token; rhythm-meter specced a parallel `rhythm[]`. Adopted harmony's step shape carrying rhythm-meter's conventions (beat units, sum guard, straight-authoring). One array, no parallel-index bugs.
- **D2 — A changes-cell OWNS its progression** (harmony F1): the turnaround IS its changes; it travels with its `prog` token rather than inheriting the pathway's.
- **D3 — Time variation = `startBeat` + `rhythmScale` only.** Displacement and augment/double-time are schema flags; pitch/ending variants are a SECOND authored cell (the construction step + harmony's lane, never schema-generated).
- **D4 — Anacrusis via `pickup`** + forced count-in + `_tail` tiling (rhythm-meter; load-bearing — the jazz lick, the slow-blues pickup, and the funk &-of-4 push all start before the beat).
- **D5 — 4/4-only v1.** Odd/compound-meter cells are v2-banked WITH content waiting: prog's 5/4–7/8 siblings, norteño's vals 3/4 + true huapango hemiola, emo's shifting-meter twinkle, folk's 6/8 jig cut. (The folk jig is therefore pilot-ineligible despite being authored.)
- **D6 — The open-string two-rail rule** (guitar-ped + emo converged): every open-string device ships a key-pinned `open_anchor` variant AND a movable `closed_required` variant; the closed rail is the drill/transposition axis; no auto-capo.
- **D7 — Resolver places, cell constrains** (guitar-ped): `positionFrame` + `maxSpan` + a playability gate, honoring the repo's explicit-shape-keys rule.
- **D8 — Twin-lead = the harmonize machinery over a single-voice cell** (guitar-ped + harmony F2): `harmonyInterval` as a diatonic degree stack (3rds/6ths vary correctly per scale step); never a hand-stacked second voice. In-cell dyads (`stack`) stay for double-stops.
- **D9 — Tier policy inverted: TRANSPOSITION-coverage is the primary mastery axis** for a motif; tempoTiers short (2–3) and secondary (L&D).
- **D10 — A pack is NOT a band** — devices deepen the genre's existing pack; a small `concept_<genre>` pack bootstraps only ladder-less genres (L&D; most genre agents independently proposed exactly this).
- **D11 — Bass policy** (bass-ped): device classes NATIVE (render verbatim; groove cells default feltGate) / ADAPTED (octave-down single line; %-gate — the pitch contour is the skill) / n-a (simultaneity-defined devices). Gradable onsets ≥ D2 or the rung can't be felt-gated (the unclearable-rung trap). Construct + jam phases are always unscored mirror.
- **D12 — Rollout** (market): pilot 2 rungs; **batch 2 gated** on (a) a tester completing the construction step, (b) an "I made a thing" signal, (c) nobody crediting the tool with the output. Programs-vs-batch-2 re-evaluated with pilot signal — never pre-commit the matrix.
- **D13 — OPEN (load-bearing, resolve during pilot build):** does `call_response` present a REAL construction surface (a prompt + a blank answer window the player fills) or just alternate fixed lines? L&D flagged; market's gate (a) depends on it. If the latter, the construct step needs a small build — verify before the pilot ships.

## 3 · The 29-genre device digest

One row per lane; full maps in each agent's memory. ★ = proposed pilot. (bootstrap) = genre has no ladder; pack would bootstrap a small concept pack.

| Lane | Top devices (ranked) | Standout flags |
|---|---|---|
| **Blues ★** | Descending-3rds turnaround · BB-box cell · slow-blues pickup · boogie walk-up | Turnaround = the HELD-rung unlock; wants `bn:0.25`; slow-blues 12/8 backing gap |
| **Metal ★** | Tapped-arpeggio cascade · **harmonized twin-lead phrase** · breakdown half-time displacement · neoclassical pedal lick | Twin-phrase = the melodeath ROADMAP gap; breakdown exposes kick-coupling |
| Jazz | The lick · chromatic enclosure · bebop turnaround tag · horizontal blues-riff | Pickup-heavy (D4); tag gated on swing backing; slots after Guide-Tones/Connect |
| Country | Cluck-and-pop (chicken pickin') · oblique pedal-steel bend · 6ths slide · open-string pull-off cascade | Ships the two enhancements the country rungs flag as missing; train-beat drum gap; correction: country pack is 6 rungs, not 1 |
| Bluegrass (bootstrap) | G-run · walking connector · crosspick roll · fiddle-tune tag | G-run = chord-ARRIVAL anchor + the open-string poster child; two-feel backing check |
| Rock | Double-stop bend-release · open-position boogie I-riff · pentatonic cascade · sus-resolve hook | Leans on ring/mute per-hit + bright-modal tokens (both previously-logged gaps) |
| Funk (bootstrap) | **Pickup-to-the-one** · unison 16th riff · stab-and-scratch · octave-bounce · slap-pop call | Jam capstone gated on the dorian i7–IV7 vamp token (standing #1 funk gap) |
| Soul/Motown (bootstrap) | Anticipated-change push · melodic counter-line · root-3-5-6 walkup · 12/8 ballad climb · backbeat stab+fill | Bass-led feltGate pack; 12/8 triplet backing gap |
| Reggae (bootstrap) | One-drop riddim · skank-and-answer · rockers driving-root · dub drop-and-return · ska walking-upbeat | One-drop groove EXISTS (ungated); rockers four-floor variant gap; rests are the vocabulary |
| Disco | Octave-bounce-WITH-fill · scratch + the one stab · walk-up-into-chorus · string-stab figure · clipped dom9 line | Goes beyond shipped bass_octave_groove; offbeat OPEN-HAT check (the lift) |
| Latin (bootstrap) | Tumbao · bossa comp cell · montuno fragment · baião/samba bass | Every device states its clave relation; hybrid bass/guitar split pack like intervals |
| New Orleans (bootstrap) | Rhumba-boogie bass · big-four accent · second-line strut · triplet fill | The tresillo [3,3,2] atom is SHARED with latin/tango/norteño — build once; second-line drum check |
| Gospel | Walkup I→IV (+passing dim) · approach-chord slide · amen/backdoor turnaround · shout drive cell | 3 new progression tokens needed; shout = drum-gated; 2 devices piano-banked |
| Ragtime/Boogie | Eight-to-the-bar boogie bass · walking-6ths · cakewalk syncopation (straight!) · boogie turnaround · stride oom-pah | Player-side bass EXCEEDS the shipped backing line (suppress backing bass); stride leap piano-banked; cedes continuous Travis to folk |
| Country's sibling — Norteño (bootstrap) | **Requinto corrido fill** · bajo-sexto oom-pah · tololoche polka bass + chromatic walk · huapango 3+3+2 | Audience-weighted: corridos tumbados demand; vals 3/4 v2-banked |
| Gypsy jazz (bootstrap) | Arpeggio-chase climb · diminished enclosure · minor-6 cadence lick · octave melody | HARD GATE: no la pompe comp cell in the backing — can't claim an authentic pack until it ships |
| Flamenco (bootstrap) | Andalusian cadence figure · picado run · pulgar thumb melody | Ships today picked; rasgueado/golpe/alzapúa = v2 articulation gaps; compás accent cell routed to the rhythm engine, NOT a motif |
| Folk/Celtic (bootstrap) | Travis pinch cell · DADGAD drone-and-melody · jig cut (6/8 — v2) · hammer-from-nowhere | NO fingerstyle rung ships today — whole lane open; 6/8 + drone-bed backing gaps; cedes walkup to bluegrass |
| Classical | p-i-m-a arpeggio study · campanella (gated) · cadential ornament · appoggiatura · Alberti figure | Étude tradition = ideal legal ground; campanella needs independent-voice sustain |
| Prog | Shifting-cell figure (3-over-16ths, 4/4-legal!) · quartal cell · legato burst · post-rock swell arp | 5/4–7/8 siblings v2-banked; swell needs a dynamics flag |
| Emo (bootstrap) | Twinkle cell · tapped-cascade twinkle · add9 double-stop slide · quiet-loud flip | Open-string two-rail poster child; cedes octave-lead to punk; shifting-meter twinkle v2 |
| Punk (bootstrap) | Octave-lead hook · three-chord turnaround push · pm→open dynamic flip · D-beat cell · post-punk angular line | Tempo floors 150–180 stress-test backing/judge; the "push" needs the judge to credit an intentionally-early hit |
| Pop | Vocal-answer tag · arpeggiated four-chord figure · staccato octave motif · pre-chorus lift | Wants a "vocal placeholder" backing slot; four-on-the-floor backingStyle outstanding |
| City pop | Sliding double-stop hook · maj9 stab-and-scratch · busy fusion bass fill · broken-maj9 arp · funk-lite line | Stabs MUST route through voiceChord (mud risk); swung-16th gloss pocket |
| Hip-hop fusion | Neo-soul double-stop slide · triplet-hat run · tapped-harmonic chime · 808-answer bass | Drums COVERED (halftime/trap ships); 808 cell has a real sub-floor register problem |
| Surf (bootstrap) | Tremolo descending run · low-E glissando dive · staccato muted figure · exotic-scale melody | Spring-reverb tone = hard sound-design dependency on every rung |
| Shoegaze | Drone-shape cycle · bass carry-line · octave-haze lead | HONEST DEFER of the full pack until the effects chain exists; bass carry-line is pilot-grade |
| Afrobeat (bootstrap) | Tension-guitar ostinato · highlife arpeggio · bass ostinato · interlock-answer · horn-stab line | The construction step is the marquee ("write the second guitar part"); gated on an afrobeat DRUM_GROOVES entry |
| Tango (bootstrap) | Marcato bass + arrastre · 3-3-2 síncopa stabs · minor walkdown · milonga habanera · octave fragment | NO drums in tango — needs a marcato comp groove instead; arrastre ≈ `slu` scoop v1 |

## 4 · Engine-gap registry (consolidated from all lanes)

**Schema/articulation (v1 build):** `bt` bend-intent field · `bn:0.25` quarter-curl.
**Schema/articulation (v2 batch, content waiting):** rake-as-field · oblique two-target bends · tremolo-arm gesture · rasgueado/golpe/alzapúa · independent-voice sustain (campanella) · dynamics/swell flag · non-4/4 cells (the D5 bank).
**Backing/feel (each unlocks named rungs):** la pompe comp cell (gypsy — HARD gate) · 12/8 triplet ballad + slow-blues 12/8 · train-beat (country) · rockers four-floor reggae + dub dropouts · second-line (NOLA) · afrobeat bell groove · marcato tango comp (no-drums) · polka two-feel (norteño) · 6/8 jig lilt + DADGAD drone bed (folk) · four-on-the-floor backingStyle + vocal-placeholder slot (pop) · offbeat open-hat check (disco) · shout double-time (gospel) · two-feel boom-chuck check (bluegrass).
**Harmony tokens:** dorian i7–IV7 vamp (funk — standing #1) · gospel_walkup_I_IV / gospel_amen[_backdoor] · bright-modal tokens (rock — standing).
**Judging:** the punk "push" (crediting an intentionally-early hit) · sustained sub-bass gradability (hip-hop 808 cell).

## 5 · The pilot (next build, per D12)

**Two rungs:** the **blues descending-3rds turnaround** (unlocks the HELD turnaround rung — its token is exactly MOTIF_CELLS) + the **metal harmonized twin-lead phrase** (the melodeath flagship ROADMAP gap, exercising `harmonyInterval`/D8). Engine scope: the §1 schema + `buildMotifExercise` + `assertMotifCellsValid` + the `bt`/`bn:0.25` articulation adds + **resolving D13** (the construct surface). Both rungs ship with their construct step; smoke rows land in the suite that owns the system (`smoke-generators` enumeration covers the rungs for free; the cell-table guard rows join the generator suite).
