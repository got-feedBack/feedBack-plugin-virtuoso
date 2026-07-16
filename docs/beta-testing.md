# Beta builds — `Virtuoso (Beta)`

Virtuoso ships on two channels:

| Channel | Branch | Plugin id | How users get it |
|---------|--------|-----------|------------------|
| **Stable** | `main` | `virtuoso` | Bundled with FeedBack Desktop **and** auto-updated to `main` HEAD by the host's `update_manager` (the host only ever auto-ships the default branch). |
| **Beta** | `virtuoso-beta` | `virtuoso_beta` | **Opt-in manual install** of the `virtuoso-beta` branch (below). The host cannot auto-update anyone to a non-default branch — that's what keeps beta opt-in. |

The beta is a **renamed mirror of `main`** (or a feature branch via `--source`): every `virtuoso` token (plugin id, on-screen element ids, `/api/plugins/virtuoso/…` URLs, storage tables, localStorage keys) is swapped to `virtuoso_beta`. That distinct identity is what lets it install **alongside** the stable build — FeedBack keys plugins by `id` and inlines every plugin screen into one shared page, so two `virtuoso` installs would collide (registration + duplicate DOM ids). With a different id they coexist: two nav entries, fully independent (own settings, own saved presets, own progress). Proven side-by-side via `.claude/skills/run-virtuoso/probe-coexist.mjs`.

---

## For testers — install the beta next to stable

You keep your normal Virtuoso; the beta appears as a **second** entry, **Virtuoso (Beta)**, so you can A/B them on the fly.

**1. Find your FeedBack plugins folder**
- Windows (Desktop): `%LOCALAPPDATA%\Slopsmith\plugins`
- (Other platforms: the `plugins/` dir of your FeedBack install.)

**2. Clone the beta branch into it** (one time):
```bash
git clone -b virtuoso-beta https://github.com/got-feedback/feedBack-plugin-virtuoso virtuoso_beta
```
Restart FeedBack. You'll now see **Virtuoso** and **Virtuoso (Beta)** in the menu. The beta's version badge reads `…-beta.N`.

**3. Update to the latest beta** whenever asked:
```bash
git -C virtuoso_beta pull
```
…then restart FeedBack.

**If it ever gets stuck / won't load:**
```bash
git -C virtuoso_beta fetch origin
git -C virtuoso_beta reset --hard origin/virtuoso-beta
```

**Notes**
- The beta is **independent** — it can't touch your stable install's settings or saved presets.
- The beta is where new work lands *before* it's promoted to stable, so expect rough edges. That's the point — **tell us what breaks or feels off** (Discord / GitHub issues).
- To remove it: delete the `virtuoso_beta` folder and restart.

---

## For the maintainer — cutting & promoting

**Cut / refresh a beta** (after landing your work on `main`, the single trunk since the 2026-07-16 consolidation):
```bash
git push origin main                    # beta is built from the latest COMMIT on the source ref (default main)
node scripts/cut-beta.mjs --push        # regenerate the renamed tree → commit + push virtuoso-beta
```
To let testers run **WIP alongside stable**, cut from a feature branch instead: `node scripts/cut-beta.mjs --push --source feat/my-branch`.

`cut-beta.mjs` builds from the committed source tree (default `main`; tracked runtime files only — no `.claude`, docs, ROADMAP, agent-memory), auto-bumps the version to `X.Y.Z-beta.N` (the base `X.Y.Z` comes from `plugin.json`, stripped of any `-dev`), and commits a snapshot to `virtuoso-beta` so testers' `git pull` stays fast-forward. Flags:
- `--dry-run [dir]` — write the renamed tree to a temp dir and inspect; no git.
- `--version 0.7.6-beta.3` — force a version.
- (no `--push`) — commit to the local `virtuoso-beta` branch only; push later.

When you bump `plugin.json` to a new base (e.g. `0.7.7-dev`), the beta counter resets to `0.7.7-beta.1`.

**Promote a beta to stable** (the usual release ritual):
1. Land the work on `main` (short-lived feature branch → PR → merge when green).
2. Bump `plugin.json` `version` to the clean `X.Y.Z` **and** the `VIRTUOSO_VERSION` constant in `screen.js` to match (the host caches by id+version; the badge is mirrored by hand).
3. Tag, Discord post, README/GitHub page update.
4. The host's `update_manager` ships `main` HEAD to all updaters.

See also: `project_host_release_v029_audit` (main = published artifact), `project_dev_install_github_and_test_env` (the dev/test layout).
