# Virtuoso Progression & XP Infrastructure — developer handover

*2026-06-12. A self-contained tour of every progression/XP system in the plugin: the stores, the credit paths (the only code allowed to write them), the verdict engines, the read surfaces, and the invariants that must hold. Function names refer to `screen.js` (grep the name or the §-banners; see `docs/code-map.md`). Accurate as of v0.7.23-dev.*

## 0 · The design frame (read this first — it explains every odd-looking rule)

Virtuoso is a practice/learning tool. The whole layer follows one principle: **gamification describes mastery, it never substitutes for it and never gates content.** Concretely:

- **Gained-only, upward-only.** Every stored artifact is a one-way ratchet (a tier flips up, a PB rises, a badge sets once). Nothing is ever shown as lost; there is no decay, no reset, no spendable currency.
- **Soft gating only.** Progress state styles the UI (node states, glow) but never locks an exercise. Prerequisites are suggestions.
- **Competency, not activity.** Credit names skills (a rung cleared, a key carried, a pocket held), never rounds/time/attendance. Reps are recorded but advance nothing (a "silent stat").
- **The XP mode switch is real.** `virtuoso.progress.mode ∈ off | casual | hardcore`. **Off collapses the entire layer** — no XP, no depth rungs, no badges, no emits (the standing proof it never gates). `progressSetMode()` writes it; `virtuoso.xpMode` stores the settings-panel default.
- **No dark patterns.** No leaderboard, no rank, no combo, no RNG rewards, no countdown pressure. Streaks are deliberately forgiving. Jam mode is a *mirror, never a judge* (no scoring surface at all).

## 1 · The stores (all `localStorage`, all shell-side — the generation core never touches them)

| Key | Shape | What it is |
|---|---|---|
| `virtuoso.pathway_tiers` | `{ [pathwayId]: { highest_tier, bestBpm?, feltBpm? } }` | **The competency ledger** — the Speed axis (`highest_tier` = highest tempo tier cleared, indexes `TIER_LABELS = ['Slow','Med','Fast','Push']`), the guitar clean-tempo PB (`bestBpm`), and the bass pocket PB (`feltBpm` = highest tempo held *Locked*). |
| `virtuoso.progress` | `{ mode, xp, byNode: { [id]: { reps, depth:{ travel, clean, eyesOff }, masteredAt, keysCleared[] } }, badges: { [id]: ts } }` | **The depth/XP store** (`PROGRESS_KEY`). `xp` is a derived number (see §4). `depth.*` are one-time timestamp flips; `eyesOff` is reserved/unused. `keysCleared` backs the Travel axis. |
| `virtuoso.sessions` | array, newest first | **The session log** — every run ≥2s (`sessionBegin`/`sessionEnd`): mode, pathway_id, bpm/bpm_tier, scale, key (+ `key_credit`/`tuning_offset` — see Travel below), hit/miss counts, duration. Feeds the woodshed log, streaks, recognizers. |
| `virtuoso.spec_best` | `{ [specKey]: { best, runs } }` | The "Best here" standing-target line (per exact exercise spec). |
| `virtuoso.proofloop` | flag | The proof-loop pilot gate (`proofPilot()` — pilot pathways only). |
| `virtuoso.xpMode` | string | Settings default for the mode switch. |

Both presets and tunings live server-side in the FeedBack meta-DB; **everything above is client-local**. There is no server sync of progress today.

## 2 · The credit front doors (the ONLY writers of the ledger)

All tier writes funnel through **`_updatePathwayTier(pathwayId, tier)`** — idempotent (flips only an uncleared tier), **MERGE-writes** (never drops sibling fields like `bestBpm`/`feltBpm`), and emits `virtuoso:tier:unlocked` to the host. Four callers:

1. **`advancePathwayTier(session)`** — the solo run path (called from `sessionEnd`). Gate: ≥65% of judged units hit, with a **lenient self-confirm** when evidence is sparse (`PT_MIN_JUDGED = 8` — below 8 judged units, or mic-less, the player self-confirms; the results modal discloses it). Pathway mode credits its own rung at `bpm_tier`; Custom mode fuzzy-matches any rung within ±5 BPM (a "passive flip" — recorded, but capped out of the modal's hero slot). Proof-loop pilot rungs additionally require `proofHeld` (the settling-tax: the run must *hold* the standard, not luck into it).
2. **`creditBlockTier(templateId, bpm, score)`** — the Workout per-block path. Deliberately **stricter** than solo: needs an authored `creditsPathway` tag on the source template, a credit-eligible role (`technique|scale_arp|application|review`, kinds `chromatic|modal_vamp` excluded), and **strict evidence** (≥8 judged AND ≥65% in the block's own window — NO lenient path per-block; this is the anti-inflation spine). No per-block XP. A startup guard (`assertCreditTagsValid`) throws on a mis-authored tag.
3. **`creditFeltRung(pwId, bpm, feltVerdict)`** — the bass FELT path (rungs flagged `feltGate:true`; see §3). **Settling-or-better flips the tier** (mirrors guitar's "clean enough" 65% bar); **Locked additionally raises `feltBpm`**. No lenient path — a flip needs real above-floor onsets, so a silent/sub-floor run stays "practiced." Workout blocks whose template credits a feltGate rung route here via `blockFeltInfo` (the block's own timing slice) instead of the %-gate.
4. **`advanceDepthLadder(session)`** — XP + the depth axes (§4/§5).

**Badges** are persisted by `creditBadges()` (gained-only diff, called last in `sessionEnd` so the run's flips are reflected). **Null in Off mode.**

## 3 · The bass felt-hold verdict engine (`feltHoldAnalyze`)

Bass feel rungs complete on a *pocket verdict*, never a % (per-note early/late feedback trains click-chasing — hard-vetoed). Input: `_ptDevs` — per-credited-note onset deviations `{ d, t, sb }` (d = seconds late(+)/early(−), latency-anchored; `sb` = the register-dependent speak-budget excess, subtracted before analysis so a low string's late-speaking evidence doesn't read as the player dragging). Pure function, exposed on `window.Virtuoso`.

Three numbers over the longest continuous credited span (chain breaks on a >2-bar gap): **leanMs** (median placement), **driftMs** (Theil-Sen slope × span = tempo trend), **jitterMs** (MAD×1.4826 of detrended residuals = tightness). Evidence gates: ≥12 onsets AND ≥4 continuous bars, else verdict `null` (never a directional label on thin evidence). Bucketing order — drift → lean → tightness:

| Verdict | Rule (v1 constants in `FELT`) |
|---|---|
| dragging / rushing | \|drift\| ≥ 35ms net (sign decides), else lean ≥ +28ms / ≤ −18ms (asymmetric — slightly-behind IS the pocket) |
| **locked** | jitter ≤ 25ms (raises `feltBpm`) |
| settling | jitter ≤ 45ms (flips the rung) |
| null + untight | looser — "keep working it", no shame, no flip |

The honest floor: detection cadence ~40ms quantizes at ~11–12ms — never claim tighter than ~15ms. Sub-floor runs (low-B/E1 territory, < D2 ≈ 73Hz) can't muster evidence → "couldn't catch the low strings — go by feel," never a fabricated verdict. **Which rungs are feltGate'd is a curated per-rung tag** (7 today: walking ×4, octave/root-5-octave, slap), never per-instrument; the trap to avoid: tagging an all-sub-floor rung makes it permanently unclearable (no lenient path).

## 4 · XP and levels

**XP is derived, never spent, never gates**: `advanceDepthLadder` accrues `seconds-practiced × xpDifficultyMult` per run (mult = `1 + bpm_tier × 0.25`, floor 1.0 — easy play still earns; a maxed exercise keeps earning *for playing*). Paused wall-time is excluded upstream.

**Levels** (`xpLevelInfo`, the `WOODSHED_LEVELS` table) are a legible readout of accumulated XP — 10 named tiers from *First Steps* (0) to *Lifer* (300k). Deliberately understated: home is the P-sheet/woodshed, and a level-up appears in the run-end modal only as a quiet delta. The terminal level shows a **graduation line + lifetime-ledger pointer** instead of going silent (the "Lifer cliff" fix). Decided and locked: finite cap, **no prestige/reset** (our XP ≈ real hours — a reset would lie), forever-progression = the uncapped lifetime ledger (hours, PRs, badges), not infinite levels.

## 5 · The Depth Ladder (the mastery axes above the Speed climb)

Per-node, in `progress.byNode`, all one-time false→true flips, all requiring the Speed axis already cleared + a clean top-tier (Push) run:

- **Travel** — a clean Push pass in a not-yet-credited key appends to `keysCleared`; the rung flips on the **2nd distinct key** (portability proven; never a keys-N/12 grind bar). Credits the **nominal** key (`session.key_credit`) so a retune-and-replay of identical fingering can't double-credit.
- **Clean** — a supports-off proving run (fingering hand-marks OFF for the whole run, clean at Push).
- **eyesOff** — reserved in the schema, not yet creditable.
- `reps` increments every run — a silent stat, advances nothing.

## 6 · Read surfaces (pure views — none of these write)

- **`nodeProgressState(id)`** — the per-rung state the Ladder picker renders (tier glow, depth pips).
- **Run-end results modal** — verdict-led, one hero (felt > proof > tier-flip > travel); recognizers are *deterministic* new-bests on stored artifacts (first-clear > fastest-clean; zero RNG); Workout runs show the chapter recap (per-block ✓/●/○, never red, never a session-wide %); felt runs show the verdict word, never a %.
- **`woodshedLog()`** — the practice-history view (sessions → days/streak/grooves-owned readouts), incl. "Grooves owned — held Locked to N BPM" from `feltBpm`.
- **`streakCount(sessions)`** — forgiving streak (designed not to punish a missed day harshly).
- **Share cards** (`shareCardModel/Text`, `renderShareCardImage` 1200×630) — every run gets a card, but it's an honest mirror: earned runs lead with ✓, ordinary runs are a descriptive log; no %/rank/leaderboard ever (the anti-inflation gate moved from the button to the content).
- **Badges** — 7 (`BADGES`): On the Board, Up to Speed, It Travels, Clean Hands, Broad Strokes, Well-Traveled, In the Pocket. `badgeContext()` reads ONLY the artifact stores, so the set is a pure function of competency — no rep/time/streak inputs, nothing farmable.

## 7 · Host integration seam

Outbound only, fire-and-forget, the store never depends on it: `window.slopsmith.emit('virtuoso:tier:unlocked', {pathway, tier, label})` on a flip, and `emitProgress(kind, nodeId, extra)` → `'virtuoso:progress'` events (`kind ∈ xp | depth | felt`). No host XP intake exists yet; these define the shape for when it does. Registration as a FeedBack *minigame* was considered and declined (Virtuoso is a practice studio, not a score-chaser — see the 2026-06-03 decision in `ROADMAP.md`).

## 8 · Invariants (the checklist any change must hold)

1. Every ledger write goes through a front door in §2 — no new writers.
2. Gained-only / upward-only / merge-writes (never drop `bestBpm`/`feltBpm`).
3. Off mode collapses everything (XP, depth, badges, emits all null).
4. The lenient self-confirm exists ONLY on the solo path — never per-block, never felt.
5. Minimum-denominator rule: no claim is issued off < 8 judged units.
6. Bass feel: never a per-note early/late flash, never a % on a groove, never a fabricated verdict below the evidence gates.
7. No leaderboard / rank / combo / RNG / loss-framing anywhere.
8. Jam writes nothing and shows no judged surface.

**Test coverage:** `smoke-progress.mjs` (49 rows — XP accrual, Travel double-credit rejection, Off-mode collapse, the felt analyzer verdict matrix, the feltGate tag-pass drift guards, per-block felt slicing, share-card honesty rules) + `smoke-variation`/`smoke-session-sync` for the Workout side. Public test surface: `window.Virtuoso.{progressLoad, progressSetMode, advanceDepthLadder, nodeProgressState, woodshedLog, streakCount, creditBlockTier, creditFeltRung, feltHoldAnalyze, xpLevelInfo, computeBadges, creditBadges, shareCardText, isShareworthy}`.
