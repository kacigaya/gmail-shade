import { browser } from 'wxt/browser';
import { PAINTED_ATTRIBUTE } from '@/lib/message-backgrounds';
import { check, report, waitFor } from './helpers';

void report('content', async () => {
  const plain = document.getElementById('plain')!;
  const card = document.getElementById('card')!;
  // Startup deliberately paints dark defaults before its asynchronous read.
  // Observe saved non-default settings before exercising a writable control.
  await waitFor(() => document.querySelector('style[data-gmail-shade]')?.textContent === '' && !document.getElementById('gmail-shade-toggle'), 'Content script did not load saved non-default settings');
  check(getComputedStyle(plain).color === 'rgb(34, 34, 34)', 'Saved light mode was not applied');
  await browser.storage.sync.set({ darkMessages: true, showToggle: true });
  await waitFor(() => card.hasAttribute(PAINTED_ATTRIBUTE) && !!document.getElementById('gmail-shade-toggle'), 'Production content script did not initialize');
  check(getComputedStyle(plain).color === 'rgb(232, 234, 237)', 'Plain text is not light');
  check(getComputedStyle(card).color === 'rgb(34, 34, 34)', 'Author card text changed');
  card.className = '';
  await waitFor(() => !card.hasAttribute(PAINTED_ATTRIBUTE), 'Native class mutation was not classified');
  check(getComputedStyle(card).color === 'rgb(232, 234, 237)', 'Changed card did not get light text');
  document.getElementById('gmail-shade-toggle')!.click();
  await waitFor(async () => (await browser.storage.sync.get('darkMessages')).darkMessages === false, 'In-page toggle did not save to native storage');
  await waitFor(() => getComputedStyle(plain).color === 'rgb(34, 34, 34)', 'Native storage change did not remove dark styling');
  await browser.storage.sync.set({ showToggle: false });
  await waitFor(() => !document.getElementById('gmail-shade-toggle'), 'Native storage notification did not remove the toggle');
  check(!document.getElementById('gmail-shade-toggle'), 'Native content synchronization completed');
});
