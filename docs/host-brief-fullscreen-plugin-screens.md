# Host brief — full-screen plugin screens (0.3.0 fit regression + capability request)

**For:** Byron / xasiklas (FeedBack host)
**From:** Virtuoso (practice plugin)
**Date:** 2026-06-24
**Re:** issue "0.3.0 Virtuoso Does Not Fit Properly" (MacOS) + the team thread about giving Virtuoso its own dedicated page

> TL;DR — Two things. (1) Part of the fit bug is **ours**: Virtuoso still sizes itself against the *pre-0.3.0* layout contract; we'll fix that on our side regardless. (2) The real fix the team converged on — Virtuoso as a **dedicated full-screen page** (sidebar collapsed, topbar hidden, plugin owns the viewport) — needs a **host capability** we can opt into, because plugins must not reach in and hide host chrome themselves. This doc proposes that capability, grounded in a pattern the v3 shell **already** ships (`ssFollower`).

---

## 1. What users see (the bug)

Reported on MacOS, `Main Interface > Sidebar > Virtuoso`:

- The Virtuoso UI is **cut off at the bottom** — the transport/stage run off-screen; the user must scroll down to reach them.
- There's **excess empty padding at the top**, pushing everything down under the topbar.

This is a layout/fit problem, not a functional one — the plugin works, it just doesn't fit the new shell.

## 2. Root cause — the v3 layout contract changed under us

Virtuoso was built against the **old** host layout and hard-codes three assumptions that 0.3.0's v3 shell no longer satisfies.

**Virtuoso's stale assumptions** (`screen.html`, `.virtuoso-root`):

```css
.virtuoso-root {
  /* comment in our code: "navbar is a transparent, position:fixed, 64px-tall
     bar that floats over the active screen. The host mounts plugin screens as
     bare containers at top:0 (no offset)..." */
  height: 100vh;            /* assumes the plugin IS the full viewport */
  padding: 80px 18px 18px;  /* self-clears a floating navbar */
  overflow: hidden;         /* we want NO page scroll — only our rail scrolls */
}
```

**What the v3 shell actually does now** (host repo):

- `static/v3/index.html` — `<body class="h-screen flex overflow-hidden">` makes `#v3-sidebar` (`w-64`) and `#v3-main` **side-by-side flex children**.
- `#v3-main` is `flex-1 overflow-y-auto` — i.e. it is **the vertical scroll container**, and it contains a **real `#v3-topbar` header that occupies vertical space** (not a floating overlay), *then* the screen.
- The legacy floating top `#navbar` is now `class="hidden"`.
- `static/style.css` — `.screen { display:block }` / `.screen.active { display:block }`: a plugin screen is mounted as an **ordinary auto-height block in normal flow**, below the topbar.

**So the symptoms map exactly:**

| Symptom | Cause |
|---|---|
| Excess top padding | Our `padding-top: 80px` clears a navbar that no longer floats there; the real `#v3-topbar` already sits above us, so that 80px is pure dead space. |
| Cut off at bottom / must scroll | Our `height: 100vh` forces full-viewport height, but the `.screen` block starts *below* `#v3-topbar` inside the shorter `#v3-main`. `topbar + 100vh > viewport`, so `#v3-main` scrolls and our transport falls off the bottom. |

Nothing the host did is "wrong" — the v3 shell is a clean, conventional sidebar+topbar+scrolling-content layout. The mismatch is that **Virtuoso is not a scrolling content page**; it's a DAW-style shell that needs a fixed, non-scrolling, viewport-locked stage + transport — much closer to `#player` than to `#v3-home`. That mismatch is exactly why the team landed on a dedicated full-screen page.

## 3. What the team agreed (from the thread)

- Virtuoso should be **its own dedicated page**, like the main game — not a window-in-a-window crammed into a small viewport.
- In that mode: **topbar disappears**, **sidebar collapses to icons (or a burger)**, the plugin occupies ~98% of the screen.
- **Keep a minimal profile/streak badge** from the top nav visible (OmikronApex), ideally **host-owned** so plugins don't each re-implement it.
- **Integrate with the Core's instrument selection** rather than Virtuoso carrying its own duplicate (Chris + OmikronApex agreed).
- xasiklas mentioned he wanted to implement a **"full screen" mode** that day.
- Esc / a back button returns to the main menu (consistent with the host already owning Escape).

## 4. The ask — a host "full-screen plugin screen" capability

We need the host to give an opted-in plugin a **chrome-hidden, full-viewport slot**. Plugins should **not** hide host chrome themselves (reaching into `#v3-sidebar` / `#v3-topbar` from a plugin is monkey-patching host UI — fragile and against the plugin contract).

**Good news: the v3 shell already has this exact pattern**, for splitscreen pop-outs. `static/v3/index.html` (~lines 21–62) tags the document root early and a style block hides every chrome element:

```css
html.ss-follower-pre #v3-sidebar,
html.ss-follower-pre #v3-topbar,
html.ss-follower-pre #v3-railzone,
html.ss-follower-pre #player-controls,
html.ss-follower-pre .screen:not(#player) { display: none !important; }
html.ss-follower-pre body { margin: 0; overflow: hidden; }
```

The request is to **generalize that proven mechanism** into a first-class, plugin-opt-in capability.

### Proposed shape (for discussion)

1. **Opt-in via manifest.** A plugin declares it wants the immersive treatment, e.g.
   `plugin.json` → `"screen": { "fullscreen": true }` (or a `ui.fullscreen-screen` capability).
   Virtuoso, `rig_builder`, and `editor` (the three promoted plugins) are the obvious candidates.

2. **Host toggles a root class on that plugin's screen.** When the user navigates to a full-screen plugin's screen, the host adds (and removes on leave) a class like `html.fb-immersive` / `body.fb-fullscreen-plugin`, with host CSS that mirrors the `ss-follower-pre` rules: hide `#v3-sidebar` + `#v3-topbar`, and let the active plugin `.screen` fill the viewport (`position:absolute; inset:0` or a definite `height:100%`), `body { overflow:hidden }`.

3. **The plugin then owns its viewport.** Given that slot, Virtuoso drops its `100vh`/`80px` hacks and simply sizes to the slot — no more guessing at host chrome.

4. **Keep two host-owned affordances visible** (so every full-screen plugin gets them for free):
   - **Esc / back to menu** — the host already owns Escape; in immersive mode Esc returns to the previous screen. Virtuoso deliberately never touches Escape, so this just works.
   - **A compact profile/streak badge** overlay (the thread's request) — host-rendered, top-corner, so plugins don't each rebuild it.

5. **Sidebar "collapse to icons"** is a nice middle ground if you'd rather not fully hide it — a rail of icons (no labels) instead of the `w-64` panel. Either works for us; full-hide is simplest.

This keeps the contract clean: the **host** owns chrome visibility and the badge; the **plugin** owns everything inside the slot.

## 5. Interim (what we'll do now, pending the capability)

Per Chris: we'll **standby** on the dedicated-page work until the host capability exists, so we build against the real thing instead of throwaway hacks. If a stop-gap is wanted before then, we can ship a small **defensive** Virtuoso-side CSS fix that drops the viewport assumptions (remove the 80px navbar padding; stop forcing `100vh`; fit the embedded `#v3-main` slot) so MacOS users aren't broken in the meantime — **without** touching any host element. Say the word and we'll cut it.

## 6. Open questions for Byron / xasiklas

1. Is full-screen mode **per-plugin opt-in** (manifest/capability) or a generic toggle? We'd prefer manifest opt-in.
2. What's the trigger you're leaning toward — a root/body class (like `ss-follower-pre`), a JS call (`window.feedBack.requestFullscreenScreen()`), or route-driven?
3. Will the host keep a **back affordance + profile/streak badge** in immersive mode, or should plugins render their own? (We'd prefer host-owned.)
4. Does this apply to the other promoted plugins (`rig_builder`, `editor`) too? Designing it once for all three seems right.
5. Any timeline on the "full screen mode" you mentioned — so we can sequence the Virtuoso migration (full-screen sizing + profile-badge consumption + Core instrument-selection integration) behind it?

---

*Host facts in this doc were read from the local `feedback` clone at host `VERSION` 0.3.0 (`static/v3/index.html`, `static/v3/shell.js`, `static/style.css`) on 2026-06-24.*
