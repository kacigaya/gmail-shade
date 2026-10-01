# Project facts

- Browser extension using WXT 0.21, React 19, TypeScript, and Tailwind CSS 4.
- Package manager/runtime: Bun 1.4.2, pinned in `.bun-version` and matching `@types/bun`.
  Install with `bun install --frozen-lockfile`.
- Development: `bun run dev` for Chrome; `bun run dev:firefox` for Firefox.
- Validation: `bun test`, `bun run compile`, `bun run test:browser`, `bun run zip`,
  `bun run zip:firefox`, `bun run lint:firefox`, `bun run test:firefox`, and `bun run audit:deps`.
- Browser tests need Chrome/Chromium on PATH, in the Playwright cache, or at `CHROME_PATH`.
  The fixture uses a controlled browser storage API and needs no Gmail account.
- Native Firefox tests require Node 20+, Firefox on PATH or at `FIREFOX_PATH`, and a built
  `.output/firefox-mv2`. They install a disposable test copy with real sync storage.
  The process runner supports Linux/macOS. Live Gmail checks are in `tests/GMAIL.md`.
- Builds: `.output/chrome-mv3` and `.output/firefox-mv2`. ZIPs live in `.output`.
- Firefox extension ID: `gmail-shade@kacigaya`. Preserve it across builds and signing.
- Settings use independent sync keys `darkMessages` and `showToggle`; legacy `settings`
  remains a read-only fallback. Do not write entire settings objects.
- CI validates PRs and pushes to main; OSV audits also run weekly.
- Pushing a stable `vX.Y.Z` tag matching `package.json` triggers release validation.
  The commit must be on main. Both ZIPs upload to a draft and are verified before
  publication. Do not manually publish an empty release. No application server is configured.
