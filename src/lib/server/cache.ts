type CacheEntry<T> = {
  expiresAt: number;
  value: Promise<T>;
};

const store = new Map<string, CacheEntry<unknown>>();

export function cached<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > Date.now()) return existing.value;

  const value = factory().catch((error) => {
    store.delete(key);
    throw error;
  });

  store.set(key, { expiresAt: Date.now() + ttlMs, value });
  return value;
}
