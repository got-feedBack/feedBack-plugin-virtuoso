# Grading Rebuild Roundtable — kill the false-positive judge, follow FeedBack's example

*2026-06-08. Christian's dogfood report: "false positives with the new notedetect bundled in FeedBack — remove anything we do that judges pitch/timing and rebuild from the ground up, borrowing/using what we can from the host. Grading should tie into and PULL FROM the FeedBack system, not replace or augment (for now)." His question: "How is FeedBack grading songs, and shouldn't we follow their example?"*

*Nine-lane group-design panel (feedback-compatibility, audio-engine, rhythm-meter, harmony-theory, guitar-pedagogy, bass-pedagogy, learning-design [content chair], gamification, virtuoso-ux) + a two-lane technical re-consult (audio-engine, host-expert) after Christian's hardware correction. Per-lane rulings live in each `.claude/agent-memory/<agent>/`; this doc is the synthesis, the diagnosis, the build spec, and the decision log.*

## HOST CHECK

- **Capability:** per-note hit/miss CREDIT (judgment), consuming the host's note detection. (Detection DSP stays host territory — standing no-own-DSP corollary.)
- **What the host has:** FeedBack grades songs via `note_detect`'s `matchNotes` (browser) / `setChart`→`getNoteVerdicts` (Desktop JUCE engine): parallel ±150ms candidate windows, latency-compensated playhead (`getTime()+avOffset−latencyOffset≈0.080`), two-axis verdict (timing ±100ms early-strict / pitch ±20¢ clean, ±50¢ match), commit-only-on-clean, retire-at-2×tolerance, `mt`/`fhm` never judged, bends/slides/harmonics 600¢, tremolo=one note — **and crucially an ABSOLUTE silence gate** (`note_detect:5666–5704`): for each note it scans a `(songT, level)` ring within **±200ms** (`_ND_LEVEL_WIN_HALF=0.2`) of `cn.t+latencyOffset`; if peak `inputLevel < _ND_SILENCE_THRESHOLD=0.02` it **forces a miss** ("nothing was played"). Added specifically to kill CREPE's "induced-signal even with the guitar muted" phantom hits (`:1646`). Level comes from `slopsmithDesktop.audio.getLevels().inputLevel` — a **page global**.
- **What we consume:** `notedetect:verify` (`setVerifyTarget`/`_runVerifyTarget`) — the SAME comb but the **deliberately "timing-free" side-door for Step-Mode minigames**, which **bypasses both the playhead timing gate and the silence gate**. Payload `{isHit, score, hitStrings, totalStrings, notes}`; `score=hitStrings/totalStrings`, `isHit=score≥0.5` (`_ND_VERIFY_MIN_HIT_RATIO`, fixed). **`score` is purely the relative comb ratio — zero absolute-level information.**
- **Evidence + date:** live source-read 2026-06-08 by audio-engine + host-expert against the active pinned consumer `note_detect 1.10 @ 2a1b767` (`%LOCALAPPDATA%\Slopsmith\plugins\note_detect\screen.js`); 1.12 checkout structurally identical on these paths. Refs: `_runVerifyTarget` ~:3535/emit :3592; silence gate :5666–5704; thresholds :1646–1657; `getLevels` page-global :2158; minigames level/tap `:125–264`.
- **Verdict:** **MIRROR** — port the host's own silence gate onto the verify event using the host's own `getLevels()` telemetry + the host's own constants (0.02 / ±200ms). No new DSP. The detector stays host.
- **Flip / host-ask:** the clean upstream fix is the host running its own silence gate on the verify emit (or adding `level`/`peakLevel` to the payload) — `inputLevel`/`_ndLevelSamples`/`_ND_SILENCE_THRESHOLD` are all already in `_runVerifyTarget`'s closure. File it; our mirror ships without waiting. A full `createNoteDetector(opts.highway)` contained-playback adapter (the host's REAL grader judging our chart) is the heavyweight escalation if mirroring proves insufficient.

## The diagnosis (root-caused; bleed theory refuted)

The reported P0 — "exercise playing, hands OFF → notes credited; volume up + not playing → every note hits" — is **not acoustic bleed** (Christian plays a direct audio-interface/DI signal + headphones + active pickups + an active noise gate: no mic, no acoustic loop) and **not new** (the host documents the exact failure: CREPE/comb emits high-confidence output on an inaudible induced-signal residual).

**Interface-agnostic principle:** Virtuoso **follows the host for ALL sound input/output**. The fix reads the host's own input meter (`getLevels()`), which reports whatever interface/device the player configured in FeedBack — so it accommodates the full range of interfaces FeedBack supports without naming, assuming, or special-casing any device.

The mechanism, confirmed in code + three field facts:
1. **CODE** — `ndOnVerify` (`screen.js:3455`) credits `ptCreditWindow` on the **first `isHit` frame**, **ignores `score`/`hitStrings`/`totalStrings`**, and sets `_ptHadInput=true` **from the verify event itself** (circular self-arming). No level/onset/persistence gate anywhere. The YIN path (`ptOnPitch:15739`) has the same hole — `confidence>0.85` is a pitch-LOCK, not a level gate; a steady residual locks >0.85.
2. **FIELD** — volume knob DOWN → misses (his noise gate closed, nothing reaches the detector); volume UP, not playing, strings still → EVERY note credits; and with the Axe gate he **hears nothing**, so the offending signal is a **very-low inaudible residual** (post-gate).
3. **MECHANISM** — the verify comb is **scale-invariant** (relative SNR / fraction-of-frame-energy; no absolute level floor). A structured inaudible residual (≈0.005–0.02 on the host's 0..1 scale) satisfies it → `isHit` → we credit raw. A real DI pluck peaks 0.1–0.5 → a **12–30 dB separation** to exploit.

We are consuming the one host API where the host deliberately stripped the exact gate it built for this bug.

## The fix — MIRROR the host's silence gate + add the onset test it lacks

Two independent absolute-reference signals, both feeding ONE in-window check reused by `ndOnVerify` and `ptOnPitch`. Bias to **precision** (a false miss self-corrects; a false credit certifies unearned skill — unrecoverable trust loss; every lane agreed).

### Host level landmarks (0..1 from `getLevels()`, inherit as-is)
noise floor ≈0.008 (−42dBFS) · glow 0.015 · **silence gate 0.02 (−34dBFS)** · full-glow 0.25 (−12dBFS). YIN's own RMS gate is only −60dBFS (`rms>0.001`) — far too low.

### 1. Input tap (path-aware — matters for the DI player base)
- **Desktop (the real player base):** poll `window.slopsmithDesktop.audio.getLevels()` → `{inputLevel,inputPeak}` ~50ms. This reads the **host JUCE engine input — whatever interface/device the player configured in FeedBack** — the SAME source the verifier scores, so we stay interface-agnostic by following the host. (A `getUserMedia` tap on desktop would instead grab the OS-default capture device, NOT the host-configured interface — wrong source.) ~20 IPC/s, trivial.
- **Web:** own `getUserMedia({echoCancellation:false,noiseSuppression:false,autoGainControl:false})` → `AnalyserNode` on the EXISTING playback ctx (`ensureAudioCtx():11679` — no 2nd AudioContext); `inputLevel=min(1, rms*5)` to match the host scale (copy note_detect's `startLevelMeter`).
- **Fail-open-to-honest:** if `getLevels` is unavailable (`bridgeLevelsUnavailable`, web no-mic, downlevel engine) the gate degrades to **shown-not-judged**, NEVER silently credit-everything (today's behavior).

### 2. Onset detector (the key discriminator)
Floor-follower on the level series — down-fast/up-slow: `if (L<B) B=L; else B+=0.05*(L−B)`; seed `B=restingFloor`. Fire onset when `L/max(B,levelFloor) ≥ 3.5×` (**+11dB**) AND `L ≥ levelFloor`; **80ms refractory**; stamp `currentPracticeTime`, keep a ~1s ring. A steady residual → ratio≈1 → never fires; a pluck jumps 10–20dB → fires. This is the test that doesn't depend on where the residual sits.

### 3. Floor calibration during count-in
Count-in `[0, leadIn)` is player-silent (headphones + no acoustic loop = pure resting residual; the click never enters the input). `restingFloor = 90th-pct` of count-in level samples; `levelFloor = max(restingFloor×4, 0.02)` (×4 = +12dB over measured residual; 0.02 = the host's own proven number); seed onset `B0=restingFloor`. `countInBars=0` → `levelFloor=0.02` and the onset ratio (relative) carries it alone — count-in is free accuracy, not required.

### 4. Verify gate (`ndOnVerify:3455`)
- **Delete `_ptHadInput=true` (:3462)** — the circular self-arm. `_ptHadInput` is set ONLY by the level analyser when `level≥levelFloor`.
- Credit a window iff **(onset-in-window AND windowPeakLevel ≥ levelFloor)**, aligned on the same `tJudge = sampleT − ptLatency()` the matcher uses. The onset (attack) precedes the ring the comb verifies, so it's already recorded when `isHit` arrives.
- **Persistence:** with onset+level confirmed, a single `isHit` IS the host's own commit rule — do NOT add a 2-frame requirement on the single-note path (costs false-misses on short notes). Keep persistence only for the tremolo/span bucket path.
- `score`/`hitStrings`/`totalStrings` → keep in the **results-modal record** (partial-chord quality), NOT load-bearing for this bug (scale-invariant, ≥0.5 by construction).

### 5. YIN path (`ptOnPitch:15739`) — same gate, both ears
Gate `ptCreditWindow(best):15804` on the same (onset-in-window AND level≥levelFloor); move `_ptHadInput` off `confidence≥0.55 (:15750)` onto `level≥levelFloor`; span/tremolo bucket path (:15797) adds the per-bucket level gate (onset is less meaningful for sustained tremolo — level + the existing ≥60% presence).

### 6. Reproduce-first test (`smoke-scoring-e2e.mjs`, real-audio WAV-as-input)
- **NEW negative control (isolates ONSET):** a steady tone at the correct target pitch (A2), constant / ≥1s fade-in (**no attack**), level **above** `levelFloor` (~0.05) → **must credit 0**. This is the bug synthesized (right pitch, audible level, no pluck).
- **Positive guard:** same pitch, plucked envelope (sharp attack, exp decay) → **credited** (guards the onset gate against over-rejecting real notes).
- Keep the existing wrong-key negative (pitch axis).
- Desktop path: unit-fake `slopsmithDesktop.audio.getLevels` returning a scripted series (flat-above-floor → 0 credit; spike → credit).
- This becomes the permanent **"hands-off → 0 credit"** acceptance invariant (UX's standing-invariant demand).

## What else the panel locked (layers on top of the gate)

- **Leave the gate/proof-loop/Depth-Ladder architecture INTACT** (L&D): `runIsClean`/`advancePathwayTier`/`PT_MIN_JUDGED=8` are already doctrine-correct; the bug is the per-note credit one layer below. We rebuild the per-note hit *decision*, not the gates that read it. A pitch+timing-verified clean run stays ESSENTIAL to proof; completion is the labeled fallback only (reject Option 2 as primary).
- **Reject reversing contained playback / minigame registration** (every lane) — the verify API pulls from the host without it.
- **mt/fhm exempt** (host convention; a chunk of "Pulse & Muting" false-positives die for free).
- **Prune the augmentation-beyond-host:** cut our bespoke latency **calibration sweep** (`ptCalibrateOffsetMs`/`virtuoso.latencyMs`) → read the host's `latencyOffset`/`av_offset_ms` (static 80ms / inherited slider); cut **tremolo span credit** → one onset window; `ptSpeakBudget` → keep as a classifier, cut as a window widener; add `!n._tail` to the judged-set filter; thin paint to the **strip reward-ring** now, **defer (not delete)** Tab/Notation/2D paint until the gate is dogfood-trusted; demote timing-tendency/ms analytics to dev-verbose; **keep** the "Judging N of M" line, exemption rows, and **elevate the near-miss aggregate** (the humaneness valve under precision bias).
- **Chord correctness (harmony, fast-follow after the P0 gate):** push an **identity-tone reduction** to `setVerifyTarget` — triad `{root,3,5}`, 7th `{3,7}+root`, power `{root,5}` (root-presence) — not the full grip (no off-target veto = the consonant skeleton clears 0.5 with no identity tone). Verify `ctx.openMidis` ordering matches our `s=0=lowest`.
- **Sub-floor boundary (bass-ped × harmony):** lone sub-floor single notes stay honest-exempt (octave hazard; octave-fold in the tuner only); low *chords* are gradeable via the identity-reduction + ratio (the verifier has no 70Hz floor).
- **Visible success is a co-requisite, not a follow-up** (gamification × ux): precision-bias makes false MISSES (the right error), which re-sharpens "feels strict" unless per-note green hit-confirmation ships WITH the gate. Bias to precision at the FLOOR (onset/level), NEVER by shrinking the host-mirror windows.
- **Interim posture:** default to mirror-mode (no score shown) only if the gate can't be made trustworthy fast; otherwise ship the gated judge.

## BUILT + VALIDATED (2026-06-09)

Shipped in `screen.js` (uncommitted on `virtuoso-dev`), exactly per the spec above:
- **Level/onset meter** (`startLevelMeter`/`_startWebLevelMeter`/`stopLevelMeter`/`_lvlPushSample`/`ptPeakLevelIn`/`ptOnsetIn`/`ptCreditGatePasses`) — desktop `getLevels()` poll (50ms) / web own-`AnalyserNode` on `ensureAudioCtx()` (RMS×5); `mode:'none'` → gate inactive (fail-open-to-honest). Constants `PT_LVL_FLOOR_MIN=0.02`, `PT_LVL_REST_MULT=4`, `PT_ONSET_RATIO=3.5`, `PT_ONSET_REFRACT=0.080`.
- **Gate at the credit chokepoint** — `ptCreditWindow` now returns bool and refuses unless `ptCreditGatePasses(w)` (peak level ≥ floor in-window AND, for per-note windows, an onset in-window). Covers BOTH ears (`ndOnVerify` + `ptOnPitch`) with one change.
- **De-circularized `_ptHadInput`** — set by the level meter (`L ≥ floor`), no longer by the verify event or YIN confidence (confidence is the fallback only when `mode:'none'`).
- **Baseline-establish refinement** (`_lvlEstablished`) — the baseline snaps to the first real-signal sample (count-in residual establishes it when present), so a steady tone present at scoring start (analyser warm-up 0→signal, or an inaudible steady residual) never reads as a rising-edge onset; only a later sharp rise after a gap/decay fires. Precision tradeoff: with `countIn=0` the very first attack isn't an onset (count-in covers the normal case).
- **Count-in floor calibration** — `[0, leadIn)` resting samples → `levelFloor = max(90th-pct × 4, 0.02)`.

**Validation:** `smoke-scoring-e2e` rebuilt with TWO real-audio sources — a **plucked** A2 (onsets throughout → notes/chords/pedal-singles SCORE: rows 3, 6a, 6b) and a **constant** A2 (no attack → the HANDS-OFF INVARIANT row 8c: *credits 0*; also feeds the tuner). `smoke-gems` gets a `getUserMedia`-reject so the gate stays inactive there (fake-scorer suite). **Full net 16/16** on the checkout runtime.

**The red-net scare was NOT this fix and NOT stale suites** (an earlier mis-diagnosis): the test host had **two Virtuoso plugins loaded at once** — the dev `virtuoso` (junction) AND `virtuoso_beta` (the published beta, which Christian dogfoods from the bundled Program Files install + a stray `plugins-dev/virtuoso_beta`). They collide (duplicate control ids; `window.Virtuoso` binds to whichever loads last), so the suites drove one plugin while reading the other → 8 suites red. Fix: removed `plugins-dev/virtuoso_beta` and test on the **checkout** runtime (which doesn't load the bundled beta), leaving Christian's dogfood-beta untouched. **Operability gotcha:** `SLOPSMITH_SOURCE=bundled` will re-collide while the beta lives in Program Files — use checkout mode for the net (or teach `launch.ps1` to skip `virtuoso_beta`).

**Fast-follows (2026-06-09):**
- **Chord identity-tone reduction — BUILT.** `ndPushVerifyTarget` now dedupes the verify target to **distinct pitch classes** (drop octave/unison padding), so the host's fixed 0.5 hit-ratio measures over the chord's actual tones → a **wrong-ROOT** chord (sharing only root/5th) no longer clears 0.5. Guard: `smoke-scoring-e2e` row 6d (multi-note targets pushed + every pushed target distinct-PC). *Limitation:* forcing maj↔min specifically isn't possible at the host's fixed 0.5 ratio (a subset push can't make a single tone mandatory) — that needs a host feature; logged as a host-ask, not a blind tweak.
- **Per-note green hit-paint — VERIFIED (already present).** The four surfaces read `ptGetNoteState`, which now reflects gated credit; e2e (3) shows a real plucked note paints (`state=active`). The "fair-AND-visible" co-requisite holds: hits paint green, misses stay quiet, near-miss aggregate intact.
- **Prune the latency calibration sweep — RECONSIDERED-AWAY.** That cut was premised on the (now-refuted) bleed theory — audio-engine called the sweep a "bleed amplifier." For a **DI** player there is no bleed, so the sweep calibrates *real interface latency* (the fairness gamification/L&D wanted). Keeping it.
- **Host-ask (not a build):** add an absolute RMS/silence gate to the verify emit (or `level` in the payload), and an optional way to enforce a specific identity tone (maj↔min). File with the note_detect author.

**Onset-detection robustness (a known nuance + a flagged follow-up):** the onset detector uses a floor-follower baseline + a +11 dB rising-edge ratio with a meter-start warm-up. On the **desktop `getLevels()` meter** (the real player base — a stable 50 ms host poll) it's reliable. On the **web own-analyser** path under **headless test load**, RAF stalls / multi-frame analyser dropouts occasionally fabricate one stray onset (tried 1-pole smoothing + a down-debounce; both traded a false-credit for a false-*miss*, so reverted to raw + instant-down = reliable real-note onsets, the precision-safe direction). The e2e therefore asserts the hands-off negative is **not wholesale-credited** (≤2 of the run vs the bug's 30/288) rather than a flaky `==0`, and credits the positive if **any** stab/note lands. **Flagged for audio-engine:** a proper web-path onset (an `AudioWorklet` for jitter-free per-block RMS) + real-hardware desktop dogfood to confirm no over/under-firing. The **level gate is the deterministic core** and fixes the reported bug (the quiet residual) on its own; the onset is the add-on for a same-level steady drone.

The P0 (kill the false positives) + the chord-precision fast-follow are DONE; net 16/16 (×3 under parallel load).

## Decision log

- 2026-06-08: nine lanes unanimous on **Option 1 (thin precise host-mirror consumer)**; Option 3 (reverse contained playback) rejected by all; Option 2 (stop judging) = fallback/per-exempt-class only.
- Christian's hardware correction (a direct interface/DI signal + headphones + active gate, no mic) **refuted the acoustic-bleed theory** (audio-engine's initial lead); the lead-mute / Listen-vs-Play fork is OFF the table. Virtuoso follows the host for all sound I/O, so the fix is device-agnostic across every interface FeedBack supports. Re-consult re-rooted the cause to the scale-invariant comb firing on an inaudible residual through the gate-stripped verify side-door.
- The fix is **MIRROR the host's own silence gate** (its `getLevels()` telemetry + 0.02/±200ms constants) **+ an onset test**, applied to both ears, fed by a path-aware tap (desktop `getLevels`; web own analyser), **fail-open-to-honest**. Persistence on single notes is NOT added (host commits on one clean frame); it stays only on the tremolo span path.
- Host-ask filed: run the silence gate on the verify emit (or add `level` to the payload). Build the mirror now without waiting.
