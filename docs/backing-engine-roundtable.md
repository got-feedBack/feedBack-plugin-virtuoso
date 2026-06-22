# Backing-Engine Round-Table — Synthesis & Spec (2026-06-03)

> A 34-agent design charette on the **chord-progression + backing-track + harmony/metric**
> engines: how to make generated backing better per-genre and more lifelike, and what the
> practice-tool USP is. Panel: harmony-theory (chair), rhythm-meter, sound-design,
> audio-engine, drum-pedagogy, market-analyst, learning-design, bass- & piano-pedagogy,
> plus 25 genre-idiom lanes (blues, jazz, funk, latin, country, rock, prog, pop, gospel,
> metal, reggae, folk, bluegrass, flamenco, classical, gypsy-jazz, city-pop, soul-motown,
> disco, afrobeat, new-orleans, tango, norteño, ragtime-stride, hip-hop-fusion). Four
> texture/lead-only lanes (shoegaze, surf, emo, punk) were held out of scope.
>
> **Status: DESIGNED — not built.** This is the spec + decision log. It supersedes nothing
> shipped; it gives the already-deferred "Playing-the-changes Stage 2" timeline its full
> motivation + a genre-validated primitive vocabulary, and adds the comp/bass/drum/voicing/
> feel layers that ride on it. See `ROADMAP.md` "Backing-Engine Rebuild" for build order.

---

## 1. The one-line diagnosis

**The harmony is right; the entire rhythm/texture layer is missing.** `COMMON_PROGRESSIONS`
(~40 keys) + the `voiceChord` voicing engine are genuinely good. But the backing has exactly
**two comp shapes** — one sustained, coalesced, voiced **pad per bar** (`buildBackingEvents`,
every style) and the **blues boogie** (`buildBoogieBacking`, blues only) — harmony is
**bar-locked** (one chord per measure), the backing **bass is just the pad's sustained root**,
**drums are 4 grooves** with a straight-backbeat default, and feel is **one global swing ratio**.
So every genre that isn't blues plays *a held chord over a rock backbeat*. That is the whole gap.

The fix is **not** 30 hand-written genre tracks. It is an engine rebuilt around **recombinable
primitives** (north star: *teach the grammar, not the sentences*) — the player learns a genre as
a nameable **combination** of (comp cell × bass figure × drum feel × voicing × feel), not a canned loop.

---

## 2. The USP (market-analyst, sharpened) — and the drift line

**USP, one sentence:** *the backing is a **teaching instrument wired to the drill and to the
fretboard mirror**, not an accompaniment.* The same engine generates the exercise **and** the
backing **and** lights the target chord/guide tones — nobody else closes that loop. iReal Pro
accompanies but never teaches the line over the changes; Band-in-a-Box is lifelike but
pedagogically inert; Chordify is song-locked; the play-along trainers bake backing into songs and
never expose the *grammar*. The empty intersection we own: **generative + skill-locked + mirrored**
backing, parameterized to a device, in any key, that visibly teaches the changes.

**The single true DIFFERENTIATOR:** voice-leading + harmonic rhythm **tied to the Jam mirror**.
Everything else on this page is, by the market lens, **table-stakes** ("unbreak the pad-per-bar so
genres we already teach don't sound broken") — necessary, not edge.

**The drift bright line** (this backing work is the **#1 off-mission magnet** — guard it):
> *Does the change make the player play **better**, or make the backing sound **better on its own**?*

| BUILD (reinforces practice) | CUT / GUARDRAIL (drifts to song-gen) |
|---|---|
| Voice-leading + harmonic rhythm the player hears and answers | Long sectioned **arrangements** (intro/verse/chorus/build) |
| Genre comp/bass/drum **feel** so the device transfers idiomatically | A "make me a backing track / jam" entry with **no drill attached** |
| Anything wired to the **mirror** (next-chord target highlight) | **Backing audio export** |
| Looping a **vamp / cycle** | Ear-candy **fills as decoration**, arrangement dynamics |

Jam stays a **mirror** — no score, and no "compose." A backing is a metronome with harmony.

---

## 3. Priority discipline (market + L&D): right thing, **right order**

- **NOW (justified — it *is* the proof-loop payload):** the **narrow** fix that unbreaks the
  **~9 genres we already teach** (blues, rock, metal, djent, jazz, funk, pop, country, gospel) —
  pad→idiomatic comp/bass/drums — **plus voice-leading-to-the-mirror**. This *is* the
  drill→Jam-over-the-same-skill story the proof loop needs.
- **DEFER (breadth ahead of proof):** 30+ palettes as a *count*, exhaustive per-genre realism,
  the exotic-meter lanes (clave/compás/polymeter). Breadth of styles we have no pathway for is
  feature-sprawl that widens the "make me a jam" surface without deepening a skill.
- **Proof metric:** a **skill-transfer proxy**, not "minutes jammed" — on the *same device*, do
  players move drill→Jam and **land more guide tones / fewer root-restarts at the chord seam**
  (already instrumented via the Connect seam) and **return to** richer-backing drills more than
  pad-backing ones. If richer backing doesn't lift seam-landing or return rate, it was polish.

**L&D learning-payoff ranking:** harmonic rhythm > voice-leading > comp grooves (rhythmic
placement) > basslines > drums > palette breadth (last). The **teaching unit is the comp cell**;
backing richness **is** the difficulty axis (easy = static vamp → mastery = full genre feel as a
Jam mirror).

---

## 4. The keystone: a beat-based **chord-event timeline**

**Unanimous** — harmony chair, rhythm-meter, L&D, blues, jazz, gospel all named it first; nothing
sounds idiomatic until it lands. This is exactly the deferred **Playing-the-changes Stage 2**
(`compileChordTimeline`/`enrichEvent`).

Replace the per-bar slot loop (`slot = measureSeconds`) with a beat-keyed event stream:

```js
chart.chordTimeline = [
  { beat:0,   durBeats:2,   root, quality, ... },        // ii  (2 beats — real ii–V in one bar)
  { beat:2,   durBeats:2,   root, quality, ... },        // V
  { beat:4,   durBeats:3.5, root, quality, push:0.5 },   // I, anticipated by an 8th
  ...
]
```

- `durBeats` → 2-per-bar ii–V, 4-bar pedals, stop-time gaps, the blues turnaround.
- `push` (beats) → **anticipation**: the change is pulled earlier than its harmonic slot — the
  single device that most humanizes a change. Near-universal (Latin tumbao, jazz comp, pop "&",
  gospel "& of 4").
- Engine-**generated** `PASSING`/`APPROACH` chords as a timeline op — **not** hand-authored tokens:
  `{ type:'approach', mode:'dim'|'chromatic'|'tritoneSub'|'dom7-of-next', placement:'&4' }`.
  Gospel's keystone; reused by jazz approach + the blues turnaround. (Spelling → harmony-theory.)
- **Bar-lock becomes the trivial case** (one event, `durBeats = measureBeats`) → nothing regresses.
- Beat onsets flow straight into `swungTime` / the per-block session assembly unchanged.

Everything below **reads** this timeline.

---

## 5. The primitive registries (the recombinable grammar)

Four registries + a voicing/feel layer. Genre = a thin **recipe** picking from them.

### 5a. `COMP_GROOVES` — comp-pattern cells (parallel to `DRUM_GROOVES`)

A `DRUM_GROOVES`-style token cell, but each hit also targets **harmony**. The fields
`DRUM_GROOVES` lacks (synthesized from every genre stress-test):

| Field | Values | Forced by |
|---|---|---|
| **per-hit `target`** | `chord · shell · guide · root5 · top · pedal · broken(arpeggiate)` | jazz shell, montuno `top`, metal `pedal`, funk scratch |
| **per-hit `artic`** | `stab · sus · ring · mute-chug · arpeggiate · roll/burst(rasgueado) · swell · pump(choke) · arrastre(drag)` | rock/metal chug, gospel swell, gypsy pump, flamenco roll, tango drag |
| **per-beat `slots`** | beat → `{role, artic, accent}` | **country (keystone)** — boom-chuck, Travis, stride, Motown all fall out of this |
| **`arpPattern: int[]`** | explicit note-ORDER into the sorted voicing | classical **Alberti** `[0,2,1,2]`, pop chime, folk Travis |
| **`accentMap`** | grid indices that hit harder | skank, scratch, compás |
| **`cellBars` / `cellBeats`** | cell length decoupled from the bar | Latin 2-bar clave, prog polymeter, flamenco 12-beat compás, afrobeat |
| **`compLanes[]`** | **≥2 concurrent comp lanes** | reggae (skank + organ bubble), bluegrass (chop + banjo roll), afrobeat (interlock A/B), disco (scratch + strings), funk (gtr + clav), Latin (montuno) |
| **`phaseOffset` / `startSlot`** (per lane) | rhythmic displacement | afrobeat **interlock** (B sits in A's holes) |
| **per-lane mute/dropout track** | bar on/off | reggae **dub** (subtraction) |
| **`couple` / `unison`** | one accent map → comp + bass + kick | **prog** band-stabs, **metal** comp==bass==kick lock |

> The **per-beat `slots`** mechanism and **`compLanes[]`** are the two highest-leverage net-new
> structures — between them they unlock the largest set of genres. `compLanes[]` is the biggest
> single architectural ask after the timeline; even shipping the **array shape** now (one lane
> populated) lets the second lane drop in later without a rewrite.

### 5b. `BASS_FIGURES` — recombinable backing-bass figures (share the timeline + `bassRootGrip`)

`sustained_root · two_feel (+ `connectBass` walk-up) · walking · octave_bounce · root_pump ·
one_pocket · reggae_hook · alternating_thumb (Travis) · tumbao (anticipated) · stride ·
tresillo (3-3-2 — **shared atom**: NOLA, tango, Latin, habanera) · bass_ostinato (boogie 8-to-bar) ·
afro_ostinato · 808_glide (slide artic) · motown_counter / busy_melodic`.

- **`motown_counter` / `busy_melodic` / `walking` are GENERATORS, not stored patterns** — a melodic
  line: root/chord-tone landings + diatonic/**chromatic approach** into the next root + ghost notes
  (`mt`) + anticipation. **Reuse the Connect machinery** (`nearestPositionForPc` / `connectStartIdx`)
  + a lookahead to the next chord + a ghost/anticipation rhythm template. (Note choice → bass-pedagogy.)
- **Realism rules (bass-pedagogy):** clamp to a real bass range, prefer the nearest grip (cap leaps
  ~a 6th), **lock the downbeat root to the kick**, and **drop the pad's folded root** whenever a real
  bass figure plays so they don't fight.

### 5c. `DRUM_GROOVES` — the genre groove library + schema extensions (drum-pedagogy)

- **New lanes:** `ride · hatPedal · rim · openHat-choke · palmas/cajón/golpe (percussion-not-kit) ·
  bell (role:'timeline' — fixed asymmetric, never realigns to downbeats)`.
- **New tokens:** `o` (open-hat choke), `f` (flam/drag), **per-lane `div` override** (double-kick /
  hat rolls under an 8th hat).
- **FILLS** — a `fill` bank + `fill.everyBars` (swap the last bar of a phrase). *Biggest realism
  payoff after the grooves themselves* — a fill-less loop over 30 min is the dead giveaway.
- **Groove set:** `jazz_swing` (swung ride spang-a-lang + hat-foot 2&4 + feathered kick), `reggae_one_drop`
  (kick+snare on beat 3 only, beat 1 empty), `funk_16th`, `metal_double_kick`, `bossa`/clave,
  `second_line`, `train_beat`, `gospel_pocket`, `four_on_floor` (+ the open-hat "&" sizzle).
- **`drums:none` / percussion-role comp** — bluegrass **mandolin chop carries time**; folk/classical/
  flamenco run with no kit (palmas/brushes only).
- **Humanization:** timing ±3–8 ms + velocity jitter, **kit-gated** (electronic 808/909 → ≈0, acoustic
  → ~0.6), **never** the count-in or a loop's first downbeat. Make it **deterministic / seeded** so
  charts stay golden-testable.

### 5d. Voicing + feel layer (harmony-theory, piano-pedagogy, rhythm-meter)

- **Voice-leading BETWEEN successive backing chords** — common-tone retention + nearest-motion (thread
  `prevVoicing`; reuse the Connect picker). *The single biggest "comper, not machine" win* and the
  named differentiator. **M.**
- **`voicingStyle`**: `tertian · quartal/So-What · shell · drop2 · rootless A/B · block(4-way close) ·
  open-drone`. (piano-pedagogy: rootless A/B is the jazz/soul/city-pop workhorse; let the bass track own the root.)
- **Inversions / slash bass** — a `bass` override on the chord event (`/3`, `/5`, pedal).
- **`chromatic_mediant`** timeline transform (root ±3/4 semis + quality shift) — city-pop, prog, film.
- **Independent contrapuntal bass voice** (moving bass under a sustained melody) — classical voice-independence.
- **Feel beyond one global swing:** **per-lane / per-recipe swing** + **swing-LOCK** (Latin must stay
  straight against a global swing) + **per-voice split** (jazz: swung ride, **straight** walking bass);
  **half-time / double-time** flag; **swung-16ths** (distinct from swung-8ths — hip-hop, city-pop);
  **triplet subdivision** feel (slow-blues 12/8, soul ballad, NOLA); **clave 2-3/3-2** + **tresillo 3-3-2**
  alignment; per-lane **micro-timing** (laid-back vs on-top, genre-owned values).

### 5e. The sound (audio-engine + sound-design) — lifelike is **gesture, not timbre**

- **audio-engine:** the realism gap is **gesture**. A per-hit **envelope / note-length layer on the
  existing WAF sampler** unlocks stabs / muted chucks / swells **from voices we already load — pure
  Web Audio, ZERO new assets.** New *sourcing* tasks are few: upright bass, clean comp guitar with a
  muted attack, horn stabs, nylon, clav, strings, brushes (WAF presets / multisamples), and the one
  genuine exception — the **distorted metal/djent comp via the borrowed host NAM amp + cab-IR chain**
  (in progress; never fake distortion with a GM patch).
- **sound-design:** **kill the sustained pad** (re-articulate) = the #1 band-vs-MIDI fix; then
  **velocity contour + downbeat accent** (S, cheapest believability), **register-carve + pan + one
  shared short reverb send** (turns a mono stack into a room *and* unmasks the practice notes). As
  density rises: **pre-limiter bus trim** (limiter is a safety net, ≤3–4 dB GR), watch **correlated
  transients** (kick+bass+stab on the same downbeat). Keep it normalized + safe (no clip, no surprise).

---

## 6. The palette refactor — `STYLE_PALETTES` from config-blobs to **recipes**

Decompose each palette into a thin **recipe** referencing the registries:

```js
salsa: { progressions:['montuno_II7_V7_I'], leadScales:[...],
         compLanes:['montuno_2bar'], bassFigure:'tumbao', drumGroove:'clave_son_2_3',
         voicingStyle:'tertian', harmonicRhythm:'2/bar', feel:{ swing:'locked-straight', claveDir:'2-3' },
         audioProfile:'latin' }
```

Adding a genre = **pick ~5 primitives + name it, zero new code.** Extend the startup integrity guard
(mirrors the no-unison + style-palette guards) to assert every referenced primitive exists, so the
shared table can't silently rot. This is the same *browse/pick/refresh = three reads of one object*
insight from the segment library — and it makes **genre breadth a data task gated behind proof +
genre-agent vetting**, not an engine task.

---

## 7. Recommended build order (chair + rhythm-meter + L&D + market aligned)

1. **Beat-based chord-event timeline** (§4) — **L**, the keystone; bar-lock = trivial case. (= Playing-changes Stage 2.)
2. **Voice-leading between backing chords** (§5d) — **M** — the differentiator; rides the timeline; instant lifelike gain.
3. **`COMP_GROOVES` cell engine** (§5a) for the **~9 taught genres** — **L** — per-beat slots + per-hit
   target/artic (stab/sus/ring/mute-chug/arpeggiate) + **re-articulation** (kills the pad). Audio-engine's
   per-hit **envelope layer** (S, zero assets) + sound-design's velocity contour land here.
4. **`BASS_FIGURES`** (§5b) — **M** — incl. the generated melodic lines (reuse Connect) + `connectBass` walk-up.
5. **Genre `DRUM_GROOVES` + new lanes (ride/rim/openHat) + fills + humanization** (§5c) — **M**.
6. **Palette refactor to recipes-over-primitives** (§6) — **M** — then scale the taught + proven genres as data.
7. **Mix realism** (§5e: register-carve + pan + shared reverb + pre-limiter trim) — **M** — can run alongside #3.
8. **Breadth/exotic tier (DEFERRED behind proof):** `compLanes[]` multi-lane (reggae bubble, afrobeat
   interlock, bluegrass roll, disco strings), `cellBars`/`cellBeats` multi-bar + polymeter (Latin clave,
   flamenco compás, prog unison), the new articulations (pump/roll/arrastre/808-glide), the
   passing-chord generator, quartal/drop2/arpeggiate-note-order, half/double-time + swung-16th + triplet feels.

---

## 8. Per-genre signature → primitive map (the "various genres" answer)

What each lane named as its **#1 signature** and the **net-new primitive** it forced. (Taught-genre
rows are NOW work; the rest seed the deferred breadth tier + size the vocabulary.)

| Genre | #1 signature | Net-new primitive it forced |
|---|---|---|
| **Blues** | slow-blues **12/8 triplet** comp + the **turnaround** (bars 11–12) | triplet-subdivision feel; sub-bar turnaround (needs timeline) |
| **Jazz** | swung **walking bass + ride spang-a-lang** + sparse Charleston comp | 2-chords/bar; **per-voice swing** (swung ride / straight bass) |
| **Funk** | **16th scratch** (ghost chuck + accented stab on *the one*) + locked 16th bass | `mute-chug` artic + 16th ghost web; one-pocket bass |
| **Rock** | power-chord **8ths, chug-vs-ring** dynamic, backbeat lock | **per-hit `mute`/`stab`/`ring` artic** (the one field a pad can't do) |
| **Metal** | palm-muted **gallop chug (3+3+2)** on a double-kick | `pedal` target + `mute-chug`; **`couple:[bass,kick]`** unison; per-lane div double-kick |
| **Country** | **boom-chuck** (bass 1&3 / chuck 2&4) + train-beat | **per-beat comp `slots`** (the keystone); `connectBass` walk-up; per-recipe swing |
| **Pop** | syncopated muted strum + the **"&"-push**; dance four-on-floor | **`ARPEGGIATE`** primitive; sparseness (legal rest steps); anticipation |
| **Gospel** | keys comp riding a **chromatic passing-chord walk-up** | **generated `PASSING`/`APPROACH` chords** on the timeline; `swell` artic |
| **Reggae** | offbeat **skank** + **one-drop** + melodic bass | **`compLanes[]`** (skank + organ bubble); per-lane dropout (dub) |
| **Latin** | **montuno + tumbao over son clave 2-3** | **`cellBars:2`** + `claveDir` + hit-level `tie`/anticipation; swing-lock |
| **Folk** | alternating-thumb **Travis** + open-tuning drone | `alternating_thumb` bass; **`drone` lane**; drums-off default |
| **Bluegrass** | **mandolin chop on 2&4 (no kit)** + banjo roll + two-feel | `drums:none`/percussion-role comp; **concurrent chop + roll lanes** |
| **Flamenco** | the **12-beat compás** + rasgueado + palmas | 12-beat accent cycle; **`rasgueado-roll`/burst artic**; palmas/golpe percussion |
| **Classical** | **Alberti** broken-chord, no drums | **`arpPattern: int[]`** (note ORDER); independent contrapuntal bass |
| **Gypsy-jazz** | **la pompe** (down-up pump + choke) | **`pump`** artic (paired struck+ghost + LH choke) |
| **City-pop** | lush maj9/13 + chromatic-mediant + 16th-scratch + busy bass | `chromatic_mediant` transform; `busy_melodic` bass |
| **Soul/Motown** | the **melodic counter-line bass** | `motown_counter` as a **generator**; 12/8 triplet feel |
| **Disco** | **octave bass** + 16th scratch + string stabs + open-hat "&" | `octave_bounce`; string-stab as 2nd lane; open-hat choke slot |
| **Afrobeat** | the **interlock** (two 2-bar guitars) + ostinato + bell | per-lane **`phaseOffset`**; **bell** as a `role:'timeline'` non-backbeat |
| **New Orleans** | rhumba-boogie **tresillo (3-3-2)** LH + second-line | **`tresillo`** shared bass+accent atom; second-line "big four" |
| **Tango** | **marcato + 3-3-2 + arrastre** | **`arrastre`** drag artic (pre-beat crescendo glide into the downbeat) |
| **Norteño** | polka **oom-pah** (offbeat bajo chuck) | offbeat chuck placement; `rasgueo` vihuela burst |
| **Ragtime/stride** | **stride LH** (bass 1&3 / chord leap 2&4); boogie 8-to-bar | per-beat slots (bass↔chord); `bass_ostinato` figure |
| **Hip-hop-fusion** | **half-time 808** + swung-16ths + lush comp | **`808_glide`** (slide artic); `feel:halftime`; swung-16ths |

**The vocabulary collapses cleanly:** ~25 genres reduce to **per-beat slots + `compLanes[]` +
multi-bar cells + ~6 new articulations (`mute-chug`, `arpeggiate`, `swell`, `pump`, `roll`,
`arrastre`) + the `tresillo` atom + generated melodic/passing lines + per-lane swing/feel flags.**
The breadth is data on top of a small orthogonal field-set — which is exactly the north-star payoff:
the player learns a **finite grammar** that recombines, not 25 memorized tracks.

---

## 9. Decision log

1. **The fix is a primitive-driven engine, not 30 canned palettes.** (north star; market drift line)
2. **Keystone = the beat-based chord-event timeline** (= Playing-changes Stage 2). Build first.
3. **The only true differentiator = voice-leading + harmonic rhythm wired to the Jam mirror.** Build #2.
4. **NOW = unbreak the ~9 already-taught genres + the differentiator** (the proof-loop payload).
   **DEFER = palette breadth + the exotic-meter lanes** (clave/compás/polymeter/interlock) behind proof.
5. **Lifelike = gesture, not timbre** — re-articulate the pad via a per-hit envelope layer (zero assets);
   new instrument voices + NAM distorted comp are a smaller, later sourcing task.
6. **`STYLE_PALETTES` become thin recipes** over registries; a startup guard keeps them honest.
7. **Drift guardrails are hard rules:** loop a vamp not a song; no arrangement sections; no backing
   export; no "make me a jam" entry without a drill; Jam stays a mirror.
8. **Proof before breadth:** instrument the seam-landing / return-rate metric; let it gate the breadth tier.

**Handoffs into build:** harmony-theory owns the timeline schema, voice-leading rule, voicingStyle, and
the passing-chord spelling; rhythm-meter owns the comp-cell/feel engine + multi-bar cells + humanization;
drum-pedagogy owns the groove library + fills; bass- & piano-pedagogy verify bass figures + keys voicings;
audio-engine owns the envelope layer + new voices; sound-design owns the mix + safe output; each genre
agent authors its own recipe + cells when its tier is built.

---

# Build-plan v2 — 11-lane panel re-check (2026-06-05, build kickoff)

> The 11 build-owning lanes re-reviewed this spec against what shipped since 2026-06-03
> (rhythm/chord/djent ladders, the host refresh, the dev-ops scheduler measurement, honest
> scoring). §§1–9 above stand; this addendum records what CHANGED and the locked decisions.
> Per-lane detail lives in each agent's memory (`.claude/agent-memory/<agent>/project_backing_*`).

## What changed since §§1–9 were written

1. **Step 1 shrinks (L→M): the keystone is ~40% shipped.** `compileChordTimeline` exists
   (bar-locked) and `buildBackingEvents`/`buildBoogieBacking`/`measureGuideToneLandings` already
   read it. Remaining: sub-bar `durBeats`, `push` (clamped at count-in + loop seam), `bass`
   slash/pedal override, `gen:'approach'` tags — plus two per-block assembly fixes (keyCycle
   skips the timeline; multi-block sessions never assemble one → the proof metric would judge
   the wrong harmony). **Keep the shipped name `chart.timeline`** (not `chordTimeline`).
   Beats canonical, seconds derived: `startBeat/durBeats` = the harmonic slot (never pushed);
   `startSec/endSec` = the sounding window (push applied, pre-swing). The timeline stays
   compact (1–4 events/bar); `backingEvents` is the dense expansion — renderers never walk
   the timeline.
2. **One cell grammar (rhythm-meter ruling):** COMP_GROOVES = the shipped `STRUM_PATTERNS`
   grid schema with a step token allowed to be `{target, artic, accent}`; `RHYTHM_CELLS`
   stays the shared timing-atom library bridged by `cellOnsets(cell, div)` so tresillo /
   gallop / skank are authored ONCE and the backing plays the same named cell the player
   drilled. Drop `accentMap` (use the shipped accent encoding); per-beat `slots` = a `div:1`
   grid (country falls out free); `cellBars` 1|2 kept, **`cellBeats` stays gated** (true
   polymeter — the djent-ladder honesty tier).
3. **Scheduler = step 0 (unanimous, 5 lanes).** Measured: whole-pass = 39k nodes / 1.57s
   freeze at CURRENT density; the engine multiplies 5–10× (≈200–400k — "not slow, broken").
   ~10s window, refill at ~4s headroom off the existing tick; A–B loops stay whole-pass;
   count-in + per-block assembly untouched. Budget: ≤50ms play-press block, ≤2k live nodes
   typical / 5k hard, ≤5ms refill. Ride-along: the `_ptStreak` loop-wrap reset (same code
   path). NOT riding: attach-race counter, PT_HIT_FRAMES clamp (await dogfood evidence).
4. **Cheaper than spec'd:** articulation = AudioParam automation on the GainNode the WAF
   player already returns (**zero extra nodes**; mute-chuck +3/hit); all 14 GM voices already
   self-hosted (sourcing ≈ palette data + GM28 muted electric + CC0 IR clearance); voice-leading
   common-tone *ties* reduce event count. Mix DSP = persistent per-bus nodes only, never per-event.
5. **Sound-design re-sequencing:** velocity tiers (accent 1.0 / normal 0.78 / ghost 0.45) +
   the ARTIC envelope table + −2dB harmony trim + coupling trim ship **inside step 3** (a
   re-articulated comp without them sounds worse than the pad — the pumping artifact the
   current coalescing exists to prevent). Old step 7 splits: 7a inside #3; 7b (one shared
   zero-asset reverb + pan + register-carve) lands after #3 and **before drums**.
6. **Bass design flip:** backing bass landings = **ROOT on beat 1** (Connect's guide-tone
   preference is right for the lead line, wrong for bass), locked to the kick's grid slot.
   Reuse `nearestPositionForPc`, flip the preference. Roots MIDI 28–43, line ceiling 50,
   leap ≤9 (octave whitelisted), boogie ports as figure #1, mute the figure when the player
   IS the bassist. Walking/motown_counter generator rule-sets in bass-pedagogy's memory.
7. **Voice-leading rule-set (piano):** thread `prevVoicing` (anchor only the loop's first
   chord; never re-anchor mid-form), common tones hold literal MIDI, 7th resolves down by
   step into the next 3rd, nearest-motion ≤2 semis preferred / 5 hard, top-note ±3, re-seed
   at block seams + loop-seam drift correction (> a 4th). Hand-span guard in the voicer
   (≤12 semis AND ≤5 notes per hand, else re-voice; mirrors the no-unison guard) + the 3-row
   low-interval rule (below MIDI 48 only roots/5ths/octaves; 48–55 ≥m3; ≥55 anything).
   Rootless A/B formulas in piano-pedagogy's memory. Metal/djent need no voicingStyle
   (`chordOverride:'5'` covers them). NOT schema-gated on piano-as-instrument.
8. **Drums:** rename piece ids to the host's `lib/drums.py` vocabulary first (closed
   source-of-truth vocab; makes drum_tab export a serializer). ~11-cell NOW set (token
   sketches in drum-pedagogy's memory: jazz spang-a-lang + feathered kick ~0.10, gospel
   pocket, train beat). Fills land in the SAME batch (2–3 per groove + a no-fill pass,
   seeded round-robin, repeat period ≥12–16 bars; **the fill bar mutes the hat lane** —
   no third arm). Schema adds: per-lane velocity scale + a feathered-kick token `t` (never
   `f` — collides with the host wire-flam). Humanization kit-gated (electronic 0 / acoustic
   0.6 / jazz 0.8), never the count-in or a loop's first downbeat.
9. **Determinism is a hard rule:** humanization/fill rolls are **seeded and baked at
   generation time** (seed = stable hash of cfg identity + block index, stored on the chart);
   no bare `Math.random` in the generation path; the windowed scheduler stays a pure read;
   charts stay byte-golden. The determinism assert lands WITH step 1.
10. **L&D difficulty axis:** one ordinal `backingDensity` field, four named levels
    (0 click → 1 vamp → 2 groove → 3 full). Authored per-rung in `base`/`vary[]` (vary[]
    stepping it = the lateral ladder); Workout derives a default from block role; Jam = full.
    Orthogonal to tempo. New lane-suppression rule: **player-is-the-comp** (`strum_comp`
    blocks drop the comp lane; sibling of drop-the-pad-root). Name the active primitives on
    the goal card + the pulse-caption slot ("Backing: boom-chuck · two-feel bass") — every
    registry primitive carries a player-facing `label` from day one.
11. **Verification:** new `smoke-backing-engine.mjs` (timeline structural validity for every
    recipe; same cfg+seed → byte-identical chart; recipe-integrity guard fires on an injected
    bad ref; bounded backing voice-leading motion) + a scheduler node-ceiling row in
    `smoke-session-sync`. Generators/core-purity cover the new paths free via enumeration.

## Locked decisions (Christian, 2026-06-05)

1. **Scope: build all ~9 taught genres BEFORE the release** (overrides the panel's
   ship-one-genre-and-measure rec — Christian's call). Jazz still goes FIRST as the vertical
   pilot through steps 3–5 (L&D: the differentiator's home; today's jazz backing actively
   mis-teaches swing); blues stays the A/B control; the other 8 follow before release.
2. **NAM: in-house + detect.** A WaveShaper + CC0 cab-IR chain is the first-class distorted
   comp voice (zero deps, zero license risk — the nam_tone repo is UNLICENSED, so vendoring
   is off the table); feature-detect `nam_tone` behind a `toneChain(input)→output` seam in
   §14 as a free upgrade. Follow-ups: clear one CC0 cab IR; add the repo LICENSE file.
3. **Proof-loop flag ON with this build** — dogfood the verdict card; the rich-vs-pad seam
   measurement (local ring buffer: seamRatio, rootRestarts, backing kind, per id) rides it.
4. Minor (panel recs applied): REF_TRIM bus trims become the fader-unity defaults (notes 0 /
   bass −5 / harmony −10 / drums −9..10 / click −14; limiter unchanged, ≤3–4dB GR ceiling);
   funk palette goes Dorian (`dorian_vamp` + `auto` depth); pushed/anticipated landings
   CREDIT the seam proof (score the sounding window); `backingDensity` authored-only at
   first (no player stepper yet); the pad-vs-comp A/B toggle ships as a dev flag.

## Build order v2 (supersedes §7)

0. **Rolling-window scheduler** (§14) — the prerequisite.
1. **Finish `chart.timeline`** (sub-bar durBeats, push, bass, approach tags; keyCycle +
   per-block session assembly fixes; determinism assert + the new smoke suite land here).
2. **Voice-leading between backing chords** (prevVoicing threading + the piano rule-set +
   in-voicer guards; modal-M1 palette tokens + funk-Dorian ride along; keys register-carve).
3. **COMP_GROOVES** on the unified grammar + the pad-kill + mix 7a + `backingDensity` +
   player-is-the-comp suppression; boogie migrates to a recipe as the proof.
   **3.5** mix 7b (shared reverb / pan / carve) — before drums.
4. **BASS_FIGURES** (root-on-1, kick-locked; boogie figure #1; walking + motown generators).
5. **DRUM_GROOVES + fills** (lib/drums.py rename first; ~11 cells; fills same batch;
   per-lane velocity scale; seeded humanization).
6. **Palettes → recipes** + integrity-guard extension; then the remaining 8 genres' recipes
   (each vetted by its genre-idiom agent) before release.
7. *(unchanged)* Breadth/exotic tier stays DEFERRED behind proof: compLanes[] multi-lane,
   cellBeats polymeter, swung-16ths (`swingUnit`), quartal/drop2, busy_melodic, the
   passing-chord generator, pump/roll/arrastre/808-glide.

---

# Step 4 build record — BASS_FIGURES (2026-06-07, session #15)

**SHIPPED + 3-lane vetted** (bass-pedagogy / blues-idiom / jazz-idiom — verdicts in their
agent memories; all must-fixes landed same session). Guarded by `smoke-backing-engine`
§6c (17 rows) + §6d (6 vetting rows) — 80 checks, 16/16 net.

**What landed (screen.js, grep `BASS_FIGURES`):**
- **Registry**: pattern figures `sustained_root` / `two_feel` / `root_pump` /
  `bass_ostinato` (the boogie R-5-6-♭7 port = figure #1, label "boogie bass figure") +
  generators `walking` / `motown_counter`, every figure labeled; startup guard (grid
  shape, beat-1-root kick lock, iv range, root window under the ceiling).
- **Realism numbers** (bass-pedagogy's locked re-check, implemented): roots fold 28–43
  (soft Eb-edge: one-semitone ceiling overshoot beats dropping below E1), line ≤50,
  leap ≤9 + octave-12 whitelist + repair pass, 0.9×slot note length, beat-1 root at the
  chord slot's exact time (the kick lock; on-beat quarters are fixed points of the swing
  warp ⇒ a jazz walking line stays straight under a swung ride **by construction**),
  velocity tiers 1.0/0.78/0.45.
- **Resolver** `bassFigureForConfig` (mirrors `compCellForConfig`): A/B `backingPadDev` +
  density gates first (bass enters at density 2), `isBassCfg` PLAYER-IS-THE-BASSIST mute
  (jam-drops-bass), authored `cfg.backingBass` wins, boogie → `bass_ostinato`, swung
  non-boogie → `walking` (the jazz pilot, arriving with the Charleston).
- **Register lift**: pad/cell voicings drop the folded root (lowest voice ≥48) whenever a
  figure plays (`voiceBackingChord`/`voiceLeadBackingChord` lift windows; `compTargetMidis`
  pedal lift).
- **Boogie full-recipe migration**: `boogie_stab` cell + `bass_ostinato` figure replace the
  bespoke builder (kept verbatim behind `virtuoso.backingPad='pad'` for A/B); roots now
  fold into the TRUE bass octave 28–40 (the 36–48 guitar-window bias bass-pedagogy flagged
  is gone). strum_comp suppression now precedes the boogie branch (the rule beats a
  style recipe — behavior change for boogie+strum_comp cfgs, which now get no backing).
- **One carrier per change**: exactly one event per chord change carries
  name/cpcs/gpcs/rn/fn — the figure's beat-1 when present, else the cell's first hit, else
  the pad (also fixed step 3's label-on-every-hit). Jam consumers made dense-lane-proof:
  `jamNextGuidePcs` walks carriers (wrap-aware), `overviewBands` Jam branch filters to
  carriers (band end = next carrier's start).
- **Plumbing**: hidden `backingBass` field (screen.html) → readConfig → anti-leak in
  applyPathwayConfig; goal-card line now names both primitives
  ("Backing · Charleston comp + walking bass").
- **Determinism**: generators draw only from `chartRng(cfg)` (fresh instance — the note
  path's rolls are untouched); same cfg ⇒ byte-identical backing.

**Vetting verdicts + fixes landed (2026-06-07):**
- *bass-pedagogy*: patterns/boogie PASS; walking FIX → **two-pass seam targeting** (pre-roll
  every window's beat-1 degree; approaches target the ACTUAL next landing — kills the
  cross-barline stall jazz also flagged); motown FIX → **quality-gated colour tone** (♭7
  over minor-3rd chords; natural 6 only over maj/dom). Rulings: walking beat-1 roots obey
  the LINE window (28–50) via seam-nearest, not the 28–43 pattern fold; the boogie
  transposed-ostinato seam leap is exempt from the walking cap.
- *blues-idiom*: PASS-with-notes → **boogie_stab accents moved to '&-of-2'/'&-of-4'**
  (backbeat-side, riding the snare crack; &-of-1/&-of-3 read oom-pah). Confirmed the
  octave-deeper roots and the 0.225-beat post-warp chick. Audition evidence note: probe
  must use the real `12_bar_blues` palette token (the first audition's "12bar_blues" fell
  back to I-V-vi-IV).
- *jazz-idiom*: PASS-with-notes → **walk accents only on chord changes** (accent = "new
  chord here"; a hammer on every downbeat is oom-pah) + **Charleston accent moved to the
  '&-of-2' push**. Time-feel mechanics confirmed correct-by-construction.

**Step-5/6 carry-forwards from vetting:** jazz needs its own DRUM groove (a swung cfg
currently gets `straight_8th_rock` — a swung ROCK beat under a jazz trio; spang-a-lang +
hat 2/4 is already in the step-5 plan) · move the walking/Charleston trigger from the
swing FEEL key to style/recipe keys at step 6 (a rock rung flipping swing on as a feel
exercise shouldn't summon a jazz trio) · slow-blues 12/8 wants a longer-sustain stab cell
at crawl tempos · tempo-adaptive swing-ratio curve (rhythm-meter lane) · I-bar walking
oscillation excursion bias (polish) · dom7 depth for raw Custom boogie cfgs (harmony lane).
