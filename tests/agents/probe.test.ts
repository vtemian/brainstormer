// tests/agents/probe.test.ts
import { describe, it, expect } from "bun:test";
import { probeAgent } from "../../src/agents/probe";

describe("probeAgent", () => {
  it("should have correct configuration", () => {
    expect(probeAgent.mode).toBe("subagent");
    expect(probeAgent.model).toBe("anthropic/claude-opus-4-5");
  });

  it("should have prompt that works within branch scope", () => {
    expect(probeAgent.prompt).toContain("scope");
    expect(probeAgent.prompt).toContain("branch");
    expect(probeAgent.prompt).toContain("finding");
  });

  it("should output done with finding OR next question", () => {
    expect(probeAgent.prompt).toContain("done");
    expect(probeAgent.prompt).toContain("question");
  });
});
