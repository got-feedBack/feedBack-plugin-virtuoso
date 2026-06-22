# Jam UX Redesign Round-table — declutter + on-the-fly feel

**8-lane design panel, 2026-06-14 (session #34).** Christian: *"GUI/usability issues with the
Jam page — (A) on-the-fly adjustments (instrument switch, volume, settings) sometimes don't
trigger / are too quiet / need a stop+restart or a re-hit before they register; how do we make
them feel better? (B) the Jam menu is cluttered as hell / overwhelming (users said so even
before the 29 genre chips). Redesign the Jam sidepane + improve the UI/UX."*

Panel (all reported): **virtuoso-ux-designer (chair)** · audio-engine · sound-design ·
devops-operability · feedback-compatibility · gamification · learning-design · market.
Per-lane detail in each `.claude/agent-memory/<agent>/`. This doc is the build spec + decision
log. Companion to `docs/jam-mode-roundtable.md` (the 2026-06-12 *feature* charette, D-J1..D-J11,
slices J-1..J-4 — J-1/J-2 shipped); this is the **UX/reliability second pass** on what shipped.

---

## 1. The unanimous diagnosis — both problems share ONE root

> **The Jam pane is FLAT.** It stacks ~9 co-equal control sections + a 29-chip wall in *setup
> order* with ▶ Jam at the **bottom**, and it treats three different things as identical:
> (a) *set-once config* vs *live-performance knobs*; (b) the *timing model* of a change (now /
> at-the-wrap / async); (c) *commodity* controls vs the *differentiating wedge*.

That flatness causes **both** symptoms. The overwhelm (B) is obvious. But it *also* causes the
"unreliable" feel (A): a set-once control that wrap-quantizes (Tempo) looks identical to a live
knob, so when it doesn't respond instantly it reads as *broken* (learning-design's key insight —
the clutter and the unreliability are the same root).

Underneath (A) there are also **real bugs**, verified in code (not just perception):

1. **The instrument switch is buried in the Mixer** (a different panel) with **no feedback** —
   the user can't see it register, so they stop/re-hit Jam. (chair, devops)
2. **An async race.** The Mixer `change` handler (`screen.js` ~23031–23060) is `async`: it
   `await awaitVoices()` (caps **2 s**) *before* rescheduling. For **sample-engine** voices
   (e-piano / Electric DI / strings / organ) it parks on the load; a second click spawns a
   second handler, the awaits resolve **out of order**, and an earlier pick wins — *the select
   says B, the audio plays A.* It's **intermittent** because **synth voices have nothing to
   await and apply instantly.** This is the "had to mess with settings before it registered."
   (devops, audio-engine)
3. **"Too quiet."** WebAudioFont `normalize:true` peak-normalizes **each preset independently**
   (matches peaks, not loudness) → a sustained organ reads far louder than a plucked guitar at
   the same peak; compounded by the genre's `harmony.level` (tuned for *that genre's* voice)
   staying applied to a **user-overridden** voice; and by the **oscillator fallback** sounding
   when the preset isn't decoded yet (thinner + not level-matched). (sound-design, audio-engine)
4. **"Abrupt."** The instrument handler does `stopAudio()` (hard-cut **all** nodes, chops
   ring-out) + a cold reschedule — no crossfade, while the fader/pan paths right next to it
   already ramp. (sound-design, audio-engine)
5. **Every live change is a full rebuild.** `jamPlay()` (~18659) begins `stopPlayback()` then
   `generate→attach→start`; the wrap handler (~14225) **also** calls full `jamPlay()`. The
   2026-06-12 roundtable's "glitch-free in-place mutation" was **never built** — so there's a
   real rebuild seam on every style/key change. (chair — load-bearing correction)

And the IA itself: **29 style chips (all 6 families rendered at once) + 7 control groups + 3
help blocks, ▶ Jam at the very bottom** (`screen.html` 1496–1575) — the cluttered-as-hell
signal, in code (market verified).

---

## 2. The solution — two workstreams

### Workstream A — On-the-fly RELIABILITY + FEEL

**The user-facing model (all lanes + host agree): *telegraph the boundary, don't fake
immediacy.*** Every change lands at a musical boundary — warm, audible, visibly confirmed.
**Keep the now-vs-wrap split** because it's musically honest and already half-built — a **style
swap = a *new band*** → enters *now* on its count-in; **key/feel/depth = the *same band*** →
top of the form — but **telegraph both** so neither reads as a bug. (host: the host's own loop
feel *count-ins* into the loop rather than snapping — aligning to the wrap is on-pattern;
faking mid-loop immediacy is the off-pattern source of the "weak" feel.)

The mechanism fixes:

| # | Fix | Symptom it kills | Owner | File | Tier |
|---|---|---|---|---|---|
| A1 | **Token-guard the apply** (`_jamApplyToken`): supersede stale async applies + re-read the live value before scheduling | the race ("select says B, plays A"); the retry | devops | mixer handler ~23031 | quick |
| A2 | **Preload candidate voices** (on jamPlay + on opening the mixer/band strip) | cold-switch lag / silence | audio-engine | new `prewarmMixerCandidates()`; `ensureWafPreset` ~5557 | quick |
| A3 | **Preset-ready gate** — keep the *current* voice sounding until the new one is decoded; never fall back to the thin oscillator on a live swap | "too quiet / sounds wrong then fixes itself" | audio-engine | mixer handler; `getReadyWafPreset` ~5564 | quick |
| A4 | **`WAF_GM_TRIM` per-preset loudness table** (twin of `DRUM_PIECE_GAIN`/`sgSourceTrim`) + **decouple the genre `harmony.level`** from a user-overridden voice (use a neutral ~0.8 ref) | "volume too low" (the core of it) | sound-design | `wafVoice` ~17031; new const by `WAF_VOICE_VOL` ~16896 | quick |
| A5 | **Drop `stopAudio()` on an instrument swap; equal-power crossfade** (~80–120 ms instrument / 120–200 ms style) at the boundary | "abrupt / unconfident" cut | sound-design + audio-engine | mixer handler ~23053; `scheduleBackingEnvelope` ~16913 | substantial |
| A6 | **In-place `activeBundle` hot-swap** at the boundary (re-gen chart → swap the bundle → the rolling window picks it up per chunk) replacing `stopPlayback→startPlayback` — the **unified apply path** for chart-changing changes | the rebuild seam; the jarring genre-switch restart | audio-engine + chair | `jamPlay` ~18659; wrap-apply ~14225; scheduler ~16945 | ambitious |
| A7 | **Jam live-change probe + soak** — hammer two swaps <50 ms apart, assert the *later* wins; soak repeated rebuilds for node/listener/**wake-lock** leaks (no jam smoke suite exists today) | regression net | devops | new `probe-jam-live-change.mjs` | quick |

**The confidence cue is the crossfade + the visual telegraph — NOT a beep** (sound-design's
[[audio-hit-feedback-ruling]] no-extra-cue stance; silence-then-quiet *was* the whole "didn't
work" perception, so a full-level warm morph *is* the "it took" signal). gamification: in a
no-score mode, **the change-response IS the feedback** — confident/immediate/visible = mastery
& agency; lagging/silent = learned helplessness (the fastest trust-killer here).

### Workstream B — The IA REDESIGN (declutter)

Unanimous structure (chair · gamification · learning-design · market · host):

**Organize by *setup-vs-live*, with progressive disclosure** (learning-design's spine;
gamification's "load curve, not fewer features"; market's "inversion"):

- **PRIMARY — the lit entry path (always visible, no scroll):**
  **Style** (as **6 family chips + a Recent row**, not 29) · the **"Your band" readout** (with
  a per-row **voice swap** — see below) · an **optional aim/intent** · **▶ JAM at the top**
  (market V6: it's at the bottom today). A beginner presses ▶ Jam touching nothing (sane
  defaults: Core/Chord/Band-only/Straight/Mix).
- **"Set up the band" (secondary, one cluster):** Key · Tempo · Changes · Feel · Band-role.
  Configure-then-forget; these wrap-quantize.
- **"While you play" (live):** the **Highlight scaffold ladder** · Intent · (future Energy).
- **Advanced (`▸ More` / native `<details>`):** Depth and any rarely-touched control.

Plus the specific moves:
- **29-chip wall → host picker grammar:** inline **search** + **6 family facets** (reveal-on-
  demand, *not* all-open) + a **Recent/Favorites** row + a **count badge**. **No modal** — the
  host has none, so a modal reads *less* native (host-expert). (`renderJamStyles` ~18487)
- **Highlight = a scaffold LADDER** (Chord→Guide→Scale→Off, training wheels that recede),
  **absorbing the separate Guide-line toggle** into its top rung → deletes two sections *and*
  adds pedagogy; fixes the beginner-wants-map-up / advanced-wants-off default conflict.
  (learning-design R4)
- **Promote the INTENT/aim over Depth** — the intent is the autonomy/motivation lever; Depth
  was over-promoted by sitting at section weight. Keep intent **optional** (required = drift).
  (gamification ②)
- **Move the instrument voice-swap out of the buried Mixer onto the "Your band" strip**
  (`renderBandStrip` ~18466) — a per-row voice menu writing the same `mixerState[key].instrument`,
  with a **loading→landed** state. This relocation alone fixes a big chunk of "I couldn't tell
  it worked." (chair #2)
- **Foreground the drill→Jam hand-off** (Path A on-ramp: arrive from a cleared rung with
  style+key+the drilled device pre-loaded — "you drilled the G-run, here's a blues band in A,
  quote it ▶") over the cold 29-chip grid — the differentiator, currently buried.
  (learning-design R5 + market)
- **The commodity→wedge INVERSION** (market): spend *less* surface on commodity (chips/toggles
  every rival has), *more* prominence on the wedge — the **teaching mirror tied to the band** +
  the **apply chip**.
- **Kill the green active-state** on Jam controls (`.virtuoso-jam-hl-btn.active` uses
  `rgba(34,197,94)`) — green = "cleared," it violates mirror-not-judge; the landed-flash is
  `--ss-accent`, **never** `--ss-meter` green. (chair)

**The feedback affordance (the (A)/(B) bridge):** a per-control **`↻` dot** (changed-since-
snapshot) + the pending chip upgraded to a **"Band takes it at the top — ~N beats"** countdown
(read live off the loop timebase — rhythm-meter to confirm the math) + a **visual landed-flash**
at the wrap (250 ms `--ss-accent` pulse, reduced-motion-gated, **no audio**). Reuse the host's
**loop-wrap count-in** as the "switching now" cue for the style/new-band case. (chair + gamif + host)

**Host-native skin (host-expert — MIRROR, don't invent):** the right-slide **drawer** shell
(`aside translate-x-full` + overlay, uppercase-tracking `<section>` headers, Clear/Done footer);
native **`<details>`** for the groups; inline **`role="status"`** for "applied". **BUILD** (no
host primitive): the genre→band picker grammar + the pending-until-wrap chip (dress it as the
host count-badge / amber pill). **All in `ss-*` CSS copying host hex values** (`dark-800 #0a0a12`,
`accent #4080e0`, …) — **never Tailwind class names** (runtime plugins aren't in the host's
build scan → arbitrary classes render unstyled; the rule stands).

---

## 3. The build-ordered plan

**Stage 1 — Reliability (make on-the-fly changes WORK + sound right).** The daily pain; mostly
localized bug fixes, no redesign. A1 token-guard · A2 preload · A3 ready-gate · A4 loudness-trim
+ level-decouple · A5 instrument crossfade (drop `stopAudio`) · A7 probe. *Fixes problem A's bugs
end-to-end without touching the layout — the fastest relief, and it de-risks the redesign (the
telegraph in Stage 2 assumes the underlying apply works).*

**Stage 2 — The IA redesign (declutter + telegraph).** The structural pane rework: three-tier
setup-vs-live disclosure + drawer shell + ▶ Jam primary/top · 29-chip → families+recent+search ·
Highlight ladder (absorb Guide) · promote Intent over Depth · per-control `↻` + countdown chip +
landed-flash · move the instrument voice-swap onto the "Your band" strip · kill green · foreground
the drill→Jam hand-off · host-native skin.

**Stage 3 — Unified seamless apply + generalize.** A6 in-place `activeBundle` hot-swap (replace
the full-rebuild seam) → one seamless apply model for *all* changes incl. a de-jarred genre swap ·
adopt the IA pattern (one primary + one cluster + `▸ More` + collapse-the-wall) as a **standing
design-system.md rule** and apply it to the **Custom / Workout** inspectors (the *other* panes
users called overwhelming — this is the real leverage). Content follow-on (learning-design): the
per-style "try this" / call-phrase prompts need a **harmony + genre-idiom** content pass.

---

## 4. Table-stakes vs differentiator vs drift

- **Table-stakes (we currently FAIL these):** pick-a-style-and-play-immediately; a live
  instrument/key/tempo change that's instant, audible, never silent; a non-overwhelming pane.
- **Differentiator (foreground, lead with these):** the **unified Live-Change telegraph**
  ("talk to the band, watch the change queue, watch it land") + the **drill→Jam apply wire** +
  the **teaching mirror tied to the band** + the **receding Highlight scaffold**. No rival pairs
  a curriculum with a no-score jam where every adjustment is a confident, telegraphed band-cue.
- **Drift to refuse (hard fences):** any jam score / combo / rank / loop-counter / live-clock /
  "best take" (collapses mirror-not-judge — the leaner pane must NEVER be backfilled with a
  score); a *required* intent; a generate/keep/export-a-track button; a confirmation **beep**; a
  full live mixing-console/effects-automation surface (stay a practice band, not a DAW).

---

## 5. HOST CHECK summary (host-expert, vs FeedBack 0.2.9, 2026-06-14)

| Capability | Verdict | Mirror/Build |
|---|---|---|
| Dense control-panel shell | **MIRROR** | the host right-slide **filter drawer** (aside + overlay, uppercase section headers, Clear/Done) |
| Many-item picker | **MIRROR** | host **Library**: inline search + tri-state/family chips + active-chip row + count badge. **No modal** (host has none). |
| Collapsible disclosure | **BORROW** | native **`<details>`/`<summary>`** (collapsed by default, chevron `group-open:rotate-180`); pill→popover for a dense bar |
| "Applied/pending" feedback | **MIRROR + BUILD** | inline `role="status"` for "applied" + reuse the loop-wrap count-in; the pending-until-wrap chip is **ours** (dress as a count-badge/amber pill) |
| Tailwind/styles | **RULE STANDS → BUILD** `ss-*` | runtime plugins aren't in the host build scan → use self-contained `ss-*` CSS copying host hex, never Tailwind class names |
| Genre→band selection | **BUILD** | host selection is song/gear-anchored; no genre→band picker exists |

**Nothing on the host UI roadmap flips this** (the drawer #129/#69 and collapsible-settings #48
are recent, deliberate host scannability decisions — safe to mirror).

---

## 6. Open decisions for Christian

1. **Where to start.** Recommended: **Stage 1 (reliability) first** — it fixes what you hit
   daily, it's mostly localized bug fixes (low risk), it lets you *feel* on-the-fly changes work,
   and the Stage-2 telegraph assumes the apply already works. Then the IA redesign.
2. **The now-vs-wrap model.** Recommended: **keep the split** (style = new band, enters now on a
   count-in; key/feel/depth = same band, at the wrap) and **telegraph both** — musically honest
   + host-on-pattern. (The chair initially leaned toward forcing one timing; the panel reconciled
   to "unify the *feedback*, not the *timing*.")
3. **Scope of the generalization (Stage 3).** Whether to roll the new IA pattern out to
   Custom/Workout this initiative or defer — those are the *other* "overwhelming" panes.
