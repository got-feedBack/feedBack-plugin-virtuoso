# Progression & Leveling — detail companion

*2026-06-12. The deep-dive companion to `docs/progression-xp-infrastructure.md` (read that first — it has the stores, the credit front doors, the felt engine, and the invariants). This doc goes mechanism-by-mechanism through everything the overview compresses: the tier ladder, the full leveling math, PBs/recognizers, the proof loop, the summit invite, node states, streaks, the woodshed surfaces, Workout-side progression, and what's designed-but-not-built. Function names refer to `screen.js`. Accurate as of v0.7.23-dev.*

## 1 · The tempo-tier ladder (the Speed axis, rung by rung)

Every pathway carries `tempoTiers` — usually 4 ascending BPMs labelled `TIER_LABELS = ['Slow','Med','Fast','Push']`, rendered as "Rung 1…4" buttons (`syncTempoTierButtons`) with cleared/active/glow states (`tier-glow` marks the just-unlocked rung once, then clears).

**A tier is more than a BPM.** Since the beginner-entry fixes, a rung may declare parallel **density ladders**: `tempoTierSubdivs[]` (e.g. `['quarter','eighth','eighth','eighth']`) and `tempoTierBars[]` (short bars at the cold bottom). Every tier-entry path — pathway apply, the rung buttons, the results-modal ladder CTAs — realizes a tier through ONE helper, **`applyTierFields(pw, idx)`** (bpm + subdivision + bars together, so the form never half-applies a tier). When subdivision varies, the tier chip shows a note-value glyph (`tierChipLabel`: ♩/♪/♬ + BPM) because a bare BPM would lie about difficulty.

**Startup guards** (`assert…` at load, throw on violation): tiers strictly increasing; `tempoTierSubdivs`/`Bars` lengths must match `tempoTiers`; a beginner-band rung's tier-0 must respect the **≤2.4 notes/sec density floor**. A mis-authored ladder can't ship.

## 2 · The leveling system in full

**Accrual** (`advanceDepthLadder`): every run ≥2s earns `round(practiced-seconds × xpDifficultyMult)`. The multiplier is `1 + bpm_tier × 0.25` → Slow 1.0, Med 1.25, Fast 1.5, **Push 1.75** — floor 1.0, so easy play always earns, and a fully-maxed exercise keeps earning *for playing* (time base). Paused wall-time is excluded upstream (`sessionPausedMs`). Worked example: a 10-minute run at the Fast tier = 600 × 1.5 = **900 XP**. XP accrues for ANY run (pathway or not); only the depth rungs need a known pathway. **Off mode: nothing accrues.**

**The ladder** (`WOODSHED_LEVELS`, consumed by `xpLevelInfo(xp)`). Hour figures assume a mid-tier mix (×1.25, i.e. ~75 XP/min):

| Lv | Name | XP at | ≈ practice time (cumulative) |
|---|---|---|---|
| 1 | First Steps | 0 | — |
| 2 | Picking It Up | 1,500 | ~20 min |
| 3 | Woodshedder | 5,000 | ~1.1 h |
| 4 | Regular | 12,000 | ~2.7 h |
| 5 | Journeyman | 25,000 | ~5.6 h |
| 6 | Roadworn | 45,000 | ~10 h |
| 7 | Seasoned | 75,000 | ~17 h |
| 8 | Veteran | 120,000 | ~27 h |
| 9 | Old Hand | 180,000 | ~40 h |
| 10 | Lifer | 300,000 | ~67 h (≈48–83 h across the mult range) |

`xpLevelInfo` returns `{ level, name, xp, at, nextName, nextAt, into, span }` — `into/span` drive a progress readout; `nextName: null` marks the terminal tier.

**Where levels show (deliberately understated):** the home is the **P-sheet woodshed section** ("Woodshed level · Lv N · Name" + a forward line "X XP of practice to {next}" — phrased as opportunity, never a grind bar). The run-end modal shows a level-up only as a **quiet ambient delta**, computed in `sessionEnd` by diffing `xpLevelInfo(prevXp)` vs `xpLevelInfo(newXp)`; the result carries `summit: !b.nextName`.

**The Lifer cliff (fixed, locked decision):** at the terminal level the old surface went silent at the most-committed player. Now: the P-sheet forward line becomes a **graduation** ("Lifer — top of the ladder. The hours keep counting; from here your tempo PBs, keys and badges are the climb."), and a summit level-up gets graduation copy in the modal. The ratified decisions behind this (gamification + market convergence, `project_xp_leveling_decision`): **keep the finite cap** (no infinite levels), **no prestige/reset** (our XP ≈ real hours — a reset would lie and train grind), and forever-progression = the **uncapped lifetime ledger** (hours, PBs, keys, badges — the fitness-app model), not the level number. Deferred polish (designed, unbuilt): naming the next tier in the level-up moment, a warmer level-up render, craft descriptors per level.

## 3 · PBs, recognizers, and the standing target

Three distinct "personal best" mechanisms, all gained-only:

- **`bestBpm`** (guitar denomination, on `pathway_tiers[id]`): written inline in `sessionEnd` when a pathway run is **clean by the strict bar** (≥8 *really judged* units AND ≥65% — the lenient self-confirm does NOT set PBs) and `bpm > prevBest`. Monotonic. Surfaces as the woodshed "**Your numbers** — clean tempo to beat" list (top 5, descending) and as the pull-back hint on the rung signpost.
- **Recognizers** (the run-end "variable reward", zero RNG — deterministic new-bests): precedence **`first_clear`** (this run created the pathway's ledger entry) **> `fastest`** (bestBpm rose and a previous best existed; carries `{bpm, prev}`); "new ground" (a Travel key) is the render-time fallback. **Never fired for felt rungs** — speed/accuracy is never the bass headline; `feltResult` carries bass recognition instead.
- **`specBest`** (`virtuoso.spec_best`): the best-% *at this exact spec* — keyed `pathwayId|bpm|key_credit` (or `mode:practice_type|bpm|key`), counted only when ≥8 judged. A **standing target fact** ("Best here: N%"), never gap arithmetic; render-side suppression: same-spec only, ≥3 runs, never on rough runs, hidden when today IS the best. Jam never touches it.

## 4 · The proof loop (flagged pilot)

Behind `localStorage['virtuoso.proofloop'] === 'on'`; pilots in `PROOF_PILOTS` (`blues_foundation` → kind `tempo`, `vl_connect` → kind `guide_tones`). Two effects:

1. **The settling-tax clean-gate** (`proofHeld`): a pilot rung's tier flip additionally requires the run to have *held* the standard — duration ≥ `max(20s, 85% of content length)`. Kills the 22-second-fluke clear on a long chart; ≥1 real pass on a short one.
2. **The "what you proved" card**: on a real flip only (anti-inflation — a claim exists only when something was proven). Kind `tempo` claims completion-at-tempo; kind `guide_tones` makes a **musical claim** only if `measureGuideToneLandings` verifies the chart actually voice-led (most changes landing on the next chord's 3rd/7th, ratio ≥ 0.75 — the same bar `smoke-connect` asserts); on config drift it falls back to the honest tempo claim rather than fabricate. Mic-OPTIONAL by design — the verdict is completion + settling-tax, never mic-primary.

## 5 · The depth slice & the summit invite (how a player moves along the depth axis)

The resolved axis order (4-agent panel, `project_depth_slice_switching`): **Speed → Patterns → Travel → Support-off → Master**, and switching is **student-driven, never automatic** (auto-cycling was explicitly rejected). The shipped atom: when the Speed climb summits, the climb signpost becomes a **summit invite** — a close-and-arm offer of the next axis (Patterns) instead of a dead-end "Summit reached."

`depthPatternOffer(pw)` encodes the honesty rules: only practice types that consume `cfg.sequence` (`scale`, `chord_scales`); only when Advanced mode is ON (otherwise `readConfig` strips the sequence — offering it would be a silent no-op); never when already patterned; and **7-note scales get "in 3rds" while pentatonic/blues get "in 4ths"** (a [0,2] skip is not a diatonic third on a 5-note scale — the relabel gate). Patterns reuse `SEQUENCE_PATTERNS`/`applySequencePattern`, which only reorder already-resolved positions (zero bad-note risk).

## 6 · Node states & the picker (how progress styles, never gates)

`nodeProgressState(id, ptData)` → `{ tierCount, highestTier, cleared (top tier reached), inProgress, prereq, prereqUnmet, depth: { travel, clean, eyesOff, mastered, keysCleared } | null }`. `depth` is null in Off mode; `eyesOff`/`mastered` are schema-present but unfilled (future slices). **`prereqUnmet` only styles** — a soft "Builds on …" hint from `SKILL_TREE_EDGES`; nothing is ever locked.

Visibility is a separate system: `visiblePackOrder()` (Core packs pinned first, then installed Style packs in the user's order — `virtuoso.packs`) × `isHiddenNode(id)` (instrument-awareness: bass rungs hide on guitar and vice versa; the intervals pack's per-instrument split rides this). Uninstalled packs live in the Pack-manager "+" modal, not the picker.

## 7 · Streaks & the calendar (the forgiving rules, exactly)

`streakCount(sessions)` over the session log's local-date strings: **grace until midnight** (no practice today doesn't break the streak until tomorrow — counted from yesterday); walking backward, **one rest day is frozen** (skipped, streak continues) but **two consecutive missed days end the run**. `last7Days` renders the 7-dot calendar strip (practiced/today markers). No loss framing anywhere — a broken streak just shows the new count.

## 8 · The woodshed surfaces (the P-sheet)

`woodshedLog()` (pure read) → `{ totalMin, weekMin, sessions, days, xp, numbers[], travels[], grooves[] }`:
- time on the instrument + this week + practice days (real-artifact aggregates, no quotas);
- **numbers** = the `bestBpm` PB list (guitar denomination);
- **travels** = keys-cleared counts per pathway (+ mastered flag, future);
- **grooves** = the `feltBpm` list — "**Grooves owned** — held in the pocket to N BPM" (bass denomination; tempo-you-HOLD, never peak).

`woodshedSectionHtml` renders it with the level row + forward/graduation line (§2); the whole section returns empty in Off mode. The locked future shape: this grows into the **lifetime ledger** surface (uncapped hours/PBs/keys/badges) — see §11.

## 9 · Workout-side progression (per-block)

- **Measurement**: `perBlockScore` buckets the judge's settled windows by segment → per-block `{hits, judged}`; `_blockHadInput[]` tracks real input per block.
- **The recap chapters** (run-end, multi-block only): per-block rows with the glyph ladder **✓ proved** (a real tier flip — the only meter-green) **> ● played** (reached + sounded, or mic-less) **> ○ touched** (reached but silent while the mic was live elsewhere) **> — unreached**. Never red; a Workout shows **no session-wide %** anywhere.
- **Credit**: `creditBlockTier` (strict, §2 of the overview doc) for %-gated rungs; `blockFeltInfo` → `creditFeltRung` for feltGate-crediting blocks (the block's own timing slice at the block's own `barSec`). The seam caption drops the block's felt word live (analysis-only; credit fires once at `sessionEnd`).
- **The inter-block break** doubles as the verdict beat (a tempo-locked count-in for the incoming block); the seam card shows "✓ {block} — done / {felt word}" + the NEXT ▸ breadcrumb, with silence honestly un-narrated.
- **No per-block XP** — XP is session-level, once per sitting (anti-farming).

## 10 · Session log schema + the difficulty-relief chip

Each `virtuoso.sessions` entry: `{ date, mode (pathway|custom|session), pathway_id, bpm, bpm_tier, scale, key, key_credit, tuning_offset, practice_type, duration_ms, hit_count, miss_count, jam, hand_marks_on, content_ms }`. The honesty fields: `key` is CONCERT (what sounded); **`key_credit`** is the rung's nominal key (what Travel credits — a retune + replay of identical fingering can't double-credit); `hand_marks_on` backs the Clean depth rung; `content_ms` backs the settling-tax.

**The mid-run downshift chip** (beginner-entry P2): on beginner rungs ONLY, a struggling first-4-bars run offers a quiet "Feeling fast?" step-down — silence-guarded (never fires on an idle mic), once per rung per session, and **suppresses the post-run step-down suggestion** (one voice, not two). It's relief, not judgment — it writes nothing to the ledger.

## 11 · Designed but NOT built (so the dev isn't surprised by the roadmap)

- **Programs** (Tier B, designed — `docs/programs-ladder-roundtable.md`): a `PROGRAMS` table of *pointers* (which rungs/Workout/Jam + completion predicates); progress is a **pure view over the existing ledger** (`nodeProgressState`), the only new state a tiny opt-in bookmark. 4 starters specced; every Program ends in a Jam capstone + offers a next Program. Four forks still open with Christian.
- **The lifetime ledger surface** — the uncapped forever-progression home (hours/PBs/keys/badges); the woodshed section is its seed.
- **Depth axes `eyesOff` + `masteredAt`** — schema-present, no credit slice yet.
- **The accumulating warmth/coverage map** (P-sheet artifact) + the **milestone-gated share-PNG join** — scorecard-hero deferrals, designed in agent memories.
- **Felt-hold live drift-bubble** (slow-EMA ahead/behind, ~1 Hz, never per-note) + hollow-exempt strip rendering — a sound-design pass.
- **The riff-vocabulary pilot's construction surface** (charette D13) — may touch the recap/credit shape if `call_response` needs a real construct mode.
