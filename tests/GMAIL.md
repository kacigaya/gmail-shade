# Live Gmail verification

Run this checklist before releasing changes to Gmail selectors or message styling. Automated
fixtures and native Firefox tests need no account and cannot verify Gmail's current DOM.
Use a test mailbox and synthetic messages. Never commit mailbox content, screenshots with
personal data, browser profiles, or credentials.

1. Build both browsers with `bun run zip` and `bun run zip:firefox`. Load
   `.output/chrome-mv3` through Chrome's extensions page and
   `.output/firefox-mv2/manifest.json` through Firefox's temporary add-on page.
   Firefox must report extension ID `gmail-shade@kacigaya`.
2. Enable Gmail's dark theme. Open plain text, HTML, and thread messages. Check the
   message pane, subject, sender metadata, attachments, reply area, and blue links.
3. Check synthetic HTML with white and dark cards, nested coloured text, transparent
   backgrounds, images, gradients, and `bgcolor` tables. Author colours should survive
   on painted blocks; plain text should stay readable on the dark pane.
4. Navigate between messages and Gmail folders without reloading. Expand collapsed
   messages and open a message in another tab. Check the toggle is present once per
   toolbar and follows rebuilt layouts.
5. Change each popup preference independently. Check both Gmail tabs update, then
   change the in-page dark toggle and confirm the popup follows. Reload the tabs and
   restart the browser; preferences should persist.
6. Enable the operating system's reduced-motion preference. Popup switches should
   change state immediately, retain their accessible names, and work with Tab/Space.
7. With a message open, reload or disable the extension. Check for stale controls,
   page errors, and content-script exceptions. Reload Gmail after disabling to clear
   injected page state where the browser does not deliver invalidation cleanup.

Record browser versions, commit, date, and pass/fail for each step in the PR or release
notes. A missing signed-in session is an unverified check, not a passing result.
