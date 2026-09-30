import { beforeEach, expect, spyOn, test } from 'bun:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import content from '@/entrypoints/content';

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
beforeEach(() => {
  fakeBrowser.reset();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

async function run(check: (ctx: ContentScriptContext, flush: () => void) => Promise<void>) {
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  const schedule = spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    frames.set(++next, cb);
    return next;
  });
  const cancel = spyOn(globalThis, 'cancelAnimationFrame').mockImplementation((id) => { frames.delete(id); });
  const ctx = new ContentScriptContext('test-content');
  const flush = () => {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) callback(0);
  };
  try {
    content.main(ctx);
    await check(ctx, flush);
  } finally {
    ctx.notifyInvalidated();
    schedule.mockRestore();
    cancel.mockRestore();
  }
}

test('invalidation cancels a queued frame and cannot remount the toggle', async () => {
  await run(async (ctx, flush) => {
    await settle();
    ctx.notifyInvalidated();
    flush();
    expect(document.querySelector('style[data-gmail-shade]')).toBeNull();
    expect(document.querySelector('#gmail-shade-toggle')).toBeNull();
    await fakeBrowser.storage.sync.set({ darkMessages: false });
    flush();
    expect(document.querySelector('style[data-gmail-shade]')).toBeNull();
  });
});

test('invalidation during a storage read leaves no resource behind', async () => {
  let resolve!: (values: Record<string, unknown>) => void;
  const get = spyOn(fakeBrowser.storage.sync, 'get').mockImplementationOnce(() => new Promise<Record<string, unknown>>((yes) => { resolve = yes; }));
  try {
    await run(async (ctx, flush) => {
      await settle();
      ctx.notifyInvalidated();
      resolve({ darkMessages: true });
      await settle();
      flush();
      expect(document.querySelector('[data-gmail-shade]')).toBeNull();
    });
  } finally { get.mockRestore(); }
});

test('failed reads show a notice and the in-page button retries', async () => {
  const get = spyOn(fakeBrowser.storage.sync, 'get').mockImplementationOnce(async () => { throw new Error('Unavailable'); });
  try {
    await run(async (_ctx, flush) => {
      await settle();
      flush();
      expect(document.querySelector('#gmail-shade-error')?.textContent).toContain('Could not load settings');
      document.querySelector<HTMLButtonElement>('#gmail-shade-toggle')!.click();
      await settle();
      flush();
      expect(document.querySelector('#gmail-shade-error')).toBeNull();
      document.querySelector<HTMLButtonElement>('#gmail-shade-toggle')!.click();
      await settle();
      flush();
      expect(document.querySelector('style[data-gmail-shade]')?.textContent?.trim()).toBe('');
    });
  } finally { get.mockRestore(); }
});

test('failed saves restore dark styling and show a recoverable error', async () => {
  await run(async (_ctx, flush) => {
    await settle();
    flush();
    const save = spyOn(fakeBrowser.storage.sync, 'set').mockImplementationOnce(async () => { throw new Error('Quota exceeded'); });
    try {
      document.querySelector<HTMLButtonElement>('#gmail-shade-toggle')!.click();
      await settle();
      flush();
      expect(document.querySelector('style[data-gmail-shade]')?.textContent).toContain('#2c2c2c');
      expect(document.querySelector('#gmail-shade-error')?.textContent).toContain('Could not save settings');
    } finally { save.mockRestore(); }
  });
});
