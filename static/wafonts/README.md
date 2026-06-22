# Bundled WebAudioFont assets — provenance & licensing

Verified 2026-06-12.

| Asset | Source | License |
|---|---|---|
| `WebAudioFontPlayer.js` | the WebAudioFont project (surikov/webaudiofont) | MIT |
| `NNNN_FluidR3_GM_sf2_file.js` (14 melodic GM programs) | WebAudioFont preset renders of **FluidR3_GM** by Frank Wen | MIT (FluidR3 GM is MIT-licensed; see the license document referenced by the webaudiofontdata README, hosted in the MuseScore project repository) |
| `128NN_0_FluidR3_GM_sf2_file.js` (drum one-shots) | same — FluidR3_GM percussion | MIT |

Notes:

- The melodic set was originally the `JCLive` WebAudioFont variants. They were
  **removed 2026-06-12**: the upstream webaudiofontdata repository declares MIT
  but does not document the JCLive sound data's source, and an open upstream
  issue asking whether the MIT grant covers the sound data has no maintainer
  answer. FluidR3_GM has clear MIT provenance, so the whole bundled set now
  comes from it. Do not reintroduce JCLive (or any other undocumented-source
  font) into the committed set.
- `alt/` (gitignored) holds alternate fonts for local A/B auditioning only —
  nothing in it ships.
- The committed Shinyguitar sample subset lives in `static/samples/` with its
  own provenance README (CC0).
