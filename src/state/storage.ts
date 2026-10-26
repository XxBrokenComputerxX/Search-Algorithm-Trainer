import { useSyncExternalStore } from 'react';

/** A tiny localStorage-backed store. Falls back to in-memory state if storage is unavailable. */
export function createStore<T>(key: string, fallback: T, validate: (raw: unknown) => T) {
  let value: T = fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) value = validate(JSON.parse(raw));
  } catch {
    value = fallback;
  }
  const listeners = new Set<() => void>();

  return {
    get: () => value,
    set(next: T) {
      value = next;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage full or blocked: keep the in-memory value.
      }
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export function useStore<T>(store: { get: () => T; subscribe: (l: () => void) => () => void }): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
