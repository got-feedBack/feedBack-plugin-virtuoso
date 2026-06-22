# Virtuoso Architecture

Virtuoso is a FeedBack plugin that generates practice material and plays it back **inside the plugin's own contained surface** — its own renderer, transport, and audio engine — without navigating the user out of the Virtuoso screen.

## Direction decision (2026-05-30) — contained, not launched

> **Virtuoso keeps the entire practice experience inside the plugin screen.**
> "Play" must never take the user out of Virtuoso into FeedBack's full-screen
> player. This is a deliberate, owner-confirmed product decision (Christian),
> and it **overrides** the earlier "launch into the main player" direction that
> the rest of this document was originally written around.

Why this matters technically: `playSong(filename, arrangement)` calls
`showScreen('player')` and binds the host highway to the canonical `#highway`
canvas (verified in FeedBack `static/app.js` ~line 4548). The host player **is a
screen**, not an embeddable component — its transport, audio, loop/count-in,
speed, and scoring all live in that screen's lifecycle. There is no host API to
run that machinery in place inside a plugin panel. So "contained UX" and "reuse
the host player wholesale" are mutually exclusive; we chose contained.

**The accepted cost of this decision:** Virtuoso owns its own transport
(`tick()` / `currentPracticeTime`), its own Web Audio engine
(`schedulePreviewAudio`), and its own looping/seam quality. These do **not**
come for free from the host and will not auto-track host improvements. That is
understood and accepted — the contained, single-surface UX (one consistent
practice surface) is worth the maintenance.

**What we still reuse from the host (and may, while staying contained):**
- The host's **3D highway renderer** as a *visual* factory
  (`window.slopsmithViz_highway_3d`), driven by Virtuoso's own clock inside the
  plugin canvas. Borrowing the renderer is fine; it does not require the player
  screen.
- Host **navigation/events** via `window.slopsmith` (e.g. `navigate`, `emit`,
  `on`) for moving between Virtuoso and other FeedBack screens.
- The host **theme / page chrome**, so Virtuoso looks native.

**What we deliberately do NOT use:** `playSong()` as the primary play action,
and the temp-sloppak → main-player launch path as the primary UX. The
temp-sloppak backend route and the launch contract below are retained only as a
possible **optional future "export to the full host player"** action — never the
default, never required.

The plugin should feel like a native practice mode inside FeedBack, presented
as a self-contained practice surface rather than a launcher into another screen.

## Source-of-truth contracts from FeedBack

These notes are based on the current FeedBack docs and implementation:

- FeedBack is a FastAPI + vanilla JavaScript single-page app. Plugins are loaded from `plugins/<name>/` via `plugin.json`, optional `routes.py`, optional `screen.html`, optional `screen.js`, and optional `settings.html`.
- Plugin backend routes must live under `/api/plugins/<plugin_id>/...`.
- Plugin screens are mounted with DOM ids of the form `plugin-<plugin_id>`.
- Plugin shortcut scopes use `plugin-<plugin_id>`.
- Frontend plugin scripts run in page scope and may use `window.playSong`, `window.showScreen`, `window.createHighway`, the shared audio element, and `window.slopsmith`.
- `window.slopsmith` is the public frontend integration point for navigation, events, and lightweight host APIs.
- The main player opens through `playSong(filename, arrangement)`, which stops the current highway, switches to the `player` screen, initializes the canonical `#highway` canvas, and connects to `/ws/highway/{filename}?arrangement={index}`.
- Sloppak is an official FeedBack source format. Directory-form `*.sloppak/` packages are valid, not just zipped `.sloppak` files.
- Sloppak contents are manifest-indexed. The loader does not discover arbitrary files; `manifest.yaml` must point at arrangements and stems.
- Arrangement JSON should follow the `arrangement_to_wire()` / `arrangement_from_wire()` shape: `notes`, `chords`, `anchors`, `handshapes`, `templates`, `beats`, and `sections`.
- The WebSocket stream sends similar shapes to the player, but Virtuoso should write arrangement JSON and let FeedBack's existing `/ws/highway` loader stream it.
- Visualization plugins are for replacing the main highway renderer through `window.slopsmithViz_<id>` and `setRenderer`. Virtuoso is not a visualization plugin.

## Core rule

Virtuoso generates practice charts and **plays them itself, in-screen**. The
generated chart data is the contract; the contained renderer + transport + audio
engine consume it directly.

Current flow:

```text
Virtuoso configuration UI
  -> generate exercise data (the chart)
  -> makeBundle() wraps it for the renderer
  -> contained renderer (2D highway / tab / notation, or the borrowed host 3D
     renderer driven by Virtuoso's own clock) draws it on #virtuoso-canvas
  -> Virtuoso's own transport + Web Audio engine play it back, in-screen
  -> the user never leaves the Virtuoso screen
```

Optional, non-default escape hatch (retained but not primary):

```text
Virtuoso configuration UI
  -> generate -> write a temp directory-form .sloppak
  -> playSong(filename) to open the full host player (leaves the Virtuoso screen)
```

This launch path is documented below for completeness and possible future use as
an explicit "open in full player" action. It is **not** the default play action.

## What this means for ownership

Because the experience is contained, Virtuoso necessarily owns parts the host
would otherwise provide. This is intentional (see the Direction decision above):

- transport / playhead clock — Virtuoso's `tick()` + `currentPracticeTime`
- audio playback — Virtuoso's Web Audio engine (`schedulePreviewAudio`)
- looping + seam quality (gapless audio, smooth visual wrap) — Virtuoso's job
- renderer lifecycle for the contained canvas

We still avoid *gratuitous* duplication: navigation, events, theme, and the 3D
renderer **visual** come from the host. We do not reimplement those.

## Temporary Sloppak strategy (optional host-export path)

> The temp-sloppak path is **not** the primary UX (see the Direction decision).
> It is retained as an optional "export to full host player" capability. The
> backend route exists and works; the frontend launch is intentionally not the
> default play action.

Virtuoso writes generated practice content as directory-form Sloppaks inside the configured DLC directory:

```text
<DLC_DIR>/.virtuoso-temp/<id>.sloppak/
  manifest.yaml
  arrangements/lead.json
  stems/silence.wav
```

This keeps the package loadable by FeedBack's existing `/ws/highway/{filename}` route while avoiding library indexing.

### Manifest requirements

`manifest.yaml` must include:

```yaml
title: "Virtuoso - C major scale"
artist: "Virtuoso"
album: "Practice Tools"
year: 2026
duration: 12.0
arrangements:
  - id: lead
    name: Lead
    file: arrangements/lead.json
    tuning: [0, 0, 0, 0, 0, 0]
    capo: 0
stems:
  - id: full
    file: stems/silence.wav
    default: true
```

Sloppak docs normally show OGG stems, but the important requirement is that `stems` is non-empty and manifest-indexed. Virtuoso currently uses a generated silent WAV so the player has a transport clock; if FeedBack rejects WAV in practice, replace it with generated OGG.

### Audio stem generation

The stem is a synthesized WAV (OGG if `ffmpeg` is on PATH). Content is controlled by `session.audio` in the exercise payload:

- `{ "notes": true }` — synthesizes plucked-sine note audio from the note list using the correct string/fret MIDI pitches.
- `{ "metronome": true }` — synthesizes a metronome click track from the beats list (accented on measure downbeats).
- Both false (default) — writes a silent WAV; the player still gets a valid transport clock.

### Arrangement requirements

The temp arrangement should write Sloppak's on-disk field names:

```json
{
  "name": "Lead",
  "tuning": [0, 0, 0, 0, 0, 0],
  "capo": 0,
  "notes": [],
  "chords": [],
  "anchors": [],
  "handshapes": [],
  "templates": [],
  "beats": [],
  "sections": []
}
```

Frontend generation may internally use `chordTemplates` and `handShapes`, but the backend writer should normalize to `templates` and `handshapes` for Sloppak JSON.

## Main-player launch contract

The frontend launch path should:

1. Generate the current exercise from UI config.
2. POST it to `/api/plugins/virtuoso/temp-sloppak`.
3. Receive `{ ok, filename, title, duration }`.
4. Set a one-shot return marker in `sessionStorage`.
5. Prefer the existing 3D Highway by setting the FeedBack viz picker through `setViz('highway_3d')` when available, with a safe localStorage fallback.
6. Call `playSong(...)` with the temp DLC-relative filename.

Filename encoding needs practical testing because FeedBack's current `playSong()` builds its WebSocket URL with `decodeURIComponent(filename)`. If passing the raw relative path fails with slashes or spaces, pass `encodeURIComponent(filename)`. Do not change the backend output unless testing proves the current path is incompatible.

## Escape-return behavior

FeedBack's default player shortcut returns to the Library or Favorites. If a song is launched from an unexpected screen, including a plugin screen, the default fallback is Library.

Virtuoso needs a plugin-level Escape override only for Virtuoso-launched temp charts:

- Before launch, set `sessionStorage['virtuoso.returnToMenu'] = '1'`.
- Install a capture-phase keydown listener.
- If `Escape` is pressed while the active screen is `player` and the marker is set, stop propagation and navigate to `plugin-virtuoso`.
- Clear the marker when returning.
- Do not override Escape for normal songs.

This avoids core FeedBack changes while preserving native player behavior for the rest of the app.

## Plugin UX direction

Virtuoso should look and behave like a compact FeedBack practice-control panel.

Primary UX (contained):

- One primary action: **Play** — plays the generated routine in-screen, on
  Virtuoso's contained surface. No screen change.
- Supporting actions: **Generate**, **Stop**, **Save Preset**.
- Renderer choice (2D highway / tab / notation / borrowed 3D) is a Virtuoso
  surface concern here, since the playback is ours.
- Optional, de-emphasized: **Open in full player** (the temp-sloppak launch),
  for users who explicitly want the host's full-screen player. Not the default.
- Status area should tell the user what will happen next: generated
  notes/chords, duration, and play/loop state.

Playback surface:

- The contained renderers (2D highway / tab / notation) are first-class playback
  surfaces now, not just debug previews.
- The borrowed host **3D renderer** may be offered as a contained option, driven
  by Virtuoso's clock. (Note its current limitations: 6-string only, and as a
  host black box it can't be made loop-aware for a true seamless visual scroll.)

Configuration UX:

- Group controls by task, not by implementation detail:
  - Routine: mode, key, scale, progression, chord depth, chord override.
  - Instrument: instrument, tuning, fret range.
  - Timing: BPM, meter, subdivision, bars.
  - Output: preview summary and launch status.
- Hide irrelevant fields based on mode where possible. Progression selection is only relevant to progression arpeggios; chord depth and chord override are only relevant to arpeggio modes.
- Keep the form keyboard-safe. FeedBack global shortcuts intentionally avoid text inputs and selects; Virtuoso should not add conflicting document-level shortcuts except the one-shot Escape return handler.

## Growth path

Virtuoso grows along two axes: richer generated chart data, and a better
contained playback surface (since playback is ours now). Chart-data growth:

1. Position-aware scale paths: CAGED, 3NPS, string-set restrictions.
2. Better arpeggio paths: inversions, sweep shapes, nearest-note voice leading.
3. Progression-aware practice: chord-tone targeting, guide tones, shell voicings.
4. Audio improvements: generated metronome/click stem, count-in stem, optional spoken count.
5. Song-aware mode: use active song tuning, tempo, sections, and loop regions as inputs, then still emit a separate temp practice Sloppak.
6. Diagnostics: contribute Virtuoso generation state through FeedBack diagnostics if troubleshooting becomes common.

## Current implementation alignment

Current state (matches the contained decision):

- Frontend plays the routine in-screen via the contained renderers + Web Audio
  engine. This is now the intended primary UX, not a stopgap.
- Backend temp Sloppak route exists and is retained for the optional
  "open in full player" export path (not the default).
- Backend normalizes frontend `chordTemplates` / `handShapes` to Sloppak `templates` / `handshapes`.

Active work:

- **Seamless loop** for extended practice — gapless audio across the loop seam
  (pre-schedule the next pass instead of `stopAudio()`+restart) and a smooth
  visual wrap (carry the clock phase instead of freeze-and-snap). Started
  2026-05-30. Generator-side bar-line alignment + optional turnaround, and a
  true horizon-scroll in the 2D renderers, are follow-on increments.

Next implementation pass:

1. Make **Launch in Main 3D Player** the primary button in `screen.html`.
2. Add `launchInMainPlayer()` to `screen.js`.
3. Add Virtuoso-only Escape return handling.
4. Reframe existing embedded 2D renderer as Preview only.
5. Remove or demote the renderer dropdown.
6. Update README to describe temp Sloppak launch through the native FeedBack player.
