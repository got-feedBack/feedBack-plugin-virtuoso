# Jam-Session / "band follows player" — panel roundtable

**Date:** 2026-06-14 · **Status:** BRAINSTORM synthesis — **no decisions made** (per Christian's instruction). Decisions pending.

## Trigger
A FeedBack dev-team Discord thread proposing a reactive **"Jam-Session mode" (band FOLLOWS player)** — detects your rhythm/key/mode, follows tempo, switch off whichever instrument you play, theory hints + the "why," a Spotlight/rotate-leader mode, multiplayer, "leverage the minigame SDK," a modular band of "musicians as param-collections" (swap the black-metal drummer for an EDM one) offered as a community capability. A separate bmad repo + UI mockup exist; Christian may collaborate. Plus Christian's live ask: clicking a new style mid-jam should switch the band instantly.

Christian's questions: pivot to band-follows-player or keep player-follows-band? per-instrument style/personality? cross-functional instruments (metal drums over zydeco, jazz piano over punk)? Compare to what we have / the market / the realistic best design. **Don't decide — brainstorm + compare.**

## Panel (10 lanes — all reported; per-lane detail in each `.claude/agent-memory/<agent>/`)
audio-engine (chair) · harmony-theory · rhythm-meter · notedetect · slopsmith-host · market · learning-design · gamification · drum-pedagogy · metal-idiom.

---

## THE HEADLINE (near-unanimous)
**Player-follows-band (what we have) and band-follows-player (the dev team's vision) are DIFFERENT PRODUCTS solving different jobs — this is a "both / collaborate" call, NOT a pivot.** Keep ours; the reactive one is the dev team's / host's to build (it's host-platform-sized); the one idea worth grabbing *now* is the **Spotlight form** — which is Christian's own "every member solos" back-pocket idea, panel-validated.

---

## Q1 — Pivot / keep / both?
**BOTH, asymmetrically. KEEP player-follows-band** as the apply/mastery rung.
- A band that *conforms to you* **hides your drift** — it removes the one thing the apply rung trains (transfer under a steady constraint). (learning-design, rhythm-meter, metal-idiom)
- Band-follows-player is a *different job* (a reactive theory sandbox for beginners), not a "better Jam."
- It is **largely NOT feasible for Virtuoso to BUILD, and not the wedge:**
  - **Feasibility (notedetect — the linchpin):** the detector is a *target-matcher* (no "what you played" emit). **Key-follow** = feasible-now but off the **YIN pitch stream we already read** (count pitches → key histogram; *not* DSP, corollary-safe), coarse/mono. **Chord-follow** = host-ask, never our DSP. **Tempo-follow** = mirage. Latency punishes *following*, not *mirroring*.
  - **Market:** it's **3 hard products stacked** (real-time polyphonic detection + an adaptive arranger that doesn't sound MIDI + a theory engine) = a host-platform bet, not a 1-person plugin build. **RS Session Mode proved the love; RS+ DELETED it** (a curriculum-less island) → the lane is open, but *reactivity is a delight axis any funded rival copies*; the wedge is the curriculum loop, not reactivity.
  - **If reactive ever happens:** "detect-and-SET" (lock key/tempo once, hold steady), **never chase**; framed as a coaching **mirror** ("you're implying Dorian — here's a vamp"), never auto-accompaniment. (rhythm-meter, audio-engine, harmony, notedetect)

## Q2 — Per-instrument style/personality ("musicians as params")?
**Worth doing, and ~80% already us.**
- A thin **`MUSICIANS` registry** (id, name, genre, instrument, rig, temperament) + a **slot-resolver** reifies fields we already scatter across recipes/profiles/mixer overrides. Small change, big leverage: per-instrument personality + cross-genre swap + a **"community adds a musician" surface** — all on the existing buses + rolling-window scheduler. (audio-engine)
- **It's the highest-leverage SHARED artifact with the dev team** — it *is* their "modular band as a community capability," built once in our engine. (host)
- What a "personality" actually is — drummer: **{kit set, groove vocab, ghost density, per-limb push/pull, fill style, intensity}**; the rest is cosmetic. (drum-ped) Per-voice micro-timing/swing belongs as **recipe DATA** (bounded, deterministic), not user sliders/random jitter. (rhythm-meter)
- **Caveat (metal-idiom):** for lock-heavy genres the swappable unit is sometimes a **coupled pair (riff+kick)**, not a lone instrument — "swap any one freely and it still grooves" is a false promise.
- **Market:** real JTBD only as an **ear/arrangement-learning LENS** ("swap the drummer, *hear* the feel change, adapt your playing") — a toy if it's a cosmetic costume-swap.

## Q3 — Cross-functional instruments?
**Technically FREE in the engine; gate by a COHERENCE RULE (3 lanes converge).**
- **harmony:** a transplant works only as a *subordinate, rootless colour voice* following the host's roots — never reharmonizing. Jazz piano over punk = sweet if rootless-following, mud if it reharmonizes.
- **rhythm-meter:** only *same-family* swaps where meter/subdivision/swing/downbeat align; metal-over-zydeco = identity collapse.
- **drum-ped:** teaches only when **one unambiguous downbeat/pulse survives**; "metal drums over zydeco" isn't one answer (the gallop kick tiles fine, the blast beat breaks).
- **metal-idiom:** identity is the **LOCK, not the part** — survives when the swap preserves a lock *or* needs none.
- **The practice asset isn't chimera BEDS** — it's **lead over a foreign bed** (shred over synthwave; no lock needed; teaches phrasing portability) + comp under a foreign lead. Ship the capability, **default idiomatic**, make cross-bind an explicit **labeled drill** — never a "build me a weird band" generator (song-generator drift).

---

## THE SLEEPER WIN — the Spotlight / rotate-leader FORM (the "do-this")
Three lanes independently + Christian's own idea converge on this as the best north-star fit in the thread:
- It's a **Jam FORM** (not a new mode, not multiplayer-gated, **no new detection**) — sidesteps the entire feasibility wall.
- It drills the **two least-practiced jam skills**: soloing AND **comping-behind-a-soloist** (structurally impossible to practice alone — the prize). Fills a real **parity gap**: we teach playing the changes as a *soloist*, never as an *accompanist*.
- It delivers the **band-follows-player *feeling*** (you solo → band supports; bandmate solos → you comp) **without building a reactive band.**
- **Fully in-fence** (mirror-not-judge): the rotation resets each cycle = structure (show whose turn), never a counter/score. Also solves the "shapeless jam" problem (gives the vamp a form).
- **Build cost:** a turn-taking layer over the steady engine + the play-the-changes harmony, plus **bandmate LEAD-line generation** (harmony/genre/audio-engine — the real cost is the lead lines, not the form).
- Ladder cross-build: as a skill ladder — hold-time → comp the changes → leave space/dynamics → trade fours → full rotate-leader. (learning-design, gamification)

## Theory-hints — a LADDER win, not a Jam win
- It's our **existing deterministic theory engine pointed at the SCREEN** (rn/fn function tags, `voiceChord`, `MODE_FOR_QUALITY`, `jamNextGuidePcs` already compute "suggested progression/voicing/arpeggio + the why"). (harmony)
- But teaching = evaluative → it belongs in the **Ladder**, not the mirror Jam; we **mostly already have it** (187 goal-cards carry the why). Net-new = a **just-in-time "why" overlay** during play; guard the "don't auto-apply the choice / don't hand them the sentences" line. (learning-design)
- Credit as **descriptive competency** ("you can find guide tones in 5 keys"), never a quiz %. (gamification) Market: the **most crowded lane** (the gamified-theory-app turf) — our credible version is narrow: theory you *play*, named recombinable devices.

## Collab framing (host + market)
- **Virtuoso = the band ENGINE + curriculum BRAIN + drill→apply wire + transfer measure + 29-band realism + guide-tone mirror.** Dev team / host = the **reactive ENGINE + theory CONTENT + native VSTi realizer + multiplayer transport + detection.**
- **A real `multiplayer` plugin ALREADY ships** (Byron, v1.0.0, GPL-3.0): synced rooms, NTP clock-sync, host-controlled playback, Ninjam-style quantized peer audio. Multiplayer is **not from-scratch**; the clean borrow seam (`collaboration` capability) is reserved on the host roadmap.
- **Duplication risk (specific):** if their separate repo builds its *own* generated band, it re-does our 29-style recipe engine. Anti-pattern: **two band engines in two repos.**
- **Integration seams:** (1) the **realizer-agnostic musician `rig` field** (web sample+WaveShaper now / native NAM-VSTi later, *same param object*); (2) the future **`collaboration`** capability. The **MUSICIANS registry is the highest-leverage shared artifact** (the public "add a musician" surface).
- **Minigame SDK:** borrow the **ear** only (we already do via note_detect); decline the round/score model; **do NOT register** (re-imports the score/rank dark pattern + forces a single-config harness onto our 4-mode shell). We're the **named pilot** for the host's progression spec **011** (competency-events, not `min_score`).
- **VSTi-in-a-web-page isn't real for us** — and the thread's own "humanization must be in-engine" point argues *for* our model. (audio-engine)

## What NOT to build (explicit cuts)
- A from-scratch reactive band engine inside Virtuoso (host territory).
- A gamified-theory COURSE competing with the incumbent theory apps.
- A Jam score/rank/leaderboard or a keep/export-the-jam artifact (mirror-not-judge).
- A cosmetic "build your dream band" mixer with no learning lens.
- "More styles" as the headline (polish the *feel* of the 29 instead).
- A second transport/player (contained-playback law). Don't register as a minigame.

## The honest gate (market)
**Virtuoso has no retention telemetry on the modes it already has.** Before betting on a 5th lane, instrument saved-Workout reuse / time-per-clear / drill→Jam rate first — don't decorate a tool nobody's proven they run twice. (Bet #5 before bet #1 returned data.)

## Cherry-pick list (what to grab from the thread)
1. **The Spotlight/rotate-leader form** — do-this; Christian's own idea, panel-validated; cheap, in-fence, on-mission.
2. **The MUSICIANS registry** — cheap reification of what we have; the shared collab artifact.
3. **Cross-functional as a LABELED drill** (lead-over-foreign-bed), gated by the coherence rule.
4. **The just-in-time "why" theory overlay** — in the Ladder.
5. **Borrow:** the multiplayer plugin + the `collaboration` seam (later), the minigames ear, the NAM realizer.
- **Leave for the dev team/host:** the reactive band engine, the theory-content course, multiplayer transport, detection.

## Open forks for Christian (no decision made)
- **A.** Build the **Spotlight form** now (the cheap, in-fence, on-mission slice — your own idea)?
- **B.** Build the **MUSICIANS registry** now (the shared collab spine + per-instrument personality), or wait until the collab is concrete?
- **C.** Cross-functional as a **labeled drill** (lead-over-foreign-bed) — now / later / no?
- **D.** Collab posture: position Virtuoso as **the band/curriculum brain the dev team's app consumes** — and confirm the bmad scope is a *separate plugin* (→ borrow, ideal) vs "Virtuoso *becomes* this" (→ the pivot to resist).
- **E.** The gate: instrument **retention telemetry** before committing to any of A–D?

## The instant-style-switch bug (Christian's live ask)
Code switches correctly on a clean slate (probe-confirmed jazz→metal). The "no change" is almost certainly a **persisted voice pin** (Mixer/band-strip → set to Auto). Whether a genre switch should *keep "your drummer"* or *reset to the new band* is itself a fork — and it's the same question the MUSICIANS registry raises (fork B).
