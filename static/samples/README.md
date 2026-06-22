# static/samples — committed sample assets (license-cleared only)

Unlike `static/irs/` and `static/nam/` (gitignored pending licensing), everything in
this directory is **license-cleared for redistribution and committed to git**. Each
asset set below records its provenance and license. Only add assets here whose
license verifiably permits redistribution in an AGPL-3.0 plugin repo.

## Shinyguitar derived subset (`sg_*.ogg`) — CC0 1.0

A slimmed, derived subset of **Shinyguitar** by Karoryfer Samples (sampling and
mapping by D. Smolken), obtained from the open-source mirror
`github.com/sfzinstruments/karoryfer.shinyguitar`. The library is licensed
**CC0 1.0 Universal** (public-domain dedication — the repo's LICENSE file; the
readme adds "you can do whatever you want with it"). This subset is a processed
derivative: the **electric direct-input (DI) pickup signal** only, transcoded to
OGG Vorbis (q3, mono 44.1k) with sustains trimmed to 4.5 s (0.4 s fade-out).

| Files | Source articulation | Layers kept |
|---|---|---|
| `sg_sus_<midi>_vl<2\|3>_rr<1\|2>.ogg` (68) | pitched sustains, 17 keycenters MIDI 37–84 (minor-3rd spacing) | velocity layers vl2 (mid-soft) + vl3 (mid-hard) of 4; round-robins 1–2 of 4 |
| `sg_chuck_<1-4>_rr<1\|2>.ogg` (8) | strummed dead-string mutes (multi-string chucks) | RR 1–2 of 5 |
| `sg_mutestr_<1-6>_rr<1\|2>.ogg` (12) | per-string dead mutes (string 1 = low) | RR 1–2 of 5 |

Source SFZ velocity splits: vl2 = 33–64, vl3 = 65–96 (of 127). Pitched palm-mutes
are realized at runtime by envelope-shortening the sustains (the same technique the
source library uses via its CC110 "mute" control), not by separate samples.
Dropped from the subset: the acoustic/microphone channel, vl1/vl4, rr3–rr5,
release noises, and body percussion.

Region table + player live in `screen.js` §14; served by the `/sample/{name}`
route in `routes.py`.

## 8ridgelite 8-string DI subset (`8r_*.ogg`) — GPL-3.0

A derived subset of **8ridgelite**, an open-source JUCE 8-string electric-guitar DI
sampler, obtained from `github.com/OmikronApex/8ridgelite`. The repository is licensed
**GPL-3.0** (its `LICENSE` is the full GPL-3.0 text; the `.wav` set is committed in-repo
under that license) — compatible with this repo's AGPL-3.0-only, so the derived OGGs are
likewise GPL-3.0. The derivative: the `8ridgelite_20sec_wav/Natural/` articulation only
(the as-recorded sustain), each 20 s source WAV transcoded to **OGG Vorbis q3, mono
44.1 k** and trimmed to **4.5 s** (0.4 s fade-out), renamed `8r_<midi>.ogg`.

| Files | Articulation | Coverage |
|---|---|---|
| `8r_<midi>.ogg` (61) | Natural sustain (one take, one velocity layer) | chromatic MIDI **27–88**, less **33** (absent from the source) |

Single take + single layer (the "lite" set): variation is supplied at runtime by the
engine's pseudo round-robin (per-hit detune / gain / buffer-start jitter, `SG_VAR_*`) and
dynamics by the velocity→brightness low-pass (`opts.bright`). It has **no** chuck or
per-string dead-mute samples — pitched palm-mutes use the runtime `chug` envelope, and
chucks / dead-mutes fall back to the WAF voice. Selected via the mixer **"Electric DI 8"**
instrument pin (`mixerState[..].instrument === '8ridge'`); the bank descriptor (`R8_KCS`)
and player share the Shinyguitar region engine in `screen.js` §14.

> Pitch mapping is `midi = sourceIndex + 27` (verified against the source's own a4/c5/e6
> note-name labels). The low-octave file labels read one semitone off that mapping — if a
> by-ear check finds the whole bank a semitone out, it's a one-line offset fix here.

## Salamander Grand Piano subset (`sal_<midi>_v<N>.ogg`) — CC-BY 3.0

A derived subset of the **Salamander Grand Piano V3** by **Alexander Holm**, licensed
**CC-BY 3.0** (Creative Commons Attribution 3.0) and obtained from the Internet Archive
(`archive.org/details/SalamanderGrandPianoV3`, the `OggVorbis` package). Required
attribution: *"Salamander Grand Piano V3" by Alexander Holm, CC-BY 3.0.* This subset is a
processed derivative: **3 of the 16 velocity layers** — `v4` (soft) / `v9` (mid) / `v14`
(hard) — at the source's native minor-third keycenters (A/C/D#/F# per octave, A0–C8),
each transcoded to **OGG Vorbis q4, mono 44.1 k** and trimmed to **4.5 s** (0.4 s
fade-out), renamed `sal_<midi>_v<N>.ogg`.

| Files | Layers | Coverage |
|---|---|---|
| `sal_<midi>_v<N>.ogg` (90) | `v4` / `v9` / `v14` (soft / mid / hard) | MIDI **21–108** every minor 3rd (30 keycenters) |

This is the first **multi-velocity-layer** bank: a hit picks `v4` below vel 0.42, `v9`
below 0.75, else `v14` (`SAMPLE_BANKS.salamander.velLayers` — by-ear tunable), so loud vs
soft actually changes timbre, not just gain. Pitch-shift covers the ≤1-semitone gaps;
pseudo round-robin adds per-hit variation on top. Selected via the mixer **"Grand Piano"**
melodic instrument pin (`mixerState[..].instrument === 'salamander'`); shares the region
engine in `screen.js` §14. Mono for now (the source is stereo — a stereo re-harvest is a
size/quality bump if wanted), and re-harvestable from the upstream 44.1k/16-bit FLAC for
a single-lossy chain.

## Emily acoustic-guitar subset (`em_<midi>_<dyn>_rr<N>.ogg`) — CC0 1.0

A derived subset of **Emily** — a steel-string acoustic guitar by **Karoryfer Samples**
(the same source family as the Shinyguitar electric DI), from the open-source mirror
`github.com/sfzinstruments/karoryfer.emilyguitar`, licensed **CC0 1.0 Universal**
(public-domain dedication). The derivative: **3 of the 4 dynamic layers** — `p` (soft) /
`mf` (mid) / `f` (hard) — × **2 of the 3 round-robins**, at the source's 18 recorded
keycenters (Db2–D6, ~minor-third spacing), each source WAV (mono 44.1 k) transcoded to
**OGG Vorbis q3, mono** and trimmed to **4.5 s** (0.4 s fade-out), renamed
`em_<midi>_<dyn>_rr<N>.ogg`.

| Files | Layers × RR | Coverage |
|---|---|---|
| `em_<midi>_<dyn>_rr<N>.ogg` (108) | `p`/`mf`/`f` × `rr1`/`rr2` | 18 keycenters MIDI **37–86** (~minor 3rds) |

The first bank with BOTH real velocity layers AND real round-robins: a hit picks `p`
below vel 0.4, `mf` below 0.75, else `f` (`SAMPLE_BANKS.emily.velLayers`), alternating
rr1/rr2 per hit. Pitch-shift covers the ≤1.5-semitone gaps; pseudo round-robin layers on
top. Pitched palm-mutes use the runtime `chug` envelope; chucks/dead-mutes fall back to
WAF (Emily has no such samples in this subset). Selected via the mixer **"Steel acoustic"**
melodic instrument pin (`mixerState[..].instrument === 'emily'`); shares the region engine
in `screen.js` §14. Note→MIDI verified against the source SFZ (`db2` → keycenter 37).

## Wurlitzer EP200 subset (`wur_<midi>.ogg`) — CC-BY 3.0

A derived subset of the **Wurlitzer EP200** from **Greg Sullivan's E-Pianos**, licensed
**CC-BY 3.0** (Creative Commons Attribution 3.0), from `github.com/sfzinstruments/
GregSullivan.E-Pianos`. Required attribution: *Wurlitzer EP200 from "E-Pianos" by Greg
Sullivan, CC-BY 3.0.* The upstream is a **sparse, uneven** vintage set (most notes have
only 1–2 of its 4 dynamics), so this is a single-layer harvest: the best-covered dynamic
(`mp`) at its 12 recorded keycenters, each FLAC transcoded to **OGG Vorbis q4, mono 44.1 k**
and trimmed to **4.5 s** (0.4 s fade-out), renamed `wur_<midi>.ogg`. The instrument's
authentic vintage detuning is **kept** (the source SFZ's per-note tune correction is not
applied — it's character).

| Files | Layers | Coverage |
|---|---|---|
| `wur_<midi>.ogg` (12) | single (`mp`) | 12 keycenters MIDI **33–92** (A1–G#6, ~5-semitone spacing) |

A **character** Wurli, not a lush multi-layer one (the source can't support that — the
CC-BY CP-80 in the same pack is far better sampled if a fuller electric piano is ever
wanted). Single layer + `bright: 0.5` velocity→brightness + pseudo round-robin fake the
dynamics; pitch-shift (up to ~±3 semitones) covers the wide gaps. The Rhodes proper is
**not** here — jRhodes is CC BY-**NC**-SA (NonCommercial), incompatible with this repo.
Selected via the mixer **"Wurlitzer"** melodic instrument pin
(`mixerState[..].instrument === 'wurli'`). By-ear tunable: the `mp`-vs-`f` choice, level
balancing, the bright amount.

## Banjo subset (`bj_<midi>.ogg`) — CC0 1.0

A derived subset of **ganjo** (a 5-string banjo), licensed **CC0 1.0 Universal**
(public-domain dedication), from `github.com/sfzinstruments/ganjo`. The 25 base takes
(one per recorded keycenter — the source also ships many round-robins, dropped here),
each WAV transcoded to **OGG Vorbis, mono** and trimmed to **4.5 s** (0.5 s fade-out —
a banjo's pluck decays fast), renamed `bj_<midi>.ogg`.

| Files | Layers | Coverage |
|---|---|---|
| `bj_<midi>.ogg` (25) | single | 25 keycenters MIDI **39–71** (mostly contiguous low/mid + sparse high) |

Single layer + `bright: 0.4` velocity→brightness + pseudo round-robin fake the dynamics
and beat the machine-gun on banjo *rolls* (fast repeated notes). **Note→MIDI is the source
SFZ's `pitch_keycenter`, NOT the filenames** — ganjo's octave labels run one octave high
(its "D#3" = keycenter 39 = MIDI D#2). Selected via the mixer **"Banjo"** pin (and the
bluegrass `bank:'banjo'`).

**RE-HARVESTED 2026-06-15 (tuning fix — banjo-pedagogy-expert audit).** The ganjo source
WAVs are ~**+50¢ sharp** of their keycenters, and the v1 transcode added ANOTHER ~+90¢ (so
v1 rendered +120–150¢ sharp — worst in keys whose drone landed on a take v1 had corrupted;
that's why it sounded right in G but off elsewhere). Each take is now **pitch-corrected onto
its keycenter** on re-export (`asetrate`/`atempo` by the measured per-sample offset; verified
**avg 1.5¢ / worst 8¢** off). The broken kc47 source (an octave low) was dropped; 53/61/71
added for coverage. No per-bank `tune` correction is needed now.

## CP-80 electric grand subset (`cp_<midi>_<dyn>.ogg`) — CC-BY 3.0

A derived subset of the **Yamaha CP-80 electric grand** from **Greg Sullivan's E-Pianos**
(the same CC-BY 3.0 pack as the Wurlitzer above), from `github.com/sfzinstruments/
GregSullivan.E-Pianos`. Required attribution: *CP-80 from "E-Pianos" by Greg Sullivan,
CC-BY 3.0.* Unlike the sparse Wurli, the CP-80 is **fully and evenly sampled**, so this is
a proper **3-velocity-layer** harvest: `mp` / `f` / `ff` at each of 21 keycenters, each
FLAC transcoded to **OGG Vorbis q4, mono 44.1 k** and trimmed to **4.5 s** (0.4 s fade-out),
renamed `cp_<midi>_<dyn>.ogg`. The leading number in the source filename **is** the MIDI
(no octave trap — unlike ganjo).

| Files | Layers | Coverage |
|---|---|---|
| `cp_<midi>_<dyn>.ogg` (63) | 3 (`mp`/`f`/`ff`) | 21 keycenters MIDI **27–107** (D1–B7, ~minor-third spacing) |

The bandmate to the Wurli: where the Wurli is a gritty character voice, the CP-80 is the
glossy, bell-like electric grand (its tine-and-string strike sits between a Rhodes and an
acoustic). 3 real dynamic layers (`maxVel` 0.45 / 0.78 / ∞) so attack hardness is recorded,
not faked; `bright: 0` (the layers carry the timbre); pseudo round-robin decorrelates
repeats; pitch-shift covers the minor-third gaps. Amp-able but not forced (a finished
recording — no `amped` flag). Selected via the mixer **"Electric grand"** melodic
instrument pin (`mixerState[..].instrument === 'cp80'`). By-ear tunable: the layer
thresholds, level balancing.

## Acoustic drum kit subset (`dk_<piece>_<n>.ogg`) — CC0 1.0

A curated lightweight subset of **virtuosity_drums** by **Versilian Studios & Karoryfer
Samples** (KVR Developer Challenge 2021), licensed **CC0 1.0 Universal** (public-domain
dedication), from `github.com/sfzinstruments/virtuosity_drums`. This **replaces the FluidR3
GM drum soundfont** as the source for the sampled acoustic kits (`kit_rock` / `kit_jazz` /
`kit_acoustic_soft`) — the drum-side of the melodic sample-bank realism upgrade. FluidR3
stays as the per-piece **fallback** for the pieces this subset drops.

Scope set by a drum-pedagogy + sound-design panel for a **backing bed** (these drums sit
*under* a practicing player, never soloed): a single medium-velocity layer per piece +
**round-robins** (the #1 anti-machine-gun lever) — dynamics come from playback `vol`
scaling, not extra layers. Mic choice per sound-design (one mic per piece, never summed):
**close** mics for kick/snare/toms, the tight **mid** mic for hi-hats, **overheads** for
ride/crash. Each source FLAC peak-normalized to −1 dBFS (so the per-piece gain table starts
neutral), per-piece trim + fade, a gentle >9 kHz shelf cut baked into cymbals/hats, → **OGG
Vorbis q4, mono 44.1 k**.

| Piece (`dk_<token>_<n>`) | Source mic | Round-robins |
|---|---|---|
| `kick` | kickmic (close) | 3 |
| `snare` | snaremic (close) | 3 (adjacent vel layers as RR) |
| `xstick` (cross-stick) | snaremic (close) | 2 |
| `hhclosed` | mid (tight) | **4** (driving-hat machine-gun killer) |
| `hhopen` / `hhpedal` | mid (tight) | 2 / 2 |
| `ride` | oh (overhead) | 3 |
| `crash` | oh (overhead) | 2 |
| `htom` / `ltom` | mid (close) | 2 / 2 |

25 files, ~270 KB total. Engine: `DRUMKIT_BANKS.virtuosity` maps each of the engine's 18
drum pieces → a source token (the 4 tom slots alias the 2 harvested toms); dropped pieces
(`ride_bell`/`splash`/`china`/`crash_r`/`bell`/`clap`) fall through to FluidR3 then the
synth 808/909 voice (degraded-but-audible, never silent). By-ear tunable: the snare's
medium-hard velocity-layer pick (vl11–13 of 16), the per-piece gain re-balance vs the synth
failover, and a future ghost-snare 2nd layer (a genuinely soft-struck sample, not gained-down).
