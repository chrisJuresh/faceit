type CacheEntry<T> = {
  freshUntil: number;
  staleUntil: number;
  value: Promise<T>;
  settled: boolean;
  refreshing: boolean;
};

const store = new Map<string, CacheEntry<unknown>>();
const MAX_ENTRIES = 2000;

function evictExpired(now: number) {
  if (store.size < MAX_ENTRIES) return;
  for (const [key, entry] of store) {
    if (entry.staleUntil <= now) store.delete(key);
  }
}

/**
 * Memoises a request for `ttlMs`. With `staleMs`, an expired value is still returned for that
 * much longer while one background refresh replaces it, so repeat visits never wait on FACEIT.
 */
export function cached<T>(
  key: string,
  ttlMs: number,
  factory: () => Promise<T>,
  staleMs = 0
): Promise<T> {
  const now = Date.now();
  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.freshUntil > now) return existing.value;

  if (existing && existing.settled && existing.staleUntil > now) {
    if (!existing.refreshing) {
      existing.refreshing = true;
      factory()
        .then((fresh) => {
          const at = Date.now();
          store.set(key, {
            freshUntil: at + ttlMs,
            staleUntil: at + ttlMs + staleMs,
            value: Promise.resolve(fresh),
            settled: true,
            refreshing: false
          });
        })
        .catch(() => {
          existing.refreshing = false;
        });
    }
    return existing.value;
  }

  evictExpired(now);
  const entry: CacheEntry<T> = {
    freshUntil: now + ttlMs,
    staleUntil: now + ttlMs + staleMs,
    value: Promise.resolve() as Promise<T>,
    settled: false,
    refreshing: false
  };
  entry.value = factory().then(
    (value) => {
      entry.settled = true;
      return value;
    },
    (error) => {
      if (store.get(key) === entry) store.delete(key);
      throw error;
    }
  );
  store.set(key, entry);
  return entry.value;
}
