// tests/session/manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SessionManager } from "../../src/session/manager";

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager({ skipBrowser: true });
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  describe("startSession", () => {
    it("should create a session with unique ID", async () => {
      const result = await manager.startSession({ title: "Test Session" });

      expect(result.session_id).toMatch(/^ses_[a-z0-9]{8}$/);
      expect(result.url).toMatch(/^http:\/\/localhost:\d+$/);
    });

    it("should create multiple sessions with different IDs", async () => {
      const result1 = await manager.startSession({});
      const result2 = await manager.startSession({});

      expect(result1.session_id).not.toBe(result2.session_id);
      expect(result1.url).not.toBe(result2.url);
    });
  });

  describe("endSession", () => {
    it("should end an existing session", async () => {
      const { session_id } = await manager.startSession({});

      const result = await manager.endSession(session_id);

      expect(result.ok).toBe(true);
    });

    it("should return ok=false for non-existent session", async () => {
      const result = await manager.endSession("ses_nonexistent");

      expect(result.ok).toBe(false);
    });
  });

  describe("pushQuestion", () => {
    it("should push a question and return question ID", async () => {
      const { session_id } = await manager.startSession({});

      const result = manager.pushQuestion(session_id, "pick_one", {
        question: "Test question",
        options: [{ id: "a", label: "Option A" }],
      });

      expect(result.question_id).toMatch(/^q_[a-z0-9]{8}$/);
    });

    it("should throw for non-existent session", async () => {
      expect(() => {
        manager.pushQuestion("ses_nonexistent", "pick_one", {
          question: "Test",
          options: [],
        });
      }).toThrow("Session not found");
    });
  });

  describe("getAnswer", () => {
    it("should return pending status for unanswered question", async () => {
      const { session_id } = await manager.startSession({});
      const { question_id } = manager.pushQuestion(session_id, "confirm", {
        question: "Test?",
      });

      const result = await manager.getAnswer({ question_id, block: false });

      expect(result.completed).toBe(false);
      expect(result.status).toBe("pending");
    });

    it("should return cancelled status for non-existent question", async () => {
      const result = await manager.getAnswer({ question_id: "q_nonexistent", block: false });

      expect(result.completed).toBe(false);
      expect(result.status).toBe("cancelled");
    });
  });

  describe("cancelQuestion", () => {
    it("should cancel a pending question", async () => {
      const { session_id } = await manager.startSession({});
      const { question_id } = manager.pushQuestion(session_id, "confirm", {
        question: "Test?",
      });

      const result = manager.cancelQuestion(question_id);

      expect(result.ok).toBe(true);
    });

    it("should return ok=false for non-existent question", () => {
      const result = manager.cancelQuestion("q_nonexistent");

      expect(result.ok).toBe(false);
    });
  });

  describe("listQuestions", () => {
    it("should list all questions across sessions", async () => {
      const { session_id } = await manager.startSession({});
      manager.pushQuestion(session_id, "confirm", { question: "Q1?" });
      manager.pushQuestion(session_id, "pick_one", { question: "Q2?", options: [] });

      const result = manager.listQuestions();

      expect(result.questions.length).toBe(2);
    });

    it("should filter by session ID", async () => {
      const { session_id: s1 } = await manager.startSession({});
      const { session_id: s2 } = await manager.startSession({});
      manager.pushQuestion(s1, "confirm", { question: "Q1?" });
      manager.pushQuestion(s2, "confirm", { question: "Q2?" });

      const result = manager.listQuestions(s1);

      expect(result.questions.length).toBe(1);
    });
  });
});
