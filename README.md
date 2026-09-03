<p align="center">
  <img src="assets/logo.svg" alt="Gmail Shade logo" width="140">
</p>

<h1 align="center">Gmail Shade</h1>

<p align="center">
  <strong>Browser extension that finishes Gmail's dark theme.</strong><br>
  <em>Darkens the opened-message reading pane, which Gmail leaves white.</em>
</p>

<p align="center">
  <a href="https://wxt.dev"><img alt="WXT 0.21" src="https://shieldcn.dev/badge/WXT-0.21-8b5cf6.svg?variant=secondary&amp;logo=googlechrome"></a>
  <a href="https://react.dev"><img alt="React 19" src="https://shieldcn.dev/badge/React-19-61dafb.svg?variant=secondary&amp;logo=react&amp;logoColor=171717"></a>
  <a href="https://bun.sh"><img alt="Bun 1.3" src="https://shieldcn.dev/badge/Bun-1.3-fbf0df.svg?variant=secondary&amp;logo=bun&amp;logoColor=171717"></a>
  <a href="https://tailwindcss.com"><img alt="Tailwind CSS 4" src="https://shieldcn.dev/badge/Tailwind_CSS-4-06b6d4.svg?variant=secondary&amp;logo=tailwindcss"></a>
  <a href="https://github.com/kacigaya/gmail-shade/blob/main/LICENSE"><img alt="MIT License" src="https://shieldcn.dev/github/license/kacigaya/gmail-shade.svg?variant=secondary"></a>
</p>

## What it does

Gmail's dark theme covers the message list, sidebar, and interface, but opened messages still have
a white reading pane, subject, body, and reply bar. Gmail Shade styles those areas to match.

| Toggle             | Effect                                                                             |
| ------------------ | ---------------------------------------------------------------------------------- |
| **Dark messages**  | Pane, subject, body, reply bar and "Show details" popup go `#2c2c2c` on `#e8eaed`   |
| **In-page toggle** | Shows a sun/moon button in the message toolbar that flips dark messages on and off  |

Both settings are on by default. They live in `sync` storage, so preferences follow the Google
account across machines. Open Gmail tabs pick up changes without a reload.

Links in message bodies keep Gmail's `#8ab4f8` blue. Gmail ships the action, star, and reply-bar
icons as black PNGs, so the extension inverts them instead of recolouring them.

## Install

Each [release](https://github.com/kacigaya/gmail-shade/releases) includes Chrome and Firefox builds.
To run an unpacked build:

```bash
bun install
bun run build     # .output/chrome-mv3, load unpacked at chrome://extensions
```

## Develop

```bash
bun install
bun run dev          # Chrome; `bun run dev:firefox` for Firefox
bun test             # DOM logic in lib/gmail.ts
bun run compile      # tsc --noEmit
bun run build        # .output/chrome-mv3
bun run zip          # packaged extension
```

## Layout

- `entrypoints/content.ts` injects the stylesheet and mounts the toggle during each mutation sweep
- `lib/gmail.ts` contains the stylesheet, toolbar lookup, and tested button DOM
- `lib/settings.ts` holds the settings shape, defaults, and storage item
- `entrypoints/popup/` is the React popup
- `components/ui/` contains the coss UI components

## Design notes

**The stylesheet is the switch.** Light mode is the absence of rules, not a class on `<html>`, so
there is no class state to synchronize with the setting. The extension applies the dark defaults
before waiting for storage, then reconciles the saved settings. This prevents a white flash while
the page loads.

**The button follows Gmail's layout.** The extension inserts it into the message toolbar instead of
positioning it as `fixed` from the print button's bounding box. A `requestAnimationFrame`-coalesced
`MutationObserver` remounts it when Gmail rebuilds the pane, with no position polling.

**Icons use `createElementNS`.** Gmail sets `require-trusted-types-for 'script'`. Isolated worlds
are currently exempt, but constructing the SVG through the DOM avoids relying on that exemption.

## Limits

The rules target Gmail's generated class names (`.nH.a98.iY`, `.hx .a3s`, `.btDi4d`). These names
have been stable in practice, but Gmail does not guarantee them. A redesign may break the styles.

The extension first looks for the last action button in the opened message
(`.hx .gH.acX button[data-tooltip]`), then for the print button by `aria-label` in six locales. If
neither exists, the toggle uses a fixed position in the top-right corner, where the userscript it
replaces placed it.

Only the reading pane is styled. Gmail's own dark theme handles the rest and must be enabled in
Gmail's settings for the extension to look right.
