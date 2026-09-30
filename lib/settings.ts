import { browser } from 'wxt/browser';

export interface Settings {
  /** Dark styling for the opened-message reading pane. */
  darkMessages: boolean;
  /** Show the sun/moon toggle in Gmail's message toolbar. */
  showToggle: boolean;
}

export const DEFAULT_SETTINGS: Settings = { darkMessages: true, showToggle: true };
const KEYS = ['darkMessages', 'showToggle'] as const;
const STORAGE_KEYS = ['settings', ...KEYS] as const;

export interface SettingsState {
  settings: Settings;
  loaded: boolean;
  error: string | null;
}

/** Keep the old object as a read-only fallback until each preference is changed. */
function readSettings(raw: Record<string, unknown>): Settings {
  const legacy = raw.settings;
  const fallback = legacy != null && typeof legacy === 'object' ? legacy : {};
  const read = (key: keyof Settings) => {
    const value = raw[key];
    if (typeof value === 'boolean') return value;
    const old: unknown = key in fallback ? Reflect.get(fallback, key) : undefined;
    return typeof old === 'boolean' ? old : DEFAULT_SETTINGS[key];
  };
  return { darkMessages: read('darkMessages'), showToggle: read('showToggle') };
}

/** One subscription per surface, with pending intent separate from storage echoes. */
export function createSettingsController(onChange: (state: SettingsState) => void) {
  const raw: Record<string, unknown> = {};
  const versions = { settings: 0, darkMessages: 0, showToggle: 0 };
  const pending: Partial<Settings> = {};
  const writing = new Set<keyof Settings>();
  let disposed = false;
  let loaded = false;
  let error: string | null = null;
  let loading: Promise<void> | undefined;
  let subscribed = false;

  const snapshot = (): SettingsState => ({
    settings: { ...readSettings(raw), ...pending },
    loaded,
    error,
  });
  const emit = () => { if (!disposed) onChange(snapshot()); };
  const listener = (changes: Record<string, { newValue?: unknown }>) => {
    if (disposed) return;
    for (const key of STORAGE_KEYS) {
      if (!(key in changes)) continue;
      raw[key] = changes[key]?.newValue;
      versions[key]++;
    }
    emit();
  };

  const load = (): Promise<void> => {
    if (disposed) return Promise.resolve();
    if (loading) return loading;
    error = null;
    emit();
    loading = Promise.resolve().then(async () => {
      if (disposed) return;
      try {
        if (!subscribed) {
          browser.storage.sync.onChanged.addListener(listener);
          subscribed = true;
        }
        const before = { ...versions };
        const values: Record<string, unknown> = await browser.storage.sync.get([...STORAGE_KEYS]);
        if (disposed) return;
        for (const key of STORAGE_KEYS) {
          // A notification after the read started is newer than its snapshot.
          if (versions[key] === before[key]) raw[key] = values[key];
        }
        loaded = true;
      } catch {
        if (!disposed) error = 'Could not load settings. Try again.';
      } finally {
        loading = undefined;
        emit();
      }
    });
    return loading;
  };

  const persist = async (key: keyof Settings) => {
    writing.add(key);
    try {
      while (!disposed && pending[key] !== undefined) {
        const value = pending[key];
        const before = versions[key];
        try {
          await browser.storage.sync.set({ [key]: value });
          if (disposed) return;
          if (versions[key] === before) raw[key] = value;
          if (pending[key] === value) delete pending[key];
        } catch {
          if (disposed) return;
          if (pending[key] === value) {
            delete pending[key];
            error = 'Could not save settings. Try again.';
          }
        }
        emit();
      }
    } finally {
      writing.delete(key);
    }
  };

  return {
    get state() { return snapshot(); },
    load,
    set(key: keyof Settings, value: boolean) {
      if (disposed || !loaded) return;
      pending[key] = value;
      error = null;
      emit();
      if (!writing.has(key)) void persist(key);
    },
    dispose() {
      disposed = true;
      if (subscribed) {
        // Chrome may already have invalidated the API when cleanup runs.
        try { browser.storage.sync.onChanged.removeListener(listener); } catch { /* Context gone. */ }
      }
    },
  };
}
