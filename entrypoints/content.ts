export default defineContentScript({
  matches: ['*://mail.google.com/*'],
  runAt: 'document_start',

  main() {},
});
