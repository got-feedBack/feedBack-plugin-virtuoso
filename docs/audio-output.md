# Virtuoso — Audio Output

How a browser-only FeedBack plugin produces believable guitar/bass tone using only the Web Audio API — no bundled instruments, no native dependencies. **Self-contained by design:** native-instrument (VSTi) support is planned as an *optional* enhancement, but the product is built to stand on its own first, and this path stays as the zero-cost fallback for anyone who can't run or doesn't want native plugins. Verified against the current build 2026-06-14.

## TL;DR

- **100% Web Audio API today.** No bundled instruments, no native host, no build step.
- **Contained playback** — the plugin owns its own transport (a `requestAnimationFrame` clock + a Web-Audio lookahead scheduler). It does *not* hand off to the host's main player.
- Sound is **layered**: synth + a self-hosted GM sampler + a sampled electric-DI guitar + an in-browser amp/cab chain, with an **optional borrow** of the host's neural-amp plugin for amp tone.
- Everything routes through a mixer (per-role buses → **master safety limiter** → output), so output is normalized and can't surprise-clip.
- **Native-instrument support is a planned *additive* layer, never a dependency** — see Roadmap below.

## Why it's self-contained

Virtuoso is a FeedBack plugin: plain `screen.html` / `screen.js` / `routes.py` served by the host's FastAPI, running in page scope. **No bundler, no compiler, no runtime package deps.** So whatever makes sound has to be (a) Web Audio, or (b) a capability already present in the host that we borrow. That constraint is deliberate: nothing to install, nothing to sign, runs everywhere the host runs, and it costs the user nothing. Native-instrument support will sit *on top* of this — an enhancement for players who have the plugins and the CPU, not a gate in front of the product.

## The sound-source stack

| Layer | What | Used for |
|---|---|---|
| **1. Synthesis** | Web-Audio `OscillatorNode` voices | Metronome/click, count-in, utility/synth tones |
| **2. GM sampler** | A JS soundfont player + a self-hosted general-MIDI soundfont | The GM instrument bank (bass, keys, drum one-shots, etc.) |
| **3. Sampled electric-DI guitar** | A derived subset (DI pickup only), velocity layers + round-robins, transcoded to OGG; a region player picks the sample per note+velocity | A real guitar-ish DI voice for the practice notes / backing |
| **4. In-browser amp/cab** | `WaveShaper` (drive/clip curve) → `ConvolverNode` loaded with a real cab **impulse response**; procedural cab fallback if an IR is missing (never silent) | Turning the clean DI into an amped tone, fully in Web Audio |
| **5. Neural-amp borrow** | Feature-detect the host's `nam_tone` plugin and hand off (Neural Amp Modeler, user-supplied model files) | Amp-grade tone without us shipping an amp modeler |

Layer 3 detail: **palm-mutes are realized at runtime** by envelope-shortening the sustain samples (the same control the source library exposes), so we don't ship separate mute samples for every pitch.

## Signal chain

```
note event
  → source voice  (synth | GM sampler | DI region-sampler)
  → [optional amp chain:  WaveShaper drive → Convolver cab IR]
  → per-role bus gain  (the Mixer console: a bus per role + MASTER fader)
  → master safety limiter  (DynamicsCompressor, thresh −6 / ratio 6, ~3 ms attack)
  → ctx.destination
```

The master limiter is a deliberate safety stage — sudden-loud / clipping protection — not a mix effect. There's ~0.85 headroom trim into it.

## Scheduling

Backing can run 30-minute "woodshed" sessions. Scheduling a whole pass up front created tens of thousands of audio nodes (~39k) and a long main-thread stall. The fix is a **rolling-window scheduler**: only ever schedule a short horizon ahead of the play clock, keeping the live node count bounded — including across loop wraps. Worth doing from day one for anything long-form in Web Audio.

## Assets & licensing

The repo is **AGPL-3.0-only**, so anything that *ships* must be redistribution-compatible. Full per-asset provenance + license lives in `static/<dir>/README.md`; the summary:

| Asset | Role | License | Ships? |
|---|---|---|---|
| GM soundfont + player | GM sampler | **MIT** | ✅ |
| Electric-DI guitar subset | Electric-DI guitar | **CC0 1.0** | ✅ |
| Metal 4×12 cab IR | Metal cab | **GPL-3.0-or-later** (AGPL-compatible) | ✅ |
| Clean + overdrive cab IRs | Clean/OD cabs | Commercial captures | ❌ local-only → procedural-cab fallback ships |
| Neural-amp model files | Neural amp | User-supplied | ❌ not bundled (host's `nam_tone` owns the engine) |

Self-hosted, never a CDN. Commercial captures are gitignored and the public build falls back to a procedural cab, so a missing IR is never silent.

## Design principles

- **Borrow before build.** If the host already ships a capability (neural-amp modeling, a GM sampler), use it instead of reimplementing. The neural-amp hand-off is exactly this.
- **Self-contained floor.** A browser plugin should make sound with the platform it's already in. Dependency-light, portable, free to the user.
- **Self-host license-cleared assets only.** Provenance + license recorded per asset.
- **Safe output.** Normalized + limited; no clipping, no surprise full-volume transients.
- **Cheap realism first.** Cab-IR convolution gets most of the way to "amped" for almost nothing; richer tone is the optional layer, not the baseline.

## Roadmap: native instruments as an optional layer

Native-instrument (VSTi) support, and richer native tone generally, is a planned capability — but **additive, never required**. The ordering is intentional:

1. The product must work **fully on its own** with the self-contained Web-Audio chain above. That is the baseline experience, and it's what gets verified and shipped.
2. Native instruments then layer on for players who have the plugins, the licenses, and the CPU.
3. The self-contained chain **stays** as the permanent **fallback** — for anyone who can't run native plugins or can't afford them, the product is never degraded, just un-enhanced.

So the Web-Audio path isn't a stopgap until native instruments land; it's the floor the whole product stands on.

## Where it lives (for parity)

- `screen.js` §14 — transport, playback clock, audio engine, DI region player, amp chain, mixer/limiter
- `static/wafonts/` — GM soundfont (+ provenance README)
- `static/samples/` — electric-DI OGG subset (+ provenance README)
- `static/irs/` — cab impulse responses (+ provenance README)
- `static/nam/` — sample neural-amp model + manifest
- `routes.py` — `/wafont` `/sample` `/ir` `/nam` asset routes

---

The audio exists to serve practice: it has to sound good enough to play against, then get out of the way. The generative practice engine is where the real work is.
