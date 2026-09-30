type Change = { newValue?: unknown; oldValue?: unknown };
const listeners = new Set<(changes: Record<string, Change>) => void>();
export const api = {
  values: {} as Record<string, unknown>,
  failRead: false,
  failWrite: false,
};
export const browser = {
  runtime: { id: 'gmail-shade-test' },
  storage: {
    sync: {
      async get() {
        if (api.failRead) throw new Error('Unavailable');
        return structuredClone(api.values);
      },
      async set(values: Record<string, unknown>) {
        if (api.failWrite) throw new Error('Quota exceeded');
        const changes: Record<string, Change> = {};
        for (const [key, value] of Object.entries(values)) {
          changes[key] = { oldValue: api.values[key], newValue: value };
          api.values[key] = value;
        }
        for (const listener of listeners) listener(changes);
      },
      onChanged: {
        addListener(listener: (changes: Record<string, Change>) => void) { listeners.add(listener); },
        removeListener(listener: (changes: Record<string, Change>) => void) { listeners.delete(listener); },
      },
    },
  },
};
