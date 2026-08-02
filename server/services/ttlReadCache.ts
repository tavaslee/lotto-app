type TtlReadCacheOptions = {
  ttlMs: number;
  canUseStaleOnError?: (error: unknown) => boolean;
};

export function createTtlReadCache<T>({ ttlMs, canUseStaleOnError }: TtlReadCacheOptions) {
  let value: T | undefined;
  let expiresAt = 0;
  let inFlight: Promise<T> | null = null;

  return {
    async read(loader: () => Promise<T>): Promise<T> {
      if (value !== undefined && Date.now() < expiresAt) return value;
      if (inFlight) return inFlight;

      inFlight = loader()
        .then(nextValue => {
          value = nextValue;
          expiresAt = Date.now() + ttlMs;
          return nextValue;
        })
        .catch(error => {
          if (value !== undefined && canUseStaleOnError?.(error)) return value;
          throw error;
        })
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    },
    invalidate() {
      value = undefined;
      expiresAt = 0;
    },
  };
}
