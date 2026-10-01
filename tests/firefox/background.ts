import { browser } from 'wxt/browser';
import { createSettingsController } from '@/lib/settings';
import { assertionCount, check, waitFor } from './helpers';

declare const TEST_URL: string;
const phases = new Map<string, (message: { assertions: number; error?: string }) => void>();
browser.runtime.onMessage.addListener((message: unknown) => {
  if (message && typeof message === 'object' && 'phase' in message && typeof message.phase === 'string') {
    if ('error' in message && typeof message.error === 'string') phases.get(message.phase)?.({ assertions: 0, error: message.error });
    else if ('assertions' in message && typeof message.assertions === 'number') phases.get(message.phase)?.({ assertions: message.assertions });
  }
});

async function open(phase: string, url: string) {
  const completed = new Promise<{ assertions: number; error?: string }>((resolve) => phases.set(phase, resolve));
  const tab = await browser.tabs.create({ url });
  try {
    const result = await completed;
    if (result.error) throw new Error(`${phase}: ${result.error}`);
    return result.assertions;
  } finally {
    phases.delete(phase);
    if (tab.id !== undefined) await browser.tabs.remove(tab.id);
  }
}

void (async () => {
  let result: string;
  const first = createSettingsController(() => {});
  const second = createSettingsController(() => {});
  try {
    check(browser.runtime.id === 'gmail-shade@kacigaya', 'Firefox identity changed');
    await browser.storage.sync.clear();
    await browser.storage.sync.set({ settings: { darkMessages: false, showToggle: true } });
    await Promise.all([first.load(), second.load()]);
    check(first.state.loaded && !first.state.settings.darkMessages, 'Native sync storage or legacy fallback failed');
    first.set('darkMessages', true);
    second.set('showToggle', false);
    await waitFor(() => first.state.settings.showToggle === false && second.state.settings.darkMessages === true, 'Native independent writes or notifications failed');
    const saved = await browser.storage.sync.get(null);
    check(saved.darkMessages === true && saved.showToggle === false, 'Independent sync keys were lost');
    check(saved.settings !== null && typeof saved.settings === 'object' && 'darkMessages' in saved.settings && saved.settings.darkMessages === false, 'Legacy settings were overwritten');
    await browser.storage.sync.set({ darkMessages: true, showToggle: true });
    const popup = await open('popup', browser.runtime.getURL('/popup.html'));
    await browser.storage.sync.set({ darkMessages: false, showToggle: false });
    const content = await open('content', TEST_URL);
    result = `${assertionCount() + popup + content} native Firefox assertions passed`;
  } catch (error) {
    result = String(error);
  } finally {
    first.dispose();
    second.dispose();
  }
  await fetch(`${TEST_URL}result`, { method: 'POST', body: result });
})();
