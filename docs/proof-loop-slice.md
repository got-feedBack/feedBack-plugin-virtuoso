# Proof-Loop Slice — Spec (build-ready, 2026-06-03)

> Virtuoso's #1 priority (five independent market convergences). ONE build, behind a flag,
> on ONE pilot ladder, doing **triple duty**: (1) a per-rung **clean-pass verdict**, (2) the
> only honest **retention signal** at homebrew/tiny-N scale, (3) a copy-able **shareable card**
> for the Discord community. Designed by gamification-architect (chair) + learning-design.
> **Status: BUILT + VERIFIED (2026-06-03).** Flag `localStorage['virtuoso.proofloop']='on'`
> (default OFF → zero behavior change), pilot `PROOF_PILOTS={blues_foundation}`. Verified by
> `probe-proofloop.mjs` (negative: a short fluke run does NOT clear the settling-tax; positive:
> a held run clears the tier + the "✓ You proved" card renders + Copy writes the plaintext share
> card — 7/7 PASS) and the full 10-suite `npm test` green with the flag off (no regression).
> The Guide-Tones Connect-measured verdict (the fast-follow) is also BUILT + VERIFIED — see §7. The infra was ~70% there.

## What already exists (do NOT rebuild)
`virtuoso.progress` (the Depth-Ladder XP store — gained-only, localStorage, *shell* not core) ·
per-pathway `tempoTiers` + `nodeProgressState` · `runIsClean(session)` · `advanceDepthLadder` /
`advancePathwayTier` · the session-end **Last-session card** (`sessionSummaryCardHtml` ~8717,
`presentSessionSummary` ~8753 — already gained-only, no score). The "this slice has no
clean-gate/verdict" comment (~8122) is **partly stale** — the gate is mostly here; what's
missing is the *settling-tax guard*, the *competency framing*, and the *card*.

## 1. The verdict mechanic (v1) — completion-at-tempo + settling-tax
**Source decision: completion-at-tempo, gated by the settling-tax window, with mic (Minigames
pitch tracker) as a silent tightener only when present — NEVER mic-primary.** A false "fail"
from unreliable homebrew mic input is the worst possible dark pattern (telling an honest player
they didn't do what they did). Pure self-attest (👍/👎 modal) is rejected for v1 (interrupts
flow + inflates trivially).

A pilot rung **clears** at session end when ALL hold:
- `bpm_tier === targetTier` — played **at** the tier BPM (not below), AND
- **`durationCleared`** — ran ≥ `max(20s, 0.85 × bundle.duration)` (survived past the first
  phrase; kills the 22-second fluke on a 90s run), AND
- `runIsClean(session)` — **already exists** (≥65% hits when mic present, lenient-true when absent).

**The one new gate:** add the `durationCleared` guard to `advancePathwayTier` (today it can flip
on *reaching* the tier BPM regardless of how long you stayed). That guard **is** the missing
clean-gate. learning-design's honesty bar: the verdict should read the **last sustained correct
portion** (hold the standard, don't touch it once); tier-aware (clearing Push implies the lower
tiers). v1 completion-at-tempo approximates this; the richer per-note *musical* verdict (esp.
guide-tone landing) is the fast-follow (§7).

## 2. The "What you proved" readout — extend the Last-session card
Reframe `sessionSummaryCardHtml`'s lead from descriptive → **competency claim**, populated *only
when something flipped*:
- Tier cleared → `✓ You proved: [Blues] holds together at [Push] tempo` (named in the player's
  vocabulary, tier-tagged).
- Travel/key → keep the existing "new ground" line.
- **Nothing flipped → no "you proved" line at all** — the card stays the calm mirror it is today
  (time + tempo). *This is the anti-inflation spine: a claim only when a claim is earned.*

learning-design — REPORT: competency name + position/key + tier-of-clean ("Owns **triad
inversions** (E-shape, one position) — clean at **Medium**"). **Do NOT report:** numeric score/%,
time-spent-as-achievement, streaks, XP-total-as-headline. Plus **one transfer line** (north-star
nod, framed as *use it* not *grind more*): "You own the ♭7→3 — next time you jam over a ii–V, try
*hearing* it land before you play it."

## 3. The shareable card — plaintext, opt-in
`proofCardText(s)` → plaintext, rendered only on a real flip. A **"Copy"** button
(`data-act="copy-proof"` → `navigator.clipboard.writeText`), opt-in (you click it), silent (no
toast sound). Format:
```
Virtuoso — Blues Foundation
✓ Holds at Push tempo (132 BPM)
✓ Travels — A, E, G
Practiced 6:42 · Day 4
```
No score, no rank, no link-bait — just the earned competency flips + time.

## 4. Flag + scope
`localStorage['virtuoso.proofloop']` (default **off**), gated by `PROOF_PILOTS = new Set([<pilot>])`.
When off OR pathway not in the set: the `durationCleared` guard is skipped (old behavior), no
"you proved" line, no Copy button — **zero effect on every other ladder.**

## 5. The loop / guardrails
The beat: you push to tempo, *stay in it*, the card says **"you proved X holds at speed"** — a
competency claim you earned, copyable to show the Discord. **Guardrails (hard):** gained-only;
**never** a fail verdict; the settling-tax is a floor, not a score; Copy is silent; a flip can't
un-flip; no streak-nags. Competency, not a game.

## 6. The pilot — Blues first, Guide-Tones fast-follow
The two lanes split: gamification → **Blues Foundation** (full `tempoTiers`, mic-optional, *the
dogfood favorite Christian plays daily* — critical for the research-instrument role; the simplest
verdict; honest "holds at tempo" framing). learning-design → **Guide-Tones** (the sharpest, hardest
-to-fake competency claim — "voice-led the ♭7→3 through the change" — and the Connect engine +
`smoke-connect.mjs` *already measure it*: 0 root-restarts, bounded seam leaps).
**Synthesis: ship Blues for v1** (dogfood favorite + simplest), then **Guide-Tones as the second
pilot** where the verdict wires the existing Connect guide-tone-landing measurement into a *real
musical* verdict (the deepest, most-transferable claim in the set).

## 7. Build plan
- **S** — `durationCleared` settling-tax guard in `advancePathwayTier` + `PROOF_PILOTS`/flag. **The
  verdict; highest value on its own.** Update the stale ~8122 comment.
- **S** — the "you proved" + transfer line in `sessionSummaryCardHtml`.
- **M** — `proofCardText` + the Copy affordance + a delegated handler (~12202).
- **Fast-follow (M)** — Guide-Tones pilot: wire the Connect guide-tone-landing measurement into the
  live verdict for a real musical clean-gate. ✅ **BUILT + VERIFIED (2026-06-03).** Pilot =
  `vl_connect` ("Connect the Changes", the Connect-engine rung of the Guide Tones / Voice-Leading
  concept ladder). `PROOF_PILOTS` is now a Map of `id → kind` (`blues_foundation:'tempo'`,
  `vl_connect:'guide_tones'`). A pure `measureGuideToneLandings(chart, cfg)` reads the shared
  `chart.timeline` (per-bar `rootPc` + `gpcs` guide-tone pitch classes) and the foreground first-note
  per bar — exactly `smoke-connect`'s landing measure — and is computed once in `makeBundle` as
  `bundle.proofMeta` (connect chord-scale charts only). At `sessionEnd` the guide-tones claim is
  emitted **only** when the line measurably voice-led (`ratio ≥ 0.75`, the smoke-connect "most
  changes land on a guide tone" bar — the cycle-seam root-restarts on a tiled/looped run are
  unavoidable and already count against the ratio, so we gate on the ratio, **not** 0 restarts); if
  it didn't (config drift) it falls back to the honest `tempo` claim. The card/`proofCardText` branch
  on `proof.kind`: *"✓ You proved: Connect the Changes — you connected the changes at Push tempo /
  Your line voice-led to the guide tones (3rd & 7th) through the ii–V–I."* Verified by
  `probe-proofloop-guidetones.mjs` (7/7 — held run clears, guide-tone card + sub-line, Copy writes
  the voice-leading share card), the unchanged blues `probe-proofloop.mjs` (7/7), and the full
  10-suite `npm test` (incl. `smoke-connect`) green with the flag off. **Open for review:** harmony +
  learning-design should sign off on the claim wording + the 0.75 landing bar before it's "done".

Files: `screen.js` — `advancePathwayTier` (~11154 path), `sessionSummaryCardHtml` (8717),
`presentSessionSummary` (8753), the handler block (~12202), the stale comment (8122). *(Line
numbers are gamification-architect's read — confirm at build.)* Card visuals → ux when polished.

## The triple duty (why this one build is the whole answer)
The **same flip-data** serves all three: it gates the rung (**verdict**), it *is* the only
retention/learning signal obtainable at N≈5–20 (**research instrument**), and it prints the
**shareable card** that is the Discord-community hook. Build once, get all three.
