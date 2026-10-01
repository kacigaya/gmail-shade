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
| **Dark messages**  | Pane, subject, body, reply bar and "Show details" popup use `#e8eaed` on `#2c2c2c` |
| **In-page toggle** | Shows a sun/moon button in the message toolbar that flips dark messages on and off  |

Both settings are on by default. They live in browser `sync` storage, so preferences can follow
your browser account across machines. Open Gmail tabs and the popup pick up changes without a
reload. Each preference is saved independently. Existing preferences from the older settings
object remain a fallback until you change them. Failed saves restore the last confirmed value;
failed reads offer a retry.

Links in message bodies keep Gmail's `#8ab4f8` blue. Gmail ships the action, star, and reply-bar
icons as black PNGs, so the extension inverts them instead of recolouring them.

Designed emails that paint their own background keep their original text colours inside that
block. Detection uses computed styles, including stylesheet classes, legacy attributes, images,
and gradients. Transparent backgrounds and positioning declarations do not count as painted
cards. Plain emails get light text on the dark pane.

## Install

Each [release](https://github.com/kacigaya/gmail-shade/releases) includes Chrome and Firefox builds.
To run an unpacked build:

```bash
bun install --frozen-lockfile
bun run build     # .output/chrome-mv3, load unpacked at chrome://extensions
```

## Develop

```bash
bun install --frozen-lockfile  # Bun 1.4.2, pinned in .bun-version
bun run dev          # Chrome; `bun run dev:firefox` for Firefox
bun test             # DOM, settings races, storage errors, lifecycle cleanup
bun run test:browser # Computed styles and popup behavior in Chrome/Chromium
bun run compile      # tsc --noEmit
bun run build        # .output/chrome-mv3
bun run zip          # packaged Chrome extension
bun run zip:firefox   # packaged Firefox extension
bun run lint:firefox  # Validate the built Firefox extension
bun run test:firefox  # Native Firefox extension, sync storage, popup, and content script
bun run audit:deps    # Exact public dependency versions checked against OSV
```

Browser tests require Chrome/Chromium on `PATH` or a Playwright Chromium cache. Set `CHROME_PATH`
to select an executable. They run a local fixture with a controlled storage API; no Gmail login
or network service is needed. Native Firefox tests require Node 20+ and Firefox on `PATH` or `FIREFOX_PATH`,
run on Linux/macOS, and use a fresh temporary profile. They test the built popup and content
script with real browser storage; only a disposable copy receives localhost test permissions.
Pull requests run these validation checks. See [the Gmail checklist](tests/GMAIL.md) for
verification against a signed-in mailbox; fixture tests cannot detect Gmail selector changes.

The dependency audit runs for pull requests, pushes to main, and weekly. It sends only exact
public npm package names and versions from `bun.lock` to OSV, including development and optional
dependencies. Workspace and custom-registry packages are excluded. Active advisories fail the
check; API failures also fail instead of reporting a clean scan. Advisory coverage is limited
to OSV's database and does not establish whether a vulnerability is reachable in this extension.

## Release

Update `package.json`'s stable version, validate, commit, and push to main. Push a matching
`vX.Y.Z` tag on that commit to start the release workflow. The workflow runs all tests, builds
both ZIPs, validates Firefox, and audits dependencies before creating a draft release. It
uploads the two exact browser ZIPs, checks their names, sizes, upload state, and GitHub-provided
digests when available, then publishes. An upload failure leaves a draft; rerunning the failed
workflow can resume it. Published releases and drafts targeting another commit are rejected.
Do not publish a release manually before this gate finishes. The workflow supports stable
versions only; prerelease policy needs a separate change.

## Layout

- `entrypoints/content.ts` injects the stylesheet and mounts the toggle during each mutation sweep
- `lib/gmail.ts` contains the stylesheet, toolbar lookup, and tested button DOM
- `lib/settings.ts` handles subscriptions, independent writes, pending intent, and storage errors
- `lib/message-backgrounds.ts` classifies painted blocks and cleans up temporary markers
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

**Classification reads before it writes.** Only changed message bodies are remeasured. The extension
temporarily disables its stylesheet to read the author's backgrounds and text colours, then
updates markers in one batch. Its own DOM writes are excluded from observation. Invalidation
cancels queued frames and removes the subscription, stylesheet, markers, button, and error notice.

**Firefox uses a stable identity.** `gmail-shade@kacigaya` enables sync storage in temporary Firefox
installs and stays fixed across builds. A signed AMO submission must use this same ID.

**Icons use `createElementNS`.** Gmail sets `require-trusted-types-for 'script'`. Isolated worlds
are currently exempt, but constructing the SVG through the DOM avoids relying on that exemption.

## Limits

The rules target Gmail's generated class names (`.nH.a98.iY`, `.hx .a3s`, `.btDi4d`). These names
have been stable in practice, but Gmail does not guarantee them. A redesign may break the styles.

The extension first looks for the last action button in the opened message
(`.hx .gH.acX button[data-tooltip]`), then for the print button by `aria-label` in six locales. If
neither exists, the toggle uses a fixed position in the top-right corner, where the userscript it
replaces placed it.

Computed-style classification costs one walk of each changed message body. Very large emails can
make this expensive. Background images and partly transparent backgrounds keep the author's text
colours; the extension does not analyze image brightness or guarantee contrast in those cases.
Changes made directly through CSSOM or CSS animations without a DOM mutation are not observed.

Different surfaces can change separate preferences safely. Simultaneous changes to the same
preference follow browser storage's last-write behavior. Older extension versions still read the
legacy object and will not see changes saved to the new independent keys.

Only the reading pane is styled. Gmail's own dark theme handles the rest and must be enabled in
Gmail's settings for the extension to look right.
