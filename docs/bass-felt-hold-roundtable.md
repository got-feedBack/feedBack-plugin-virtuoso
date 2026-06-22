# Bass Felt-Hold — synthesis spec (the "shore up foundations" build)

*2026-06-09. Main-thread synthesis of a three-lane design panel (bass-pedagogy · rhythm-meter · gamification), convened because L&D's Programs design flagged an engine gap: **bass groove/walking/application stages have no clearable ledger rung** — guitar flips on `bestBpm`/`highest_tier`, but bass feel can only ever log "practiced," so bass Programs (and the bass Core) can't *complete* anything. This is the bass analog of the guitar clean-tempo PB. Per-lane detail: `.claude/agent-memory/bass-pedagogy-expert/project_bass_felt_hold_thresholds.md`, `.claude/agent-memory/rhythm-meter-architect/project_bass_felt_hold_measurement.md`, `.claude/agent-memory/gamification-architect/project_tierc_ratify_and_bass_felt_pb.md`. This doc is the reconciled build spec + decision log.*

**Decision: BUILD.** v1 from the data we already collect (no new DSP); the low-string limitation is a documented host-ask, not a blocker.

## HOST CHECK

- **Capability:** bass felt-hold verdict (Locked / Settling / Dragging / Rushing) + the `feltBpm` ledger — derived from the onset-timing spread/trend the scorer already collects (no new DSP).
- **What the host has:** nothing found — the host's detector surface is pitch/level (note-detection primitives) only; there is no groove / pocket / feel / timing-spread analysis domain to borrow.
- **Evidence + date:** 2026-06-09, the 3-lane design panel (bass-pedagogy · rhythm-meter · gamification) + host-check; confirmed the host exposes no qualitative-feel analysis.
- **Verdict: BUILD** — greenfield, on our competency-typed store. "Held the tempo in the pocket" is not a host concept, and the qualitative bass-feel verdict is Virtuoso's USP, not host territory.
- **Flips if:** the host ships a groove/pocket/timing-spread analysis API (then borrow the analysis) or the §9 onset/transient channel lands (tightens sub-floor independence) — both tracked as host-asks.

> **HEADLINE FORK RESOLVED → Option A** (verdict WORD is the hero, tempo demoted). All three design lanes + the market-analyst (`.claude/agent-memory/market-analyst/bass-felt-hold-headline-verdict.md`, HIGH confidence) converged: bass BPM is a confound (rewards faster-and-sloppier), so `feltBpm` (the tempo held *Locked*) lives in the woodshed PB, never the run-end headline; "Locked the pocket" is a *state* (cooperative/shareable) not a *rank* (leaderboard-bait at tiny-N); and naming the pocket as a word is a real differentiator (no rival grades bass feel qualitatively). Copy note: "Settling" is the one soft word — kept for v1, flag for a Discord A/B ("on-your-way" vs "meh"); one-word fix = "Settling in".
>
> **AS-BUILT v1 (2026-06-09, committed, @ 0.7.16-dev):** data model `_ptDevs` → `{d,t}`; `feltHoldAnalyze` (Theil-Sen drift + MAD jitter + the gates/bucketing) + `creditFeltRung` (`feltBpm` ledger, `_updatePathwayTier` merge-fixed) on `window.Virtuoso`; `feltGate:true` on **bass_walking** (the pilot — fixes the rung that could never fire); `sessionEnd` routes feltGate runs through the felt verdict (and suppresses the %-recognizers/bestBpm for bass); surfaces = the modal felt-word hero (Option A, no %), the woodshed **"Grooves owned"** + **"In the Pocket"** badge, the verdict-led share card. 11 durable `smoke-progress` rows; net 16/16. **Deferred:** per-block felt-credit in a Workout (needs `_ptDevs` bucketed by segment — the engine handoff gamification flagged); the v1.1 speak-budget lean correction (D3); extending `feltGate` to the other bass feel rungs (a bass-ped pass, like the `creditsPathway` tag rollout); the live drift-bubble + hollow-exempt rendering (sound-design).

---

## 1 · The model (one paragraph)

A bassist's reward is **felt, not scored** — and the pitch scorer can't see groove (per-note early/late feedback induces the worst pocket habit). So the bass denomination is **hold-tempo-in-the-pocket**: did you *sustain* the pocket over a real span? It is measured as a single **felt verdict — Locked / Settling / Dragging / Rushing** — derived from the spread/trend of onset timing the scorer already records (`_ptDevs`), **never a %, never a per-note flash**. It mirrors guitar's two layers: a **rung FLIP** (the completion the engine gap needs) when you held the pocket *well enough* at the rung's tempo, and a **`feltBpm` PB** ("grooves you own" — the weeks-climb) when you held it **Locked**. Both are gained-only, upward-only, behind XP-Off, through the **same one ledger** as guitar.

---

## 2 · The measurement (rhythm-meter owns; all from the existing `_ptDevs`)

`_ptDevs` is pushed only on **credited** notes as `tJudge − onset`, latency-compensated. **Sign convention (authoritative — the code's): `+ = LATE = behind the beat`, `− = EARLY = ahead`.** (⚠ see Decision D1 — bass-ped's prose used the opposite sign; this spec uses the code's.)

Compute **three numbers**, not one:
- **`leanMs`** = median(d) — placement (behind/ahead).
- **`driftMs`** = Theil-Sen slope (median pairwise slope over **time**, ms/s) × spanSec — the cumulative tempo *trend* (sped up / slowed down across the span).
- **`jitterMs`** = MAD (×1.4826, centered on the median) of the residuals **after** removing the Theil-Sen line — tightness, independent of any steady lean or drift.

**Why three:** a player sliding +40→−40ms has `leanMs`≈0 (looks centered) and a big *raw* spread (looks loose) but is actually rushing — only the drift number catches it. MAD (not stdev) for outlier-robustness at bass's small n; `_ptDevs` is also naturally censored (out-of-window plays are misses, not samples).

**Anchor robustness (important):** `jitterMs` and `driftMs` are invariant to a constant offset, so a wrong latency anchor can't corrupt the Locked/Settling or drift-directional verdicts. Only the **steady-lean** (`leanMs`) path is anchor-sensitive → it is de-prioritized (checked last) and given generous thresholds.

**Gates (no verdict unless all hold):** `n ≥ FELT_MIN_N (12)` AND continuous in-band span `≥ FELT_MIN_BARS (4 bars / ~6–8 s)` AND **coverage sanity** (samples span a real slice of elapsed time, not one corner). Below the gates → `null` ("couldn't feel it yet — keep playing"), **never** a directional label. Continuous span breaks on a gap > ~2 bars; a loop wrap is fine, a stop/restart or a sub-floor dropout is a discontinuity.

**Bucketing order (drift → lean → tightness):**
1. gates fail → **NO VERDICT** (`null`).
2. `|driftMs| ≥ DRIFT_FAIL` → **Dragging** if `+` (slowed, ended behind) / **Rushing** if `−` (sped up, ended ahead).
3. else `leanMs ≥ LEAN_BEHIND` → **Dragging**; `leanMs ≤ LEAN_AHEAD` → **Rushing** (asymmetric — see §3).
4. else `jitterMs ≤ JITTER_LOCK` → **Locked**; else → **Settling**.

---

## 3 · The thresholds (bass-ped owns; ABSOLUTE ms, sign-translated to the code convention)

Bands are **absolute ms**, not %-of-IOI (bass timing is ms-discriminated; %-of-beat forgives slow tempos and over-tightens fast). Honest resolution floor ≈ 15 ms (the ~40 ms detector cadence quantizes at ~11–12 ms) — **never claim Locked tighter than ~15 ms**.

| Constant | v1 value | meaning |
|---|---|---|
| `JITTER_LOCK` | **25 ms** | jitter ≤ this (+ centered) = **Locked** |
| `JITTER_SETTLING` | **45 ms** | jitter ≤ this = **Settling**; above = untight ("not yet", **no flip**) |
| `LEAN_AHEAD` | **−18 ms** | leanMs at/below this (ahead) = **Rushing** (stricter — rushing the kick is the gig-killer) |
| `LEAN_BEHIND` | **+28 ms** | leanMs at/above this (behind) = **Dragging** |
| `DRIFT_FAIL` | **35 ms** net over the span | cumulative drift past this = drag/rush by sign |
| `FELT_MIN_N` | **12** onsets | below = no verdict |
| `FELT_MIN_BARS` | **4** continuous in-band | below = no verdict (a "real felt-hold" for the PB wants ~16 bars; see §4) |

**The Locked lean window is asymmetric and slightly-behind-friendly:** Locked allows `leanMs ∈ [−8 ms (ahead) … +20 ms (behind)]` — **a consistent slight-behind lean reads Locked, not Dragging** (that *is* the pocket). Rushing fires earlier (−18) than Dragging (+28) on purpose.

**Tempo measurement window:** 8th-note grooves ~60–140 BPM (the pocket zone 70–120); walking quarters measurable ~100–180 (wide IOIs). Above where written 16ths out-run detection (~95 BPM), measure the felt-hold on the **quarter/8th pulse**, not every sub-division.

All threshold values are **v1, dogfood-tunable** (named constants).

---

## 4 · Credit, persistence, surface (gamification owns)

**Two-tier (mirrors guitar's rung-clear vs `bestBpm`-PB):**
- **Rung FLIP** (the engine gap's fix): a sustained **Settling-or-better** verdict (i.e. *not* untight, *not* Dragging/Rushing) at/above the rung's target tempo flips `highest_tier` through the **same `_updatePathwayTier` ledger** guitar uses. (See Decision D2 — Settling, not Locked, flips, to mirror guitar's "clean *enough*" 65% bar and keep bass↔guitar parity fair.)
- **`feltBpm` PB** ("grooves you own", the weeks-climb): a sustained **Locked** verdict raises `feltBpm` — a gained-only, upward-only sibling field on `pathway_tiers[pwId]` = the highest tempo you've *held Locked* (the tempo you hold, not peak). The bass analog of `bestBpm`.

**Per-rung opt-in:** bass FEEL rungs (walking / groove / application-by-feel) carry an explicit **`feltGate: true`** flag — **per-rung, NOT per-instrument** (bass arpeggios stay on the normal %-hit gate). This is also the fix for **`b_app_walking`**, which today routes through the %-hit gate and can never fire below the mic floor.

**Anti-inflation (same spine as guitar):** the felt flip needs **real onsets above the floor** (≥ `FELT_MIN_N`, ≥ `FELT_MIN_BARS`); there is **no lenient mic-less self-confirm** path for felt — a sub-floor block can't muster the evidence, so it self-enforces "practiced only." Settling/Dragging/Rushing are a **descriptive mirror**, never a flip.

**Surface — the verdict WORD is the hero, never a number:**
- **Run-end modal:** on a flip → meter-green **"✓ Locked the pocket — cleared {tier}"** (the one place green is allowed); no flip → a calm/accent word (Settling/Dragging/Rushing), no shame. **Tempo is demoted to a secondary fact** (never speed-as-headline for bass).
- **Workout seam:** drops the felt word per block.
- **Woodshed P-sheet:** a **"Grooves owned"** section + **"Held in the pocket — up to {feltBpm} BPM."**
- **Badge:** one **"In the Pocket"** (the 7th badge, feltGate-earned — gamification's reserved bass badge from the Tier-C ratify).
- **Share card:** verdict-led for bass.
- **Live (deferred to a sound-design/render follow-up):** a slow-EMA ahead/behind **drift bubble** (~1 Hz, never per-note) + a strip-dot credit flash; exempt/sub-floor notes render **hollow** (silence ≠ miss).

**Guardrails (self-audit — all hold):** never a per-note early/late flash; never a %/score/combo on the groove; gained-only `feltBpm`; behind XP-Off (the verdict word still mirrors in Off, like the guitar %); sub-floor degrade → **"couldn't catch the low strings — go by feel,"** never "Dragging."

---

## 5 · Which stages qualify (bass-ped)

- **Walking / Lines & Changes — PRIME** (0% ungraded by construction, wide quarter IOIs = cleanest onset sample; already the graded showcase). Lead the build here.
- **Octave groove / Root-5-Octave / Slap & Pop — QUALIFY** (thinner sample; the octave-up partners + pops clear the floor).
- **Dead-note 16ths / all-sub-floor low grooves — DEGRADE** → credit **"played with the band"** (time over the drummer-spine), never a fabricated Locked/Dragging.

---

## 6 · Build plan (concrete; ~one focused slice)

1. **Data model — `_ptDevs` scalar → `{ d, t }`** at both push sites (the per-sample onset time is needed for gap-detection + trend-vs-*time*). **Retarget, don't cut:** the timing-tendency reader (`leanMs`/`leanN` in `sessionEnd`) now reads `.d`; the same vector feeds the bass verdict. (rhythm-meter's two data-model asks.)
2. **`feltHoldAnalyze(devs, { bpm, barSec })` → `{ verdict, leanMs, driftMs, jitterMs, n, spanBars }`** — a pure function (Theil-Sen slope, MAD×1.4826 detrended jitter, the gates, the bucketing, the §3 thresholds, sub-floor→null). Lives in the scorer section; expose on `window.Virtuoso` for headless tests.
3. **Per-block bucketing** — bucket `_ptDevs` by segment (parallel to `perBlockScore`; the dev push site already has `w.t`) so a Workout block gets its own felt verdict.
4. **Ledger — `feltBpm` sibling on `pathway_tiers[pwId]`** (gained-only, upward-only) + a `creditFeltRung(pwId, bpm, verdict)` front door: Settling-or-better at/above tempo → `_updatePathwayTier` flip (idempotent); Locked → also raise `feltBpm`. A startup guard validates `feltGate` rungs.
5. **`feltGate: true`** on the bass FEEL rungs (walking/groove/application-by-feel) incl. the `b_app_walking` fix; route feltGate rungs through `creditFeltRung` instead of the %-hit gate.
6. **`sessionEnd` wiring** — compute the whole-run verdict (solo) + per-block (Workout); stash on `_lastEndedSession`; fire `creditFeltRung` for feltGate rungs.
7. **Surfaces** — the modal verdict word + tempo-demote; the P-sheet "Grooves owned" + `feltBpm` readout; the "In the Pocket" badge; the verdict-led bass share card.
8. **Guards** — a `probe-felthold` (synthetic dev-vectors → each verdict + the gates + sub-floor null) and durable rows in **`smoke-progress`** (the ledger system owner): `feltBpm` gained-only/upward-only; a Settling-or-better feltGate run flips the rung; a Dragging/untight run does NOT; Off collapses it.

---

## 7 · Decision log (the reconciliations the main thread made)

- **D1 — Sign convention: the CODE's wins (`+ = late = behind`).** bass-ped's prose used `− = behind`; rhythm-meter + the actual `_ptDevs = tJudge − onset` use `+ = behind`. The spec's §3 thresholds are stated in the code convention. Anyone building must use `+ = behind / − = ahead`. *(This is exactly the trap bass-ped flagged — the late-bias + an inverted sign would brand every bassist a dragger.)*
- **D2 — Settling-or-better flips the rung; Locked raises the PB.** gamification proposed Locked-for-flip (conservative); bass-ped's two-tier flips on Settling-or-better. Adopted bass-ped's: it mirrors guitar (a rung clears on a "clean *enough*" ≥65% pass, not perfection; `bestBpm` is the separate weeks-climb), so the bass bar isn't *harder* than guitar (fair parity). The strict-evidence gate (≥12 onsets, ≥4 bars, above floor, no self-confirm) already prevents fabrication. **→ wants a quick gamification + bass-ped nod.**
- **D3 — Late-bias correction is v1.1, not v1.** Low strings speak late (`clamp(3·period+25, 35, 80)ms`), biasing `leanMs` late → a fake "Dragging." v1 leans on the **bias-invariant** spread/drift verdicts + a **generous `LEAN_BEHIND` (+28)**; v1.1 (dogfood-gated) subtracts the f0 speak-delay per low-note deviation before aggregating. No new DSP either way.

---

## 8 · Forks for Christian

1. **(the real one) The bass run-end HEADLINE.** **A (recommended):** the verdict **word is the hero**, tempo demoted to a secondary fact ("**Locked the pocket** · 96 BPM") — keeps faith with never-speed-as-headline-for-bass; the number lives in the woodshed PB. **B:** tempo + verdict **co-headline** (some bassists track the number). → see the question deck.
2. **(minor, my call unless you object) `feltBpm` location.** A sibling field on `pathway_tiers` (recommended — minimal, mirrors `bestBpm`) vs a richer `feltHold:{ bpm, verdict, at }` on `progress.byNode` (only if we later want a verdict-history surface).

---

## 9 · The host-ask (deferred, not blocking)

The honest long-term substrate for felt-hold is an **onset/transient channel** — floor-independent (a 31 Hz B0 has a clean attack transient even though YIN can't pitch it), which would let the **sub-floor low grooves stop degrading**. Both bass-ped and rhythm-meter flagged it. Route to `feedback-compatibility` as a host-ask; v1 ships on the gradable-register onsets we already get.

## 10 · Follow-up reviews (named, not spawned)

- **gamification + bass-ped:** ratify D2 (Settling-flips) + the "In the Pocket" badge criterion.
- **sound-design:** the live drift-bubble + hollow-exempt-note rendering (deferred surface).
- **rhythm-meter:** confirm the Theil-Sen + MAD constants once dogfood data exists.
