// src/session/waiter.ts
// Immutable waiter management for async response handling

/**
 * Generic waiter manager with immutable operations.
 * Each operation creates a new array rather than mutating in place.
 *
 * @typeParam K - Key type (e.g., string for question_id or session_id)
 * @typeParam T - Data type passed to waiter callbacks
 */
export class WaiterManager<K, T> {
  private waiters: Map<K, Array<(data: T) => void>> = new Map();

  /**
   * Register a waiter callback for a key.
   * Returns a cleanup function to remove this specific waiter.
   */
  registerWaiter(key: K, callback: (data: T) => void): () => void {
    // Create new array with callback appended (immutable)
    const current = this.waiters.get(key) || [];
    this.waiters.set(key, [...current, callback]);

    // Return cleanup function that removes this specific callback
    return () => {
      const waiters = this.waiters.get(key);
      if (!waiters) return;

      const idx = waiters.indexOf(callback);
      if (idx >= 0) {
        // Create new array without this callback (immutable)
        const newWaiters = [...waiters.slice(0, idx), ...waiters.slice(idx + 1)];
        if (newWaiters.length === 0) {
          this.waiters.delete(key);
        } else {
          this.waiters.set(key, newWaiters);
        }
      }
    };
  }

  /**
   * Notify only the first waiter for a key and remove it.
   * Other waiters remain registered for subsequent notifications.
   */
  notifyFirst(key: K, data: T): void {
    const waiters = this.waiters.get(key);
    if (!waiters || waiters.length === 0) return;

    const [first, ...rest] = waiters;
    first(data);

    // Set new array without first element (immutable)
    if (rest.length === 0) {
      this.waiters.delete(key);
    } else {
      this.waiters.set(key, rest);
    }
  }

  /**
   * Notify all waiters for a key and remove them all.
   */
  notifyAll(key: K, data: T): void {
    const waiters = this.waiters.get(key);
    if (!waiters) return;

    // Call all waiters
    for (const waiter of waiters) {
      waiter(data);
    }

    // Remove all waiters for this key
    this.waiters.delete(key);
  }

  /**
   * Check if there are any waiters for a key.
   */
  hasWaiters(key: K): boolean {
    const waiters = this.waiters.get(key);
    return waiters !== undefined && waiters.length > 0;
  }

  /**
   * Get the number of waiters for a key.
   */
  getWaiterCount(key: K): number {
    return this.waiters.get(key)?.length ?? 0;
  }

  /**
   * Remove all waiters for a key without notifying them.
   */
  clearAll(key: K): void {
    this.waiters.delete(key);
  }
}

/**
 * Result of waiting for a response
 */
export type WaitResult<T> = { ok: true; data: T } | { ok: false; reason: "timeout" };

/**
 * Wait for a response with timeout.
 * Registers a waiter and returns a promise that resolves when notified or times out.
 */
export function waitForResponse<K, T>(manager: WaiterManager<K, T>, key: K, timeoutMs: number): Promise<WaitResult<T>> {
  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let cleanup: (() => void) | undefined;

    // Register waiter
    cleanup = manager.registerWaiter(key, (data) => {
      if (timeoutId) clearTimeout(timeoutId);
      resolve({ ok: true, data });
    });

    // Set timeout
    timeoutId = setTimeout(() => {
      if (cleanup) cleanup();
      resolve({ ok: false, reason: "timeout" });
    }, timeoutMs);
  });
}
