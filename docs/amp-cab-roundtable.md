# Amp/Cab interface — design roundtable + build

*2026-06-13. Main-thread synthesis of a 3-lane design pass (feedback-compatibility · audio-engine-architect · virtuoso-ux-designer). Christian: "if we're doing the amp/cab interface we don't just need an IR picker, we need more. Is there a NAM gui we can integrate or do we have to build our own?" + "look into A2." This is for Virtuoso's **BACKING band** amp/cab tone (the generated comp/guide voices) — NOT the player's live input (that's the host `nam_tone` plugin).*

## The facts that reframed it
- **`nam_tone` (host plugin, v1.2.0)** is already a full NAM amp/cab rig — upload `.nam` models + cab IRs, build presets (model+IR+gain+gate), tone-map to songs, a config GUI, a SQLite preset DB, and a WASM NAM worklet served cross-plugin. But it amps the **player's LIVE input**. Virtuoso's amp/cab is for the **backing** — same engine family, different signal.
- **A2** = NAM Architecture 2 (launched 2026-06-02, TONE3000 + Steve Atkinson): hyper-accurate open-source captures, "virtually indistinguishable" from real gear, runs on a $3 chip. `nam_tone` is built on NeuralAmpModelerCore **v0.5.3 with the A2 fast-path**, so its worklet loads **both A1 and A2** with the identical `load-model` message — no A2-specific code our side. A2 is heavier CPU on the single-thread worklet (A2-Lite/standard cheaper than A1; A2-Full heavier).
- **Correction:** we do NOT currently borrow NAM — it was only proven in a throwaway probe, never integrated. The shipped backing amp is our in-house WaveShaper+cab-IR chain.

## HOST CHECK — verdicts (host-expert, verified 2026-06-13)
| Piece | Verdict |
|---|---|
| NAM engine (worklet + wasm) | **BORROW** — feature-detect `/api/plugins/nam_tone/worklet/*`; degrade to our WaveShaper when absent |
| A2 model loading | **BORROW** — no-op (same `load-model`; watch `model-loaded.success`, fall back) |
| Player's NAM presets/models/IRs | **BORROW read-only** — `GET /presets` + `/file/model\|ir` (the player's whole tone library; IRs ffmpeg-normalized to 48k mono) |
| Amp/cab GUI | **BUILD ours** for the backing; **MIRROR via handoff** for the player's live amp (the Input strip's "Tone…" → `nam_tone`) |
| Live-input amping | **BUILD-NOTHING** — defer to `nam_tone` (the clean line: band tone ≠ live tone) |

## The method call (audio-engine)
**For the BACKING, WaveShaper + a good cab IR wins; NAM isn't worth it.** The cab IR is ~80% of perceived tone (the literal measured cab); NAM only improves the ~20% drive stage — audible on a soloed lead, **inaudible buried in a backing mix under the player's own live guitar**, the only context backing exists in. NAM is foreground-grade; our chain is mix-grade, and mix-grade is all the backing needs. **The real backing-tone lever is better cab IRs, not NAM** (the CC0 clean/crunch hunt). Tier order: **(a) build the spine → (c) borrow → (b) defer.**

## v1 — SHIPPED (Christian: "ship A, then build it")
The **Mixer's "Rig" view** (`[Console | Rig]` tab) — per-amp cab IR + output trim for the backing band. The cab is **per-amp** (one Metal cab serves every metal-amped strip), so the Rig manages the 3 amps, not the 7 strips.
- **Three amp cards** (Clean/Overdrive/Metal): **Cab** name + **[Load…]** (file picker) + **[Reset]**; **Output** trim slider + dB readout + reset.
- **Engine:** `ensureCabIr` generalized to resolve a `user:<ampId>` blob from **IndexedDB** before the `/ir/` fetch — the never-wait `_irPending` hot-swap + procedural fallback + per-ctx cache stay identical. `buildAmpChain(ctx, p, ampId)` applies the user cab + output override; `wireTrackAmp` stores the makeup node for live output trim. A bad file decode-fails → procedural stays (never silent).
- **Persistence:** IR bytes → IndexedDB (`virtuoso-rig`), metadata (name + output) → localStorage (`virtuoso.rig`). A user upload is THEIR licensing problem (never committed). core-purity stays green (Rig is shell, not the generation path).
- **The player's live amp** stays the Input "YOU" strip's "Tone…" handoff — a one-line disambiguator keeps band-tone ≠ live-tone clear.
- Verify: `probe-rig.mjs` 10/10 (real file-chooser flow) + 18/18 smoke.

## Deferred roadmap — the power-user amp-tone process (staged; do NOT rabbit-hole)

**The process: ship the defaults now → revisit to deepen per-amp customization, one safe stage at a time.** Some players WILL want to craft tone per amp; this is where those requests land, so we add depth deliberately (each stage gated on real demand + the prior shipping) instead of building a full amp-sim up front. **Stage 0 (DONE, v1):** ship the defaults — the 3 amp presets, the GPL V30 IR, and the Rig view's per-amp cab upload + output trim. Then:

1. **v1.1** — Drive/EQ macros on the cards (the params already exist in `AMP_PRESETS`).
2. **"Use my NAM tone"** (tier c, the compelling NAM tier) — read the player's `nam_tone` `/presets`, let them point a backing amp at one (pull its model + IR via the borrowed worklet; A2 loads free). Ships nothing, licenses nothing.
3. **Generic NAM/A2 model load** (tier b) — gated, never a shipped default. If ever NAM the backing: **A2-Lite, one lazy worklet**, the double-track stays a downstream delay/detune split (no 2nd worklet).
4. **Asset gap** — source CC0 clean + crunch cabs to ship (the clean/OD cabs are procedural fallbacks in the public build); the **real** backing-tone win.
5. **(B) built-in cab library** — a small shipped cab picker so the Rig is useful on first open (gated on #4).

Agent specs: `.claude/agent-memory/{feedback-compatibility/reference_nam_tone_borrow_surface, audio-engine-architect/project_backing_amp_method_and_a2, virtuoso-ux-designer/project_amp_cab_interface_spec}.md`.
