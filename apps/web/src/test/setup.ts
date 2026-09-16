import { vi } from 'vitest';

vi.stubEnv('VITE_SUPABASE_URL', 'https://example.invalid');
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key');

installLocalStorage();

/** Node 25+ exposes a non-functional `localStorage` global that shadows happy-dom. */
function installLocalStorage(): void {
  const existing = globalThis.localStorage;
  if (isUsableStorage(existing)) {
    return;
  }

  const fromWindow =
    typeof window !== 'undefined' && isUsableStorage(window.localStorage)
      ? window.localStorage
      : null;
  const storage = fromWindow ?? createMemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: true,
    value: storage,
  });
}

function isUsableStorage(storage: Storage | undefined): storage is Storage {
  if (!storage) return false;

  const probeKey = '__asterism_storage_probe__';
  try {
    storage.setItem(probeKey, probeKey);
    const usable = storage.getItem(probeKey) === probeKey;
    storage.removeItem(probeKey);
    return usable;
  } catch {
    return false;
  }
}

function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key) {
      return data.has(key) ? (data.get(key) ?? null) : null;
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key) {
      data.delete(key);
    },
    setItem(key, value) {
      data.set(String(key), String(value));
    },
  };
}
