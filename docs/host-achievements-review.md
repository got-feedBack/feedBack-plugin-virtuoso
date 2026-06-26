# fee[dB]ack Online Achievements — Review & Recommendations

> **For:** Byron (FeedBack host) · **From:** the Virtuoso plugin team · **Date:** 2026-06-24
>
> Feedback on your "fee[dB]ack Online Achievements — Epic Design & Plan." We ran it
> past five specialist lanes — gamification/engagement, host-compatibility,
> operability/release, learning-design/pedagogy, and market/strategy — and the read
> was strikingly consistent across all five, so this is consensus, not one opinion.
> Written shareable; nothing here blocks you, it's a peer review.

---

## TL;DR

**The architecture and privacy model are genuinely strong — keep them. The two things to change are the catalog and the public wall:**

1. **Rework the catalog from counts to competencies.** "Hit 100,000 notes" / "500 in a
   session" / "250-note streak" reward *volume and attendance*, not skill. Four
   independent lanes flagged this as off-mission. It's a `achievements.json` edit, not
   an architecture change.
2. **Don't ship the hosted public count-wall now — and never count-based.** It's
   expensive, ops-heavy, legally amputated, and (per market) me-too-at-best in this
   category. Ship the **local** engine first; if a public surface ever ships, make it
   competency-based and/or a user-initiated share-card, not a names-list ranked on grind.

Everything below expands these and adds concrete corrections.

---

## What's strong — keep as-is

These came up as wins independently across lanes; worth stating plainly:

- **Privacy model.** Opt-in default-OFF, self-serve removal keyed by `player_hash`,
  earned-only display (no locked "0 / 100,000" grind-bars), zero song/library data on
  the wire. This is ahead of where most shipped social features land.
- **The split** (local offline plugin + separate hosted service) is the right reading of
  Principle I, and the local half is idiomatic FeedBack — `setup(app, context)`,
  `settings.server_files`, CONFIG_DIR-owned SQLite all check out against current host
  conventions.
- **Trust-posture honesty** — "client token = obfuscation, not security; spoofing is
  low-stakes" is the correct call for the unlock data itself. Don't over-engineer it.
- **Data-minimization contract** is the right instinct (see operability for how to make
  it *enforced* rather than promised).

---

## The catalog: reward competency, not volume

This is the headline. The starter catalog rewards the opposite of deliberate practice,
and it does so on the *loudest, most public, most social* surface in the product.

| Achievement | What it credits | Verdict |
|---|---|---|
| `notes_10k` / `notes_100k` / `notes_1m` | Cumulative note *volume* | ❌ Pure time-on-task. A metronome left running earns it. Zero skill signal. |
| `session_500` (500 notes in one session) | Single-session *volume* | ❌ Rewards a long undifferentiated grind — the textbook massed-reps anti-pattern. |
| `streak_250` (250-note streak) | Consecutive hits without a miss | ⚠️ Weak proxy. Accuracy-gated, but rewards playing something *easy enough not to miss* — it trains risk-aversion at the moment learning needs risk-tolerance. |
| `paths_3_lv5` (three paths to level 5) | Breadth across paths | ✅ The one on-mission item — *if* "level 5" is itself competency-gated downstream. |
| `secret:true` entries | Unknown | Secrets should hide *what's fun to discover*, never *how much you have to grind*. A secret count-milestone is the worst of both. |

**Why it matters (not just purism):** a public, count-based wall is a values signal. It
tells the community "the player to admire logged the most notes," not "the player who can
cleanly play a ii–V–I in five keys." A learner optimizing the wall will rationally play
*more, easier, and more repetitively* — exactly what good practice pedagogy warns against
(Goodhart's law in miniature).

### The fix is a catalog swap, not a rebuild

Re-point the catalog at *demonstrated skill*, which the host already receives events for.
On-mission archetypes (all stay generic — no song/library data):

1. **Clean-at-tempo** — cleanly clear a skill at a target tempo tier (proof you can
   actually play it, not that you played it a lot). Tiered Slow → Push.
2. **Breadth** — demonstrate *N distinct* competencies (same skill twice doesn't count).
   This is "three paths to level 5" done right.
3. **It travels** — demonstrate one competency in *N* transposed contexts/keys. Credits
   *transfer* — the literal goal — and is unfarmable by repetition.
4. **Growth-streak** — a streak of *days that each contained a real advance* (a new PB, a
   new key, a tier cleared), not a streak of notes. Keeps the habit hook; gates it on
   growth, so you can't protect it by looping easy material.
5. **New personal best** — raised your own bar on a tracked metric. Self-referential, so
   "play more = win" can't game it.
6. **Scaffolds-off mastery** — demonstrate a skill with the supports removed / applied in
   a jam. The top of the easy→mastery arc.

**One-line litmus for any future achievement:**
> *"Could a learner unlock this by looping something they already mastered?"*
> If yes, it's volume — private flavor stat at most, never the public wall.

If pure note-counts must stay for the "you've put in the hours" feeling, **demote them to a
private local stat** ("miles travelled"), explicitly *off* the public competitive wall.

---

## The public wall: scope, positioning, legal

The local engine and the hosted wall are very different bets. The local engine is cheap and
table-stakes; the wall is the expensive, legally-sensitive, off-mission half.

- **Positioning (market lane).** Badges are table-stakes — nobody picks a practice tool for
  its badge list. But a public *count/ranked* surface reads as the Rocksmith / Yousician
  "feels like a game, doesn't teach me" aesthetic — the exact thing a serious practice tool
  positions *against*. In the comps, the public name-wall correlates with the "gaming the
  detector / metrics over learning" complaint; tools like Melodics and Justin Guitar
  deliberately avoid one. Strava works only because *distance is the accomplishment* and the
  layer is cooperative-cheer — "notes hit" is not the accomplishment; skill is.
- **The legal constraint amputates the compelling version.** The §1204 / data-minimization
  rule means the wall can publish *only* the off-mission grind metric and is *barred* from
  the on-mission one ("mastered [X]"). A wall that can only ever show generic counts is a
  vanity ledger users won't even screenshot.
- **It's nearly un-measurable.** The same data-minimization contract that protects users
  means the server keeps almost nothing — so you can't actually prove the wall drives
  retention. Carrying standing ops cost (uptime, display-name moderation, anti-farm, GDPR,
  §1204 liability) for a feature you can't measure is a weak trade.

**The 80/20:** ship the **local** achievements engine (trophy shelf, earned-only). If you
want a shareable/social hook, prefer a **user-initiated competency share-card** — the user's
own card on their own channel — which gets the dopamine and organic acquisition with *no*
public service, no names-list, no moderation surface, and (crucially) it *can* show
competency because it isn't an operator-hosted public property.

---

## How this fits with what already exists

There's overlap with Virtuoso's progression layer, but it's **different altitude, not
duplication** — and it surfaces a real seam you'll want to decide on purpose.

- **Virtuoso's layer** is practice-specific, competency-named, and **fully local**
  (`virtuoso.progress` in localStorage; no network, no account). Its first principle is
  *"credit names skills — a rung cleared, a key carried, a pocket held — never rounds, time,
  or attendance; reps are recorded but advance nothing."* That's our USP, and it's the exact
  philosophy your starter catalog inverts.
- **Your layer** is host-wide, cross-plugin, count-based, sourced from `note:hit` / `/api/stats`.

### The three-tally seam

The host *already* tracks `profile_progress.current_streak` / `best_streak`, an `xp_profile`,
and `player_paths`. Add achievements counters on top and there's a risk of **three
uncoordinated tallies**. Concretely today: `paths_3_lv5` reads the **host's** progression
paths, **not** Virtuoso's ladder — so a player who practises 30 days in Virtuoso earns
*nothing* toward it and shows a host streak of 0. Worth deciding how achievements layer *on
top of* the existing host counters rather than forking a third.

### The integration rule: emit raw activity, never launder competency

Two things that look like a contradiction but aren't:

- **Fine / free:** Virtuoso (or any plugin) emitting raw *activity* — `note:hit` / `/api/stats`
  — so the host's generic counters and your `notes_*` achievements light up.
- **Not fine:** converting a *competency* event ("cleared the Push rung in 2 keys") into a
  count-achievement tally. That launders a skill claim into an activity number and
  re-contaminates the anti-score design on both sides.

So the clean sequence: **Virtuoso stays out of the count-wall.** If you rework the catalog to
the competency archetypes above, Virtuoso can then feed it through events it *already emits*
(`virtuoso:tier:unlocked`, `virtuoso:progress`) and the host progression-contributor path —
no third tally, and the wall gets richer, on-mission signal for free.

---

## Host-surface corrections (verified against host v0.3.0)

You're clearly reading current source — most refs are accurate. The real issues:

| Claim in the doc | Status | Note |
|---|---|---|
| `window.slopsmith.on('note:hit')` | ⚠️ Drifted | Bus is `window.feedBack`; `slopsmith` resolves only via a **legacy alias** that has already been removed for viz/desktop globals (`feedBackViz_*`, `feedBackDesktop` have none). Use `window.feedBack.on('note:hit', …)`. |
| `slopsmith-demucs-server` as the **Render** template | ❌ Wrong deploy shape | It's FastAPI + uvicorn but **systemd-deployed** (a `.service` unit), *not* Render — there's no `render.yaml` in it. Cite it as the *FastAPI app* shape only. |
| `hexterra-website/render.yaml` static-wall template | ❌ Unverifiable | Not in the shared clone catalog, so the Render + Postgres deploy story can't be ratified from our side — treat it as proposal, not proven pattern, or point at a clonable repo. |
| `plugin.json` registration | ⚠️ Add `settings.category` | New in v0.3.0 — without it the Privacy toggle lands in the generic Plugins tab instead of a real settings tab. |
| `note:hit` / `note:miss`, `static/v3/*`, `stats-recorder.js` → `/api/stats {hits,misses,bestStreak}`, `progression-core.js` → `progression:path-level-up`, `profile` table + `player_hash`/`player_salt`, plugin `config_dir`, outbound `requests` in `lib/lyrics_transcribe.py` | ✅ Correct | All real. Note `note:hit`/`note:miss` exist only when **notedetect** is installed (deferred capability). `player_hash` is already commented as the host's future-leaderboard identity — **reuse it**, don't mint a new one. |
| Line refs (`loadSettings` ~3229, `_RESETTABLE` ~5609, profile wizard ~263-310, plugin context ~3449-3486) | ⚠️ Drift 5–100 lines | Cosmetic — you're a hair behind HEAD (e.g. `loadSettings` is `app.js:3328`, `_RESETTABLE` is `:5613`, `load_sibling`/`log` are injected per-plugin in `plugins/__init__.py`, not the global context dict). |
| `progress.js` "new `progress:rendered` emit" | ✅ Correctly framed as new | It doesn't emit that today — honestly labeled as new work. |

---

## Operability must-fixes (if/when the wall ships)

The core shape (local SQLite + at-least-once queue + idempotent upsert + opt-in +
removal-by-hash) is sound. Three gaps are mandatory before shipping the networked half:

1. **No 4xx should ever permanently drop an unlock.** "4xx-except-429 → drop" silently eats
   an earned unlock on a schema mismatch or a transient 403. Use a `dead_letter` state and
   keep the row (diagnosable, replayable). The only things that should remove a queued
   unlock are a server ack or a user opt-out.
2. **Make data-minimization a *code gate*, not prose.** One explicit-dict serializer that
   builds `{display_name, player_hash, achievement_id, unlocked_at}` literally (never
   `dict(row)` / `**model`), plus a test asserting the outbound payload key-set is *exactly*
   those four — it goes red the day a fifth field sneaks in. Also scrub client IPs from the
   Render/uvicorn **access logs** (schema-clean ≠ log-clean; "no IP retention" has to cover
   the platform log, not just the table). This is the single highest-value item: it's the
   first practice data to leave the device in this ecosystem, on a service carrying your name.
3. **Removal = immediate-local + idempotent-wall.** Delete local data *unconditionally* on
   opt-out (don't gate it on the network — an offline opt-out must still wipe local), make the
   wall removal delete *all* rows for the hash and succeed on zero rows, and order it so a
   still-queued unlock can't resurrect a removed hash. Reuse this as a **takedown-by-hash**
   moderation path — impersonation under a real name on an operator-hosted public wall is the
   one trust risk that's above "low-stakes," and the hash-suffix disambiguation helps machines
   but not the human reading the wall.

Lower-priority, fine with a documented constraint: in-memory rate-limit lost on dyno restart
(acceptable), single-instance assumption (pin it, write it down), `GET /api/wall` cold-start
(`200 []`, not 500; a short TTL cache beats event-driven invalidation), and a real migration
tool for managed Postgres (you can't just delete the file like SQLite).

---

## Recommended sequence

1. **Local achievements engine, competency catalog.** Counters + unlock eval + earned-only
   Progress display, fully offline. Swap the catalog to the skill archetypes above. This is
   the 80/20 and it's on-mission.
2. **Opt-in + settings + removal UI** (core PR), with the data-minimization code gate baked
   in from the start.
3. **Public surface — reconsider before building.** If it ships, make it competency-based
   and/or a user-initiated share-card, with the three operability fixes in place. Decide the
   host-counter / identity story (reuse `player_hash`; don't fork a third tally) up front.

---

*Net: the system is good and worth building locally; the count-catalog and the public
count-wall are the off-mission parts. Swapping "how much did you play" for "what can you now
do," and cutting/cooperative-izing the wall, makes this reinforce practice instead of
competing with it — at the cost of catalog edits and a scope decision, not a redesign.*
