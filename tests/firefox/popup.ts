import { browser } from 'wxt/browser';
import { check, report, waitFor } from './helpers';

void report('popup', async () => {
  await waitFor(() => document.querySelectorAll('[role=switch]').length === 2 && !document.querySelector('[aria-busy=true]') && !document.querySelector('[role=switch][disabled], [role=switch][aria-disabled=true]'), 'Popup did not load native settings');
  const switches = document.querySelectorAll<HTMLElement>('[role=switch]');
  check(switches[0]!.getAttribute('aria-checked') === 'true', 'Popup did not read sync storage');
  await browser.storage.sync.set({ darkMessages: false });
  await waitFor(() => switches[0]!.getAttribute('aria-checked') === 'false', 'Popup missed native storage notification');
  check(matchMedia('(prefers-reduced-motion: reduce)').matches, 'Firefox reduced-motion preference was not applied');
  for (const control of switches) {
    check(getComputedStyle(control).transitionProperty === 'none', 'Switch animates with reduced motion');
    const thumb = control.querySelector<HTMLElement>('[data-slot=switch-thumb]')!;
    check(getComputedStyle(thumb).transitionProperty === 'none', 'Thumb animates with reduced motion');
  }
  switches[1]!.click();
  await waitFor(async () => (await browser.storage.sync.get('showToggle')).showToggle === false, 'Popup did not persist native settings');
  check((await browser.storage.sync.get('darkMessages')).darkMessages === false, 'Popup overwrote the independent preference');
  await browser.storage.sync.set({ darkMessages: true, showToggle: true });
});
