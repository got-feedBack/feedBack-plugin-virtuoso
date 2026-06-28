# Genre-Band Realization — Roundtable Spec & Build Plan

**Initiative:** "Every genre sounds the same / the workflow is clunky." Make selecting a genre in Jam
load an **authentic, audibly-distinct band** (instrumentation + kit + mix + feel per genre) playing the
chosen progression — and make the genre→band **workflow intuitive**. Christian's #1 priority, 2026-06-13.

**Panel (16 lanes).** Chair: `audio-engine-architect` · co-chair (mix): `sound-design-architect` ·
usability LEAD/co-lead: `virtuoso-ux-designer` + `gamification-architect` · voices:
`drum-/bass-/piano-pedagogy` · exemplars: `metal-/country-/jazz-idiom` · data model + progressions:
`harmony-theory-architect` · borrow: `feedback-compatibility` · context: `market-analyst`,
`learning-design-architect`, `rhythm-meter-architect`, `guitar-pedagogy-expert`.

> Status: synthesized from 11/16 lanes (host-borrow + market/L&D/meter/guitar incoming — §10 placeholders).

---

## 1. Diagnosis — measured, not guessed

Main-thread probes on the **live beta.9 code** (the real `makeBundle` playback path *and* the real Jam-UI
click-flow), reproduced by the chair at the line level:

- **The generation/recipe engine is CORRECT.** `ARRANGEMENT_RECIPES` already declares a distinct band
  per genre (comp + bass + drum cells + ensemble flags). Probes: **9/9 genres → 9 distinct rhythm
  fingerprints**; chord qualities differ too (country `Amaj/Dmaj/Emaj` triads, metal `A5/F5/G5` power,
  jazz `Bm7/E7/Amaj7`). The *notes* are right.
- **The AUDIO-REALIZATION layer collapses it** — four narrow root causes (all line-pinned):

  | # | Symptom | Root cause |
  |---|---------|-----------|
  | 1 | **Keys/pad track SILENT for every genre** | `screen.js:16634` — `busName = ev.comp != null ? 'harmony' : 'pad'`. Once a genre declares a comp cell, every harmony event carries `ev.comp` → routes to Rhythm → the pad bus is never fed. The 4th band track is structurally orphaned. |
  | 2 | **Bass = 2 voices for 17 genres** | No genre overrides `bass.tone`; all clean/electronic/distorted families inherit GM-33 fingered electric. Metal's "driving bass" == pop's bass. |
  | 3 | **Drums = 3 kits, metal == country** | clean *and* distorted both default to `kit_rock`; only jazz/bluegrass declare a kit. **And** `kit_rock`/`kit_acoustic_soft`/`kit_jazz` are the *same FluidR3 samples at different `level`* — a kit-id swap alone can't fully differentiate. |
  | 4 | **Brightness pinned to 0.5 for all** | `readConfig` always emits `audio.brightness` from the slider; `resolveAudioProfile` then unconditionally overrides the per-genre value. |

  **Net:** the two loudest timbres (drums, bass) never change across genres, the Keys track is silent, and
  only the buried comp differs → "every genre sounds the same."

- **The WORKFLOW is clunky** (Christian's second, equally-important half): switching a genre chip mid-jam
  is **queued to the next loop wrap** (`jamQueueChange` → the "↻ At the wrap" chip), so it doesn't change
  immediately; and **nobody can see who's in the band** (the instrument list is buried in the mixer reading
  "Auto"). Combined with the timbre collapse, the user can't tell what's happening or how to drive it.

---

## 2. Decisions (the decision log)

1. **Keep the two-table split; extend `AUDIO_PROFILES`.** `ARRANGEMENT_RECIPES` owns rhythm/ensemble cells
   (per `style:feel:tier`); `AUDIO_PROFILES` owns per-genre **timbre** (per style, tier-invariant). They vary
   on different axes — merging denormalizes and invites drift. Adding a genre band stays a **guarded data
   edit** across the two tables. (harmony-theory, ratifying the chair.)
2. **Genre switch = re-establish at the next DOWNBEAT, not the loop wrap; keep the wrap-quantum only for
   same-band tweaks** (key/tempo/feel/changes/depth/band-mode). "A new genre is a new band; bands cut, they
   don't slowly morph." `jamPlay()` already rebuilds cleanly mid-run, so this is free. (UX + gamification;
   reconciled from UX's "instant" + gamification's "next bar line" → **next downbeat**.)
3. **Surface the band as a "Band" lineup strip** in the Jam Inspector that *names each player from the
   recipe* and lets you swap any of them inline. It's the same `mixerState[key].instrument` the mixer owns
   — two views of one state. The strip is **the contract the audio must honor** (says "brushed kit" ⇒ you
   hear one). Kills the "Auto"/hidden-mixer problem. (UX, with gamification's "Band Card.")
4. **Drum differentiation is mix-side, not just a kit-id swap.** Because the acoustic kits share one sample
   set, ship a `MIX_RECIPES` delta table (per-genre EQ tilt + compression + decay + pan/space/level +
   loudness trim) — the *real* per-genre drum character — alongside the kit assignment. Real brush/metal/
   Latin **sample sets** are P1 polish. (sound-design.)
5. **The Keys track has three idiomatic patterns, not one** (piano-pedagogy):
   - **`sustain` glue pad** (soul/gospel/city-pop/pop/rock/shoegaze/blues): a *separate* held voice, **rootless
     and a register above the comp** (`voiceBackingPad`, never the comp's voicing — the mud rule, §3).
   - **comp-on-keys** (jazz/new-orleans/ragtime): the genre's comp *is* a piano — route the comp cell to the
     Keys bus (`compBus:'pad'`) and add **no** second pad (don't stack piano-on-piano).
   - **rhythmic keys cell** (reggae "bubble", disco string-stabs, afrobeat interlock): a real *rhythmic* part
     that needs its own short-envelope cell — **NOT** a sustain pad. **Deferred to P1+** (a sustain here is
     flat-out wrong, so these genres ship keyless-or-sustain until a cell exists).
   - **keyless** (bluegrass/folk/classical/flamenco/gypsy-jazz/punk/metal/djent): the Keys track stays **off**
     by design — wallpapering a pad here is worse than silence.
6. **Bass overdrive needs its own preset.** Do **not** route bass through the guitar `metal`/`drive` amps —
   their `preHp` (75–110 Hz) guts the bass fundamental. A `bass_drive` preset (preHp ~30 Hz, gentle drive,
   no mid-scoop, dry-sub blend) + extend the amp insert to the bass bus. (bass-pedagogy.)
7. **Lighter/heavier sections are a density TIER, not a song-section flag** (metal's clean break = the
   `:sparse` tier). Virtuoso generates practice loops, not arranged songs — the tier *is* the dynamic-
   control primitive. (metal-idiom, north-star aligned.)
8. **Recommended-vs-any progressions already works in the data model** (`stylePaletteConfig(id,{progression})`
   passes any `COMMON_PROGRESSIONS` key); it's a UX surfacing job. Only content change: **soul default →
   `soul_turnaround`.** (harmony-theory.)

---

## 3. Architecture

### 3.1 `AUDIO_PROFILES` extension (pure data, additive, guarded)

All four slots optional; absence = today's family-default behavior (back-compat). Threads for free through
the existing `resolveAudioProfile` merge (`GLOBAL_AUDIO_DEFAULT ← family ← profDef`).

```
<style>: {
  family,                                     // unchanged — drives AUDIO_FAMILY_DEFAULTS
  harmony: { engine, tone, level, sg?, amp? },// the COMP (Rhythm strip) voice — unchanged
  bass:    { tone, level?, amp? },            // NEW per-genre — the Bass voice (+ overdrive amp)
  pad:     { tone, level?, role:'sustain'|'comp'|'counter' }, // NEW — the Keys/pad voice + how it plays
  drums:   { kit, level? },                   // EXISTS — fill it (stop sharing kit_rock)
  brightness,                                 // unchanged value; the CLOBBER is fixed (§3.4)
}
```

**Startup guard** — add `validateAudioProfiles()` (mirrors `validateStylePalettes`/`validateArrangementRecipes`):
every `*.tone` ∈ `TONE_GM`, every `drums.kit` ∈ `KIT_REGISTRY` (**currently UNguarded — a typo silently falls
to kit_909**), `pad.role` ∈ the enum, `family` ∈ `AUDIO_FAMILY_DEFAULTS`. Throws on load.

### 3.2 The bus-routing fix (cause #1) + the Keys emit

- **Route by explicit role, not by "has a comp tag":** change `16634` so `role:'pad'` events → pad bus and
  comp events → harmony bus. (Un-orphans the Keys track the moment a pad event exists.)
- **Emit the pad** in `buildBackingEvents`: when the profile declares `pad.role==='sustain'` and
  `ensemble.pad!=='off'`, push a **coalesced** `role:'pad'` event per chord (reuse the legacy `lastPad`
  coalesce) voiced by `voiceBackingPad` (§3.3). For `pad.role==='comp'` (jazz family), route the **comp cell**
  to the pad bus instead of emitting a second voice (`compBus:'pad'`). `pad.role==='counter'` is reserved
  (moving-line generator, future).

### 3.3 The mud rule (`voiceBackingPad`) — harmony-theory's load-bearing finding

Today the pad and comp draw from the **same** voiced `midis`; filling the pad with a distinct timbre would
double the comp in-register → mud/comb-filtering. Rule the engine must own:

> When a profile declares a `pad`, the pad plays a **rootless upper-structure voicing in a register above
> the comp** (`{omitRoot:true, omitFifth:true@≥4, bassLow:60, upperHigh:84, maxVoices:3, preferGuideTones}`),
> **never doubling a comp pitch in the same octave**; the **bass owns the root**; voices and pad level are
> capped (bass 1–2 + comp ≤4 + pad ≤3, pad level ≤0.5–0.6 — glue, not presence).

Add a `voiceBackingPad()` sibling to `voiceBackingChord` (reuses the boogie builder's proven rootless-shell
logic + the existing `voiceChord` guards). Deterministic; no new dependency.

### 3.4 The brightness fix (cause #4)

Make the slider **opt-in**: `readConfig` emits `audio.brightness` only when the user actually moves it
(touched flag / sentinel), so `resolveAudioProfile`'s override fires only on a real user move and the
per-genre brightness survives. (Mechanism → ux-designer; contract fixed.) Intended per-genre values already
live in `AUDIO_PROFILES` and are musically right (djent/metal 0.38/0.42 scooped … shoegaze/disco 0.66–0.70
bright) — **keep them, don't reset to 0.5.**

### 3.5 `MIX_RECIPES` — the per-genre mix delta table (sound-design)

A new pure-data table keyed by style (mix is coarser than arrangement), deltas over the house mix; the
**drums/bass loud-layer mandate** carries the genre signature. Re-applied with ramps (250–400 ms on the
backing group, ~30 ms per bus) — no jump on a genre switch; the master limiter always backstops.

```
MIX_RECIPES[style] = {
  level: { harmony?, pad?, bass?, drums? },   // dB delta from house ref (±3 typ, clamp ±6)
  pan:   { harmony?, pad?, bass?, drums? },    // absolute pan [-1,1]
  carve: { harmonyHP?, bassLP?, padHP? },      // per-bus filter overrides
  dip:   { bass?:{f,dB,Q}, ... },              // mask-avoidance notch
  send:  { harmony?, pad?, bass?, drums? },     // reverb send = the SPACE knob
  drumkit:{ loShelf:{f,dB}, hiShelf:{f,dB}, compRatio, compThr, decayScale, level }, // the REAL drum differentiator on shared samples
  masterTrim?,                                  // per-genre loudness pre-correction (density → perceived loudness)
}
```

**Loudness normalization:** dense/distorted genres get a quieter `masterTrim` (metal −2 dB, mid −0.5/−1,
sparse/jazz = 0 ref) so a metal wall and a jazz trio land within ~1.5 LU and the limiter does the same
~2–3 dB GR for all. Jazz is the reference everything normalizes to.

### 3.6 The groove-piece multiplier (drum-pedagogy)

Half of "sounds like the genre" is the **groove choosing the signature piece** — reggae/country cross-stick
(`snare_xstick`), jazz ride-led (`ride` + `hh_pedal` 2&4), disco open-hat on the "&" (`hh_open`), funk ghost
notes (low-vel `snare`), reggae one-drop (silent 1, kick+snare on 3). **Free today** (pieces exist). P0 must
**audit each genre's `DRUM_GROOVES` cell uses its signature piece** alongside the kit/mix change — jazz is
confirmed correct; others to verify.

---

## 4. The workflow redesign (UX + gamification)

1. **Instant band on genre pick** (decision #2): genre chip click while playing → `jamPlay()` re-establish at
   the next downbeat (≤1 bar), with a fast "tape-rewind" tell on the overview + the Band strip swapping and
   doing a staggered count-in reveal (drums→bass→comp light up = "the band is here"). Cover the ~300–600 ms
   rebuild with a "…loading the Metal band" state. Reduced-motion-safe; no audio sting (the music is the
   reward). Key/tempo/feel/changes/depth/band-mode keep the "↻ At the wrap" quantum.
2. **The "Band" strip** in the Jam Inspector (between Genre and Key): one row per *active* ensemble role,
   each naming its resolved instrument from `ARRANGEMENT_RECIPES`+`AUDIO_PROFILES` (Country → *Acoustic ·
   Upright · Brushed kit · Pedal-steel pad*; Metal → *Dist gtr · Overdrive bass · Modern kit*). Off-roles
   render faint with a one-word reason ("Keys — off"). Each row's instrument name **is** the mixer's
   per-channel `<select>` — surfaced, labelled with the real resolved voice (not "Auto"), so the manual
   swap is discoverable here. A "Reset band to <Genre> default" link appears after any manual swap. Two
   views of one `mixerState`.
3. **Recommended-changes picker:** the recommended progression (`progressions[0]`) shown starred/labelled
   "recommended," alternates as chips (≤4) or the existing `<select>` (5+), plus an "all progressions"
   escape hatch (passes any `COMMON_PROGRESSIONS` key — already supported). Changing it keeps the wrap-quantum.
4. **Progressive disclosure / IA:** a first-timer sees **Genre → Band → Key/Tempo → Changes → ▶ Jam**; fold
   Feel/Depth/Highlight/Band-audio/Bass-mode under a "More options ▾" reveal. The defaults ARE the demo.
   One-line model statement above the grid: *"Pick a style → its band plays your chords → you jam the lead
   over it."* First-run only: an opt-in "▶ Hear a band" auto-demo; an empty-handed "your turn" nudge if the
   detector hears nothing for ~8 bars (once/session). Mirror, never judge.
5. **Healthy exploration (gamification):** "Sat in with the band" — credit a genre's first **real** jam (the
   detector heard you play, not silence); a breadth badge ("Session Player — 5 bands", "Genre-Fluent — 12")
   extending the existing `BADGES`. No locked bands, no listening rewards, no streak/FOMO, no jukebox carousel.
6. **GROUP the 29 chips** (market: a 29-flat-chip wall is *below* table-stakes — worse than rivals' grouped
   models). Group by family (e.g. Rock/Metal · Blues/Jazz · Funk/Soul/R&B · World/Latin · Folk/Acoustic ·
   Pop/Electronic) so "I want funk" is ≤2 taps. (Already a self-flagged "Jam picker IA" follow-up.)
7. **"▶ Audition the band" before commit** (host-mirror): the host's selection idiom (`nam_rig_builder`'s
   card-grid + ▶ Listen, `nam_tone`'s key→preset dict) is exactly our genre→recipe shape. Let a player hear
   the band on a genre card *before* committing the switch — answers "clunky/unintuitive" with the host's
   own grammar. (Card-grid genre picker backed by the genre→recipe map + an audition verb.)

---

## 5. Per-track realization maps

### 5.1 Drums — stop defaulting 12 genres to kit_rock (drum-pedagogy)

Ship-today matrix on existing kits + level + the §3.5 `drumkit` mix-voicing + the §3.6 groove-piece audit:

| Genre(s) | Kit (today) | Level | Signature piece the groove must own |
|---|---|---|---|
| rock/punk/prog/emo | kit_rock | 0.92–1.05 | backbeat; punk harder |
| metal/djent | kit_rock* | 1.0 | double-kick, tight hat/china (*→ P1 `kit_metal`) |
| funk | kit_rock | 0.95 | **ghost-note snare + 16th hats** |
| disco | kit_rock | 1.0 | **open-hat on every "&"** + four-floor |
| afrobeat | kit_rock | 0.95 | bell pattern + busy syncopation |
| country/soul/reggae/new_orleans/norteño/surf/shoegaze | kit_acoustic_soft | 0.82 | **country/reggae cross-stick**; reggae **one-drop**; soul tambourine |
| latin (bossa) | kit_acoustic_soft | 0.82 | brushed + clave (*salsa → P1 `kit_latin`) |
| jazz | kit_jazz | 0.8 | **ride-led spang-a-lang + hat-foot 2&4** (already correct) |
| electronic styles | kit_909/808 | — | already distinct |
| classical/flamenco/folk/gypsy-jazz/ragtime/tango/bluegrass | **DRUMLESS** | — | no kit (flamenco: optional palmas) |

P1 sample sets (CC0 WAF, priority order): **`kit_metal`** (most-wrong without it) → **`kit_latin`/`kit_afro`**
percussion (congas/timbales/clave/cowbell — can't fake) → **`kit_brush`** (jazz/country swirl).

### 5.2 Bass — per-genre voice (bass-pedagogy)

`upright` for jazz/country/bluegrass/folk/tango/NOLA/norteño/latin-bossa/gypsy-jazz/classical. `bass`
(electric) elsewhere, differentiated by **brightness + articulation in the figure + the OD insert**: metal/
punk add `amp:'bass_drive'` (light grind, kick-locked pick 8ths); reggae = dark/round/low-passed (the riddim
is the hook — loudest, roundest); funk = bright fingered 16ths; disco = octave; soul/motown = warm melodic
counter-line. Figures already differ — this is the **voice**. (`synthbass:38` is a one-line future add for
synth-pop/electronic.) Trim OD makeup-gain so driven bass doesn't outrun the band.

### 5.3 Keys — per-genre (piano-pedagogy; the honest map)

`sustain` glue (rootless, above comp): soul→Rhodes, gospel→organ, city-pop→Rhodes, blues→organ,
pop/rock/emo→synth-pad/strings, **shoegaze→featured lush pad**, country→**pedal-steel-as-slow-swell-pad**
(honest ~80%; no real glide yet). `comp`-on-keys: **jazz→piano** (route comp to Keys bus), nola/ragtime →
the piano IS the comp (no 2nd voice). **Keyless:** bluegrass/folk/classical/flamenco/gypsy-jazz/punk/metal/
djent. **P1 rhythmic cells (NOT sustain):** reggae bubble, disco string-stabs, afrobeat interlock, norteño
accordion-stand-in (no GM accordion → organ).

### 5.4 The three exemplar bands (the reference recipes)

**COUNTRY** (country-idiom) — `family:'acoustic'` (flips warm family + soft-kit default as a side-effect),
`harmony.tone:'guitar'` (steel-string acoustic, *not* the clean electric — that's the Tele *lead*),
`bass:{tone:'upright'}`, `pad:{tone:'pad',role:'sustain',level:0.48,attack:'slow'}` (pedal-steel swell — THE
signature, honest 80%), `drums:{kit:'kit_acoustic_soft'}` (→ `kit_brush` P1), `brightness:0.55`. Arrangement
unchanged (already country). Follow-ons: `country_walkup` bass figure, `travis_pick` ballad sub-feel, the
real pedal-steel **glide** voice.

**METAL** (metal-idiom) — `drums:{kit:'kit_metal'}` (P1 sample; the biggest tell), `bass:{tone:'bass',
amp:'bass_drive',drive:0.35,pick:true}`, comp already runs `amp:'metal'` (just finish the scoop +
hard-L/R double-track → sound-design), **Keys off** (orchestral pad only on a `metal:symphonic:full` feel).
"Lighter section" = the `:sparse` tier (clean let-ring). Priority if only three ship: **kit_metal →
overdriven bass → scooped double-tracked comp.** Gap: a `metal_gallop_kick` drum cell. (punk also shares
kit_rock — same family of fix.)

**JAZZ** (jazz-idiom) — best-served today; two mis-routings to fix: **(GAP-1)** route the `charleston` comp
to the **Keys bus as `piano`** (`pad:{tone:'piano',role:'comp'}`) — un-orphans Keys *and* makes the comper a
piano; **(GAP-2)** `bass:{tone:'upright'}` (inherits electric today). `harmony.tone` epiano→`piano` for
straight-ahead (keep epiano as a `fusion` feel). Drums (`jazz_swing`) already a real spang-a-lang — keep.
P1: brush sample set, comp-variation across the form, piano+guitar trading (quintet). Result: e-piano-
charleston+electric-walk → **comping piano + walking upright + brushy ride = unmistakably a jazz trio.**

---

## 6. Sourcing (borrow-vs-build) — chair's verdicts; host to confirm (§10)

Everything P0 ships on **already-committed CC0/MIT assets**, no new dependency, no host-player borrow:
- Keys/bass/upright/synth voices → **WAF GM presets (BUILT/shipped)**.
- Kits rock/soft/jazz/909/808 → **shipped**; `MIX_RECIPES.drumkit` does the per-genre voicing on them.
- Bass overdrive → **WaveShaper reuse** (new `bass_drive` preset, ~6 lines, procedural cab fallback ships).
- Comp amp tones → shipped chain (metal IR ships; clean/crunch cab IRs = open item).
- **P1 BUILD (curation):** `kit_metal`, `kit_latin`/`kit_afro`, `kit_brush` sample sets; clean/crunch cab IRs
  (CC0, gitignore-until-cleared). **NAM-for-backing = DEFER** (cab IR is ~80% of tone).

**Host-confirmed (feedback-compatibility, runtime 0.2.9 — the rule-4 HOST CHECK):** none of the realism fix
depends on a new host borrow. Host `drums.py`/`drums` plugin = generic GM (no metal/brush/Latin kit to borrow,
CDN-dependent) → kits are **BUILD (ours)**. The host's new `nam_rig_builder` *does* own a bass-overdrive VST3
(`BLACKBRASS`) + 90 pedals, but they're **native VST3, walled off from WebAudio** → bass-OD stays our
**WaveShaper (BUILT)**. Keys = our **WAF sampler (BUILT)**. The `nam_tone` amp worklet is borrowable but
**dormant** (we run the WaveShaper chain). **No host genre/band picker exists** — our workflow is a new
surface (no collision), mirror the host's *primitives* (card-grid + ▶ audition + key→preset dict) per §4.6/4.7.

---

## 7. Phased build plan

**P0 — make country/metal/jazz audibly distinct + the workflow intuitive** (data + a few small code edits,
all on shipped assets):
1. **Brightness opt-in fix** (§3.4) — un-clobbers per-genre brightness; biggest perceptual bang per line.
2. **Per-genre `bass.tone` + `drums.kit`** for the genres that obviously differ (§5.1/5.2) — pure data + the
   `validateAudioProfiles` guard (also closes the unguarded-kit gap).
3. **`MIX_RECIPES` table + wiring** (§3.5) — the per-genre drum/bass mix-voicing + loudness trim (the real
   differentiator on shared kit samples). Worked mixes for country/metal/jazz ship first.
4. **Un-orphan the Keys track** (§3.2/3.3) — the `16634` bus fix + the `role:'pad'` emit + `voiceBackingPad`
   (mud rule). Declare `pad` on the 3 exemplars (country pedal-steel pad, jazz comp-on-keys, metal off).
5. **Groove-piece audit** (§3.6) — verify each P0 genre's `DRUM_GROOVES` hits its signature piece.
6. **`bass_drive` preset + bass-bus amp insert** (§5.2) — metal/punk overdriven bass.
7. **Workflow:** instant-downbeat genre switch (§4.1) + the **Band strip** (§4.2) + progressive-disclosure IA
   (§4.4) + recommended-progression starring (§4.3). soul default → `soul_turnaround`.

After P0: comp (already) + bass + drums + brightness + Keys all change per genre, the switch is instant, and
the band is visible/swappable. **The bar is cleared for the 3 exemplars.**

**P1 — the full matrix + the asset curation:**
- Fill `bass`/`pad`/`drums`/`MIX_RECIPES` across **all** genres (idiom-agent-vetted).
- P1 sample sets: `kit_metal` → `kit_latin`/`kit_afro` → `kit_brush`; clean/crunch cab IRs.
- The rhythmic keys cells (reggae bubble, disco stabs, afrobeat interlock).
- "Sat in with the band" badges; first-run demo.

**P2 — polish:** comp-variation across the form (jazz), piano+guitar trading, the pedal-steel **glide** voice,
`country_walkup` bass, flamenco palmas, synthbass.

---

## 8. Verification / smoke

Add rows to `smoke-backing-engine.mjs` (per the per-system growth rule): (a) a genre with a declared `pad`
emits ≥1 `role:'pad'` event AND the pad doesn't share a comp pitch in-octave; (b) two genres that previously
shared `kit_rock` now resolve distinct kits OR distinct `MIX_RECIPES.drumkit`; (c) brightness from two
profiles differs when the slider is untouched; (d) `validateAudioProfiles` throws on a bad tone/kit/role.
Plus a probe: country/metal/jazz produce distinct **audio-resolution** fingerprints (kit + bass voice + pad
filled + mix delta), not just distinct event data. (`probe-genre-audio.mjs` already measures this.)

---

## 9. North-star check

Every item credits *playing a believable band to practise against* and builds genre fluency the player takes
off-screen. The band is a means to practise an idiom, never a song/jukebox generator: density tiers (not song
sections), recommended-progression latitude (learn the grammar), exploration credited only on real play
(not listening), Jam stays a **mirror** (no score/rank). ✔

---

## 10. Incoming lanes (fold on arrival)

Folded: ✅ host (§6) ✅ market (§11). Still incoming:
- **learning-design-architect** — how the band serves practice / the on-ramp; guitar↔bass parity.
- **rhythm-meter-architect** — per-genre feel/timing confirmation; the switch-quantum interaction.
- **guitar-pedagogy-expert** — per-genre rhythm-guitar voice/role; the 2nd-guitar/Keys interlock genres.

---

## 11. Market framing & guardrails (market-analyst)

**The honest reframe — this fix gets us TO the bar, it is not the moat.** "Pick a genre → a decent band +
mixer, instantly" is now **table-stakes** (AI backing-track generators and dedicated backing-band /
accompaniment apps all ship it — several with bigger sample libs than a web plugin). Today's
collapse leaves us **below** that bar, which is why it reads as urgent. **We do NOT win a tone arms race** —
the realism bar is not "sound like a record," it's **"each genre is audibly its OWN band, not the same kit
re-skinned."** Fixing the collapse clears table-stakes; that's necessary and the right priority.

**The actual differentiators ride ON TOP** (none is "better samples"): (1) the **apply-wire** — one tap from a
cleared Ladder rung into a band on the *same key/scale/changes* (no competitor has a curriculum to apply
*from*); (2) the **guide-tone teaching mirror** — the band *teaches* what to play over its changes, fading as
you master it; (3) each genre audibly its own band; (4) **tuning/rig-adaptive** (the band re-derives from
*your* tuning); (5) **mirror-not-judge / no-sub / no-lock.** Sequence: fix the sound-collapse + group the
chips (table-stakes) FIRST, then the apply-wire + teaching-mirror are the moat that rides on top.

**Drift tripwires (binding — practice tool, never a jukebox):**
- ❌ **No "save / export / share this backing track" button** on the band — the single clearest jukebox tell.
- ❌ Don't make **"type what you want / pick-a-vibe"** the *primary* entry (keep pick-a-grouped-genre +
  apply-from-a-rung primary; the progression-suggestion engine is a secondary practice-variety/teaching tool).
- ❌ Don't **market on sound quality** ("studio-grade tones") — a claim we lose, and it frames us as a track tool.
- ❌ Don't chase **more genres** as the headline (29 is plenty; breadth is the least-differentiating axis).

**Validation metrics (healthy, tiny-N):** genre-distinguishability blind test (*"eyes shut — can you tell
reggae from disco from metal?"* 👍/👎, NOT "rate the audio"); apply-rate (cleared rungs → "take it to Jam");
switch-friction (taps from "I want X" to "band playing X", target ≤2). **Anti-metric:** any tracks-saved
count (its presence means we drifted).
