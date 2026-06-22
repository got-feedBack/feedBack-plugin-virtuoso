# Guitar-Focused Genre Framework (Prog / Metal / Fusion / Emo / Trap-Rock)

> Research + framework spec (2026-05-29). Companion to `docs/theory-progressions.md`.
>
> These genres are where Virtuoso can separate itself from pop-loop progression
> tools. The competition generates I–V–vi–IV in a key. Almost none of them model
> **power chords, pedal-point riffs, polymeter, drop/extended-range tunings,
> harmonized twin-guitar lines, or exotic/symmetric scales** — which is exactly
> what guitarists in these scenes practise. This doc lays the framework before we
> build, so the work lands as a coherent system, not one-off genre hacks.
>
> Theory/pedagogy only — no proper nouns, per the attribution-cleanup convention.

---

## 0. The key reframe: riff/device, not chord-loop

For pop/jazz/country, "a progression" is a chord loop and the player solos over it.
For the genres here, the practised object is usually a **riff or a harmonic
device**, not a diatonic chord loop:

- A metal "progression" is a sequence of **power-chord roots**, often moving by
  **semitone / chromatic** intervals, frequently over a **held low pedal**.
- A melodeath signature is a **harmonized twin-guitar line in 3rds**, not a chord
  change.
- A djent "progression" is a **rhythmic cell** (grouping of chugs) more than a
  harmonic one — the harmony can be a single palm-muted power chord.

So the framework additions below are mostly about **chord quality (power chords),
root motion (semitones), rhythm (polymeter/gallop), tuning (drop/extended), and
harmonized voices** — not new chord-loop presets. The existing degree-array model
and the `{semis}` token from `theory-progressions.md` §1 cover the harmonic side;
this doc adds the missing primitives around it.

---

## 1. What already exists (reuse, don't rebuild)

| Capability | Status | Notes |
|---|---|---|
| Odd / grouped meters | ✅ | `parseMeter` supports `7/8:2+2+3`, `5/4`, grouping-aware beat accents. UI exposes 3/4, 6/8, 7/8 (both groupings), 5/4. |
| Extended range | ✅ | guitar 6/7/8-string in `STRING_SETUPS`; custom tunings via the per-string editor → covers drop tunings. |
| Tremolo picking | ✅ | `tr:true` generator. |
| Pedal point | ✅ | generator exists — but as a *scale* exercise, not a power-chord riff (see §2.3). |
| Scale in thirds / sixths | ✅ | single-line today; the basis for harmonized twin lines (see §2.4). |
| Legato / tapping / string-skip | ✅ | serve fusion/prog/djent lead vocabulary. |
| Sweep arpeggios | ✅ | neoclassical / melodic-metal / prog. |
| Chromatic generator | ✅ | death-metal chromatic runs, warmups. |
| Rhythmic displacement | ✅ | djent/prog feel; phrase offset across the barline. |
| Exotic scales present | ✅ | phrygian, phrygian_dominant, locrian, locrian_♯2, harmonic_minor, whole_tone, diminished (whole-half), altered, lydian, lydian_dominant. |

## 2. Framework gaps (the new work, prioritised)

### 2.1 Power-chord quality — ✅ DONE (2026-05-29)
Added `'5'` (root+5th) and `'5oct'` (root+5th+octave) to `CHORD_FORMULAS`, exposed
in the `chordOverride` dropdown under a "Power (no 3rd)" optgroup, and routed
around the CAGED triad-template path (see §2.1a) so they voice as actual power
chords, not maj triads. `MODE_FOR_QUALITY` maps them to `minor_pentatonic` for
mode-of-moment. `chordName` already produces `E5` correctly.
- Unlocks **every** rock/metal/punk genre at once. A power chord is deliberately
  third-less; substituting maj/min is harmonically wrong for these styles.
- Voicing: on drop tunings the one-finger low-string power chord (root + 5th on
  adjacent strings) is the idiom; `5oct` is the three-string shape. Concrete
  one-finger drop-tuning shapes are still a renderer/fingering follow-up.

### 2.1a Extended chords (9 / 11 / 13) — ✅ DONE (2026-05-29)
Added alongside power chords (requested for piano forward-compat, ROADMAP Phase 6):
`maj9/min9/dom9`, `maj11/min11/dom11`, `maj13/min13/dom13`, plus `6`, `min6`,
`69`, `min_maj7`, `sus2`. Defined as **interval stacks above the octave**
(9th=14, 11th=17, 13th=21) — a pitch-primary definition that is instrument-
agnostic. Guitar position-pickers reduce them to pitch classes; a future piano
voicing engine reads the full stack. **Voicing decisions** (drop-2, omit-3-under-11,
octave placement) are deliberately NOT in the data — they're a render-time concern.
`MODE_FOR_QUALITY` maps each extension to its parent 7th's chord-scale (dom11→
mixolydian for the natural 11). Backing-pad voicing (`voiceBackingChord`) still
caps at 4 core tones, so the pad plays the core triad/7th under extended charts —
fine for now; a voicing engine is the place to surface the extension audibly.

### 2.1c Auto-diatonic chord depth (9/11/13) — ✅ DONE (2026-05-29)
`chordDepth` now offers `ninth` / `eleventh` / `thirteenth` in addition to
triad/seventh. With chord-quality override = Auto, extended depths build each
chord by **stacking true diatonic thirds from the active scale** — so every
degree gets its real chord, altered tensions and all (major-key iii →
`m13(♭9♭13)`, IV → `maj13(♯11)`, harmonic-minor III → augmented-maj). Mechanism:
- `diatonicChordIntervals(scale, degree, tones)` stacks scale thirds → exact
  interval set (heptatonic scales only — the `DIATONIC_QUALITIES` set).
- `diatonicExtendedQuality()` registers a memoised **synthetic** `CHORD_FORMULAS`
  entry (key `__d:<scale>:<degree>:<depth>`) carrying `intervals`, a derived jazz
  `symbol` (`deriveChordSymbol`), and a `mode` (the base seventh's chord-scale, so
  mode-of-the-moment still works). Every existing `CHORD_FORMULAS[quality]`
  consumer picks it up with **zero call-site changes**.
- **Borrowed/secondary chords** (progression overrides, future tritone subs) don't
  diatonically stack — they promote via `QUALITY_EXTEND` to their natural extended
  named form (e.g. a secondary-dominant V7/x → `dom13`). Non-heptatonic scales
  (pentatonic/blues) promote the fallback seventh the same way.
- Notes are always exact; the symbol is a readable approximation that flags spicy
  tensions. Backing-pad voicing still caps at the core 4 tones (extension shows in
  the chart/arpeggio, not muddying the pad).
### 2.1d Tritone substitution — ✅ DONE (2026-05-29)
`tritoneSub` config: `off` / `dominant_v` (sub only the V) / `all_dominants` (sub
every dominant). Implemented in `chordRootForDegree`: when in scope and the
degree's chord `isDominantQuality()`, the root moves +6 semitones (G7 → D♭7).
Quality is unchanged, so the chord NAME follows the new root and mode-of-the-moment
resolves to that root's lydian dominant — the classic altered-scale relationship,
for free. Composes with depth (G13 → D♭13). Confined to `chordRootForDegree` (which
has `cfg`); the ~10 chord builders and the quality function are untouched.
- Subs only fire on real dominant 7th chords, so it needs seventh-or-richer depth
  (or a dominant `chordOverride`). Triad V is a major triad → no sub (by design).
- Verified live: ii-V-I/7th → `Dm7·C#7·Cmaj7`; /13th → `Dm13·C#13·Cmaj13`; triad →
  no sub; 12-bar/all_dominants → every dom subbed (C7→F#7, F7→B7, G7→C#7).
- Display spells the sub with sharps (C#7) since `pcName` is sharp-based app-wide;
  enharmonically D♭7. A flat-spelling pass for sub contexts is a possible polish.
- The automatic-substitution use case is covered here; *authoring* arbitrary
  chromatic progressions as presets is the `{semis}` token below (§2.1e).

### 2.1e Chromatic progression token `{deg|semis,q,rn}` — ✅ DONE (2026-05-29)
Progression arrays may now mix bare degrees with token objects (theory-progressions
§1). `semis` = chromatic root offset from key root (♭II/♭VII/♭III/♭VI — roots no
degree can express); `q` = explicit quality (promoted by depth); `rn` = display
label. `chordRootForDegree`/`chordQualityForDegree` accept tokens; guide tones moved
to `chordRootForDegree` for root resolution. Three presets ship: `tritone_sub_ii_V_I`,
`backdoor_ii_V`, `tadd_dameron`. Verified live, incl. 13th-depth promotion + guide
tones. ♯iv°7 / ♭iii° passing chords are now expressible as `{semis,q:'dim7'}` — they
just need authoring as presets.

### 2.1b Quality→template guard
`cagedShapeQualityKey` now returns `null` for any quality outside
`TEMPLATE_QUALITIES` (triads + basic 7ths), so power chords and extensions skip the
CAGED chord-template path and fall back to interval-derived positions. Also
corrected a latent bug: the half-diminished check compared against the symbol
`'m7b5'` but the quality key is `'min7b5'`, so m7b5 chords were silently getting a
major template; they now correctly use the `dim` template.

### 2.2 A few symmetric / exotic scales
Add to `SCALE_INTERVALS`:
```js
half_whole_dim:  [0,1,3,4,6,7,9,10],  // dominant diminished — fusion/prog over dom7, symmetric metal runs
double_harmonic: [0,1,4,5,7,8,11],    // Byzantine — neoclassical / exotic death metal
hungarian_minor: [0,2,3,6,7,8,11],    // harmonic minor #4 — neoclassical / melodic metal
neapolitan_minor:[0,1,3,5,7,8,11],    // optional — dark classical-metal color
```
(Whole-half `diminished`, `whole_tone`, `altered`, `phrygian_dominant`,
`locrian_♯2` already exist.) Each is a one-line data add + a dropdown `<option>`.

### 2.3 Pedal-point **riff** mode (power chords over a held low pedal)
The current pedal-point generator interleaves a pedal note with scale tones. The
metalcore/djent/melodeath idiom is different: a **held open low string (pedal)**
alternating with **power chords / single notes higher up**, often chromatic. Add a
variant that:
- holds `s=0` (lowest string, open or fretted root) as the pedal,
- places power chords (`5`) or single notes on the beat grid above it,
- supports **chromatic/semitone** target roots via the `{semis}` token.
This is the single most genre-defining riff shape for the heavy styles.

### 2.4 Harmonized twin-guitar lines (3rds / 6ths as two simultaneous voices)
The thirds/sixths generators today produce a **single** line that walks in
interval pairs. The melodeath/melodic-metal signature is **two voices sounding
together** (guitar 1 melody + guitar 2 a 3rd/6th above, both on the grid). Add a
`harmonize` option that emits the harmony voice as simultaneous notes (diatonic
3rd or 6th above), so the preview/audio plays the actual twin-guitar sound. Reuses
the existing interval logic; the change is "stack, don't sequence."

### 2.5 Rhythm: polymeter cells + gallops
- **Polymeter / grouping cells** — the meter engine's `grouping` field already
  supports this (`7/8:2+2+3`). Expose **4/4 grouping presets** for djent feel:
  `4/4:3+3+2`, `4/4:3+3+3+3+2+2` (over two bars), and add `9/8`, `5/8`, `11/8`,
  `12/8`. Pure data/UI — the engine handles it.
- **Gallop subdivisions** — eighth+two-sixteenths ("gallop") and the reverse
  ("reverse gallop") are the metal rhythm-guitar staple and are **not** in the
  `subdivision` list (quarter/eighth/sixteenth/triplets only). Add `gallop` and
  `reverse_gallop` as subdivision patterns. Galloping power chords on a pedal =
  classic melodic/heavy metal.

### 2.6 Tuning presets (drop / extended) as named entries
Drop tunings are reachable via the custom-tuning editor, but the heavy genres lean
on a small known set. Add named presets so they're one click:
`Drop D`, `Drop C`, `Drop B`, `Drop A (7)`, `Drop G/F♯ (8)`, plus `Eb standard`.
Pure data into `TUNING_PRESETS`.

### 2.7 (Lower priority) sus2 voicing for emo/math
`add9` and `sus4` exist; **`sus2` `[0,2,7]`** does not. Emo/math-rock open
voicings lean on sus2/add9 ringing shapes. One-line `CHORD_FORMULAS` add.

---

## 3. Per-genre profiles

Each profile: **scales · harmonic devices · typical tuning · meter/rhythm ·
skeleton(s) · generators that serve it**. Skeletons use degree arrays (`{semis}`
= chromatic root from `theory-progressions.md` §1; `q:'5'` = power chord).

### Prog rock
- **Scales:** major modes (esp. mixolydian, lydian, dorian), melodic minor.
- **Devices:** modal vamps, slash/sus chords, quartal voicings, pedal tones,
  modulation/key changes, **odd & changing meters**.
- **Tuning:** standard. **Meter:** 7/8, 5/4, 9/8, mixed.
- **Skeletons:** `I–♭VII–IV` (mixolydian) `[1,7,4]`; lydian vamp `Imaj7–II`
  `[1,2]` over lydian; sus pedal `Isus4–I`.
- **Generators:** modal_vamp, chord_scales, sequences, position shift, odd meters.

### Fusion
- **Scales:** melodic-minor modes (lydian_aug, altered, locrian_♯2,
  mixolydian_♭6), lydian_dominant, **half_whole_dim (NEW)**, diminished.
- **Devices:** altered/extended dominants, ii–V with alterations, modal vamps,
  wide-interval legato lines, quartal/slash voicings, chromatic enclosures.
- **Tuning:** standard. **Meter:** straight or odd; swung/funk 16ths.
- **Skeletons:** altered ii–V–i `[2,5,1]` with `V=dom7`(altered scale); lydian
  dominant vamp `I7♯11` `[1]` over lydian_dominant.
- **Generators:** guide_tones, chord_scales, legato, chromatic enclosures,
  arpeggio inversions, shell voicings.

### Metalcore
- **Scales:** natural_minor, harmonic_minor, phrygian, phrygian_dominant,
  diminished.
- **Devices:** **pedal-point power-chord chug** (open low string), **breakdowns**
  (rhythmic low-string displacement), harmonized minor leads, diminished tension.
- **Tuning:** Drop D / Drop C / Drop B. **Meter:** 4/4 with syncopation; half-time
  breakdowns.
- **Skeletons (power-chord roots):** pedal riff `i5 – ♭II5 – i5 – ♭VII5` →
  `[{deg:1,q:'5'},{semis:1,q:'5'},{deg:1,q:'5'},{semis:10,q:'5'}]` over a pedal;
  `i5–♭VI5–♭VII5` `[1,6,7]` q:`5`.
- **Generators:** pedal-point riff (§2.3), power chords (§2.1), tremolo, string
  skipping, rhythmic displacement, harmonized thirds (§2.4).

### Emo / Math-rock-adjacent
- **Scales:** major, mixolydian, lydian, dorian (bright/colourful).
- **Devices:** open **add9 / sus2 / sus4 / maj7** voicings with ringing open
  strings, fingerstyle arpeggiation, tapping (math), **odd meters**, capo.
- **Tuning:** standard, drop D, altered/open; capo common. **Meter:** 7/8, 5/4,
  mixed (math), or straight 4/4 (emo).
- **Skeletons:** `Iadd9–IVadd9–vi7–V` colored four-chord; `IVmaj7–I–V–vi`.
- **Generators:** chord_scales (with add9/sus2/sus4), arpeggios, tapping, odd
  meters. **Needs sus2 (§2.7).**

### Melodic metal (NWOBHM / power / heavy)
- **Scales:** harmonic_minor, natural_minor, major (uplifting power metal),
  phrygian_dominant.
- **Devices:** **gallop** rhythm power chords, **harmonized twin leads in 3rds**,
  neoclassical sweep arpeggios, fast alternate picking.
- **Tuning:** standard / Eb / Drop D. **Meter:** 4/4 gallop, some 6/8.
- **Skeletons:** `i–♭VI–♭VII` `[1,6,7]` q:`5`; uplifting `I–V–vi–IV` `[1,5,6,4]`
  at speed; neoclassical `i–♭VII–♭VI–V` (harmonic minor, `V=maj/dom`).
- **Generators:** sweep arpeggios, harmonized thirds (§2.4), tremolo, sequences,
  power chords, **gallop subdivision (§2.5)**.

### Death metal
- **Scales:** phrygian, locrian, diminished, **double_harmonic (NEW)**,
  whole_tone, chromatic.
- **Devices:** **chromatic/semitone power-chord riffs** (non-functional),
  tritones, tremolo-picked riffs, pedal point, blast-beat rhythm (drums).
- **Tuning:** low — Drop B/A and lower, 7/8-string. **Meter:** fast 4/4, blast
  feel; abrupt changes.
- **Skeletons (chromatic roots):** `i5 – ♭ii5 – i5 – tritone5` →
  `[{deg:1,q:'5'},{semis:1,q:'5'},{deg:1,q:'5'},{semis:6,q:'5'}]`; chromatic
  descending power chords.
- **Generators:** chromatic, power chords w/ `{semis}` roots, tremolo, pedal-point
  riff.

### Melodic death metal (Gothenburg)
- **Scales:** natural_minor, harmonic_minor, phrygian, dorian.
- **Devices:** **harmonized twin-guitar leads in 3rds/6ths**, **tremolo-picked
  modal melodies**, pedal-point riffs, minor modal color.
- **Tuning:** standard / Eb / Drop D. **Meter:** 4/4, double-kick/thrash feel.
- **Skeletons:** `i–♭VI–♭VII–i` `[1,6,7,1]` (power chords under harmonized lead);
  tremolo melody over a `i` pedal, harmonized a 3rd up.
- **Generators:** **harmonized thirds/sixths (§2.4)** — flagship, tremolo,
  pedal-point riff, sweep, natural/harmonic minor scales.

### Djent
- **Scales:** phrygian, aeolian, lydian (clean overlays), whole_tone, diminished,
  chromatic.
- **Devices:** **polymeter / syncopated grouping cells** (e.g. 3-3-2 over 4/4),
  **palm-muted power chords across 3+ strings (`5oct`)**, pedal-point chug,
  ambient clean lydian/major sections, virtuosic legato/tapping solos.
- **Tuning:** extended range 7/8/9-string, Drop A/G/F♯ — **lowest tunings on the
  list.** **Meter:** polymeter — odd cycles against a steady 4/4 pulse.
- **Skeletons:** single palm-muted `i5oct` chug arranged as a **rhythmic cell**;
  harmony often static — the "progression" is the grouping pattern.
- **Generators:** pedal-point riff + `5oct` (§2.1, §2.3), rhythmic displacement,
  **grouping/polymeter presets (§2.5)**, tapping, legato.

### Prog metal
- **Scales:** all — modes, melodic/harmonic minor, diminished, whole_tone,
  double_harmonic.
- **Devices:** **changing meters & modulation**, neoclassical sweep arpeggios,
  diminished/whole-tone runs, unison lines, extended/altered chords, tapping.
- **Tuning:** standard / extended. **Meter:** frequent changes, odd meters.
- **Skeletons:** spans everything above — modal vamps, neoclassical minor, altered
  ii–V, chromatic power-chord riffs.
- **Generators:** the whole library — sweep, chromatic, position shift, modal,
  sequences, odd meters, tapping, harmonized lines.

### Trap rock / trap metal
- **Scales:** natural_minor, phrygian, harmonic_minor, minor_pentatonic.
- **Devices:** **dark 2-chord minor drone loops**, power chords over a half-time
  trap feel, atmospheric/sparse, 808-doubled root.
- **Tuning:** drop / low. **Meter:** 4/4 **half-time** trap feel (the rhythmic
  identity is the drum side; the guitar side is simple power-chord loops).
- **Skeletons:** `i–♭VI` `[1,6]` q:`5` drone; `i–♭VII` `[1,7]` q:`5`.
- **Generators:** power chords, pedal-point riff, simple progression loops.
- **Note:** the trap *feel* is largely drums/808 (outside Virtuoso's guitar
  remit); we serve the **guitar** layer — drop-tuned power-chord loops + the dark
  minor scale palette.

### Adjacent guitar-focused styles (compact)
| Style | Scales | Signature devices | Generators |
|---|---|---|---|
| Math rock | major modes, lydian | odd/changing meter, tapping, clean dissonant add-note chords, capo | tapping, odd meters, chord_scales (add9/sus2) |
| Post-rock | major, lydian, aeolian | crescendo build on suspended `I–IV–vi`, tremolo-picked swells, delay | chord_scales (sus/add9), tremolo |
| Stoner / doom | minor_pentatonic, blues, dorian, phrygian | slow drop-tuned pentatonic riffs, power chords, modal | power chords, pentatonic scale, pedal-point riff |
| Shoegaze | major, lydian, mixolydian | drone, add9/sus2 open voicings, tremolo-bar | chord_scales (add9/sus2), tremolo |
| Nu-metal | minor_pentatonic, phrygian, natural_minor | single low-string drop riffs, power chords, syncopation | power chords, pedal-point riff, drop tunings |

---

## 4. Recommended framework build order

Sequenced so each step is independently shippable and unblocks genres immediately:

1. **Power-chord quality `5` / `5oct` (§2.1).** Keystone. One small data add +
   override option + renderer label. Instantly makes every rock/metal genre
   harmonically correct.
2. **Tuning presets (§2.6)** + **gallop/odd-meter & grouping presets (§2.5).**
   Pure data/UI. Drop tunings + gallop + djent grouping cells = the rhythmic/tonal
   identity of the heavy genres, cheaply.
3. **Pedal-point riff mode (§2.3)** with power chords + `{semis}` chromatic roots.
   The defining riff shape for metalcore / death / melodeath / djent / nu-metal.
4. **Harmonized twin lines (§2.4).** The melodeath / melodic-metal flagship; turns
   the existing thirds/sixths into the actual twin-guitar sound.
5. **Exotic scales (§2.2)** + **sus2 (§2.7).** Round out fusion/neoclassical/emo
   palettes.
6. **Genre pathway packs.** With 1–5 in place, author curated pathways per genre
   (replaces the generic ROADMAP Phase 4 "Metal/Jazz/Country/Classical" packs with
   this richer guitar-focused set) and feed the **random generator** (`theory-
   progressions.md` §3) per-style grammars that emit power chords + semitone roots.

**Competitive note:** items 1, 3, and 4 (power chords, pedal-point riffs,
harmonized twin leads) are essentially absent from pop-oriented progression tools.
Shipping them is the differentiation thesis for the guitar-enthusiast user base.
