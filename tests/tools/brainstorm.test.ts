// tests/tools/brainstorm.test.ts
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rmSync } from "node:fs";

import { createSessionStore } from "../../src/session/sessions";
import { createBrainstormTools } from "../../src/tools/brainstorm";

describe("Brainstorm Tools", () => {
  let sessions: ReturnType<typeof createSessionStore>;
  let tools: ReturnType<typeof createBrainstormTools>;

  beforeEach(() => {
    sessions = createSessionStore({ skipBrowser: true });
    tools = createBrainstormTools(sessions);
  });

  afterEach(() => {
    rmSync(".octto", { recursive: true, force: true });
  });

  describe("create_brainstorm", () => {
    it("should create brainstorm session with branches", async () => {
      const result = await tools.create_brainstorm.execute(
        {
          request: "Add healthcheck",
          branches: [
            {
              id: "services",
              scope: "Which services to monitor",
              initial_question: {
                type: "ask_text",
                config: { question: "What services?" },
              },
            },
          ],
        },
        {} as any,
      );

      expect(result).toContain("ses_");
      expect(result).toContain("services");
    });
  });
});
