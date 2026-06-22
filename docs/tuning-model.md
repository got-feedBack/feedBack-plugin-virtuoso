# How Virtuoso models and names tunings

> Written up for the host-team discussion about tunings displaying as raw offset
> arrays (`-1 -1 -1 -1 -1 -1`) instead of names. Virtuoso already ships a
> name-first tuning layer across 4–8-string guitar and bass; this is the design,
> the rationale, and the host-integration gotchas we hit building it.

## TL;DR

1. **Canonical representation: absolute MIDI per string**, lowest string first —
   never offsets-from-standard. Offsets need an implied base tuning to mean
   anything, and the base differs per instrument family and string count
   (the same array on a 4-string bass and a 6-string guitar is two different
   tunings), and they lose the octave. Absolute MIDI is unambiguous on both.
2. **A tuning record is `{ name, family, string_count, midis[] }`.** Name is
   display metadata; the midis are the truth.
3. **Names are a resolution layer, not storage.** Display resolution walks a
   curated preset table for the active `(family, string_count)` and exact-matches
   the midis; misses fall through to user-saved names, then to spelled
   note+octave names. Raw numbers are never shown.

## The pieces (all shipped, in this repo)

### Preset table — `TUNING_PRESETS` (`screen.js` §1)

Keyed `${family}_${stringCount}` so a name can never leak across instruments or
string counts (the "DADGAD on 4 strings vs Drop D on 4 strings" ambiguity can't
arise — they're different keys):

| Key | Presets |
|-----|---------|
| `guitar_6` | Standard, Drop D, Drop C, Drop B, Eb Standard, D Standard, DADGAD, Open G, Open D |
| `guitar_7` | Standard, Drop A |
| `guitar_8` | Standard, Drop E |
| `bass_4` | Standard, Drop D, Eb Standard, BEAD (low B) |
| `bass_5` | Standard low B, Standard high C, Drop A |
| `bass_6` | Standard (B E A D G C) |

Each entry is `{ id, label, midis }` and the label **spells the strings** —
`"Drop C (C G C F A D)"` — so the name teaches the notes instead of replacing
them. (This also answers the "names vs note lists" split in the thread: do both
in one string.) The table is plain data; populating it from a larger external
tuning-name database would slot straight in without touching the resolver.

### Resolution — `syncTuningOptions()` (`screen.js` §15)

The *effective* tuning (custom override if present, else the active setup's
`openMidis`) is exact-matched against the presets for the current
`(family, string_count)`; first match wins and the UI shows that label. No
match → match against the user's saved tunings; still no match → "Custom…".
A user who dials in DADGAD by hand sees "DADGAD", not numbers.

### Fallback naming — `midiToNoteName()` (`screen.js` §15)

`midi → "E2"` (note + octave, C-based octave numbering, MIDI 40 = E2). When a
user saves a custom tuning, the suggested default name is the spelled tuning,
e.g. `"D2 A2 D3 G3 A3 D4"`. Octaves are included deliberately: the fallback
fires precisely on the weird extended-range/content-hack tunings where a
nameless note list like `E A D G B E` would be ambiguous about which string
moved an octave.

### Storage — `routes.py` `/tunings` CRUD

User-saved tunings persist as `{ name, family, string_count, midis_csv }` in the
shared meta-DB (table `virtuoso_tunings`), upserted by name, listed per
`(family, string_count)`. Guarded end-to-end by `smoke-strings.mjs` (the chart
must actually change with string count + tuning).

## Host-integration gotchas (for anyone touching the host tuning model)

Hard-won while wiring 4/5/7/8-string support (verified against host
v0.2.9-alpha.7; see the comment block in `routes.py` ~line 297):

- **`len(tuning) == 6` is treated as "no signal".** The host derives string
  count as `max(notes, name, tuning)` but ignores a 6-length tuning array
  (`lib/song.py:439-440`) — so a 5/7/8-string arrangement whose tuning was
  padded/trimmed to 6 silently miscounts as 6 strings. Tuning arrays must be
  emitted at the **real** string-count length, never normalized to 6.
- **The manifest tuning overrides the arrangement tuning at load**
  (`lib/sloppak.py:226-231`) — the two must be kept in sync or the manifest
  silently wins.
- If the host moves to a name-resolution layer like the above, the offset
  arrays it stores today are exactly the lossy case: `0 0 0 0 0 0` on a
  7-string and a 6-string are different pitch sets, and an offset array can't
  say which octave a string landed in. Resolving **absolute pitches** (offsets
  + the arrangement's known base tuning + string count) and *then* matching
  names sidesteps the whole class.

## Pointers

- `screen.js` §1 — `STRING_SETUPS`, `TUNING_PRESETS`, `TUNING_TO_SETUP`
- `screen.js` §15 — `syncTuningOptions()`, `midiToNoteName()`, `onSaveTuningClick()`
- `routes.py` — `/tunings` CRUD + the string-count/tuning-length comment block
- `.claude/skills/run-virtuoso/smoke-strings.mjs` — the behavioural guard
