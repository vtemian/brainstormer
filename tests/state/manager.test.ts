// tests/state/manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { rmSync } from "fs";
import { StateManager } from "../../src/state/manager";

const TEST_DIR = "/tmp/octto-manager-test";

describe("StateManager", () => {
  let manager: StateManager;

  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
    manager = new StateManager(TEST_DIR);
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("createSession", () => {
    it("should create a new session with branches", async () => {
      const state = await manager.createSession("ses_create1", "Add healthcheck", [
        { id: "services", scope: "Which services need healthchecks" },
        { id: "format", scope: "What format for healthcheck responses" },
      ]);

      expect(state.session_id).toBe("ses_create1");
      expect(state.request).toBe("Add healthcheck");
      expect(Object.keys(state.branches)).toHaveLength(2);
      expect(state.branches.services.scope).toBe("Which services need healthchecks");
      expect(state.branches.format.scope).toBe("What format for healthcheck responses");
      expect(state.branch_order).toEqual(["services", "format"]);
    });
  });

  describe("addQuestionToBranch", () => {
    it("should add question to the correct branch", async () => {
      await manager.createSession("ses_addq", "Test", [
        { id: "branch1", scope: "Test scope" },
      ]);

      const question = await manager.addQuestionToBranch("ses_addq", "branch1", {
        id: "q_test1",
        type: "ask_text",
        text: "What is the goal?",
        config: { question: "What is the goal?" },
      });

      const state = await manager.getSession("ses_addq");
      expect(state!.branches.branch1.questions).toHaveLength(1);
      expect(state!.branches.branch1.questions[0].text).toBe("What is the goal?");
    });
  });

  describe("recordAnswer", () => {
    it("should record answer for a question", async () => {
      await manager.createSession("ses_answer", "Test", [
        { id: "branch1", scope: "Test scope" },
      ]);
      await manager.addQuestionToBranch("ses_answer", "branch1", {
        id: "q_ans1",
        type: "ask_text",
        text: "What is the goal?",
        config: { question: "What is the goal?" },
      });

      await manager.recordAnswer("ses_answer", "q_ans1", { text: "Build an API" });

      const state = await manager.getSession("ses_answer");
      expect(state!.branches.branch1.questions[0].answer).toEqual({ text: "Build an API" });
      expect(state!.branches.branch1.questions[0].answeredAt).toBeDefined();
    });
  });

  describe("completeBranch", () => {
    it("should mark branch as done with finding", async () => {
      await manager.createSession("ses_complete", "Test", [
        { id: "branch1", scope: "Test scope" },
      ]);

      await manager.completeBranch("ses_complete", "branch1", "User wants PostgreSQL and Redis");

      const state = await manager.getSession("ses_complete");
      expect(state!.branches.branch1.status).toBe("done");
      expect(state!.branches.branch1.finding).toBe("User wants PostgreSQL and Redis");
    });
  });

  describe("getNextExploringBranch", () => {
    it("should return first exploring branch", async () => {
      await manager.createSession("ses_next", "Test", [
        { id: "branch1", scope: "First scope" },
        { id: "branch2", scope: "Second scope" },
      ]);

      const branch = await manager.getNextExploringBranch("ses_next");
      expect(branch!.id).toBe("branch1");
    });

    it("should skip done branches", async () => {
      await manager.createSession("ses_skip", "Test", [
        { id: "branch1", scope: "First scope" },
        { id: "branch2", scope: "Second scope" },
      ]);
      await manager.completeBranch("ses_skip", "branch1", "Done");

      const branch = await manager.getNextExploringBranch("ses_skip");
      expect(branch!.id).toBe("branch2");
    });

    it("should return null when all branches done", async () => {
      await manager.createSession("ses_alldone", "Test", [
        { id: "branch1", scope: "First scope" },
      ]);
      await manager.completeBranch("ses_alldone", "branch1", "Done");

      const branch = await manager.getNextExploringBranch("ses_alldone");
      expect(branch).toBeNull();
    });
  });

  describe("isSessionComplete", () => {
    it("should return false when branches are exploring", async () => {
      await manager.createSession("ses_incomplete", "Test", [
        { id: "branch1", scope: "First scope" },
      ]);

      expect(await manager.isSessionComplete("ses_incomplete")).toBe(false);
    });

    it("should return true when all branches done", async () => {
      await manager.createSession("ses_allcomplete", "Test", [
        { id: "branch1", scope: "First scope" },
      ]);
      await manager.completeBranch("ses_allcomplete", "branch1", "Done");

      expect(await manager.isSessionComplete("ses_allcomplete")).toBe(true);
    });
  });
});
