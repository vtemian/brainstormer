// tests/tools/session.test.ts
import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { SessionManager } from "../../src/session/manager";
import { createSessionTools } from "../../src/tools/session";

describe("Session Tools", () => {
  let manager: SessionManager;
  let tools: ReturnType<typeof createSessionTools>;

  beforeEach(() => {
    manager = new SessionManager({ skipBrowser: true });
    tools = createSessionTools(manager);
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  describe("start_session", () => {
    it("should start a session and return formatted output", async () => {
      const result = await tools.start_session.execute({ title: "Test" }, {} as any);

      expect(result).toContain("Session Started");
      expect(result).toContain("Session ID");
      expect(result).toContain("ses_");
    });
  });

  describe("end_session", () => {
    it("should end a session successfully", async () => {
      const startResult = await tools.start_session.execute({}, {} as any);
      const sessionId = startResult.match(/ses_[a-z0-9]+/)?.[0];

      const result = await tools.end_session.execute({ session_id: sessionId! }, {} as any);

      expect(result).toContain("ended successfully");
    });

    it("should handle non-existent session", async () => {
      const result = await tools.end_session.execute({ session_id: "ses_fake" }, {} as any);

      expect(result).toContain("Failed");
    });
  });
});
