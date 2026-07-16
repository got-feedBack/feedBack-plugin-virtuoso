# Topbar host parity — Tuner · Instrument · Profile in the Virtuoso header

> **Status: SPEC (2026-07-10, ux lane) — no code changes yet.**
> Why now: Virtuoso's `"fullscreen": true` opt-in hides the host topbar entirely on our
> screen, so the three host-standard topbar elements (Open Tuner, Instrument selector,
> Profile) vanish for the player while inside Virtuoso. Part 1 rule 1: match the host
> standard — bring them into our header, in the host's order, speaking the host's
> visual language, without inventing variants.
>
> Host recon verified 2026-07-10 against the local FeedBack clone (v0.3.0-alpha.1,
> `static/v3/shell.js` + `badges.js` + `profile.js`, `server.py`).

---

## HOST CHECK

- **Capability:** topbar Tuner / Instrument / Profile parity inside Virtuoso's fullscreen screen.
- **What the host has:** `shell.js renderTopbar` (~L198–230) ends with three right-aligned
  badges — tuner (`badges.js renderTuner` ~L318: 92×96px card, 11-segment meter, note name,
  ref-hz; click → `window.tuner.toggle()`, live data `feedBack.on('tuner:frame')`),
  instrument (`renderInstrument` ~L424: card + dropdown panel; `STRING_COUNTS
  {guitar:[6,7,8], bass:[4,5,6]}`, named tunings from `GET /api/tunings` keyed
  `<instrument>-<count>`, custom offset-arrays low-string-first; persists
  `POST /api/settings`, syncs `feedBack.workingTuning.setCurrentInstrument`, emits
  `instrument:changed`), profile (`profile.js renderBadge` ~L43: avatar + streak +
  Mastery Rank + dB wallet from `GET /api/profile` + `/api/profile/progress` +
  `window.v3Progression`; click → `showScreen('v3-profile')`; renders nothing when
  `!onboarded`). Backend routes confirmed live in `server.py` (L9579+/L10734+/L10747+).
- **Evidence + date:** source reads 2026-07-10; Virtuoso screen.js currently has ZERO
  references to `/api/settings`, `/api/tunings`, `workingTuning`, `instrument:changed`,
  `tuner:frame`, or `v3Progression` (grep-verified) — this is all new integration surface.
- **Verdicts:**
  - **Tuner: BORROW the launch** (`window.tuner.toggle()`, feature-detected) **+ MIRROR the
    card** at our header scale. Our own target-aware `Tune…` stays (different job — see §3).
  - **Instrument: BORROW the persistence** (`/api/settings` + `/api/tunings` +
    `workingTuning` + `instrument:changed`) **+ MIRROR the badge/panel UI**, absorbing
    Virtuoso's extra tuning content. Host settings become source of truth for guitar/bass.
  - **Profile: MIRROR the chip** (compact, from host endpoints) **and LINK on click**
    (`v3-profile` via `goScreen`) — never a second profile implementation. Our own
    progress chip hides pending a real profile-merge design.
- **What host change would flip a verdict:** a host-provided embeddable badge component
  (or a `renderTopbar` slot the fullscreen screen could opt back into) would flip all
  three MIRRORs to pure BORROW — delete our compact badges, keep only the sync plumbing.

---

## 1. Header layout

### Order (left → right)

```
[ Virtuoso wordmark + tagline ]   [ 4-mode segments (centered) ]   [ 🎯Tuner ][ Instrument ▾ ][ Profile ]  [ ⚙ ]
```

- The **right cluster preserves the host's order exactly**: tuner · instrument · profile
  (rule 1 — the muscle memory a player brings from the main menu must transfer). It
  replaces today's `Setup ▾ … progress-chip` pair in that region.
- The **instrument badge replaces `#virtuoso-setup-btn`** in place — same flex slot
  (`.virtuoso-header-setup` moves from left-of-modes into the right cluster; see §2).
  Rationale: on the host, instrument identity lives right-of-content; keeping our Setup
  button on the left would duplicate the concept in two places. One selector (directive 2).
- **⚙ stays outermost-right** — it is Virtuoso chrome, not host parity; keeping it past
  the host triplet keeps the triplet reading as one borrowed unit.
- The **progress chip is hidden** (§4); the mode segments stay centered (they are our
  primary nav — the host topbar has no analog and cedes the center).
- Wrap container: one new `.virtuoso-header-host` flex group (gap `--vir-sp-2`) holding
  the three badges, so the cluster degrades and themes as a unit.

### Scale — honest adaptation (host look, our scale)

Host badges are ~92px-tall menu-hero cards; our header is a slim working toolbar
(~40px content). Tripling header height would steal stage rows from the practice
surface on every screen — the opposite of what fullscreen bought us. So:

- **Keep** the host's card *grammar*: card background (`--vir-inset`), 1px `--vir-border`,
  rounded (`--vir-r-control`-family, ~10px — echoing the host's rounded-2xl at our size),
  the same content *hierarchy* (tuner: meter+note; instrument: instrument+tuning label;
  profile: avatar+streak+rank).
- **Compact** to a 32px-tall badge row (matches `.virtuoso-settings-btn` height — the
  established header icon size, Fitts-friendly and consistent with the existing family).
- This is a *density variant of the host component*, not an invented look: same order,
  same fills, same click behavior, same data — smaller box. Document the deviation in
  the build commit the way the cockpit-skin work documented its scoped radius overrides.

### Narrow-width degrade (extends the existing media-query ladder)

Protect, in order: mode nav > instrument selector > ⚙ > profile > tuner > tagline.

| Breakpoint | Change |
|---|---|
| ≤1200px (existing) | tagline drops (unchanged) |
| ≤1120px (existing) | instrument badge label shortens via the existing `data-short` mechanism (reuses today's `#virtuoso-setup-label` trick); **profile badge drops its text → avatar-only** |
| ≤1000px (existing) | mode segments go icon-only (unchanged); **tuner badge hides** (the tuner plugin's own floating button remains reachable — nothing is lost, only the shortcut) |
| ≤880px (existing) | mode bar → `Mode ▾` dropdown (unchanged); **profile hides entirely** |

The instrument badge never hides — it is load-bearing setup identity (same reason the
old Setup button survived every breakpoint).

---

## 2. The merged instrument selector

### Badge (closed state)

- Reuses `#virtuoso-setup-btn` / `#virtuoso-setup-label` / the existing popover wiring
  (`toggleSetupPopover`, screen.js ~17651) — **restyled, not renamed**, so `bind()` and
  the `data-short` degrade keep working untouched.
- Label format mirrors the host badge's content hierarchy: **`Guitar · 6 · Drop D ▾`**
  (instrument · strings · tuning name). Today's "Guitar · Standard" already half-does
  this; add the string count.
- Style: the compact badge recipe from §1 (inset card + border + radius), active/open
  state = `--vir-accent` border (today's `[aria-expanded="true"]` rule, unchanged).

### Panel (open state) — host panel skeleton, Virtuoso content absorbed

Row order (top → bottom), mirroring the host `instRow` layout (label left, control right):

1. **Instrument** — chip row `Guitar | Bass | Piano(disabled)`. Reuses
   `.virtuoso-instr-btn` + `syncInstrumentFamilyButtons()`. Piano stays our gated chip
   exactly as today (the host model has no piano; piano is **local-only** — see §5).
2. **Strings** — count chips per family. Host `STRING_COUNTS` is *identical* to ours
   (guitar 6/7/8, bass 4/5/6) — `syncStringCountChips()` unchanged.
3. **Tuning** — `#virtuoso-tuning-select`, now populated from **both** sources:
   - Host named tunings for `<instrument>-<count>` from `GET /api/tunings` (listed
     first — these persist *by name* host-side and sync to the tuner plugin).
   - Virtuoso curated extras from `TUNING_PRESETS` not present host-side (drop C/B,
     DADGAD, open G/D, BEAD, high-C…), under a `───` option-group separator.
   - `Custom…` last, as today.
   De-dup by resolved MIDI array (host offsets + E-standard base → absolute MIDIs; same
   low-first index both sides, so it's a direct per-string map). When both sides define
   the same tuning, the host's *name* wins in the list; Virtuoso's `offset:true` intent
   tag still applies (it's keyed by resolved MIDIs in our layer, invisible here).
4. **Custom tuning editor** — unchanged block (`#virtuoso-custom-tuning`, note inputs
   low→high, `+ Save tuning…` to our `/api/plugins/virtuoso/tunings` CRUD). Additionally
   write-through to host settings as a custom offset array (§5).
5. **Tune…** row — our target-aware tuner entry stays here, unchanged position
   (established ruling: tuning *identity* lives in this panel, so the tool that gets the
   physical instrument into that tuning lives here too). **Remove the courtesy
   `Floating tuner ↗` button from this row** — the new header Tuner badge *is* that
   affordance now, in the host's own position; keeping both would be duplication.
   Relabel our entry **"Tune to this tuning…"** so the header tuner (generic chromatic)
   and ours (target-aware) stop reading as unexplained duplicates — this resolves the
   2026-06-21 presentation gap.
6. **Dropped from the host panel:** the Pathway select (host areas — not our concept)
   and the Reference-pitch slider (v1: the host settings screen owns it; we *read*
   `reference_pitch` for future tuner display use but render no control — see open
   question Q2).

**Hidden plumbing stays byte-identical:** `customOpenMidis`, `keyNominal`,
`tuningOffset`, `anchorStation` (the `form="virtuoso-controls"` hidden inputs inside the
popover) must survive any markup reshuffle — they are how tunings reach `readConfig()`.
Verify by grep after the build.

**Whole-pane note (rule 3):** the panel keeps the existing popover chrome
(`.virtuoso-setup-popover` surface/border/shadow) and the `.virtuoso-tuning-row`
label-left grid — we adopt the host's row *order and content model*, not its Tailwind
classes. Colors stay `--vir-*` tokens; dark `color-scheme` select styling already
handles the dropdown (design-system §8).

---

## 3. Tuner badge

- **Click = `window.tuner.toggle()`**, feature-detected exactly like the host badge; if
  `window.tuner` is absent the badge does not render (no dead control — honesty rule).
- **Display** (compact mirror of the host card): a small vertical/segment meter glyph +
  the live note name. Subscribe `hostBus().on('tuner:frame', cb)` → `{note, hz, cents}`;
  when no frames are flowing (tuner closed), show the resting glyph + "Tuner" label —
  matching the host card's idle state, at our scale. No hz sub-label at 32px (fold it
  into the `title` tooltip: "Open Tuner — 440hz").
- **Never** re-implement detection or draw on the tuner's surfaces — launch + passive
  frame display only (the borrow boundary that kept our target-aware tuner legal).
- Relationship to ours: header badge = the player's *generic chromatic* tuner (host
  standard, host engine, host UI); Setup-panel `Tune to this tuning…` = the
  *target-aware* verify-each-string tuner on our pitch strip. Two jobs, two entries,
  now visually distinct (header icon-badge vs in-panel labelled row).
- **No audio is emitted by the badge itself** — it opens the host tuner UI; mic-in only.

---

## 4. Progress chip hiding + the P-sheet affordance

- **Mechanism: CSS-hidden, not removed.** Add the `hidden` attribute to
  `#virtuoso-progress-strip` in `screen.html` plus a CSS guard
  (`.virtuoso-progress-strip[hidden] { display: none !important; }`). All wiring stays
  live and harmless: `syncProgressStrip()` (~24226), `syncCrest()` (~23761), the
  `chip-open` toggle (~16338), and the click/keydown bindings (~25378) keep writing to a
  hidden element. Zero JS surgery; un-hiding when the profile-merge design lands is a
  one-attribute revert.
- **P-sheet affordance moves into the ⚙ menu** as a labelled menu item —
  **"Progress (P)"** — placed above "Keyboard shortcuts". Rationale: opening P is a
  low-frequency ambient check; a labelled menu item preserves recognition-over-recall
  without spending header width, and the `P` hotkey + the session-end auto-present
  (`presentSessionSummary`) remain the primary paths. Rejected alternative: hanging P
  off the new profile badge — that badge *navigates away* to the host profile screen;
  overloading it with an in-place sheet would make one control do two opposite things.
- **Crest/streak fallback:** interim loss of the ambient header streak is acceptable and
  guardrail-safe (§13: absence is silent; streaks never nag). The data still surfaces in
  the P sheet itself and in the session-end summary card. The host profile badge shows
  the *host* streak — do not restyle it to imply it is Virtuoso's practice streak.

---

## 5. Profile badge + sync design

### Profile badge

- **Compact mirror**: avatar (16–20px) + streak + Mastery Rank text, fetched from
  `GET /api/profile` + `GET /api/profile/progress`; dB wallet omitted at this scale
  (fold into `title`). Data read-only — we never write profile state.
- **Click → `goScreen('v3-profile')`** (the §12 host-aware navigation accessor —
  `hostBus().navigate` / `window.showScreen`; same path the ⚙ "Plugin settings ↗" item
  uses). Never monkey-patch. If playback is running, route through the same
  leave-screen path existing navigation uses (the AudioContext-sharing gate already
  handles backgrounding).
- **`!onboarded` → render nothing** (exact host behavior). Endpoint 404/absent/error →
  render nothing. The header must look intentional without it (the cluster just ends at
  the instrument badge).

### Instrument sync — read / write / react

**Read (on screen show + first bind):**
1. `GET /api/settings` → `{instrument, string_count, tuning, reference_pitch}`.
2. `GET /api/tunings` → named tuning table per `<instrument>-<count>`.
3. Map to Virtuoso state: `instrument`+`string_count` → family/count chips; `tuning`
   (name → offsets → absolute MIDIs via the E-standard base for that family/count;
   custom offset-array → absolute MIDIs directly) → match against `STRING_SETUPS` /
   `TUNING_PRESETS` MIDIs (the existing resolution path) → either a preset selection or
   `customOpenMidis`. **Same low-first string index both sides — direct `i→i` map, no
   reversal.**

**Write (on user change in our panel):**
1. Apply locally first (Virtuoso stays functional regardless of host write success).
2. `POST /api/settings` with the patch — **mirror the host's own commit discipline**
   (`badges.js saveSettings` ~L196): only on an accepted response (HTTP ok and no
   `{error}` body) do we (a) treat host state as updated, (b) call
   `hostBus().workingTuning.setCurrentInstrument(instrument, stringCount)`
   (feature-detected), (c) emit `instrument:changed` with the host's exact payload shape
   `{instrument, stringCount, tuning, pathway}` (echo the host's stored `pathway`
   untouched — we dropped the *control*, not the field). The host's own `saveSettings`
   also pushes to the tuner plugin's config; ours should POST the same
   `/api/plugins/tuner/config {lastInstrument, lastTuning?}` mirror (named tunings only —
   custom arrays have no name, skip `lastTuning`, exactly as the host does).
3. Reverse tuning mapping: our selection's MIDIs match a host named tuning → POST the
   name; otherwise POST the custom offset array (`ourMidis[i] − eStandardMidis[i]`).

**React (external changes while Virtuoso is open):**
- `hostBus().on('instrument:changed', handler)` → re-read `/api/settings`, re-apply.
- **Echo guard:** set a short-lived `_selfEmit` flag around our own emit and ignore the
  bounce (or compare incoming payload to current state and no-op on equality).
- Unsubscribe/re-subscribe safely on re-bind (idempotence — no listener stacking).

**Precedence rules (the anti-leak line):**
- Host settings are the source of truth for the player's *own* guitar/bass identity —
  on entry, host wins over `localStorage`-remembered Virtuoso setup.
- **Per-rung tuning overrides never write to the host.** A pathway's `customOpenMidis`
  / anchor adaptation is exercise-scoped chart plumbing (already anti-leak defaulted in
  `applyPathwayConfig`); only *user-initiated panel changes* POST to `/api/settings`.
- **Piano never POSTs** — host `STRING_COUNTS` has no piano; pushing it would corrupt
  the host badge. Piano selection (when it un-gates) stays Virtuoso-local, and the
  header badge label shows it without the host round-trip.

**Failure modes:**
- `/api/settings` or `/api/tunings` unreachable (older host, headless smoke oddity,
  network) → panel behaves exactly as today: `STRING_SETUPS` + `TUNING_PRESETS` +
  Virtuoso's own persistence. Write-throughs are skipped silently; a one-shot
  console.warn, never a user-facing error.
- Virtuoso's own `localStorage`/preset persistence is retained as the offline cache —
  it is what makes the standalone/degraded path identical to today's behavior.

---

## 6. Degrade when host globals are absent

Each element **feature-detects independently and hides cleanly** (the `ptAvailable()`
pattern):

| Element | Requires | Absent → |
|---|---|---|
| Tuner badge | `window.tuner.toggle` (+ optional `tuner:frame` via bus) | badge not rendered |
| Instrument badge | nothing (host endpoints optional) | renders always; host sync skipped |
| Profile badge | `GET /api/profile` ok + `onboarded` + a navigate path | badge not rendered |

**Smoke-host assumption — verified server-side, flagged client-side:** the headless
smoke host runs the same FastAPI (`/api/settings`, `/api/tunings`, `/api/profile`
confirmed present in `server.py`), so the *sync* paths are exercisable in smoke.
Frontend globals are less certain: `window.tuner` exists only when the bundled tuner
plugin loads, and `v3Progression`/profile-onboarding state depends on the smoke
profile. **Do not let any smoke suite assert the badges exist** — assert only that the
header renders and the instrument badge works with sync on/off. A `probe-topbar-*.mjs`
should verify the real desktop presents all three (⭐ standing lesson: smoke mocks can
ship real-host bugs green).

---

## 7. Build order + verification notes

1. Progress-chip hide + ⚙ "Progress (P)" item (independent, zero-risk, lands first).
2. Header regroup: move `.virtuoso-header-setup` into the new right cluster; compact
   badge restyle of the setup button (IDs preserved).
3. Tuner badge (feature-detected launch + frame display).
4. Profile badge (fetch + navigate + `!onboarded` gate).
5. Instrument sync layer (read → write → react, in that order; each step degrades to
   the previous).
6. Remove `#virtuoso-tuner-ext` from the Setup panel + relabel `Tune…` (rides step 3).

After each step: `node --check screen.js`, then grep every touched ID
(`virtuoso-setup-btn`, `virtuoso-setup-label`, `virtuoso-tuning-select`,
`virtuoso-custom-open-midis`, `virtuoso-progress-strip`, `virtuoso-tuner-ext`,
`virtuoso-tune-btn`) to confirm wiring integrity; full smoke suite; no host global
monkey-patched; no second transport/player/tuner engine introduced.

## Open questions for Christian

- **Q1 — Reference pitch:** surface the host's 430–450hz control in our panel (full
  host-panel parity) or leave it to the host settings screen (my default: leave it out
  in v1; our audio engine doesn't consume it yet, and a control that changes nothing
  audible violates the count-in honesty rule)?
- **Q2 — Header streak source:** the profile badge shows the *host* streak while our
  practice streak hides with the progress chip. Fine for the interim, or should the
  profile-merge design be scheduled sooner because two streak definitions will coexist
  invisibly?
- **Q3 — Handedness:** the host persists `localStorage['lefty']`; Virtuoso has its own
  lefty display pref in the bundle prefs. Sync them (host wins on entry) or keep
  independent? Default: read host `lefty` as the *initial default* only, never
  write it.
