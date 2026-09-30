import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { createSettingsController } from '@/lib/settings';

const controllers: ReturnType<typeof createSettingsController>[] = [];
const create = () => {
  const controller = createSettingsController(() => {});
  controllers.push(controller);
  return controller;
};
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => fakeBrowser.reset());
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); });

describe('settings storage', () => {
  test('preserves legacy preferences without migration writes and normalizes bad values', async () => {
    await fakeBrowser.storage.sync.set({ settings: { darkMessages: false, showToggle: false } });
    const controller = create();
    await controller.load();
    expect(controller.state.settings).toEqual({ darkMessages: false, showToggle: false });
    expect(await fakeBrowser.storage.sync.get<Record<string, unknown>>(null)).toEqual({ settings: { darkMessages: false, showToggle: false } });
    await fakeBrowser.storage.sync.set({ darkMessages: true, showToggle: 'false' });
    expect(controller.state.settings).toEqual({ darkMessages: true, showToggle: false });
    await fakeBrowser.storage.sync.set({ settings: { darkMessages: null, showToggle: 'false' } });
    expect(controller.state.settings).toEqual({ darkMessages: true, showToggle: true });
  });

  test('different surfaces cannot overwrite an unrelated preference', async () => {
    const popup = create();
    const page = create();
    await Promise.all([popup.load(), page.load()]);
    page.set('darkMessages', false);
    popup.set('showToggle', false);
    await settle();
    expect(await fakeBrowser.storage.sync.get<Record<string, unknown>>(null)).toEqual({ darkMessages: false, showToggle: false });
    expect(popup.state.settings).toEqual(page.state.settings);
    expect(popup.state.settings).toEqual({ darkMessages: false, showToggle: false });
  });

  test('new notifications win over an older initial read', async () => {
    const read = deferred<Record<string, unknown>>();
    const get = spyOn(fakeBrowser.storage.sync, 'get').mockImplementationOnce(() => read.promise);
    try {
      const controller = create();
      const loading = controller.load();
      await settle();
      await fakeBrowser.storage.sync.set({ darkMessages: false, showToggle: false });
      read.resolve({ darkMessages: true, showToggle: true });
      await loading;
      expect(controller.state.settings).toEqual({ darkMessages: false, showToggle: false });
    } finally { get.mockRestore(); }
  });

  test('old write echoes do not replace newer rapid-click intent', async () => {
    const controller = create();
    await controller.load();
    const first = deferred<void>();
    const save = spyOn(fakeBrowser.storage.sync, 'set').mockImplementationOnce(() => first.promise);
    try {
      controller.set('darkMessages', false);
      controller.set('darkMessages', true);
      await fakeBrowser.storage.sync.onChanged.trigger({ darkMessages: { newValue: false } });
      expect(controller.state.settings.darkMessages).toBe(true);
      controller.set('darkMessages', !controller.state.settings.darkMessages);
      first.resolve();
      await settle();
      expect(controller.state.settings.darkMessages).toBe(false);
      expect(save.mock.calls.map((call) => call[0])).toEqual([{ darkMessages: false }]);
    } finally { save.mockRestore(); }
  });

  test('serializes a different final value after the first write', async () => {
    const controller = create();
    await controller.load();
    const first = deferred<void>();
    const save = spyOn(fakeBrowser.storage.sync, 'set').mockImplementationOnce(() => first.promise);
    try {
      controller.set('darkMessages', false);
      controller.set('darkMessages', true);
      expect(save).toHaveBeenCalledTimes(1);
      first.resolve();
      await settle();
      expect(save.mock.calls.map((call) => call[0])).toEqual([{ darkMessages: false }, { darkMessages: true }]);
      expect(controller.state.settings.darkMessages).toBe(true);
    } finally { save.mockRestore(); }
  });

  test('read failures remain retryable, including synchronous API failures', async () => {
    const controller = create();
    const get = spyOn(fakeBrowser.storage.sync, 'get').mockImplementationOnce(() => { throw new Error('Unavailable'); });
    try {
      await controller.load();
      expect(controller.state.loaded).toBe(false);
      expect(controller.state.error).toContain('load settings');
      await controller.load();
      expect(controller.state.loaded).toBe(true);
      expect(controller.state.error).toBeNull();
    } finally { get.mockRestore(); }
  });

  test('failed saves restore the acknowledged value and permit retry', async () => {
    const controller = create();
    await controller.load();
    const save = spyOn(fakeBrowser.storage.sync, 'set').mockImplementationOnce(async () => { throw new Error('Quota exceeded'); });
    try {
      controller.set('darkMessages', false);
      expect(controller.state.settings.darkMessages).toBe(false);
      await settle();
      expect(controller.state.settings.darkMessages).toBe(true);
      expect(controller.state.error).toContain('save settings');
      controller.set('darkMessages', false);
      await settle();
      expect(controller.state.settings.darkMessages).toBe(false);
      expect(controller.state.error).toBeNull();
    } finally { save.mockRestore(); }
  });

  test('a failed older write does not discard newer intent', async () => {
    const controller = create();
    await controller.load();
    const first = deferred<void>();
    const save = spyOn(fakeBrowser.storage.sync, 'set').mockImplementationOnce(() => first.promise);
    try {
      controller.set('darkMessages', false);
      controller.set('darkMessages', true);
      first.reject(new Error('Temporary failure'));
      await settle();
      expect(await fakeBrowser.storage.sync.get<Record<string, unknown>>('darkMessages')).toEqual({ darkMessages: true });
      expect(controller.state.error).toBeNull();
    } finally { save.mockRestore(); }
  });

  test('dispose stops subscriptions and continuations during initialization', async () => {
    const read = deferred<Record<string, unknown>>();
    const get = spyOn(fakeBrowser.storage.sync, 'get').mockImplementationOnce(() => read.promise);
    try {
      const states: unknown[] = [];
      const controller = createSettingsController((state) => states.push(state));
      const loading = controller.load();
      await settle();
      controller.dispose();
      const count = states.length;
      read.resolve({ darkMessages: false });
      await loading;
      await fakeBrowser.storage.sync.set({ showToggle: false });
      expect(states).toHaveLength(count);
      expect(controller.state.loaded).toBe(false);
    } finally { get.mockRestore(); }
  });

  test('dispose does not start a queued second write', async () => {
    const controller = create();
    await controller.load();
    const first = deferred<void>();
    const save = spyOn(fakeBrowser.storage.sync, 'set').mockImplementationOnce(() => first.promise);
    try {
      controller.set('darkMessages', false);
      controller.set('darkMessages', true);
      controller.dispose();
      first.resolve();
      await settle();
      expect(save).toHaveBeenCalledTimes(1);
    } finally { save.mockRestore(); }
  });
});
