# Track-Architecture Rethink — roundtable spec (2026-06-14)

**Status:** DESIGNED, awaiting build go-ahead. Christian's call: the fixed track model is too rigid
("Rhythm and Keys aren't clearly defined; don't limit to ~5 tracks — some genres need more or
fewer"), and — the reframe that reshaped the whole design — **the architecture must AUGMENT THE
PLAYER and THEIR ROLE in the genre, not be a jukebox.** Scoped to **all genres + all player
instruments (guitar/bass now; drums + piano + others coming)**.

**Panel (11 agents, main-thread synthesized):** feedback-compatibility · audio-engine-architect ·
virtuoso-ux-designer (the technical layer); learning-design-architect (CHAIR of the role model) ·
guitar/bass/drum/piano-pedagogy (the player's role per instrument) · bluegrass/jazz/funk-idiom
(three role archetypes). Per-agent detail in `.claude/agent-memory/<agent>/`.

---

## The problem (one root cause)

6 fixed mixer strips (Guide·Rhythm·Keys·Bass·Drums·Click) hardwired 1:1 to 4 fixed backing lanes
(comp·pad·bass·drums). **Both of Christian's complaints are the same bug:** the strips are generic
*bus slots*, not *band members aware of their role relative to the player.* A bluegrass banjo gets
routed onto the `harmony` bus and labeled "Rhythm"; afrobeat's two interlocking guitars can't even
be expressed (one comp lane); and nothing models *what each instrument is doing for the player.*

---

## The heart of the design — a PLAYER-RELATIVE band model

Every band track carries **two** fields (today it has roughly one):

### 1. `bandRole` — what the instrument IS, musically
`comp · bass · kit · auxperc · lead · pad · timekeeper`, each in a **class**:
- **foundation** (bass, kit, the latin clave/bell) — *cannot go silent except a deliberate break*;
  it changes **posture/intensity** (lock → half-time → breakdown → fill → trade), never presence.
- **color** (pad, horn, tambourine, vibes) — *can* go fully silent for a section.

*(Naming: call it `bandRole`, not `role` — `role` is already overloaded in `screen.js` for the
pathway-rung purpose AND the backing-lane type. — piano-pedagogy.)*

### 2. `stance` — what the track is TO THE PLAYER (the new primitive)
Default **`support`**; it changes by section, driven by a **`whoHasFloor`** token (below). The
reconciled stance set across all lanes:

| stance | meaning | who flagged it |
|---|---|---|
| **support** | active backing — the floor the player rides | all |
| **space** | thin / leave room under a soloing player | jazz, guitar |
| **layout** | *silence by arrangement* — produce NOTHING because the player covers this job (drop-doubling). NOT "low volume" — a quiet double still muddies the register and still does the player's creative work | piano |
| **trade** | turn-taking dialogue with the player (trading fours) | jazz, all |
| **feature** | the BAND has the floor; the **player accompanies** it (the under-taught half) | learning-design, jazz |
| **unison / harmonize** | double or harmonize the *player's own line* | guitar, learning-design |
| **protagonist** | the player's own part — a first-class track the band orients around | learning-design |

### 3. The mechanism — `whoHasFloor` + the section mask
Jazz's elegant insight: a single **`whoHasFloor`** token moves around the form; **every track reads
it each bar** (`floor==me → lead; me in trade.partners → trade; else → my default stance`). No track
needs to know about any other. **This already half-exists:** `ARRANGEMENT_RECIPES.ensemble:{role:
on|off|auto}` + the `tier` (sparse/groove/full) are described in-code as "the alive-band SECTION
mask the Jam/section FSM will consume," and `ARRANGEMENT_BASE.ensemble.lead:'auto'` is the unused
seed of the player's own slot. The shipped **Jam J-3 Spotlight** (`087b9b5`) is this exact taxonomy
with one stance pair (`feature`/`support`) already wired — **we generalize a working primitive.**

### 4. The band reads the player's CHART, never their live audio
Deterministic, offline, in-engine. Reactive audio-follow is host territory and hides drift.
*Augmenting the player's role ≠ chasing the player's audio.* (learning-design + bass + the backing-doc §6.)

---

## Two genre MODES the stance model must cover

The panel's biggest structural finding — "backing unless trading" is the **solo-genre** model only:

- **solo-and-back** (jazz, bluegrass, blues, country): a **rotation** passes the lead around the
  form; under the soloist the band **THINS** (`support→space`) but keeps time; the payoff is the
  **"everybody hits 1"** unison re-entry. Bluegrass is the explicit case (the "break" rotates
  banjo→fiddle→guitar→…; a G-run is the "your turn" seam).
- **groove-lock** (funk, afrobeat, reggae, disco, latin): co-equal **interlocking** parts serving
  one pocket — one anchor ("the one"), one subdivision, one feel-lean, complementary placement.
  The pocket **SURVIVES under a soloist** (`bandThinsOnSolo:false` — the *inverse* of jazz). (funk)

So a genre/section declares an **`ensembleMode`** (solo-back | groove-lock) that governs how
`support` behaves when the player solos. This is the one concept funk forced.

---

## The invariants (the anti-jukebox guardrails — "are we hitting the mark?")

These are the bright-lines that keep it *augment the player*, not *play a song at them*:

1. **The hole proof** (learning-design): mute the player → a *correct* band has a **HOLE where the
   player belongs.** If the band sounds complete without you, it's a jukebox. The hole is the proof.
2. **Low-end exclusivity** (bass): the foundation is **never empty and never doubled** — exactly one
   bass owns it, player OR band, never both. `playerInstrument==='bass'` ⇒ the band drops its bass
   and promotes the drums.
3. **Role-coverage drop-doubling** (piano, generalizing bass + bluegrass + guitar): *for each band
   track, if a player track covers its role in an overlapping register → that track goes `layout`.*
   This one set-operation yields: drop the band bass under a bassist, silence the rhythm guitar
   under a guitarist's break (bluegrass "duck under"), and drop bass+comp under a self-accompanying
   stride pianist.
4. **Foundation changes posture, not presence** (drums + bass): bass/kit duck *dynamics* under a
   soloist; they go silent only for a deliberate break.
5. **Never graded** — the band is a mirror, not a judge (the Jam rule).
6. **The band may set the bed, answer with an *authored* call, double a target, and hold the form —
   but never invent the player's line.** (learning-design's G4 bright-line.)

---

## The compound-role solution (one instrument, multiple roles)

A pianist is LH bass + RH comp; a fingerstyle guitarist is bass + melody. **Model as TWO tracks
sharing a `performer` id + a `coupling` group — NOT a single compound-role field.** (piano)
This keeps single-valued `bandRole` per track (drop-doubling stays a clean set op), lets LH/RH
**trade independently** (RH solos while LH keeps the bass = stride), and the `coupling` record
carries the "one body" constraints (cross-hand span, keyboard no-unison). Generalizes to fingerstyle.

---

## The one genuinely missing engine primitive: AUXPERC

Percussion that is **not the kit** must be **its own tracks** — because *one track = one human*, and a
drummer cannot play kit + congas + shaker at once. Today the engine **fakes** it (the clave is a
`snare_xstick` lane; the tambourine is `hh_open`) — fine for a single-drummer rock/pop band, broken
for percussion-rich genres. (drums)

A two-layer model: a `drumkit` track + **0–3 `auxperc` tracks** (each a step-string lane like a kit
groove, on a shared `perc` bus):

| aux track | role | voices | genres |
|---|---|---|---|
| timekeeper | the master clock | clave, cowbell, agogô, bell | latin, afro, some funk |
| hand-drum | the conversation | congas (tumbao), bongos, djembe, surdo | latin, afro |
| shaker/scraper | the continuous texture | shaker, cabasa, güiro, tambourine | latin, afro, funk, pop |

Most genres use 0–1; salsa/afrobeat justify up to 3. Retire the kit-fakes into real aux tracks for
the percussion-rich genres; keep them only as the cheap single-drummer approximation.

---

## Missing INSTRUMENTS (the survey Christian asked for, ranked by cross-genre payoff)

Current palette: sampled banks (shiny/8ridge/salamander/emily/wurli/cp80/banjo + the kit) + GM/WAF
voices (piano/epiano/clav/organ/nylon/guitar/clean/upright/bass/strings/brass/synthlead/pad).

| Missing | Unlocks | Note |
|---|---|---|
| **Horns** — tenor sax FIRST, then trumpet/trombone (a *section*) | funk·soul·ska·jazz·Motown·afrobeat·NOLA | **the keystone** — flagged #1 by BOTH jazz and funk. Without a non-player lead voice, "player as comper / feature" can't structurally exist. We have only a single GM "brass" patch. ★★★ |
| **Aux percussion** (clave/congas/shaker/timbales) | latin·afro·funk·reggae·NOLA | the AUXPERC primitive above; cheap, pitchless ★★★ |
| **808 / synth bass** | hip-hop·trap·modern-pop·EDM·city-pop | bass agent's #1; *synthesizable zero-asset* like our synth drums ★★★ |
| **Fiddle** | bluegrass·country·folk·western-swing·gypsy-jazz | the legato voice; a real melodic one is the engine ceiling — ship a *sustained-pad* fiddle first ★★★ |
| **Mandolin** (the chop) | bluegrass·folk | the chop IS the drumless backbeat; a forgiving one-shot ★★ |
| **A comp voice that can LAY OUT** | jazz·soul·gospel | today's comp is a sustained pad that can't go silent — `layout` needs a comp that drops ★★ |
| Pedal steel·dobro · accordion · harmonica · vibes · fretless/slap · a real string section | country·norteño·blues·jazz·fusion | the long tail ★–★★ |

*Sourcing caveat (from the sample-bank program): mandolin/fiddle/pedal-steel were license-blocked in
the CC0 hunt — they need a fresh source pass or synthesis. The 808 is zero-asset synthesizable.*

---

## HOST CHECK (rule 4, live-verified vs runtime 0.2.9, 2026-06-14)

| Capability | Host has | Verdict |
|---|---|---|
| Dynamic multi-bus WebAudio engine | `audio-mix`/`registerFader` = player-screen-bound | **BUILD** (don't bind backing buses to it) |
| Track DATA MODEL | only `studio` (a *recording* schema); no generative/sloppak track schema | **MIRROR the *vocabulary*** (instrument buckets `lead/rhythm/clean/acoustic/bass/drums/vocals/other` + `keys`/`perc`) for a free future "export my band to Band Studio" path; build our own role-graph |
| Mixer UI | `studio`'s per-track console grammar | **MIRROR** (not the single-fader popover) |

---

## Implementation layer (audio-engine + ux)

- **Data model:** a recipe gains an ordered `tracks:[]` of `{id, performer?, coupling?, instrument,
  bandRole, stance(default), generator-pointer, bus, pan, register, label}`. Legacy
  `picks:{comp,bass,drums,pad}` recipes **desugar** via `recipeTracks()` → all 29 genres stay
  **byte-identical**, opt into N tracks only when they want. No hand-rewrite.
- **2 comp lanes = 2 passes of the comp builder over the same `compileChordTimeline`** → banjo+guitar
  (and afrobeat's two guitars) are harmonically locked for free.
- **Buses:** fixed frame buses (notes/click) + dynamic backing buses from a **class-ified `trackBus`**
  (melodic/bass/drums/perc/FX classes) + the `perc` bus; mixer channels = frame ∪ active tracks.
- **Mixer UI (ux):** label by **INSTRUMENT** ("Banjo"/"Upright"), a role chip only when ambiguous;
  a **PERSONAL │ BAND │ SUM** deck that grows/shrinks (≤7 full width · 8–10 condensed · 11+ scroll);
  a genre-switch **band-reveal** (changed strips animate, a one-line band caption). Kills "Rhythm/Keys."
- **MUST land with the loop:** salted `chartRng(cfg, trackId)` (determinism breaks the moment a genre
  gains a track) + a per-window backing-voice cap (~72 voices/bar for a full band vs ~20 today).

---

## Build order (the panel's convergent recommendation)

1. **Engine core** — `bandRole`/`stance`/`whoHasFloor` model + `recipeTracks()` desugar + the
   `buildBackingEvents` track-loop + class-ified `trackBus` + salted rng + the voice cap. (All 29
   genres byte-identical; no user-visible change; smoke-backing-engine guards it.)
2. **The flagship trades** — **You↔Drums trading fours** first (the drummer's four is *pitchless* —
   sidesteps "is the band's improvised line any good"); then **band-solos / player-comps `feature`**
   (bass-native, the accompaniment-parity gap no rival tool teaches). Both reuse the Spotlight engine.
3. **Dynamic mixer UI** — instrument labels, the PERSONAL│BAND│SUM deck, the band reveal.
4. **The first multi-track band** — bluegrass (guitar boom-chuck + mandolin chop + banjo v3 + upright),
   with the rotation/break + "duck under the player" + the G-run seam. Idiom-checked.
5. **AUXPERC + the keystone voice (tenor sax)** — unlocks the groove-lock percussion genres + the
   feature/comper roles across funk/soul/jazz.

---

## Open decisions for Christian

1. **Go / phase / adjust** — build it (phased as above), review this spec first, or adjust the model.
2. **Track-label default** — instrument headline + role-chip-only-when-ambiguous (recommended) vs
   instrument + role on every strip.
3. **Scope of v1 stances** — ship the full stance set, or start with `support` + `trade` + `feature`
   (the three the Spotlight engine already proves) and add `layout`/`unison`/groove-lock as the
   bands that need them land?
