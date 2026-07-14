# Ear Mode — call→response ear-training (gap-roadmap Phase 2)

> **Status:** pre-build gate CLEARED 2026-07-14 (HOST CHECK below). Verdict **CONSUME +
> BUILD-on-ours, no note_detect change for v1.** Slices 2.1–2.3 build on our own
> contained engine + the *existing* contained-verifier path.

## What it is

The #2 differentiator (market: "improv **with** a curriculum" — a lane a major
rhythm-game's session mode proved, then abandoned). A two-phase loop over **any**
existing pitched Virtuoso drill:

1. **Call** — HIDE the notes, PLAY the target phrase as audio (our contained engine).
2. **Response** — the player PLAYS IT BACK; we grade the pitches.

This turns the whole drill library + the 29-genre backing engine (a built-in answer
key) into ear-training, and fills `call_response`'s literally-silent response bars.
G1 interval/chord recognition collapses into this: recognition answered **by playing**.

## HOST CHECK — Ear Mode (2026-07-14)

Two-lane pre-build gate (workflow rule 4). Host lane = `feedback-compatibility`
(clones @ `C:\dev\feedback\repos`, guitar_theory `554f053`); detector lane =
`notedetect-expert` (note_detect **1.28.0**, repo HEAD `5be374d`). Findings cached in
`.claude/agent-memory/notedetect-expert/project_ear_mode_response_grade.md`.

| Capability | What the host has | Verdict | Flip condition |
|---|---|---|---|
| **Call→response "play back & grade" loop** | Nothing — full ~48-plugin `plugin.json` sweep found zero; guitar_theory's ear mode is *click-to-name*, not play-back-and-grade | **BUILD** (on ours; graded half = the *existing* contained-verifier path → **zero new host surface**) | none plausible |
| **Interval / chord-quality / root RECOGNITION quiz** | guitar_theory "Theory Lab" (`id guitar_theory`, v1.0.0) ships it: `S.mode==='ear'` — intervals, chord-quality, root ID, Easy/Med/Hard | **DEEP-LINK, don't rebuild** the naming quiz; **BUILD** the answer-*by-playing* slice (our fingers-on-instrument gap) | a host `?mode=ear` deep-link param would harden 2.6 (low-pri) |
| **Reference-stimulus / demo playback ("hear the target")** | Nothing borrowable — all host audio is player/song-bound, unusable under contained playback | **BUILD on ours** — replay the existing chart notes with the highway hidden; near-zero cost, zero new assets | none needed |

### Detector verdict (the grading half) — CONSUME

- **`setVerifyTarget` = a *momentary* verifier** (scores ONE note-set against live audio
  every frame; no order, no timing — built for Step Mode). **The contained verifier =
  *timing-aware*** and needs a playhead timeline (`pushContainedPlayhead`). There is **no**
  sequence/melody/reference-phrase verify mode in the surface.
- **Primary Echo path (2.2) = the contained verifier we already use.** Replay the call
  chart; the player reproduces it **in time**; grade with the exact contained arm the
  drill/highway path runs (`setContainedChart` → `pushContainedPlayhead` per tick →
  `drainContainedVerdicts` → `releaseContainedChart`). Engine-gated pitch+timing+order,
  1:1 drain, engine's own silence/onset/persistence gating for free. **Desktop-only**
  (`isContainedVerifierAvailable()` is false on web).
- **Web / self-paced fallback = a `setVerifyTarget` state machine** — arm note 1 → wait
  for `notedetect:verify` → arm note 2 → … Grades **pitch + order, no timing**. Works
  web+desktop. Pass the tuning `ctx` on every arm (the only tuning channel note_detect reads).
- **v1 constraints:** single-note phrases (web is mono; desktop comb *is* polyphonic →
  chord-Echo is a free desktop-only tier later). **Bass sub-70 Hz is NOT a blocker** — this
  path grades through note_detect's OWN verifier (30 Hz floor since 1.15.3+), not the
  minigames YIN (whose 70 Hz `minHz` is a different path).
- **The one gap (out of scope v1):** the self-paced `setVerifyTarget` path has no onset, so
  it can't separate two *consecutive identical* pitches or grade rhythm. v1 workaround: use
  the in-time contained path (has engine onset), or constrain self-paced phrases to no
  immediate pitch repeats. Minimal host-ask (an onset/re-attack tick on the timing-free path)
  only if self-paced repeated-note melody grading ever becomes a hard requirement.

### Standing guardrails (from both lanes)
- **⭐ Every new graded modality ships behind the Phase 0.2 feature flag + a real-desktop×DI
  grading attest** — the smoke suite MOCKS the contained verifier, so a real-detector break
  ships green (the standing owe). Ear Mode's graded surfaces inherit this.
- **Consume the host judge** — Ear Mode reads verdicts, never re-judges. The CHART (what to
  play back) + the pedagogy (proof/XP) are ours; the grade is note_detect's.
- **Deep-link, don't rebuild** the naming quiz (2.6): pre-seed guitar_theory's `gt_mode='ear'`
  localStorage key + `showScreen('guitar_theory')`, feature-detecting via `/api/plugins` first.

## Build plan (slices)

| Slice | Size | What | Path |
|---|---|---|---|
| **2.1 Reference-stimulus / demo playback** | S | "Hear the target" — replay the chart notes as audio with the highway hidden. Enabler for all of 2.x. | our contained audio engine (§14); no detector |
| **2.2 Echo rung** | S | Fill `call_response`'s empty response bars with the call's notes as a graded contained chart — the minimal shippable ear/improv unit. | contained verifier (in-time), desktop; `setVerifyTarget` state machine web fallback |
| **2.3 Ear-Mode wrapper** | L | Two-phase call→response over any pitched exercise: hide → play → play back → graded. The library-multiplier. | 2.1 + 2.2 |
| **2.5 answer-by-playing recognition** | M | Interval/chord-quality recognition answered by PLAYING a 1–2-note target. | Ear Mode applied to a tiny target |
| **2.6 Theory-Lab deep-link** | S | Cross-link guitar_theory's click-to-name ear quiz — do NOT rebuild. | localStorage `gt_mode='ear'` + `showScreen` |

Single-note phrases for v1; desktop-primary grade with the web `setVerifyTarget` fallback;
every graded slice behind the feature flag + real-desktop×DI attest.
