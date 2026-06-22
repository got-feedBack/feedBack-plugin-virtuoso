# Timing & Judging Roundtable — note-timing forgiveness rework

*2026-06-06. Seven-lane panel (feedback-compatibility, audio-engine, rhythm-meter, guitar-pedagogy, bass-pedagogy, metal-idiom, virtuoso-ux) convened on Christian's dogfood report: "note timing feels unforgiving on chromatic runs; melodic/arpeggiated feels okay." Full per-lane rulings live in each agent's memory (`.claude/agent-memory/<agent>/`); this doc is the synthesis, the Slice 1 build record, and the Slice 2 design.*

## HOST CHECK

- **Capability:** note-timing hit-window judging semantics (grading, not detection).
- **What the host has:** note_detect's `matchNotes` grades with **parallel per-note candidate windows** (`±150ms` match + late grace `min(sus,1s)`; clean = `±100ms` early-strict / `±20¢`), **pitch disambiguates overlapping candidates**, judging playhead is **latency-compensated** (`latencyOffset` default `0.080s`, user slider, auto-calibration sweep writes `av_offset_ms`), commit-only-on-clean, retire at 2×tolerance. Conventions: `mt` muted notes **never judged**; `tr` tremolo = **one** judged note; bends get a **600¢** lenient pitch gate. `docs/NOTE_FAILURE_SPEC.md` codifies the same constitution. (Host checkout `plugins/note_detect/screen.js` :1437–:1504, :3476–:3612; `plugins/minigames/screen.js` :168–:302.)
- **Evidence + date:** source-read 2026-06-06 by feedback-compatibility (memory `reference_host_timing_grading_2026-06-06`).
- **Verdict:** **MIRROR** — judgment semantics are ours by doctrine (host owns detectors; we own judgment), so we replicate the host's grading model inside our contained player rather than borrow code that is chart-coupled to the host highway.
- **Flip:** a host scoring-core extraction / note-detection capability domain reachable from non-chart contexts → BORROW it and delete ours.

## The diagnosis (why chromatic runs felt unforgiving)

Four stacked factors, all mechanical (not feel, not the player):

1. **First-match window theft.** The old judge picked the FIRST note whose window contained the raw playhead. Builders emit `sus ≈ 0.78–0.85·IOI`, so the previous note's tail swallowed each note's entire early side: every window effectively opened **20–50ms AFTER its own onset** — the attack (the detector's best evidence) was always judged against the *previous* note, a semitone away, >50¢, discarded.
2. **Zero latency compensation.** Mic capture + analysis means evidence arrives ~80–165ms after the attack (audio-engine's budget). The host subtracts 0.080s before matching; we judged at the raw clock — an on-time player graded ~80ms late on every note.
3. **The EMA semitone boundary.** `smoothingMs:40` (our own parameter) is a log-domain EMA: a semitone step read **~47¢ on its first frame** — at the ±50¢ gate boundary for exactly chromatic content — and one out-of-window frame **reset the consecutive streak**.
4. **Density + same-string kill.** Chromatic drills are the densest content and same-string picks kill the prior ring; arpeggios ring across strings through their (late-opening) windows — which is why they felt fine. Bass addendum: written-staccato `sus` caps evidence too, so correctly *damped* bass groove notes were uncreditable while wrongly *ringing* ones scored.

Evidence-budget math (guitar-pedagogy): chromatic 16ths at 100 BPM left 113ms of usable evidence against a streak needing ~120ms — tier 3 was a coin flip, tier 4 structurally impossible. The complaint was the code's prediction.

## Slice 1 — SHIPPED 2026-06-06 (this build)

All in `screen.js` §14; one window table is now the single source of truth both ears read (it replaced six subtly-different copies of the window formula).

| Change | What it does |
|---|---|
| `PT_DETECT_LATENCY = 0.080` | Both ears judge at `currentPracticeTime − 0.080` (host's shipped default). Auto-calibration sweep = Slice 3. |
| `ptBuildWindows` table | Built once per run: per onset-group `matchStart/matchEnd` (parallel candidate bounds, ±100ms pads, ring credit `min(sus,1s)`) + `exclStart/exclEnd` (midpoint-split exclusive bounds). Monotonic cursor; backward seek ≥0.25s re-searches (loop wrap, click-seek). |
| Parallel candidate matching (YIN) | Every unscored window containing tJudge is a live candidate judged at its OWN pitch; the frame credits its best pitch match. Same-pitch neighbors clamp at the midpoint (the one case pitch can't disambiguate — chugs/pedals can't ring-credit their successor). |
| Evidence pair rule | Hit = **2 in-window frames ≤150ms apart** (was 2 *consecutive*, reset by any jitter frame). The lock-on sweep still contributes only one frame — anti-false-credit preserved (scoring-e2e negative control green). |
| `smoothingMs` 40→12 (scoring handle) | Near-raw YIN per frame; kills the semitone-boundary problem. The meter strip re-smooths display-side in `ptOnPitch`; the Tune… panel keeps 40 (display). |
| Verifier ear | `_ndActiveGroupAt` = the table's midpoint-split OWNER on the shifted clock — holds each target ~80ms past its nominal slot (verify events run 50–170ms behind the string), hands off promptly in dense runs. |
| `mt` exemption | Muted ghosts excluded from the judged set (host convention; DapperTap bug #2). New `exemptMuted` class in `_ptRunInfo` + a results-modal row. |
| Bend gate | `bn` notes judged at **±600¢** (host convention: the hit rides presence + timing, never a moving bend target; DapperTap bug #1 half-fix — full target modeling not host practice either). |
| `_tail` filter | Visual loop-preview copies excluded from the judged universe (they inflated totals and could phantom-credit at the loop seam). |
| Consistency | `passedTotal` (live + sessionEnd) and gem miss-arming read the same table on the same shifted clock. |

**Guards:** new `smoke-gems` row 6 — window-table exclusive bounds non-overlapping + **an on-time player credits EVERY note of a 160 BPM chromatic 16th run** (the panel's acceptance test; impossible under the old judge). `smoke-scoring-e2e` (real audio, wrong-key negative control) green. Full net 16/16.

**Deliberately NOT loosened:** the ±50¢ pitch gate (an adjacent fret is 100¢); no strictness knob (strictness is curriculum — named tight rungs / the Hardcore recognition axis); gems stay binary (`hit` means one thing — strictness lives in the judge, never the paint).

## Slice 2 — BUILT 2026-06-06 (session #13; the fast-idiom honesty layer)

**Probes ran first** (`probe-verifier-envelope.mjs` — gated bursts/PM/low-bass WAVs driven straight into `setVerifyTarget`, wrong-pitch negative control clean): verifier **min-ring ≈ 50ms** (94% @ 50ms, 100% ≥ 100ms, degrades @ 35ms → 200 BPM 16ths honestly judgeable); **palm-mute SURVIVES the comb** (100% — no PM exemption needed); the verifier has **NO 70Hz floor** (E1 + B0 100% — the sub-floor exemption dissolves in verifier mode; YIN keeps it).

**Build record** (all `screen.js` §14; guarded by `smoke-gems` rows 6d + 7a–7d):
- `PT_MIN_RING_YIN = 0.085` / `PT_MIN_RING_VERIFIER = 0.050` — the tooFast floor uses an **effective ring**: written-staccato (`sus < 0.7·IOI` — the damping is the lesson) rings `sus`; legato-ish runs (builders emit cosmetic `sus ≈ 0.78·IOI` but the string rings to the next attack) ring `IOI`; the last note rings into silence (always certifiable). Without the split, chart sus would self-exempt every fast run incl. the 160-BPM acceptance (caught by row 6d).
- Tremolo spans: consecutive same-pitch `tr` → ONE merged window (`tr@n`, ring uncapped), 100ms presence buckets, credit at ≥60% on end-of-span (`ptFinalizeSpans`, both ears), members light together, **one unit** in both numerator and denominator (`_ptScoredUnits` replaces `_ptScored.size` everywhere).
- `ho`/`po` exemption global (judge the picked opener; herta's physics generalized).
- `ptSpeakBudget(f0) = clamp(3·period+25, 35, 80)ms` extends every window's post-roll (clamped at the midpoint — never stolen from the neighbor).
- Disclosure: results-modal rows (too-fast w/ floor, slurred, tremolo-units), **timing-tendency line** (median first-evidence dev, gated ≥8 samples & |lean| ≥ 30ms) + near-miss aggregate (in-pitch ≤250ms off-window, gated ≥4), the resting-strip **pre-run denominator line** ("Judging 184 of 512 notes — 328 slurred shown unjudged", consistency-guarded against the live classifier by row 7a3), and the **dwell chip** (merged ≥0.5s exempt runs named under the playhead; muted ghosts skipped — flicker + they're the player's own mute).

Original design (constants confirmed/adjusted by the probes):

1. **`tooFast` honesty floor** — per-ear certifiability: a note is per-note-judged iff `min(sus, IOI) ≥ EAR_MIN_RING` (YIN ≈ 0.095–0.10s → per-note honest to ~135 BPM 16ths post-Slice-1 ~160–180; verifier floor unknown until probed). Below: **exempt-but-shown**, a new disclosed class out of the denominator. Emergent win: gallop cells get natural checkpoint judging (long chug judged, short pair exempt) with no special mode.
2. **Tremolo span credit** — consecutive same-pitch `tr` notes collapse to ONE judged span (host convention); hit = in-tune presence over ~60% of span frames; member gems light together (the UX "ribbon"); denominated as units ("2 tremolo runs rang in tune"), listed with judged rows, never exemptions.
3. **Gallop/cell anchor judging** — judge the cell's anchor 8th (and djent's chord stabs via the verifier); the muted pair is shown-not-judged; proof language claims the anchor, never per-16th articulation. Requires sustained input presence across the bar (no coasting).
4. **Disclosure UX** (virtuoso-ux ruling): resting-strip pre-run denominator line ("Judging 20 of 24 notes…"), a dwell-gated strip chip during play (`CHORD · not mic-judged`), modal classes stay the durable record. Plus the **timing-tendency line** ("Timing leaned late — about 30ms behind the click") and near-miss aggregate, threshold-gated — the feel→data converter.
5. **Legato (`ho`/`po`) exemption** — generalize herta's physics globally (no pick transient ≠ no skill; judge the picked frame).
6. **Bass `speakBudget(f0)`** — f0-derived post-roll extension `clamp(3·period+25, 35, 80)ms`, shifting (never widening) windows for low-register physics.

**Probes before Slice 2 constants:** palm-mute through the verifier comb (PM damps the partials it sums — unprobed); verifier min-ring (if ≤50ms, 200 BPM 16ths become honestly judgeable); low-bass WAV through the verifier (it matches the comb, not the fundamental — may have no 70Hz floor at all, which would dissolve part of the sub-floor exemption).

## Slice 3 — calibration BUILT 2026-06-06 (session #13); the rest stays logged

**Built:** `ptCalibrateOffsetMs` — a faithful mirror of the host's `_ndCalibrateOffsetMs` (note_detect screen.js:708; same objective: sweep ±250ms @ 10ms over offset-free detections, maximize matched notes with octave-tolerant ±50¢, refine by mean residual, ≥12 matches or null). Virtuoso logs `{bt: raw practice time, m: float MIDI}` per confident frame (bounded 6000); at sessionEnd the sweep's estimate (−offset = +latency) EMA-blends (0.7/0.3) into the **hidden anchor** `virtuoso.latencyMs` (clamp 0–250ms, **±8ms dead-band** so noise — and a small consistent player-lean — is never absorbed into the anchor; the timing-tendency line stays honest). `ptLatency()` now anchors every judge-clock site (8 sites; `PT_DETECT_LATENCY` remains the default). No UI; disclosed in the verbose Ear row + Copy diagnostics ("latency anchor Nms · this run measured Nms over N notes"). **No host seed:** `av_offset_ms` lives in note_detect's plugin settings store (not readable cross-plugin) — the sweep self-corrects from the 80ms default within a few runs; nothing host-side is ever written. Guards: smoke-gems row 8 (recovers a known 120ms offset; sparse→null; octave-tolerant; clamp held live).

Still logged, not built:
- **Host asks to carry** (with the standing ≈28Hz `minHz` ask): expose onset/re-strike events from the existing Desktop `detectNotes` path (unlocks per-attack gallop/tremolo credit — the flip for cell judging); a 4th #254 gem value (`exempt` → hollow gem); rest-verification (energy in a forbidden window) for djent kick-lock silence.
- **Metal tight-rung profiles** (±30ms-class windows on named rungs) — calibration is now BUILT but gate on it being **dogfood-validated on real hardware** before tightening; uncalibrated tightening punishes interface latency, not hands.
- **Phrase-aggregate shred credit** (beyond-physics runs judged as a phrase) — separate design round with learning-design + gamification.
- New false-credit channel logged (bass finding): a ringing sub-floor string's 2nd harmonic credits its octave target (open-E1 ring credits judged E2). Bounded; revisit with the octave-tolerant comparator.

## Addendum — the FEEL panel (2026-06-06/07, nine lanes) + the build

Christian's post-Slice-3 dogfood: "scoring still feels a bit too strict, and it's not visually clear when I hit a note." Nine-lane round (the original seven minus rhythm-meter/metal, plus gamification, learning-design, sound-design, market-analyst). Per-lane rulings in agent memories. The market lane's thesis bound it: **the two complaints are one** — invisible successes make a fair judge feel arbitrary.

**The source finding (audio-engine):** YIN confidence is BIMODAL — a fresh detection is always > 0.85 by construction (CMND < 0.15); every frame ≤ 0.85 is a stale fade re-emitting the previous pitch. And the HOST commits a hit on ONE clean frame — no pair rule exists in any host path; the SDK's "lock-on sweep" was the old 40ms EMA gliding, which died with smoothingMs 12. Our evidence pair was stricter than anything we were mirroring.

**Built (Christian's deck: single-frame · gained-only counter · full scope):**
- **Single-frame commit** at conf > `PT_CONF_FRESH` 0.85 (fades never score; 0.55 stays input-presence/display only). The pair deleted. Arbiter: the real-audio wrong-key negative control stayed green; `fired=1` proven in-suite.
- **Hit paint on every surface** (UX spec): Tab = inverted-ink chip ("the ink commits") / miss = dim digit; Notation = snug ink ring (never fill) / miss = faded head+stem; 2D fallback = bright outline / dim + host-miss-red rim; strip = near-white ring on the live dot, **no miss paint ever** (honesty surface). Paint on credit, never optimistic; exempt notes stay plain; all surfaces read the same `ptGetNoteState` the highway gems do.
- **Jam gate:** `ptGetNoteState` returns null on Jam runs — the mirror never judges, on any surface including the borrowed highway's gems.
- **Gained-only live tally:** "Hit 12" in meter green; the `12/15 (N%)` traffic-light (red < 60% mid-run — three lanes independently named it THE strictness experience) deleted; denominators live pre-run + post-run.
- **Under-mirrors fixed:** chord groups get the host's ±150ms clean window (chordTimingHitThreshold); written-staccato tooFast now classifies on the STABLE span (ring − speakBudget — the bass coin-flip band moves to honest exemption); floors re-derived for single-frame certifiability (YIN 85→45ms; verifier 50ms unchanged).
- **`PT_MIN_JUDGED` = 8** into runIsClean + advancePathwayTier (sparse evidence = lenient self-confirm advance, disclosed in the modal: "too few to grade; cleared on completion").

**Refused (constitution holds):** any cents-gate widening (incl. for vibrato — the +150¢ ask contains the adjacent fret); in-run near-miss/timing-quality paint (post-run only); streaks/combos/multipliers; audio hit feedback (sound-design veto — masks the articulation the player must learn to hear); optimistic pre-credit paint; live %/grade colors.

**Queued from the panel:** gamification's clean-bar ruler stamp; guitar-ped's vibrato evidence case (largely dissolved by single-frame — re-check in dogfood); bass verifier sub-floor un-dissolve (gated on an E2-vs-E1 octave negative probe).

**Highway judgment-event borrow — BUILT 2026-06-07 (after a 3-lane reconciliation; rulings amended in gamification/UX/host-expert memories).** The verdict: **host-first governs the borrowed canvas** — "the boundary is the canvas edge"; gamification's quiet-miss law applies to surfaces we author, and a borrow that suppresses the host's default-ON feedback is a fork, not a borrow. Built: `ptDispatchJudgment` emits `notedetect:hit` (on credit, label-free) and `notedetect:miss` (at window expiry in `ptWinSeek` — now advanced from the tick, detector-independent) with `{note:{s,f}, noteTime}`; the host highway renders its native marks + sliding "↑ +Nms"/"♯ +N¢" labels. Binding conditions held: **dispatch = truth** (judged outcomes only; exempt notes never in the table; misses gated on `_ptHadInput`; never in Jam); **labels carry only WITNESSED diagnostics** (an in-window wrong-pitch fresh frame → SHARP/FLAT ±¢, capped <950¢ so octave-flip artifacts never read as "you played sharp"; an in-pitch near-window frame → EARLY/LATE ±ms; nothing witnessed → mark-only); **label fields gated by the host's own `showTimingErrors`/`showPitchErrors`** (read-only from `slopsmith_notedetect`, absent = true — inherit-never-write); labels never replicate onto our four surfaces; the post-run tendency line stays the canonical diagnosis (same offset source + sign vocabulary). Guard: smoke-gems row 9 (hit shape, witnessed SHARP label, mark-only for unplayed).

## Decision log

- 2026-06-06 (Christian): **Slice 1 now**, Slice 2 to spec; release callout **folds into the held v0.7.4 notes** ("scoring got fairer, not easier — your % may jump", now covering the chord-exemption lift + this).
- Window-model fork (rhythm-meter's exclusive midpoint-split vs the host's parallel windows) resolved by Part-1 rule 1 (host-first): **parallel windows + pitch disambiguation**, midpoint clamps only for same-pitch neighbors and the verifier's one-target owner.
- Pitch tolerance and gem semantics: unchanged on principle (see Slice 1 "deliberately NOT loosened").
