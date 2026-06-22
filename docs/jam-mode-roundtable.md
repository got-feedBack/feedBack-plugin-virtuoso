# Jam-Mode Redesign Charette — synthesis spec & decision log

*2026-06-12. Main-thread synthesis of the 10-agent Jam charette — chair: virtuoso-ux-designer; lanes: market-analyst · learning-design · gamification · audio-engine · guitar-pedagogy · bass-pedagogy · harmony-theory · feedback-compatibility (HOST CHECK) · notedetect-expert. Per-lane rulings live in each agent's `.claude/agent-memory/<agent>/`. Build-time consults (not paneled, named where owed): rhythm-meter (wrap-timing/seam rules), sound-design (arc loudness, ending tag), genre-idiom agents (per-style prompts/call phrases/arc shapes), drum-pedagogy (drummer-spine kits).*

**The initiative:** Jam mode today is a style grid + key/tempo/feel + one button that loops ONE progression cycle forever with an audible generated scale line on top. Christian's bar: best-in-class session-style play-along (the reactive-band jam feature of major guitar-learning software). North-star frame: Jam is the curriculum's creative destination — a MIRROR, never a judge, never a song generator.

## The frame (chair) — Intent → Start → Flow → Variation → End → Reflection

Today Jam has only Start and an endless Flow. The plan adds the other four stages without ever adding a judge.

**The two convergent headlines (independent across 6+ lanes):**
1. **Silence the machine.** The always-audible reference scale line is the #1 usability defect — it masks the player, trains copying-not-improvising, collides in register, and on bass implies the wrong job entirely. Default = the BAND only; the line survives only as an opt-in support layer / future call-phrase.
2. **The loop-wrap is the change-quantum.** Everything live (key/feel/style/progression/energy) applies at the top of the next cycle — band convention, no stop+restart, telegraphed by a pending-change chip. Enabler verified in code: the rolling-window audio scheduler re-reads `activeBundle` per ~4s chunk, so mutating not-yet-scheduled bars is glitch-free by construction.

**Market's positioning (genericized; specifics in market's memory):** style/key/tempo/loop/chord-map are table-stakes we already meet. The un-copyable bet is the **drill→Jam APPLY wire + a guide-tone mirror that goes quiet as you climb** — no rival owns both a curriculum and a jam mode. The reactive band is the delight bet but P1, gated on Jam actually being used. Style breadth is a commodity axis — don't lead with it.

## HOST CHECK (rule-4 artifact, 2026-06-12 — full block in host-expert memory)

- **Jam/looper/session/backing capability** · host has NOTHING player-facing (specs 004/008 are internal graph/transport, explicitly excluding jam/looping/generation) · **BUILD** the band/variation/sections/controls; MIRROR host count-in/loop-wrap feel · flips if a generated-backing domain ships.
- **Mic capture (riff memo)** · host **affirmatively withholds** raw audio from plugins (007 MUST-NOT) · **BUILD-if-pursued, but it crosses our never-touch-the-signal corollary** → separate opt-in slice w/ its own go/no-go · flips on a host recording-capture domain. ⚠ Conflicts with detector lane's read that note_detect ships consumable auto-record — **OPEN: verify before any capture work** (D-J9).
- **nam_tone per-style tone** · worklet stable, no programmatic suggest-preset API · **BORROW** for backing tone; player monitoring = a hint only · flips on a `suggestTone(style)` API.
- **Visualization** · no host chord-loop surface; our two-lane overview is already the build · **BUILD/MIRROR** (keep the highway borrow).
- **Host events** · spec 011 (we're the named pilot): at most a jam **participation** `plugin_event` post-merge; never a score · **DEFER to 011 merge**.
- **Collision:** none.

## Decision log

- **D-J1 — Kill the default audible reference line** (UX P0 / both pedagogy P0 / L&D P0). `audio.notes` defaults OFF in Jam; "Guide line" becomes an opt-in audio layer beside the Highlight family. Long-term it becomes a periodic CALL-phrase (sparse, answered by the player), never a continuous line.
- **D-J2 — Bass jam = occupy-the-foundation.** Default for a bass player: the band's Bass bus DROPS ("You're the bassist": drums+comp), drummer-spine prominent; "Drums only" as the second mode. A second-bass-solos mode is declined (niche).
- **D-J3 — The wrap is the only change boundary.** All live changes (key/feel/progression/style/energy/depth) quantize to the loop wrap with a pending chip; tempo rebuilds in place at the wrap. Honest one-pass latency beats glitches or stop+restart. (rhythm-meter consult at build.)
- **D-J4 — Variety before reactivity.** Order: per-pass seeded re-roll + seam fills + density cycling (S) → manual Energy/section arc (M) → level-meter Auto-energy (opt-in, hysteresis + never-fully-drop floor + slow envelope). Reactivity rides the arc layer for free; shipped naive it's a gimmick.
- **D-J5 — Harmony variety is already authored.** Palettes carry `progressions[]` plural and `stylePaletteConfig` accepts the index — Jam just never passes it. Named progression picker + a round-robin wrap-boundary "switch it up" (never random, never mid-phrase). Harmonic-Depth dial = staged `chordDepth` (Simple/Core/Rich), roots/bass pinned, upper voices enrich. Wire the eight dormant bright-modal vamp tokens (`chordOverride:'auto'`, never `dom7`).
- **D-J6 — Guide layers: chord tones default, fade to silence.** Strip default = current chord's tones + the amber NEXT pre-light (already correct). Layer ladder full-scale → chord-tones → guide-tones → root-map → OFF rides the Depth support-off axis — an earned fade, never a silent default. Fixes: the blues ♭3 is never painted wrong (light root/5/♭7 as home, leave ♭3/♭5 unmarked); a static vamp pre-lights the tonality's color note (Dorian ♮6, Mixo ♭7) instead of going dark.
- **D-J7 — Position is a suggestion, not a cage.** Replace the hardcoded frets-2-9 clamp with a per-style/key suggested home box (ghost frame, ignorable) + opt-in per-chord follow. The neck stays open.
- **D-J8 — Intents, not scores** (gamification + L&D co-ruling). Optional pre-jam intent chip ("land the 3rd at every change", "walk into every change" on bass, "quote the turnaround you drilled") with loop-end SELF-check only. Jam time feeds the woodshed log/lifetime ledger silently — no streak pressure, no live clock, no loop counter. End = a warm non-modal no-verdict mirror (time, styles, keys; intents *touched* only if cheaply true). ANTI-list (hard): no jam score/grade/rank/leaderboard/combo/auto-"best-moment"; the bass pocket-mirror is post-session, descriptive, opt-in, or not at all.
- **D-J9 — Capture is two different features.** (a) Mono note-list riff memo from the pitch stream we already consume — allowed, mirror-grade, player-triggered. (b) RAW-AUDIO capture — **OPEN go/no-go** (host 007 withholds it; detector lane says consume note_detect's auto-record; verify which is true at the source before any design). Never auto-judged, never a default.
- **D-J10 — The drill→Jam hand-off carries the DEVICE.** "Jam this skill ▸" pre-loads style + key + the drilled device as the first intent (the riff-vocab construct step graduates by edge into a device-seeded jam). The apply-wire is the market P0.
- **D-J11 — Detector boundaries.** Played-note mirror (mono, debounced; ambient glow not verdict), level-driven energy, descriptive session mirror (pc-histogram/register/density — never "you played in D dorian" overclaims), and silence-gesture (DI-reliable) are all FEASIBLE-NOW on both web+desktop with no pin move. Key-follow ("band follows you") = a note_detect host-ask, never our DSP.

## The build plan (slices, each independently shippable)

**Slice J-1 — "Stop talking over the player" (mostly S; the usability unlock):**
guide-line OFF by default + opt-in layer (D-J1) · bass-role default (D-J2) · progression picker + switch-it-up (D-J5a) · per-pass re-roll + seam fill + density cycling (D-J4a) · style grid IA (family chips + recent row) · per-style one-line "try this" prompt (the intent seed) · strip chord-tone default + ghost home box replacing the 2-9 clamp (D-J6/J7).

**Slice J-2 — "A band you can talk to":** live wrap-boundary changes w/ pending chip (key/feel/progression/tempo) · intent chips proper (+ bass-native set) · the drill→Jam device hand-off (D-J10) · Harmonic-Depth dial + modal-token wiring + guide-layer fixes (D-J5b/J6).

**Slice J-3 — "A living arrangement":** section-arc FSM (sparse→groove→lift→breakdown) + manual Energy macro · End-jam (finishes the cycle, ending tag) → the no-verdict reflection mirror + silent ledger credit · played-note mirror on the strip · support-off fade ladder.

**Slice J-4 — "The band breathes with you" (gated on J1-J3 usage signal):** Auto-energy off the level meter (opt-in) · riff memo v1 (mono note-list) · silence-gesture break · key journeys (idiomatic per style, announced on the overview) · the key-follow host-ask.

**Metrics (market):** apply-rate (cleared rungs → "take it to Jam" taps) · return-with-intent + the transfer ask · the "didn't know what to play → found notes that worked" Discord ask. Anti-metric: jam dwell up while skill flat = time-sink, not a win.
