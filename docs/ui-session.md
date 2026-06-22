# Session UI Design

> Reference document for the Session mode panel in `screen.html` / `screen.js`.
> Update this when the layout, tokens, or interaction model changes.

---

## Purpose

The Session UI exposes the Practice Session data model (defined in `docs/session-schema.md`) to the user without cluttering the existing Pathway / Custom exercise flow.

**Goal:** a user should be able to select a curated multi-segment program, see at a glance what it contains and how long it runs, and launch it with a single button — just like launching a single exercise.

---

## Navigation model — Two-mode toggle

The left controls panel has a top-level mode toggle:

```
┌──────────────────────────────┐
│ [Single exercise] [Session]  │  ← pill toggle, always visible
└──────────────────────────────┘
```

**Single mode** (default) — unchanged pathway / custom exercise UI.
**Session mode** — session selector, info card, segment list, audio, Launch button.

Implementation: toggling adds/removes the class `virtuoso-session-mode` on `#virtuoso-root`. CSS rules hide `.virtuoso-single-only` in session mode and `.virtuoso-session-only` in single mode.

---

## Session panel anatomy

```
[Program] ← group title

Session dropdown
  Built-in: ii–V–I Workshop / Daily 30-min / Blues Fundamentals / Bebop Fundamentals
  Saved: (user presets, future)

┌─ Session info card ────────────────────────────────────┐
│  ii–V–I Workshop                                       │
│  Structured jazz learning sequence for any progression… │
│  [5 segments] [~8 min] [60–90 BPM] [jazz]             │
└────────────────────────────────────────────────────────┘

[Segments] ← group title

┌─ Segment card ──────────────────────────────────────────┐
│  [GUIDE TONES]  Guide tones — 3rds                      │
│  C major · E-shape · ii-V-I · 3rds · 60 BPM · 8 bars  │
├─────────────────────────────────────────────────────────┤
│  [GUIDE TONES]  Guide tones — 7ths                      │
│  C major · E-shape · ii-V-I · 7ths · 60 BPM · 8 bars  │
├─ (active, when session is playing) ─────────────────────┤
│  [CHORD SCALES]  Chord scales — mode of moment    ◀ NOW │
│  C major · E-shape · ii-V-I · 80 BPM · 8 bars          │
└─────────────────────────────────────────────────────────┘

[Audio]

[ ☑ Notes ]  [ ☑ Metronome ]  [ ☑ Harmony ]

┌────────────────────────────────┐
│   ▶ Launch Session             │  ← primary blue button
└────────────────────────────────┘
```

---

## CSS design tokens

All tokens are consistent with the existing stylesheet. No new palette values are introduced.

| Token | Value | Usage |
|-------|-------|-------|
| Panel bg | `rgba(17, 24, 39, 0.94)` | All panels |
| Panel border | `rgba(75, 85, 99, 0.75)` | All panels |
| Card bg | `rgba(2, 6, 23, 0.4)` | Segment cards |
| Card border | `rgba(75, 85, 99, 0.5)` | Segment cards |
| Card hover border | `rgba(96, 165, 250, 0.3)` | Segment cards (hover) |
| Active card border | `rgba(96, 165, 250, 0.55)` | Active segment (playing) |
| Active card bg | `rgba(30, 64, 175, 0.12)` | Active segment (playing) |
| Info card border | `rgba(96, 165, 250, 0.25)` | Session info card |
| Info card bg | `rgba(15, 23, 42, 0.6)` | Session info card |
| Stat chip bg | `#1e293b` | Stat chips (segments, duration, BPM) |
| Stat chip border | `#334155` | Stat chips |
| Toggle bg | `#0f172a` | Mode pill container |
| Toggle border | `#334155` | Mode pill container |
| Toggle active bg | `#1e293b` | Active mode pill |
| Text primary | `#f8fafc` | Names, headings |
| Text secondary | `#94a3b8` | Descriptions |
| Text muted | `#6b7280` | Metadata lines, stats |
| Text accent | `#60a5fa` | Active labels |

---

## Segment kind badge colors

Each exercise type gets a fixed accent color. These are drawn from the existing `STRING_COLORS` array to maintain palette coherence.

| Kind | Badge label | Color |
|------|-------------|-------|
| `chromatic` | CHROMATIC | `#f97316` (orange) |
| `scale` | SCALE | `#22c55e` (green) |
| `modal_vamp` | MODAL VAMP | `#22c55e` (green) |
| `chord_scales` | CHORD SCALES | `#3b82f6` (blue) |
| `diatonic_arpeggios` | DIA. ARPS | `#a855f7` (purple) |
| `progression_arpeggios` | PROG. ARPS | `#a855f7` (purple) |
| `sweep_arpeggios` | SWEEPS | `#ef4444` (red) |
| `guide_tones` | GUIDE TONES | `#eab308` (yellow) |

---

## Segment card metadata lines

The metadata line below the name is built from `segment.config` based on the segment's `kind`:

| Kind | Metadata fields shown |
|------|-----------------------|
| `chromatic` | Frets lo–hi · BPM · bars · duration |
| `scale` | Key scale · shape · BPM · bars · duration |
| `modal_vamp` | Key scale · shape · BPM · bars · duration |
| `chord_scales` | Key scale · progression · strategy abbrev · BPM · bars · duration |
| `diatonic_arpeggios` | Key scale · shape · BPM · bars · duration |
| `progression_arpeggios` | Key scale · progression · shape · BPM · bars · duration |
| `sweep_arpeggios` | Key scale · shape · BPM · bars · duration |
| `guide_tones` | Key scale · progression · voice abbrev · BPM · bars · duration |

Duration is estimated: `bars × measureSeconds(config)`.
Voice abbreviations: `thirds_only` → `3rds`, `sevenths_only` → `7ths`, `both_alternating` → `3rds+7ths`.
Strategy abbreviations: `mode_of_moment` → `mode of moment`, `chord_tone_emphasis` → `chord tones`.

---

## Interaction model

| Event | Effect |
|-------|--------|
| Click "Session" pill | Switch to session mode; populate session selector and summary |
| Click "Single exercise" pill | Switch back; existing generate runs normally |
| Change session dropdown | Update info card + segment list for the selected session |
| Click "Launch Session" | `generateSession(session)` → `attachRenderer()` → `startPlayback()` |
| Session is playing | Play button in single mode can still stop it (shared `playing` state) |
| Switch to Single mode while session playing | Stop playback |

---

## Audio in session mode

Sessions have three audio toggles (separate IDs from the single-exercise form names to avoid DOM collision):

- `#virtuoso-session-audio-notes` → inject `audio.notes` into each segment config
- `#virtuoso-session-audio-metronome` → inject `audio.metronome`
- `#virtuoso-session-audio-harmony` → inject `audio.harmony`

The session launch function clones the session object and patches each segment's config with the audio settings before calling `generateSession()`. The base session objects in `BUILT_IN_SESSIONS` are never mutated.

---

## Responsive behavior

Inherits the existing layout breakpoints:

- `≤ 1100px`: single-column layout (left panel stacks above render stage)
- `≤ 720px`: audio options stack to single column
- `≥ 1800px`: ultrawide two-column controls grid (session panel also participates)

The segment list is naturally scrollable within the controls panel's `max-height: calc(100vh - 150px)` overflow.

---

## Future considerations

- **Active segment indicator**: when a session is playing, the segment card for the currently-active section (determined by `currentPracticeTime` vs. section markers in `exercise.chart.sections`) should get the `.active` class. Not in scope for the first implementation — requires a `requestAnimationFrame` hook or section-change event.
- **Saved sessions**: the `#virtuoso-session-saved-group` optgroup is reserved for user-saved sessions via the preset CRUD routes. Not yet wired.
- **Session key / BPM override**: a future "customize before launch" expansion could let the user change the key or BPM for the whole session without editing segments individually.
