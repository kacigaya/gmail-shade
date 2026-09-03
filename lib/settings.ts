import { storage } from '#imports';

export interface Settings {
  /** Dark styling for the opened-message reading pane. */
  darkMessages: boolean;
  /** Show the sun/moon toggle in Gmail's message toolbar. */
  showToggle: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  darkMessages: true,
  showToggle: true,
};

// `sync`, not `local`: the preference follows the Google account across machines.
export const settingsItem = storage.defineItem<Settings>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
});

/** Stored value may predate a newly added key, so fill the gaps. */
export function withDefaults(value: Partial<Settings> | null | undefined): Settings {
  return { ...DEFAULT_SETTINGS, ...value };
}

export async function getSettings(): Promise<Settings> {
  return withDefaults(await settingsItem.getValue());
}
