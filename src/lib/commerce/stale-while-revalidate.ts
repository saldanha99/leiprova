/**
 * In-process cache for expensive read-only catalog queries.
 *
 * - First call (cold) waits for the loader.
 * - Within `ttlMs` the cached value is returned immediately.
 * - After `ttlMs` the stale value is still returned immediately while one
 *   background refresh runs; concurrent callers share that refresh.
 * - A failed refresh keeps the last good value (and is retried on the next call);
 *   with no good value yet, the error propagates to the caller.
 *
 * Only for data whose decision is re-validated at the point of sale
 * (checkout and webhook re-check coverage before charging or granting).
 */
export function staleWhileRevalidate<T>(
  loader: () => Promise<T>,
  ttlMs: number,
  now: () => number = Date.now,
) {
  let value: { data: T; at: number } | null = null;
  let inflight: Promise<T> | null = null;

  const refresh = () => {
    inflight ??= loader()
      .then((data) => {
        value = { data, at: now() };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };

  async function read(): Promise<T> {
    if (!value) return refresh();
    if (now() - value.at >= ttlMs) {
      // Stale: answer now, refresh in the background. A failure keeps the old value.
      refresh().catch(() => undefined);
    }
    return value.data;
  }

  return Object.assign(read, {
    /** Drops the cached value (e.g. right after an editorial release). */
    invalidate() {
      value = null;
    },
  });
}
