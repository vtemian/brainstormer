// tests/config/schema.test.ts
import { describe, expect, it } from "bun:test";

import * as v from "valibot";

import { OcttoConfigSchema } from "../../src/config/schema";

describe("OcttoConfigSchema", () => {
  describe("port field", () => {
    it("should accept valid port number", () => {
      const result = v.safeParse(OcttoConfigSchema, { port: 3000 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.port).toBe(3000);
      }
    });

    it("should accept port 0 (random port)", () => {
      const result = v.safeParse(OcttoConfigSchema, { port: 0 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.port).toBe(0);
      }
    });

    it("should accept maximum valid port 65535", () => {
      const result = v.safeParse(OcttoConfigSchema, { port: 65535 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.port).toBe(65535);
      }
    });

    it("should reject negative port", () => {
      const result = v.safeParse(OcttoConfigSchema, { port: -1 });
      expect(result.success).toBe(false);
    });

    it("should reject port above 65535", () => {
      const result = v.safeParse(OcttoConfigSchema, { port: 65536 });
      expect(result.success).toBe(false);
    });

    it("should reject non-integer port", () => {
      const result = v.safeParse(OcttoConfigSchema, { port: 3000.5 });
      expect(result.success).toBe(false);
    });

    it("should allow config without port (optional)", () => {
      const result = v.safeParse(OcttoConfigSchema, {});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.output.port).toBeUndefined();
      }
    });
  });
});
