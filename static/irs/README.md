# Cab impulse responses (`static/irs/`)

Real guitar-cab impulse responses for the amp inserts (`AMP_PRESETS[*].ir` in
`screen.js`). The convolver loads `static/irs/<name>.wav` via the
`/api/plugins/virtuoso/ir/<name>` route; if a file is absent, the chain falls
back to the **procedural** cab (`cabIrBuffer`) — so a missing IR is never silent.

## Shipped (committed)

| file | preset | speaker / cab | provenance · license |
|------|--------|---------------|----------------------|
| `v30_4x12.wav` | **Metal** | Celestion **Vintage 30** 4×12 (Audix i5, P2) | Deer Ink Studios capture, bundled in **[AIDA-X](https://github.com/AidaDSP/AIDA-X)** (`files/V30-P2-audix-i5-deerinkstudios.wav`) under **GPL-3.0-or-later** — compatible with this repo's AGPL-3.0-only. A V30 4×12 close-mic is the canonical 6505 cab voice. |

## Local-only (gitignored — NOT shipped)

The clean + overdrive cabs are **commercial** captures from a personal library,
used for local dogfooding only. The public build falls back to the procedural cab
for these two presets. To audition them, drop a cab IR WAV at these names:

| file | preset | currently (local) |
|------|--------|-------------------|
| `cab_clean.wav` | **Clean** | GGD Zilla "Boutique Clean" (commercial — local only) |
| `cab_drive.wav` | **Overdrive** | Marshall JMP2203 capture (commercial — local only) |

Replacing a local file is a hot-swap — no code change (the preset references the
stable role-name `cab_clean` / `cab_drive`). When a genuinely redistributable
(CC0/CC-BY/GPL) clean and Marshall/Greenback IR is found, drop it in + un-gitignore
it here (mirror the V30 row) to ship it.

> Format: short mono cab IR WAV (44.1/48 kHz, a few hundred–~2k samples). The
> double-tracking supplies the stereo, so mono is correct.
