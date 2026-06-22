# Genre-Band Realism Round-table — "best-in-class without loops"

**12-lane design panel, 2026-06-13 (session #33).** Christian: *"The country/jazz/metal
backing bands are still barely in the ballpark. How far can we take procedural band
generation — better articulation, note-lengths, sound-shaping, sub-genres,
instruments/mixes, per-genre rhythm rules — and where's the absolute line before we cross
into loops / generative-AI audio?"*

Panel (all reported): country-idiom (chair) · jazz-idiom · metal-idiom · guitar-pedagogy ·
bass-pedagogy · piano-pedagogy · drum-pedagogy · audio-engine · rhythm-meter ·
harmony-theory · sound-design · feedback-compatibility. Main thread synthesized.
Per-lane detail lives in each agent's `.claude/agent-memory/<agent>/project_*best*`. This
doc is the build spec + decision log. Companion to `docs/genre-band-authoring-playbook.md`
(the 11-dimension *content* checklist) and `docs/backing-pipeline.md` (the pipeline). This
round-table is about **realization quality**, not which cells a genre picks.

---

## 1. The unifying diagnosis (what "barely in the ballpark" actually is)

Every lane converged on the same reframe, and it is good news:

> **The charts are right; the *realization* isn't. And the gap is content/data, not
> architecture — there is no missing subsystem to design.**

The beta.13–15 work (placement, lock/interlock, space, the recipe layer) genuinely
landed — country no longer skanks, metal's gallop locks, jazz swings. What's left splits
into two findings and a thin third:

- **A — "the band hasn't caught up to the guitar."** The CC0 Shinyguitar DI voice
  (`sgVoice` ~5732) already has producer-grade rendering: round-robin, velocity layers,
  recorded dead-strums/mutes, seeded double-tracking. But **the rest of the band plays
  through `wafVoice` (~16966) → a bare `queueWaveTable` call: one sample per region, no
  per-hit envelope, no round-robin, no detune/start jitter, and the articulation tag
  (`chug`/`stab`/`sus`/`ring`/`chuck`) is never even passed to the sampler.** So a
  palm-muted chug, a staccato stab, and a let-ring are *the same GM sample at a different
  length and volume*. That asymmetry — guitar real, band GM-ish — **is** "every genre
  sounds the same." (guitar-ped, bass-ped, audio-engine, drum-ped all independently.)

- **B — the comp *voicing vocabulary* is three shapes.** The whole engine has exactly
  `triad` / `shell` / `power` (`compTargetMidis` ~7300, `backingVoicingStyle` ~6779). So
  **every jazz-family genre — jazz, funk, soul, gospel, city-pop, latin, gypsy, ragtime,
  prog — plays the identical 3-7-9 shell forever.** That's the pitch-side reason jazz reads
  generic. (harmony.)

- **C — "variation without intent."** Where variation exists it's a *uniform die-roll*, not
  a musical choice: jazz comp varies per bar at random (not form-aware), and metal's
  "riff" shuffles 1-bar chugs (`vary[] ≠ a riff`; the fixed 2-bar riff cell was specced but
  **never built**). (jazz, metal.)

A recurring sub-theme: several of the highest-value items are **specced-and-unbuilt**, not
undesigned — the jazz rootless A/B keys voicing (ruleset written 2026-06-05), the per-hit
envelope layer (pipeline doc "designed not built"), the country next-chord walk, the
`gen:'approach'` passing-chord hook (reserved in `compileChordTimeline` ~6950, nothing
implements it). Cheap to finish.

---

## 2. Christian's four questions, answered

1. **Better articulation / note-lengths / sound-shaping?** — **Yes, and it's the #1 lever.**
   The band is *articulation-deaf* (finding A). A per-hit envelope/articulation layer on
   `wafVoice` is the single biggest perceived-realism win and it improves **all 29 genres at
   once**. Note-length needs a per-genre gate + legato overlap (today every non-`sus` hit is
   one fixed fraction). Sound-shaping = per-genre reverb character + console saturation +
   buss glue (the mix scaffolding exists; it varies *amounts* through one shared room).

2. **More granular sub-genres (70s country / western swing; thrash / doom / hair; bebop /
   cool)?** — **Yes, but as PARAM AXES, not new `STYLE_PALETTES`** (unanimous across every
   idiom lane). A sub-genre = a named recipe bundle over **tempo · drum cell · comp/riff
   cell · feel/swing · voicing type**, plus two harmony dials (`reharmDensity`,
   `voicingType`). That's cheap data, not a combinatorial blow-up. The *one* place a
   sub-genre needs a real asset is **timbre** (a brushed kit) — a sample-set, Stage 2.

3. **Better instruments / mixes (channel count, sounds, EQ/FX)?**
   - *Sounds:* **Yes — the realism ceiling on the loud layers.** Velocity-layered +
     round-robin sample sets, **drums first, bass second** (audio-engine's payoff ranking).
     All BUILD — host ships zero borrowable banks (host-expert).
   - *Channel count:* **Cautiously. CPU isn't the limit — *mud* is.** Add a lane only when a
     recipe declares it (organ+gtr soul, piano+gtr country, a percussion shaker/tamb lane —
     the safest "fuller" add). Never a global bump.
   - *EQ/FX in presets:* **Yes** — per-genre reverb *character* (not just send amount),
     gentle console/tape saturation on the clean buses, a buss-glue compressor. All
     zero-asset, deterministic, safe.

4. **Per-genre articulation + rhythm rules (multiple strum patterns, note-length / velocity
   / timing-humanization algorithms)?** — **Yes, all of it, and most is Stage 1.** Continuous
   velocity + a meter-aware accent template + ghost-ramps into the backbeat; per-genre note
   gate/legato; multiple strum patterns (a country `vary[]` bank + new cells, plus a
   strum-spread/stroke-direction model); form-aware comp variation; real metal riffs.
   **Crucial constraint:** humanization should get *more sophisticated* but stay **seeded,
   bounded, and consistent** — see §3.

---

## 3. THE LINE — best-in-class *without* loops (the headline deliverable)

Every lane independently put the boundary in the same place, and two lanes (rhythm-meter,
audio-engine) found the deeper reason it's the *right* place, not a compromise.

**Where the line is:** procedural, note-level rendering — velocity-layered + round-robin
multisamples + per-hit envelopes + slides + amp/cab modeling + per-genre procedural
reverb/saturation/glue + idiomatic voicings/voice-leading/passing-chords + a bounded,
*consistent* micro-pocket — reaches **"convincing sample-library / competent session band":
believable enough that a practicing player locks to it and never thinks 'that's fake.'**
That is best-in-class without loops. **We are ~70% there on guitar, ~40% on the rest of the
band** — the ceiling is mostly *unspent*, not reached.

**What lies beyond the line (only recorded loops or generative-AI audio can give it — and
we forgo it on purpose):**

1. **Inter-note performance coupling** — legato/portamento between *specific* notes as one
   physical gesture; a drummer's push-pull around a fill; a ghost bleeding into the next
   hit. (Sample-per-note triggers independent grains; round-robin fakes variation, not
   coupling.)
2. **Ensemble micro-interaction** — two humans listening and breathing together; a comper
   reacting to the soloist. (We can seed *correlated* jitter to approximate; we can't
   capture — and reacting-to-the-player violates the practice premise anyway.)
3. **Captured room / mic-bleed / console glue / mastered sheen** — the cohesion of a real
   tracking room in every part. (Convolution approximates a *space*; it isn't the band *in*
   it.)
4. **True uncorrelated human inconsistency** — genuine drift/fatigue/a wandering pocket,
   different every bar.

**Why forgoing it is the design, not a sacrifice — three hard reasons:**

- **Determinism.** Loops/AI break the byte-identical-chart rule. Practice needs the *same*
  band twice to internalize.
- **Note-addressability.** A loop/AI render isn't targetable by the chart, the grader, or
  the fretboard mirror. The entire USP — *the band wired to the drill and the mirror, every
  note visible and targetable* — dies the moment a part becomes opaque audio.
- **The practice frame.** A mastered loop is a *jukebox to play over*, not a *band to play
  into*; and chasing "human inconsistency" (#4) actively destroys the steady time reference
  a learner locks to. **rhythm-meter's key finding: the diminishing-returns ceiling and the
  practice-mission ceiling coincide.** We stop at "the tightest, most idiomatic, most
  *consistent* fake band," and that is exactly what a practice tool should want.

**The moat that falls out of this:** a deterministic, note-addressable, fully-procedural
band at sample-library realism — *loop tools can't target the notes; AI tools can't
reproduce the take.* Nobody else is at that intersection.

---

## 4. The multi-stage plan

Three stages, ordered by leverage-per-effort. Stage 1 is the bulk of the perceived
improvement at **zero new assets** (edits to functions/tables that exist). Stage 2 is where
it crosses into best-in-class and is the only place with real asset cost. Stage 3 is the
connoisseur tail — tune by ear, mind the over-humanization cliff.

### Stage 1 — "Catch the band up to the guitar" (zero new assets, existing code)

| # | Change | Owner(s) | File anchor (panel-cited) |
|---|---|---|---|
| 1 | **Per-hit articulation envelope on `wafVoice`** — pass `ev.a` → shape attack/hold/release on the GainNode `queueWaveTable` already returns. The keystone; helps all 29 genres. Subsumes bass upright thump/decay + gallop staccato + dead-note gate. | guitar-ped, audio-engine, bass-ped, rhythm-meter | `wafVoice`~16966, `queueWaveTable`~877, scheduler loop |
| 2 | **Round-robin micro-variation on `wafVoice`** — seeded ±detune/±gain/±start-offset per repeat (port what `sgVoice` already does). Kills machine-gun repeats. | audio-engine, guitar-ped | `wafVoice`~16966 |
| 3 | **Continuous velocity + meter-aware accent template + ghost-ramp** — replace the 3-tier enum at emit; `vel` is *already* continuous downstream and *already* trips a harder sample layer (`SG_VEL_HARD`~5629), so it's near-free and adds a timbre contour. | rhythm-meter, guitar-ped, drum-ped | emit ~7777, `COMP_VEL`~7024, new `METRIC_WEIGHT` |
| 4 | **Fix `humanizeDrums` ghost-ramp** — the random jitter currently *erases* the authored `g g g a` ramp into the backbeat. Make ghost velocity a deterministic contour. | drum-ped, rhythm-meter | `humanizeDrums`~8309 |
| 5 | **`voicingType` expansion** — extend the 3 comp shapes to drop2 / rootlessA / rootlessB / quartal(So-What) / country double-stop+sus / metal ♭5-tritone+octave. Biggest pitch-side fix. Build the unbuilt jazz two-hand `voiceKeysComp` here. | harmony, piano-ped, country-idiom, metal-idiom | `compTargetMidis`~7300, `backingVoicingStyle`~6779 |
| 6 | **Jazz form-aware weighted comp picker** — replace the uniform die-roll with form-conditioned weights (anticipate the change, lay out mid-phrase). | jazz-idiom | comp picker ~7750 |
| 7 | **Metal fixed 2-bar riff cell** — build the `bars:2` pedal-point riff; make `metal_chug_stab` a fixed phrase, not a bar-shuffle. The metal "ballpark" fix. | metal-idiom | `COMP_GROOVES`~7025 + recipe matrix |
| 8 | **Buss-glue compressor on `backingGroup`** — one gentle node so the band reads as played-together, not assembled-from-stems. (After the break-fade gain node.) | sound-design | `trackBus`~14823 / backingGroup |
| 9 | **Sharpen the 3 `MIX_RECIPES` deltas** + author flams (free; `f` token already supported ~8353) + drop ghost level ~0.45→0.2. | sound-design, drum-ped, guitar-ped | `MIX_RECIPES`~14769, `DRUM_GROOVES`, `COMP_VEL` |
| 10 | **Country `country_chuck` `vary[]` bank** + a metal blast-beat cell. | country-idiom, drum-ped | `COMP_GROOVES`, `DRUM_GROOVES`~7909 |

### Stage 2 — Per-genre depth + the sourcing/space tier (CC0 assets; the crossing point)

| # | Change | Owner(s) | Note |
|---|---|---|---|
| 1 | **Velocity-layered + round-robin sample sets — drums first, bass second.** 3–4 vel × 2–3 RR per piece, CC0 SFZ via the region player the Shinyguitar loader already proves. The realism ceiling on the loud layers; mix *cannot* fix it. **All BUILD** (host ships nothing). | audio-engine, drum-ped, bass-ped | `scheduleDrumHit`~16690, `KIT_REGISTRY`~4500 |
| 2 | **Brushed kit + modern-metal kit + the 6 synth-only cymbals** (china/splash/crash_r/ride_bell/snare_xstick/tom_floor are excluded from `SAMPLED_DRUM_NOTES`~4499). The biggest sub-genre *timbre* lever. CC0, gitignore-until-cleared. | drum-ped, audio-engine | brush = jazz+country; china = iconic metal |
| 3 | **Per-genre reverb character** (procedural IR bank: jazz dark room / country plate + slap-back delay / metal tight-dry) **+ console/tape saturation on clean buses** (reuse `buildAmpChain` at low drive, loudness-matched). Both zero-asset, deterministic. | sound-design | `ensureSharedReverb`→`ensureGenreReverb`, `MIX_RECIPES` `space`/`sat` |
| 4 | **Strum-spread + stroke direction** — per-step `dir` + ~12–22ms spread (cap vs tempo) + per-string velocity tilt. Turns block chords into strums. | guitar-ped | scheduler per-string loop, `COMP_GROOVES` step schema |
| 5 | **Genre-conditioned voice-leading** — `smooth` (jazz/gospel: enforce 7→3 + contrary bass, tied to the Jam guide-tone ghost) / `parallel` (country/rock) / `none` (metal). **The named USP, currently half-built.** | harmony | `voiceLeadBackingChord`~6837 (no genre param today) |
| 6 | **Tempo + genre + per-VOICE swing** — `swungTime` reads one global bucket; make it tempo-interpolated, per-genre, and per-voice (swung ride over near-straight bass — not supported today). | rhythm-meter | `swungTime`~11684, `feel.swing` schema |
| 7 | **Note-length: per-genre gate + legato overlap + humanized release.** | rhythm-meter | `COMP_ARTIC`~7023, artic-length calc ~7765 |
| 8 | **Country band depth** — next-chord-aware two-feel walk (`kind:'gen'`, reuse `bassWalkEvents`); `country_train_8` + `country_ballad_arp` comp cells; the `dyad6` double-stop "pedal-steel" target (beats the folk-confusion test). | country-idiom, bass-ped, harmony | `BASS_FIGURES`~7351, `COMP_GROOVES`, `compTargetMidis` |
| 9 | **Sub-genre PARAM axes** — `countrySub` (neotrad/Bakersfield/western-swing) · `jazzFeel` (trad/bop/cool/modal/ballad) · metal recipe bundles (thrash/death/doom/djent/hair) · `reharmDensity` + `voicingType`. Recipe rows over the existing schema (precedent: `pop:dance` via `arrangementFeel` ~8143). | all idiom + harmony | `ARRANGEMENT_RECIPES`~8094 |
| 10 | **Muted-attack "chk" transient** on the WAF fallback comp (noise burst via the drum-noise path) + **bass slide/dead-note** primitives (the `slides` 8th param of `queueWaveTable` exists and we pass `undefined` today). | sound-design, guitar-ped, bass-ped | scheduler; `queueWaveTable` `slides`~906 |
| 11 | **Country pedal-steel keys** — oblique glide (one pad voice ramps a tone into the new chord tone while others hold) + volume swell; offer honky-tonk piano / Hammond as the country keys voice. | piano-ped, harmony, audio-engine | `scheduleHarmonyPad`~16559 (pitch ramp) |
| 12 | **CC0 clean/crunch cab IRs** (cab ≈ 80% of amp tone; clean/OD are procedural today). | audio-engine | `/ir` + `ensureCabIr`~14601 |

### Stage 3 — Connoisseur pocket + the tail (by-ear; the over-humanization cliff)

| # | Change | Owner(s) | Note |
|---|---|---|---|
| 1 | **Per-subdivision bounded micro-pocket** (Dilla feel) — `FEEL_TIMING[genre].grid = [ms per position]`; **clamp ±15ms, keep CONSISTENT** (the same beat dragged the same amount every bar is a *feel*; random-per-bar is the gimmick that wrecks the reference). Tune last, by ear. | rhythm-meter | `applyFeelLean`~11739 |
| 2 | **Tempo-dependent ensemble pocket depth** (a `pocketDepth` master scaler — laid-back at verse tempo, tight when pushed). | rhythm-meter | `feel.pocketDepth`, `applyFeelLean` |
| 3 | **Engine-generated passing chords** — implement `gen:'approach'` via a deterministic idiom registry (jazz ii-V/tritone-sub; country walk-up dim; gospel passing 2-5-1). **Rule: connect authored chords; never *choose* them.** The harmonic-rhythm USP. | harmony | `compileChordTimeline`~6953 + `PROGRESSION_GRAMMARS` |
| 4 | **Per-limb drum push/pull** (salt humanize per voice — ride floats over a planted kick) + hat-openness gradient + velocity contour within rolls. | drum-ped, rhythm-meter | `humanizeDrums`~8309 |
| 5 | **Pinch-harmonic primitive + per-hit pick-noise attack transient** (metal — closes most of the last 10% loops would buy). | metal-idiom, audio-engine, sound-design | `COMP_ARTIC`, `sgVoice`/amp chain |
| 6 | **Recipe-declared extra lanes** (2nd comp / percussion) — only where the idiom is genuinely 2-instrument. Never global. | audio-engine | per-recipe `ensemble` flag |
| 7 | **NAM amp borrow upgrade** — "use my `nam_tone` tone": feature-detect the worklet, read the player's `/presets` + `/file/ir` (A2 loads free). One backing tone bus only (CPU). | audio-engine, host borrow | feature-detect `/api/plugins/nam_tone/worklet/*` |

---

## 5. Table-stakes vs differentiator vs drift (panel consensus)

- **Table-stakes (below this we're under the bar competitors already clear):** per-hit
  articulation envelopes on the whole band; velocity-layered/round-robin drums+bass;
  per-genre reverb character; continuous velocity with metric accents; a non-robotic
  comp; a jazz "piano" that isn't a 3-note guitar grab.
- **Differentiator (the moat — invest here):** a deterministic, note-addressable,
  fully-procedural band at sample-library realism; genre-idiomatic **voicing types** +
  **genre-conditioned voice-leading tied to the Jam guide-tone mirror** (the named USP);
  engine-generated **passing chords** ("connect, don't choose"); per-voice swing; a real,
  *consistent* pocket; a Mixer/Rig the player can ride.
- **Drift to refuse (the bright lines):** pre-rendered loops/stems; generative-AI audio; a
  shipped default NAM model; a blanket 2nd/3rd comp lane; a "humanize amount" slider or
  drum-programming UI; **any "generate a riff/solo/song" faucet**; a "save/export my
  band/mix as a track" button; chasing the soloist (breaks the practice premise);
  exploding sub-genres into N `STYLE_PALETTES`; choosing/reharmonizing the progression.

---

## 6. HOST CHECK summary (feedback-compatibility, runtime 0.2.9, 2026-06-13)

| Capability | Verdict | Note |
|---|---|---|
| Multisample / sample banks | **BUILD** | Host plugins load WAF off a CDN, ship zero asset files. Curate our own. |
| `nam_tone` amp worklet + player presets/IRs | **BORROW** | The *only* borrowable audio primitive; feature-detect; A2 free; cab stays our Convolver. |
| Drum kit sounds | **BUILD** | `lib/drums.py` is a closed GM map — borrow the **piece NAMES** only (future `drum_tab` export). |
| Reverb / FX / shared DSP | **BUILD** | Host exposes none to plugins; its own inventory lists `audio-effects` as *missing*. |
| Channel count / bus routing | **BUILD** | No plugin-routable WebAudio mixer; own buses → master limiter; don't bind to the native player mixer. |
| Imminent host audio roadmap | **nothing to wait for** | Audio roadmap is native-engine/song-format plumbing; no sampler/FX item. |

Standing corollary confirmed: the never-build-our-own-DSP rule is **detection-only**
(note_detect territory); it does not restrict synthesis/sampling/FX, which the host doesn't
provide anyway. The real constraint is **CPU**: one NAM worklet bus max; respect the
rolling-window node ceiling as channel count grows.

---

## 7. Open decisions for Christian (the forks the panel surfaced)

1. **Scope / sequencing.** Recommended: **build Stage 1 (zero-asset, ~all of it edits to
   existing functions), dogfood by ear, then decide Stage 2** — the sourcing tier (CC0
   curation + licensing) is the only real cost and should be committed *after* the cheap
   realization pass proves the ear-gap is closed. (Matches the playbook's "tune by ear then
   ship" and the project dogfood rhythm.)
2. **Sub-genres now or later.** Recommended: **after** the core realism lands — sub-genres
   are a param axis (cheap), but they multiply the by-ear tuning surface; do them once the
   three exemplars sound best-in-class.
3. **Sample-set licensing.** Stage 2's kits/cabs are CC0-curation work with a clearance
   step (the playbook's gitignore-until-cleared rule). Confirm appetite before that hunt.

Everything else is engineering the panel has already specced.
