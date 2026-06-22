# Section Looping — Recon + Framework

> Status: framework only — no UI yet. See "Phase 2 — UI" at the end for what's
> intentionally deferred.

## What FeedBack does (reference implementation)

FeedBack's looping lives in `static/app.js` and is exposed to plugins via
`window.slopsmith.{setLoop, clearLoop, getLoop}` (see
`window.slopsmith = Object.assign(new EventTarget(), { ... })` around line 3160).

### Data model

- Two module-scope numbers: `loopA` and `loopB` (audio-time seconds; `null`
  when no loop).
- A SQLite-backed `loops` table, keyed by song `filename`, with per-loop
  `name`, `start_time`, `end_time`.

### REST surface

- `GET  /api/loops?filename=<f>` → array of `{id, name, start, end}`
- `POST /api/loops` body `{filename, name, start, end}` → `{ok, name}`
- `DELETE /api/loops/{loop_id}` → `{ok}`

### Frontend functions

| Function | Role |
|---|---|
| `setLoopStart()` | Captures A from the live audio clock. |
| `setLoopEnd()` | Captures B; rejects `B <= A`. |
| `clearLoop()` | Drops A and B, resets UI. |
| `setLoop(a, b)` | Plugin-facing programmatic API. Seeks to A, awaits the seek, then commits. Returns `false` if the seek landed off-target so half-applied state is never visible. |
| `saveCurrentLoop()` | POSTs the current A/B with a user-supplied name. |
| `loadSavedLoop(id)` | Restores from the dropdown via `setLoop`. |
| `deleteSelectedLoop()` | DELETEs and `clearLoop()`s. |

### Transport hook (the heart of it)

In FeedBack's 60Hz tick:

```js
else if (loopA !== null && loopB !== null && ct >= loopB) {
    lastAudioTime = loopB;
    startCountIn();
}
```

`startCountIn()` is where the polish lives:

1. Pause audio.
2. **Rewind animation** — `requestAnimationFrame` lerps `highway.setTime(t)`
   from `loopB` back to `loopA` over ~400ms with an ease-out-quad curve. The
   highway scrolls visibly back instead of cutting.
3. `_audioSeek(loopA, 'loop-wrap')` — JUCE/HTML5-aware seek that awaits
   completion and verifies the landing position to within 50ms.
4. **Count-in** — 4 metronome clicks at the song's BPM, then resume playback.
5. Emits `slopsmith.emit('loop:restart', { loopA, loopB, time: loopA })` on
   each successful wrap.

The whole chain is guarded by a generation counter (`_countInGen`) so a
teardown mid-rewind (player exit, new song load) cancels every pending
callback cleanly.

### Events plugins can listen for

- `loop:restart` `{ loopA, loopB, time }` — fires when a wrap completes and
  audio resumes at A.
- `screen:changed`, `song:play`, `song:pause`, `song:ended`, `song:seek`,
  `arrangement:changed` — adjacent events that interact with loop state.

---

## How this maps to Virtuoso

Virtuoso runs its **own** transport (`tick()` + `currentPracticeTime` +
`playAnchorMs`/`playAnchorChartTime`) and its **own** audio engine
(`schedulePreviewAudio` → Web Audio oscillators). The host's
`window.slopsmith.setLoop` controls the **host** transport — which we
deliberately don't use, because our preview playback is local.

So Virtuoso needs its own A-B loop layer with the same shape as the host's,
but plugged into Virtuoso's own clock.

### What's already in place

- A single wrap point in `tick()` (around line 2708) — currently wraps
  whole-chart at `currentPracticeTime > duration`. We hook A-B in the same
  spot.
- `stopAudio()` + `schedulePreviewAudio(bundle, fromTime, delaySeconds)` —
  re-schedules audio from an arbitrary chart time. Already used by the
  whole-chart wrap.
- `AudioEngine.scheduleClick(ctx, when, accent)` — metronome click
  synthesis, ready for count-in reuse.

### What this commit adds (framework only)

1. **Module-scope loop state:** `segmentLoopA`, `segmentLoopB` (chart-time
   seconds; `null` = no loop). Naming intentionally differs from `loopA`/
   `loopB` to avoid collision with the host's globals if a refactor ever
   merges scopes.

2. **Transport hook in `tick()`** — wraps to `segmentLoopA` immediately
   (no count-in, no rewind animation — those are phase 2 / 3). Re-schedules
   audio from A so notes/clicks/harmony resume from the loop start.

3. **Public API on `window.Virtuoso`:**

   ```js
   window.Virtuoso.setSegmentLoop(a, b)   // commits loopA/B; seeks to A
   window.Virtuoso.clearSegmentLoop()      // unsets both, no playhead jump
   window.Virtuoso.getSegmentLoop()        // → {a, b}
   ```

4. **Event emission via `window.slopsmith.emit`** (when available):
   - `virtuoso:loop:set` `{ a, b }`
   - `virtuoso:loop:clear` `{}`
   - `virtuoso:loop:wrap` `{ a, b, time: a }`

   Prefix is `virtuoso:` not `loop:` so we never shadow or conflict with
   the host's identically-named events.

5. **No UI.** No A/B buttons. No saved-loops dropdown. The framework is
   reachable only via the public JS API for now — enough to test the
   transport loop and to drive it from a future UI or from another plugin.

### Phase 2 — UI (deferred)

When we add the UI, these are the touch points:

- A/B buttons next to Play (probably under Tempo & Audio, paralleling the
  existing tier-buttons row).
- A loop-label readout showing `start → end` in beats/bars rather than raw
  seconds (we have `beats[]` and `measureSeconds` — easy to convert).
- Saved-loops dropdown:
  - New backend route: `GET/POST/DELETE /api/plugins/virtuoso/loops`,
    keyed by a hash of the exercise config (key+scale+pathway+shape) so
    saved loops survive a regenerate. (FeedBack keys by `filename` —
    we don't have one.)
- Count-in toggle + rewind-animation toggle. Both are quality-of-life and
  worth shipping behind defaults that match FeedBack's behaviour.

### Phase 3 — host parity (deferred further)

If the user is launching into the main 3D player via the temp-sloppak
path (currently not wired — see CLAUDE.md "Current implementation state"),
we should bridge `setSegmentLoop` → `window.slopsmith.setLoop` so the host
player loops the same region. The chart-time seconds we use here match
the audio-time seconds the host uses (both are arrangement-local), so the
bridge is just `slopsmith.setLoop(a, b)`.

---

## What was NOT pulled across

- **Saved-loop persistence** — FeedBack persists per-song; we'd persist
  per-exercise-config. Different keying strategy. Deferred to phase 2.
- **JUCE / Electron audio path** — FeedBack juggles HTML5 audio and the
  native JUCE backend; Virtuoso only has Web Audio oscillators, so no
  equivalent.
- **`_countInGen` teardown generation counter** — necessary in FeedBack
  because count-in spans multiple async steps that can race against song
  changes. Virtuoso's wrap is synchronous in `tick()`, no races to guard.
  We'll need it back when count-in lands in phase 2.
- **`_syncSavedLoopSelection`** — UI sync, phase 2.

---

## API reference (current)

### `window.Virtuoso.setSegmentLoop(a, b)`

Commits a loop region between chart-time seconds `a` and `b`. Both must be
finite, both must lie within the active bundle's duration, and `b > a`.
Throws on invalid input. Seeks the playhead to `a` and emits
`virtuoso:loop:set`. Returns `void`.

### `window.Virtuoso.clearSegmentLoop()`

Drops both endpoints. Does **not** stop playback or move the playhead.
Emits `virtuoso:loop:clear`.

### `window.Virtuoso.getSegmentLoop()`

Returns `{ a, b }` (each `number | null`). Cheap; no side effects.

### Events

Plugins / drivers can subscribe via `window.slopsmith.on(name, fn)`:

- `virtuoso:loop:set` — fired after `setSegmentLoop` commits.
- `virtuoso:loop:clear` — fired after `clearSegmentLoop` commits.
- `virtuoso:loop:wrap` — fired each time `tick()` wraps from B back to A.
  `detail.time` is `a` (the new playhead position).
