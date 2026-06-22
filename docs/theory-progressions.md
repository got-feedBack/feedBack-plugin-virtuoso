# Chord Progressions — Cross-Genre Catalog + Random Generator Design

> See also `docs/genre-framework-guitar.md` for the prog/metal/fusion/emo/
> trap-rock framework (power chords, pedal-point riffs, polymeter, drop tunings,
> harmonized twin lines) — those genres are riff/device-based and need primitives
> beyond the chord-loop catalog here.
>
> Research doc (2026-05-29). Two goals:
> 1. A **comprehensive, genre-organised preset library** of common progressions.
> 2. A design for **randomly generating a progression in a chosen style**.
>
> This is research + a proposed implementation path, not shipped work. Scope
> decisions are flagged for Christian. Pedagogy/theory only — no proper nouns,
> per the attribution-cleanup convention.

---

## 1. How progressions are encoded today (and what that buys us)

A progression in `COMMON_PROGRESSIONS` is a **scale-degree array**, e.g.
`'I-V-vi-IV': [1,5,6,4]`. Two functions turn a degree into an actual chord:

- **`chordRootForDegree(cfg, degree)`** — root = key root + the **chosen scale's**
  interval at that degree. The root is taken from `cfg.scale`, *not* a fixed
  major scale. This is the crucial property (see below).
- **`chordQualityForDegree(scale, depth, degree, override, progression)`** —
  quality from `DIATONIC_QUALITIES[scale]` indexed by degree, unless a
  `PROGRESSION_QUALITY_OVERRIDES[progression][degree]` or an explicit
  `chordOverride` wins.

### Why this is more capable than "diatonic only"

Because the root comes from the *selected parent scale*, many chromatic-looking
progressions are already representable by pairing a degree array with the right
scale + a quality override:

| Progression | Roman | Encoding that works today |
|---|---|---|
| Andalusian | i–♭VII–♭VI–V | `[1,7,6,5]` over **natural_minor** (deg 7→♭7, deg 6→♭6 already), override `{5:'dom7'}` for the major/dominant V |
| Rock ♭VII | I–♭VII–IV | `[1,7,4]` over **mixolydian** (deg 7→♭7, deg 4→4) |
| Borrowed iv | I–IV–iv–V | `[1,4,4,5]` over **major**, override `{ }`… *(see limitation — needs per-position quality, not per-degree)* |
| Secondary dom V/V | I–II7–V | `[1,2,5]` over **major**, override `{2:'dom7'}` (root of II = root of ii) |
| Secondary dom V/vi | I–III7–vi | `[1,3,6]` over **major**, override `{3:'dom7'}` |

The existing Rhythm-Changes entries already exploit exactly this.

### The real limitations (what forces an encoding change)

1. **Roots chromatic to every usable scale.** A **tritone sub ♭II7** needs a root
   1 semitone above tonic. No degree of any standard practice scale yields +1
   semitone, so ♭II7 cannot be written as a bare degree. Same for chromatic
   passing diminished chords **♯iv°7, ♯i°7, ♭iii°**. These are genuinely
   unrepresentable today.

2. **Per-occurrence quality, not per-degree.** `PROGRESSION_QUALITY_OVERRIDES` is
   keyed by *degree number*, so a progression that uses the **same degree twice
   with different qualities** can't distinguish them. `I–IV–iv–V` (major IV then
   borrowed minor iv, both degree 4) is the canonical break: an override
   `{4:'min'}` would force *both* to minor. This blocks a whole class of
   chromatic-mediant / modal-mixture moves.

3. **No quality carried in the data itself.** Quality is inferred from the scale.
   That's elegant for mode-of-moment play, but a cross-genre preset library wants
   to *state* "this chord is a dom7 here" independent of the scale the player
   chose to solo with.

### ✅ IMPLEMENTED (2026-05-29) — the `{deg|semis, q, rn}` token

The encoding evolution below is **shipped**. `COMMON_PROGRESSIONS` entries may now
mix bare degree numbers with token objects `{ deg | semis, q, rn }`:
- `semis` — chromatic root offset (semitones) from the key root, for chords no
  degree can express (♭II, ♭VII, ♭III, ♭VI). Taken literally (no auto tritone-sub).
- `deg` — diatonic degree (root via the scale, as a plain number would be).
- `q` — explicit quality for that position (promoted by chord depth, so a token
  `dom7` becomes dom13 at thirteenth depth).
- `rn` — display-only Roman label.

`chordRootForDegree` and `chordQualityForDegree` accept tokens; guide tones was
updated to resolve roots through `chordRootForDegree` (it previously inlined the
degree→pitch math). All other progression consumers already routed through those
two functions, so no further call-site changes were needed. Three token
progressions ship as presets: `tritone_sub_ii_V_I` (Dm7–D♭7–C), `backdoor_ii_V`
(Fm7–B♭7–C), `tadd_dameron` (C–E♭7–A♭maj7–D♭7). Verified live, including 13th-depth
promotion (Cmaj13–E♭13–A♭maj13–D♭13) and guide tones over a token progression.

The remaining **X** progressions from §2 (♯iv°7 / ♭iii° passing chords, the
jazz-blues ♯iv°7 bar) are now expressible with `{semis, q:'dim7'}` tokens — they
just need authoring as presets.

### Original design note — encoding evolution (minimal, backward-compatible)

Keep the bare-degree array as the fast path (everything diatonic stays a one-liner),
but allow an **element to optionally be a chord token object** so chromatic and
mixed-quality progressions are expressible:

```js
// Backward compatible: a number means "diatonic degree, quality from scale".
// An object overrides root and/or quality for THAT position only.
'tritone_sub_turnaround': [
  2,                              // ii  (diatonic)
  { deg: 5, q: 'dom7' },          // V7
  { semis: 1, q: 'dom7', rn: '♭II7' }, // tritone sub — root +1 semitone from key
  1                               // I
]
```

- `deg` — diatonic degree (root via the scale, as today).
- `semis` — explicit chromatic root offset from the key root, for chords no
  degree can express (♭II, ♯iv°, etc.). `rn` is a display label only.
- `q` — explicit quality for *this position* (fixes limitation #2 and #3).

`chordRootForDegree` / `chordQualityForDegree` gain a 3-line branch: if the
element is an object, use `semis ?? scaleInterval(deg)` for the root and `q ??
diatonicQuality` for the quality. **No change to the ~14 generators** that consume
`progressionDegreesForConfig` — they already map over the degree array; they'd map
over a normalised `{root, quality}` list instead. This is the cleanest path and
unblocks the full catalog below.

---

## 2. Cross-genre progression catalog

Organised by family. **R** = representable today (degree array + scale + override).
**X** = needs the encoding evolution above (chromatic root or same-degree mixed
quality). Roman numerals are relative to the listed parent context.

### 2.1 Pop / Rock — the four-chord families
| Name | Roman | Degrees | Notes |
|---|---|---|---|
| Axis / "four chords" | I–V–vi–IV | `[1,5,6,4]` | R · already shipped |
| Axis rotation (sensitive) | vi–IV–I–V | `[6,4,1,5]` | R · shipped |
| Axis rotation (pop-punk) | I–vi–IV–V (50s) | `[1,6,4,5]` | R · shipped |
| Axis rotation | IV–I–V–vi | `[4,1,5,6]` | R |
| Doo-wop / 50s | I–vi–IV–V | `[1,6,4,5]` | R · shipped as `I-vi-IV-V` |
| Three-chord rock | I–IV–V | `[1,4,5,1]` | R · shipped |
| Singer-songwriter | I–IV–vi–V | `[1,4,6,5]` | R · shipped |
| Plagal pop | I–IV | `[1,4,1,4]` | R |
| Pop-punk power | I–V–vi–IV (♭VII opt.) | `[1,5,6,4]` | R |

### 2.2 Rock — modal / borrowed
| Name | Roman | Degrees | Notes |
|---|---|---|---|
| Mixolydian rock | I–♭VII–IV | `[1,7,4]` over mixolydian | R |
| Mixolydian vamp | I–♭VII–IV–I | `[1,7,4,1]` over mixolydian | R |
| "Sweet" classic rock | I–♭III–♭VII–IV | `[1,3,7,4]` over **dorian/blues context** | X (♭III in a major feel needs explicit token) |
| Grunge slide | I–♭III–IV | `[1,3,4]` | X if major-key feel |
| Minor rock | i–♭VI–♭VII | `[1,6,7]` over natural_minor | R |
| Minor anthem | i–♭VII–♭VI–♭VII | `[1,7,6,7]` | R · shipped as `i-VII-VI-VII` |
| Aeolian loop | i–♭VI–♭III–♭VII | `[1,6,3,7]` | R · shipped as `i-VI-III-VII` |

### 2.3 Blues
| Name | Roman | Degrees | Notes |
|---|---|---|---|
| 12-bar | I7–I7–I7–I7–IV7–IV7–I7–I7–V7–IV7–I7–V7 | `[1,1,1,1,4,4,1,1,5,4,1,5]` | R · shipped, all dom7 via override |
| Quick-change 12-bar | …IV7 in bar 2 | `[1,4,1,1,4,4,1,1,5,4,1,5]` | R · shipped |
| 8-bar blues | I–V–IV–IV–I–V–I–V | `[1,5,4,4,1,5,1,5]` | R |
| Minor blues | i7–iv7–i7–V7 | `[1,4,1,5]` over natural_minor, override `{5:'dom7'}` | R |
| Jazz-blues (bars 1–6) | I7–IV7–I7–I7–IV7–♯iv°7 | `[1,4,1,1,4,{semis:6,q:'dim7'}]` | X (♯iv°7 passing chord) |

### 2.4 Jazz
| Name | Roman | Degrees | Notes |
|---|---|---|---|
| Major ii–V–I | ii–V–I | `[2,5,1,1]` | R · shipped |
| Minor ii–V–i | iiø–V7–i | `[2,5,1,1]` + minor overrides | R · shipped as `minor_ii_V_i` |
| Long turnaround | I–vi–ii–V | `[1,6,2,5]` | R · shipped |
| iii–vi–ii–V | iii–vi–ii–V | `[3,6,2,5]` | R · shipped (as RC bridge degrees) |
| Circle of fifths | I–IV–vii°–iii–vi–ii–V–I | `[1,4,7,3,6,2,5,1]` | R · shipped as `circle_diatonic` |
| Rhythm Changes A | I–VI7–ii–V ×2 | `[1,6,2,5,1,6,2,5]` | R · shipped |
| Rhythm Changes bridge | III7–VI7–II7–V7 | `[3,6,2,5]` | R · shipped |
| Tritone-sub turnaround | iii–♭III7–ii–♭II7 | `[3,{semis:3,q:'dom7'},2,{semis:1,q:'dom7'}]` | X (chromatic descending dominants) |
| Backdoor ii–V | iv7–♭VII7–I | `[4,{semis:10,q:'dom7'},1]` + `{4:'min7'}` | X (♭VII7 backdoor dominant) |
| Coltrane changes (cell) | I–♭III7–♭VI–VII7–III | mixed semis | X (giant-steps cycle) |
| Modal (Dorian vamp) | i–IV | `[1,4]` over dorian | R |
| Modal (So-What type) | iø/i11 vamp two chords a step apart | `[1,7]` over dorian (e.g. i–♭VII as quartal) | R-ish |

### 2.5 Funk / R&B / Neo-Soul
| Name | Roman | Degrees | Notes |
|---|---|---|---|
| One-chord funk vamp | I7 (dom9/13) | `[1]` override `{1:'dom7'}` | R |
| Dorian funk vamp | i7–IV7 | `[1,4]` over dorian | R |
| Neo-soul I–vi–IV–V (maj7) | Imaj7–vi7–IVmaj7–V7 | `[1,6,4,5]` | R (qualities from scale) |
| Neo-soul iii–vi–ii–V | iii7–vi7–ii7–V7 | `[3,6,2,5]` | R |
| Neo-soul ii–V–vi–IV | ii7–V7–vi7–IVmaj7 | `[2,5,6,4]` | R |
| Modal mixture | I–IV–iv–V | `[1,4,{deg:4,q:'min7'},5]` | X (same degree, two qualities) |
| Picardy / IV–iv–I | IV–iv–I | `[4,{deg:4,q:'min7'},1]` | X |
| Extended neo-soul | I–V–vi–iii–IV–I | `[1,5,6,3,4,1]` | R |
| Gospel walk-up | I–iii–IV–♯iv°–V | `[1,3,4,{semis:6,q:'dim7'},5]` | X (passing dim) |

### 2.6 Gospel
| Name | Roman | Degrees | Notes |
|---|---|---|---|
| Plagal "amen" | IV–I | `[4,1]` | R |
| Gospel 2-5-1 with extensions | ii9–V13–Imaj9 | `[2,5,1]` | R |
| Gospel turnaround | I–vi–ii–V (chromatic passing) | `[1,6,2,5]` | R (passing tones are melodic, not chords) |
| 6-2-5-1 | vi–II7–V–I | `[6,2,5,1]` override `{2:'dom7'}` | R |
| Gospel ♭III pivot | I–♭III°–ii–V | needs ♭iii° | X |

### 2.7 Country
| Name | Roman | Degrees | Notes |
|---|---|---|---|
| Three-chord country | I–IV–V | `[1,4,5,1]` | R |
| Country ballad | I–V–vi–IV | `[1,5,6,4]` | R |
| Nashville pop-country | I–IV–vi–V | `[1,4,6,5]` | R |
| Train-beat | I–IV–I–V | `[1,4,1,5]` | R |
| Country with V/V | I–II7–V | `[1,2,5]` override `{2:'dom7'}` | R |

### 2.8 Latin / Bossa / Flamenco
| Name | Roman | Degrees | Notes |
|---|---|---|---|
| Bossa ii–V–I (maj) | ii7–V7–Imaj7 | `[2,5,1]` | R |
| Bossa minor | iiø–V7–i | `[2,5,1]` + minor overrides | R |
| Bossa descending | Imaj7–♭III°–ii7–V7 | needs ♭iii° | X |
| Andalusian cadence | i–♭VII–♭VI–V | `[1,7,6,5]` over natural_minor, `{5:'dom7'}` | R |
| Flamenco (Phrygian) | i–♭VII–♭VI–V (Phrygian) | `[1,7,6,5]` over phrygian, `{5:'maj'}` | R |
| Phrygian dominant vamp | I–♭II | `[1,{semis:1,q:'maj'}]` over phrygian_dominant | partly R (♭II = deg 2 of phrygian = +1, so `[1,2]` works!) |
| Montuno / salsa | ii–V–I or I–IV–V | `[2,5,1]` / `[1,4,5]` | R |

### 2.9 EDM / Dance / Modern Pop
| Name | Roman | Degrees | Notes |
|---|---|---|---|
| Festival/anthem | vi–IV–I–V | `[6,4,1,5]` | R |
| EDM minor | i–♭VI–♭III–♭VII | `[1,6,3,7]` | R |
| Future-bass | I–V–vi–IV | `[1,5,6,4]` | R |
| "Sad pop" | vi–IV–V–I | `[6,4,5,1]` | R |
| Lo-fi / chill | ii–V–I (maj7/9) | `[2,5,1]` | R |
| Trap minor loop | i–♭VI–♭VII | `[1,6,7]` | R |
| Reggaeton | i–♭VI–♭VII–v / i–VI–VII–v | `[1,6,7,5]` | R |

### 2.10 Reggae / Ska
| Name | Roman | Degrees | Notes |
|---|---|---|---|
| One-drop | I–IV (skank) | `[1,4]` | R |
| Roots | I–V–vi–IV | `[1,5,6,4]` | R |
| Minor roots | i–♭VII–♭VI–♭VII | `[1,7,6,7]` | R |
| Ska | I–vi–IV–V | `[1,6,4,5]` | R |

**Tally:** of ~75 catalogued, the large majority are **representable today**. The
**X** set is ~12 progressions, all blocked by one of two things: a chromatic root
(♭II7, ♯iv°7, ♭iii°, backdoor ♭VII7) or a same-degree mixed-quality pair
(I–IV–iv). Both are fixed by the single encoding evolution in §1.

---

## 3. Random progression generator ("give me a progression in style X")

### Approach: weighted functional transitions (a per-style Markov walk)

The literature consensus for style-constrained progression generation is a
**first-order Markov chain over a chord vocabulary**, with transition weights
fit to (or hand-authored from) a genre's idioms. We hand-author — no training
data needed, fully deterministic to reason about, and tunable by ear.

This drops cleanly onto the existing engine: the generator's **output is just a
degree array (+ per-position quality)** — exactly what `COMMON_PROGRESSIONS`
entries are. So a generated progression flows through `chordRootForDegree` /
`chordQualityForDegree` / the 14 builders **with zero downstream changes**.

### Model

```js
const STYLE_GRAMMARS = {
  pop: {
    scale: 'major',
    start: [1, 6],                 // tonic or relative-minor start
    // transition weights: from-degree → { to-degree: weight }
    edges: {
      1: { 5:3, 4:3, 6:2, 2:1 },
      4: { 1:2, 5:3, 6:1 },
      5: { 1:3, 6:2, 4:1 },
      6: { 4:3, 5:1, 2:2, 1:1 },
      2: { 5:3, 4:1 },
    },
    cadence: [5, 1],               // bias final two toward a resolution
    length: [4, 4],                // min,max chords (loops favour 4)
  },
  jazz: {
    scale: 'major',
    start: [1, 2, 3],
    rootMotion: 'fifths',          // prefer down-a-fifth root moves
    edges: { /* ii→V→I chains, circle-of-fifths bias */ },
    qualities: 'seventh',          // default to 7th-chord qualities
    allowSecondaryDominants: true, // can emit { deg, q:'dom7' } tonicising
    cadence: [2, 5, 1],
  },
  blues: {
    scale: 'major', qualities: 'dom7-all',
    template: '12bar',             // near-deterministic backbone, slight variation
  },
  neosoul: { scale:'major', qualities:'seventh', allowMixture:true /* iv, ♭VII */ },
  flamenco: { scale:'phrygian', template:'andalusian' },
  metal: { scale:'natural_minor', edges:{ /* i, ♭VI, ♭VII, ♭II, tritone */ } },
  // … country, reggae, edm, funk
};
```

### Generation algorithm

1. Pick `start` degree (weighted random from the style's start set).
2. Walk the chain: from the current degree, pick the next by edge weight, for
   `length` steps. Styles with a `template` (blues 12-bar, Andalusian) seed the
   backbone and only vary permitted slots.
3. **Cadential closure:** bias the last 1–2 chords toward the style's `cadence`
   so it resolves rather than ending mid-phrase.
4. Apply style quality policy (`triad` / `seventh` / `dom7-all`) and any
   tonicisation (secondary dominants, tritone subs) as `{deg|semis, q}` tokens.
5. Emit `{ degrees, overrides, label }` — identical shape to a hand-authored
   `COMMON_PROGRESSIONS` entry. Hand it straight to the existing pipeline.

### Controls to surface (UX)

- **Style** select (pop / rock / blues / jazz / neo-soul / funk / country /
  latin / flamenco / metal / edm / reggae).
- **Length** (2 / 4 / 8 chords) and **major/minor** toggle where the style allows.
- **Complexity** slider — gates whether secondary dominants, modal mixture, and
  chromatic subs are allowed (low = diatonic only; high = the full §1 tokens).
- **🎲 Re-roll** button; **★ Save** writes the generated array into the preset
  store (reuses existing preset CRUD — a generated progression *is* a preset).

### Why this fits Virtuoso specifically

- It's pure data generation; no second player, no new audio path — respects the
  "never duplicate the player" constraint.
- A generated progression feeds `progression_arpeggios`, `chord_scales`,
  `guide_tones`, and the planned **Improv mode** (the random generator is in fact
  the natural content source for the "Custom progression tool" that Improv mode
  was going to consume — see ROADMAP Phase 4 / mode-architecture).

---

## 4. Recommended path (for Christian to scope)

**Phase A — preset library (low risk, high coverage).** Add the **R** progressions
from §2 to `COMMON_PROGRESSIONS` + labels in `screen.html`, grouped by genre with
`<optgroup>`. This roughly triples the catalog and ships entirely within today's
model. No engine change.

**Phase B — encoding evolution (unblocks the rest).** Add the optional chord-token
object (`{deg|semis, q, rn}`) from §1. ~3-line branches in two functions, a
normalise step in `progressionDegreesForConfig`. Then add the **X** progressions
(tritone subs, backdoor, mixture, passing dim).

**Phase C — random generator.** Build `STYLE_GRAMMARS` + the walk in §3, surface
the Style/Length/Complexity/Re-roll controls. Wire its output through the existing
preset-save path. This doubles as the content engine for the future Improv mode.

Suggested order: **A → C → B**. A is immediate value; C delivers the headline
"random in a style" feature on top of A's diatonic vocabulary; B is the polish
pass that adds the spicy chromatic chords once the surface exists.
