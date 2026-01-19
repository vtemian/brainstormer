// tests/config/loader.test.ts
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { resolvePort } from "../../src/config/loader";

describe("resolvePort", () => {
  const originalEnv = process.env.OCTTO_PORT;

  beforeEach(() => {
    delete process.env.OCTTO_PORT;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.OCTTO_PORT = originalEnv;
    } else {
      delete process.env.OCTTO_PORT;
    }
  });

  describe("env var priority", () => {
    it("should use OCTTO_PORT env var when set", () => {
      process.env.OCTTO_PORT = "4000";
      expect(resolvePort(3000)).toBe(4000);
    });

    it("should use OCTTO_PORT over config port", () => {
      process.env.OCTTO_PORT = "5000";
      expect(resolvePort(3000)).toBe(5000);
    });

    it("should use OCTTO_PORT=0 for random port", () => {
      process.env.OCTTO_PORT = "0";
      expect(resolvePort(3000)).toBe(0);
    });
  });

  describe("config port fallback", () => {
    it("should use config port when env var not set", () => {
      expect(resolvePort(3000)).toBe(3000);
    });

    it("should use config port 0 for random port", () => {
      expect(resolvePort(0)).toBe(0);
    });
  });

  describe("default fallback", () => {
    it("should return 0 when no port configured", () => {
      expect(resolvePort(undefined)).toBe(0);
    });

    it("should return 0 when config port is undefined", () => {
      expect(resolvePort()).toBe(0);
    });
  });

  describe("invalid env var handling", () => {
    it("should ignore non-numeric env var and use config", () => {
      process.env.OCTTO_PORT = "invalid";
      expect(resolvePort(3000)).toBe(3000);
    });

    it("should ignore negative env var and use config", () => {
      process.env.OCTTO_PORT = "-1";
      expect(resolvePort(3000)).toBe(3000);
    });

    it("should ignore port above 65535 and use config", () => {
      process.env.OCTTO_PORT = "65536";
      expect(resolvePort(3000)).toBe(3000);
    });

    it("should ignore float env var and use config", () => {
      process.env.OCTTO_PORT = "3000.5";
      expect(resolvePort(3000)).toBe(3000);
    });

    it("should fall back to default 0 when env invalid and no config", () => {
      process.env.OCTTO_PORT = "invalid";
      expect(resolvePort(undefined)).toBe(0);
    });
  });
});
