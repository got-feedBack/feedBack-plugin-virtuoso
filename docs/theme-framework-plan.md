# Theme Framework Plan

## Purpose

Virtuoso's theme work began as a results-card and copy-card skin system inspired by note_detect, but there was no reusable style guide behind it. This plan turns the current Virtuoso skins into a platform-agnostic theme framework that can eventually govern the whole GUI in any host, app shell, or renderer.

The immediate goal is not to add more colors. It is to make every non-default theme feel like a distinct interface identity while preserving the practice surface, accessibility, and semantic color rules.

## Current State

Virtuoso has three related but separate systems:

- **Accent picker:** Signature/default cockpit accent swatches. It recolors active UI through accent tokens.
- **Card themes:** `Signature`, `Neon`, `Esports`, `Metal`, `Warm`, and `Focus` skins for results/copy cards.
- **Whole-studio theme reach:** an opt-in setting that lets a non-Signature card theme remap cockpit accent tokens and a few shape/font/motion rules.

The problem is that the framework is still implicit. Most differences are palette and card surface. The full GUI does not yet have a formal recipe for how a theme should affect materials, typography, geometry, motion, stage framing, and settings controls.

## Non-Negotiable Invariants

These apply to every theme and every future platform implementation.

1. **Practice surface stays legible first.** Themes may frame the stage, but they do not obscure the renderer, fretboard, notation, timeline, or note judgment surfaces.
2. **Semantic colors are locked.** Cleared/progress green, destructive red, playhead red, warning/heat amber, and instrument/string colors keep their meanings. Themes may style chrome, not redefine correctness.
3. **Default remains calm.** Signature stays the stable host-native baseline. New identity belongs to opt-in themes.
4. **Reduced motion wins.** Any animated glow, ring, breathe, scan, pulse, or sweep has a static reduced-motion form.
5. **Theme identity is multi-axis.** A theme is not valid if it only changes hue. It must own at least three identity axes from the recipe below.
6. **Token contract before selectors.** Prefer theme tokens consumed by components. Use scoped selector overrides only where legacy components still have hardcoded styles.
7. **Card and cockpit can differ.** A user can keep themed result/share cards while leaving the cockpit calm.
8. **No theme should read as a score.** Glow, badges, and accents can signal identity or active state, but never imply pass/fail or mastery.

## Theme Recipe

Each theme should declare values for these axes. A theme can be quiet or loud, but it should be intentionally different.

| Axis | What It Controls | Examples |
|---|---|---|
| Palette | Primary accent, secondary accent, soft fill, frame, warning accent | Neon cyan/magenta, Esports amber/white, Warm amber/oxblood |
| Typography | Display face, casing, letter spacing, numeric style | Esports compressed uppercase, Warm slab serif, Focus system UI |
| Shape | Radius, corner treatment, border weight, pill exceptions | Esports square, Metal 6px hard bevels, Focus modest 8px |
| Material | Surface texture, glass, bevel, flatness, grain | Metal brushed plate, Warm tweed/tolex, Focus flat matte |
| Motion | Ring spin, pulse, glow breathe, none | Neon spin, Metal ember pulse, Focus none |
| Stage Frame | The one safe place for cockpit theme expression near the renderer | Conic neon ring, solid esports border, warm pilot-lamp edge |
| Control Treatment | Active segments, settings menu, sheet chrome, primary buttons | Flat esports controls, analog warm panels, neon glow controls |
| Data Density | Text size, spacing, contrast, decorative budget | Focus high-contrast low-stim, Neon expressive but still readable |

Minimum acceptance for a non-default theme: palette plus two additional axes. Preferred: palette plus four or more axes.

## Theme Contract

A future framework should expose a theme object like this, independent of CSS, DOM, or any specific frontend stack:

```json
{
  "id": "metal",
  "label": "Metal",
  "mode": "dark",
  "palette": {
    "accent": "#ffb347",
    "accent2": "#ff6b35",
    "accentSoft": "rgba(255,179,71,0.16)",
    "frame": "rgba(255,179,71,0.42)",
    "warn": "#facc15"
  },
  "typography": {
    "displayFamily": "VirtuosoMetal",
    "displayCase": "uppercase",
    "tracking": "wide"
  },
  "shape": {
    "controlRadius": 6,
    "panelRadius": 6,
    "borderWeight": 1
  },
  "material": {
    "surface": "brushed-steel",
    "texture": "noise-grain",
    "bevel": "hard"
  },
  "motion": {
    "ring": "pulse",
    "glow": "ember",
    "reducedMotion": "static"
  },
  "stageFrame": {
    "style": "inset-ring",
    "animated": true
  }
}
```

Platform adapters then map this object to their native surface:

- CSS custom properties and scoped selectors for web plugins.
- Design tokens for native apps.
- JSON theme manifests for host-level theme registries.
- Canvas/export token reads for image generation.

## Virtuoso Theme Identities

### Signature

Role: the default Virtuoso cockpit.

- Identity: host-native, calm, pro-dark, graphite.
- Color source: global Accent picker.
- Motion: Lit/Calm energy toggle only.
- Future: should become the reference baseline for host-wide theme compatibility.

### Neon

Role: expressive arcade/synth skin.

- Palette: high-chroma dual accent.
- Typography: display face, uppercase moments.
- Shape: rounded but sharper than Signature.
- Material: glassy dark panels, luminous borders.
- Motion: animated ring/glow when Lit.
- Stage: chromatic conic ring.
- Avoid: making the practice surface look like a game score.

### Esports

Role: competitive, minimal, broadcast HUD.

- Palette: one hard accent plus neutral white.
- Typography: compressed display, uppercase labels.
- Shape: square corners, crisp borders.
- Material: flat matte, no glow.
- Motion: none or instant state changes.
- Stage: solid frame, no gradient ring.
- Avoid: cyberpunk/neon language; it should feel controlled and tactical.

### Metal

Role: industrial, heavy, tactile.

- Palette: ember, steel, blood/toxic variants.
- Typography: stencil/block display.
- Shape: hard bevels, low radius.
- Material: brushed plate, subtle grunge on card surfaces; cockpit texture only if restrained.
- Motion: ember pulse, not spin.
- Stage: heavy frame, warm edge light.
- Avoid: muddy contrast or over-texturing dense controls.

### Warm

Role: analog studio / amp room.

- Palette: pilot-lamp amber, oxblood, honey, olive.
- Typography: slab serif display.
- Shape: softened hardware corners.
- Material: tolex/tweed/card grain, warm matte panels.
- Motion: slow lamp breathe when Lit.
- Stage: warm edge light, no arcade ring.
- Avoid: sepia wash over everything; controls still need modern contrast.

### Focus

Role: high-contrast, low-stimulation accessibility pole.

- Palette: slate, sage, blue, amber variants with restrained saturation.
- Typography: system UI, normal casing.
- Shape: modest rounded corners.
- Material: flat matte, no texture.
- Motion: none, regardless of Lit.
- Stage: solid quiet frame.
- Avoid: decorative glow, dense animation, and low-contrast muted text.

## Implementation Phases

### Phase 1: Virtuoso Identity Deepening

Deliver deeper distinction inside the current CSS system.

- Keep the existing Card theme and Theme color controls.
- Add cockpit treatment rules for each non-Signature theme when `Whole studio` is active.
- Make each theme affect at least three axes: palette, shape, material/control treatment, typography/motion/stage.
- Add smoke coverage that ensures each non-Signature theme stamps a distinct root state and changes at least one cockpit token or computed style.

### Phase 2: Token Contract Cleanup

Make the theme system less selector-dependent.

- Introduce formal `--vir-theme-*` tokens for material, frame, control, display, and motion roles.
- Migrate hardcoded cockpit colors and radii to tokens.
- Keep compatibility aliases for existing `--vir-card-*` and `--vir-accent-*` reads.
- Document every token as semantic role, not visual value.

### Phase 3: Theme Manifest Extraction

Move theme definitions toward data.

- Define a JSON-like theme registry in JS or a standalone manifest.
- Generate CSS custom properties from theme data where possible.
- Keep authored CSS only for irreducible material effects: grain, bevel, ring, and reduced-motion variants.
- Let card export, cockpit, and future host surfaces read from the same registry.

### Phase 4: Host-Wide Framework

Make the theme framework usable beyond Virtuoso.

- Publish a platform-agnostic theme schema.
- Provide adapters for plugin CSS variables, canvas export, and any host-level theme API.
- Define semantic-color invariants host-wide.
- Add visual regression screenshots per theme and colorway.

## Acceptance Checklist

For any theme change:

- The default Signature look is not changed unless explicitly intended.
- Every non-Signature theme still has at least three color choices.
- Each non-Signature theme differs by more than color.
- Card-only and Whole-studio scopes both work.
- Reduced-motion mode freezes or removes theme motion.
- Cleared/progress green and destructive red are not remapped.
- Copy-card/rendered-card export reads the active theme tokens.
- Smoke or probe coverage verifies the root attributes, persistence keys, and at least one visible computed-style change.


## Current Virtuoso Adapter Slice

As of the first implementation slice, Virtuoso has started Phase 3 inside the existing no-build architecture:

- `screen.js` owns a `VIR_THEME_RECIPES` registry for `Signature`, `Neon`, `Esports`, `Metal`, `Warm`, and `Focus`.
- The registry carries each theme's label, role, axes, palette preview, typography, shape, material, motion, stage-frame, and colorway list.
- The Settings theme picker renders live preview cards from that registry instead of hardcoded buttons.
- Existing CSS selectors remain the web adapter for now. This keeps launch risk low while giving future Codex/Claude sessions a single data source to migrate into formal `--vir-theme-*` tokens.
- `applyCardSkin()` stamps the recipe's `stageFrame.style` as `data-vir-stageframe`, so the renderer frame now consumes registry data instead of only skin-specific selectors.
- Renderer smoke verifies the preview cards, per-theme colorways, persistence, root attributes, distinct Whole-studio cockpit treatments, and distinct stage-frame computed styles.

Next migration target: generate or stamp formal theme tokens from `VIR_THEME_RECIPES`, then progressively replace remaining skin-specific cockpit selectors with token-consuming component rules.

## Immediate Virtuoso Slice

Start with cockpit treatment rules under `[data-vir-cardskin][data-vir-skincockpit="on"]`:

- Neon: glassy panels, chromatic active controls, glow budget on chrome only.
- Esports: square matte controls, uppercase labels, solid borders, no glow.
- Metal: hard bevels, heavier panel frames, ember edge treatment.
- Warm: analog panel warmth, slab display emphasis, soft pilot-lamp edge.
- Focus: flat high-contrast panels, no glow/motion, calmer typography.

This slice deepens identity now while leaving the longer-term manifest/token extraction for later.
