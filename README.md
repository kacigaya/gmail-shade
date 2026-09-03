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

Gmail's own dark theme covers the list, the sidebar and the chrome, then stops at the message you
opened: the reading pane, its subject, its body and the reply bar all stay white. This extension
styles that pane to match.

| Toggle             | Effect                                                                             |
| ------------------ | ---------------------------------------------------------------------------------- |
| **Dark messages**  | Pane, subject, body, reply bar and "Show details" popup go `#2c2c2c` on `#e8eaed`   |
| **In-page toggle** | Shows a sun/moon button in the message toolbar that flips dark messages on and off  |

Both default to on. Settings live in `sync` storage, so the preference follows the Google account
across machines, and every open Gmail tab reacts to a change without a reload.

Links inside message bodies keep Gmail's `#8ab4f8` blue. Action icons, the star, and the reply-bar
icons are PNGs Gmail ships in black, so they are inverted rather than recoloured.

## Install

Chrome and Firefox builds are attached to each [release](https://github.com/kacigaya/gmail-shade/releases).
To run it unpacked instead:

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

- `entrypoints/content.ts` injects the stylesheet and mounts the toggle on each mutation sweep
- `lib/gmail.ts` holds the stylesheet, the toolbar lookup and the button DOM (tested)
- `lib/settings.ts` holds the settings shape, defaults, and storage item
- `entrypoints/popup/` is the React popup
- `components/ui/` is the coss ui components

## Design notes

**The stylesheet is the switch.** Light mode is the absence of rules, not a class on `<html>`, so
there is no state to keep in sync between the class and the setting. Defaults are dark and the CSS
is applied before storage is awaited, then reconciled, which keeps the pane from flashing white on
load.

**The button rides Gmail's layout.** It is inserted into the message toolbar rather than positioned
`fixed` against the print button's bounding box. Nothing polls for its position; a
`requestAnimationFrame`-coalesced `MutationObserver` re-mounts it when Gmail rebuilds the pane.

**Icons are built with `createElementNS`.** Gmail sets `require-trusted-types-for 'script'`.
Isolated worlds are exempt from it today, and building the SVG through the DOM costs nothing while
removing the dependency on that exemption.

## Limits

The rules target Gmail's generated class names (`.nH.a98.iY`, `.hx .a3s`, `.btDi4d`). They are
stable in practice but not contractual, and a Gmail redesign can break them.

The toolbar anchor is looked up in order: the last action button of the opened message
(`.hx .gH.acX button[data-tooltip]`), then the print button by `aria-label` in six locales, then
nothing — in which case the button falls back to a fixed position in the top right corner, the same
place the userscript this replaces used.

Only the reading pane is styled. Everything else is left to Gmail's own dark theme, which has to be
switched on in Gmail's settings for the result to look right.
