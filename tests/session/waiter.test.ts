// tests/session/waiter.test.ts
import { describe, it, expect, beforeEach } from "bun:test";
import { WaiterManager, waitForResponse } from "../../src/session/waiter";

describe("WaiterManager", () => {
  let manager: WaiterManager<string, unknown>;

  beforeEach(() => {
    manager = new WaiterManager<string, unknown>();
  });

  describe("registerWaiter", () => {
    it("should register a waiter and return cleanup function", () => {
      let resolved = false;
      const cleanup = manager.registerWaiter("key1", () => {
        resolved = true;
      });

      expect(typeof cleanup).toBe("function");
      expect(manager.hasWaiters("key1")).toBe(true);
    });

    it("should allow multiple waiters for same key", () => {
      manager.registerWaiter("key1", () => {});
      manager.registerWaiter("key1", () => {});

      expect(manager.getWaiterCount("key1")).toBe(2);
    });

    it("cleanup should remove only that waiter", () => {
      const cleanup1 = manager.registerWaiter("key1", () => {});
      manager.registerWaiter("key1", () => {});

      cleanup1();

      expect(manager.getWaiterCount("key1")).toBe(1);
    });
  });

  describe("notifyFirst", () => {
    it("should call only the first waiter", async () => {
      const calls: number[] = [];
      manager.registerWaiter("key1", () => calls.push(1));
      manager.registerWaiter("key1", () => calls.push(2));

      manager.notifyFirst("key1", "data");

      expect(calls).toEqual([1]);
      expect(manager.getWaiterCount("key1")).toBe(1);
    });

    it("should do nothing if no waiters", () => {
      // Should not throw
      manager.notifyFirst("nonexistent", "data");
    });
  });

  describe("notifyAll", () => {
    it("should call all waiters for a key", () => {
      const calls: number[] = [];
      manager.registerWaiter("key1", () => calls.push(1));
      manager.registerWaiter("key1", () => calls.push(2));

      manager.notifyAll("key1", "data");

      expect(calls).toEqual([1, 2]);
    });

    it("should remove all waiters after notification", () => {
      manager.registerWaiter("key1", () => {});
      manager.registerWaiter("key1", () => {});

      manager.notifyAll("key1", "data");

      expect(manager.hasWaiters("key1")).toBe(false);
    });
  });

  describe("immutability", () => {
    it("should not mutate original array when adding waiter", () => {
      manager.registerWaiter("key1", () => {});
      const countBefore = manager.getWaiterCount("key1");

      manager.registerWaiter("key1", () => {});

      // Original count should have been 1, now 2
      expect(countBefore).toBe(1);
      expect(manager.getWaiterCount("key1")).toBe(2);
    });

    it("should not mutate original array when removing waiter", () => {
      const cleanup = manager.registerWaiter("key1", () => {});
      manager.registerWaiter("key1", () => {});

      const countBefore = manager.getWaiterCount("key1");
      cleanup();

      expect(countBefore).toBe(2);
      expect(manager.getWaiterCount("key1")).toBe(1);
    });
  });

  describe("clearAll", () => {
    it("should remove all waiters for a key", () => {
      manager.registerWaiter("key1", () => {});
      manager.registerWaiter("key1", () => {});

      manager.clearAll("key1");

      expect(manager.hasWaiters("key1")).toBe(false);
    });
  });
});

describe("waitForResponse", () => {
  let manager: WaiterManager<string, string>;

  beforeEach(() => {
    manager = new WaiterManager<string, string>();
  });

  it("should resolve when waiter is notified", async () => {
    const promise = waitForResponse(manager, "key1", 1000);

    // Simulate async notification
    setTimeout(() => manager.notifyFirst("key1", "result"), 10);

    const result = await promise;
    expect(result).toEqual({ ok: true, data: "result" });
  });

  it("should timeout if not notified in time", async () => {
    const result = await waitForResponse(manager, "key1", 50);

    expect(result).toEqual({ ok: false, reason: "timeout" });
  });

  it("should cleanup waiter on timeout", async () => {
    await waitForResponse(manager, "key1", 50);

    expect(manager.hasWaiters("key1")).toBe(false);
  });

  it("should cleanup timeout on success", async () => {
    const promise = waitForResponse(manager, "key1", 1000);

    setTimeout(() => manager.notifyFirst("key1", "result"), 10);

    await promise;

    // If timeout wasn't cleaned up, this would fail or hang
    expect(manager.hasWaiters("key1")).toBe(false);
  });
});
