# Virtuoso Exercise Schema

This document describes Virtuoso's internal generated exercise payload.

The payload is intentionally close to Sloppak/Slopsmith highway data so it can be passed into existing renderers.

## Top-level shape

```json
{
  "version": 1,
  "session": {
    "mode": "diatonic_arpeggios",
    "key": "C",
    "scale": "major",
    "bpm": 100,
    "meter": {
      "numerator": 4,
      "denominator": 4,
      "grouping": [4]
    },
    "subdivision": "eighth",
    "instrument": "guitar",
    "tuning": [0, 0, 0, 0, 0, 0],
    "position": {
      "fretMin": 0,
      "fretMax": 5
    }
  },
  "chart": {
    "notes": [],
    "chords": [],
    "chordTemplates": [],
    "handShapes": [],
    "beats": [],
    "anchors": [],
    "sections": []
  }
}
```

## Notes

Notes use FeedBack's compact note fields:

```json
{
  "t": 0.0,
  "s": 0,
  "f": 3,
  "sus": 0.25,
  "sl": -1,
  "slu": -1,
  "bn": 0,
  "ho": false,
  "po": false,
  "hm": false,
  "hp": false,
  "pm": false,
  "mt": false,
  "vb": false,
  "tr": false,
  "ac": false,
  "tp": false
}
```

### Note field meanings

All note objects use these compact keys:

| Key | Meaning |
|-----|---------|
| `t` | start time (seconds) |
| `s` | string index (`s=0` is the lowest string — see CLAUDE.md "String index convention") |
| `f` | fret number |
| `sus` | sustain duration (seconds) |
| `sl` / `slu` | slide target / slide-up target fret (-1 = none) |
| `bn` | bend magnitude in whole steps (0 / 0.25 / 0.5 / 1 / 1.5 / 2 — 0.25 is the blues quarter-curl, added with the riff-vocabulary engine) |
| `bt` | bend intent (optional; default 0): 0 = bend-up, 1 = release, 2 = pre-bend (already bent at onset), 3 = pre-bend-and-release, 4 = bend-and-release (round trip in one note). `bn` carries the magnitude; `bt` declares the shape so renderers can draw the arc back down and judging can grade the right pitch over time (the "bends judged unbent" class). Audio + judging currently treat all intents as bend-up; richer realization is a logged follow-up. |
| `ho` / `po` | hammer-on / pull-off |
| `hm` / `hp` | harmonic / pinch harmonic |
| `pm` | palm mute |
| `mt` | muted/dead note |
| `vb` / `tr` | vibrato / tremolo |
| `ac` / `tp` | accent / tap |
| `ch` | chord/strum group key (optional). Notes sharing a `ch` value — or, untagged, sharing an *exactly* equal `t` — form one simultaneous chord/diad event. The pitch scorer exempts such groups from judgment (the host detector is monophonic and reports nothing usable for polyphony — probe-verified 2026-06-05); builders that rake-stagger strums (`emitStrum`) must tag, since their notes don't share a `t`. |
| `fg` | fret-hand finger (optional; 0 = open, 1–4 = index..pinky). **Omitted = no prescription** — the hand-marks honesty rule (`docs/hand-marks-roundtable.md`): emitted only from validated sources (shape resolvers, the chromatic frame rule, bass's dual-regime `applyBassFingering`). Display/teach only — never scored. |
| `pkd` | pick stroke (optional; host sloppak ints verbatim: 0 = down, 1 = up). Omitted = player's choice. Never on legato (`ho`/`po`) or tapped notes — pick-transparent. Emission is school-driven (`applyStrokePolicy` off `cfg.strokePolicy`: alternate / economy / gypsy / bluegrass / metal with the `DOWNPICK_CEILING_BPM` flip; a `RHYTHM_CELLS` `strokes` array — gallop `D-DU` — is definitive). Display/teach only — never scored. |
| `rh` | pluck-hand finger (optional; host enum 0=p 1=i 2=m 3=a 4=c). Bass fingerstyle emission (hand-marks Slice 2): strict i-m parity with ghosts counting (`applyBassPlucking`; a same-finger descent = the implicit RAKE), `octave_groove` by role (i root / m octave), `slap_pop` by region (0 = thumb incl. dead-thumb ghosts, 1 = pop). Bass is never given guitar pick logic (`bass_parity` fallback). A note sets at most ONE of `pkd`/`rh`. Display/teach only — never scored. |

## Chord templates

Chord templates describe display names and fret shapes. Unused strings are `-1`.

```json
{
  "name": "Cmaj7",
  "displayName": "Cmaj7",
  "arp": true,
  "fingers": [-1, -1, -1, -1, -1, -1],
  "frets": [3, 3, 2, 0, 1, 0]
}
```

## Chords

A chord event references `chordTemplates[id]`.

```json
{
  "t": 0.0,
  "id": 0,
  "hd": false,
  "notes": [
    { "s": 0, "f": 3, "sus": 0 }
  ]
}
```

## Hand shapes

Arpeggio exercises should mark spans as `arp: true` so the existing 3D highway arpeggio framing can be reused.

```json
{
  "chord_id": 0,
  "start_time": 0.0,
  "end_time": 2.0,
  "arp": true
}
```

## Beats

Beats are generated from BPM, meter, and grouping. Measure starts use a non-negative `measure`; other beats use `-1`.

```json
[
  { "time": 0.0, "measure": 1 },
  { "time": 0.5, "measure": -1 }
]
```
