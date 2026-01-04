// tests/agents/context.test.ts
import { describe, it, expect } from "bun:test";
import { formatAnswer, buildProbeContext, type QAPair, type PendingQuestion } from "../../src/agents/context";

describe("formatAnswer", () => {
  it("should format pick_one answer", () => {
    const answer = { selected: "opt1" };
    const config = { options: [{ id: "opt1", label: "Option One" }] };

    const result = formatAnswer("pick_one", answer, config);

    expect(result).toBe('User selected "Option One"');
  });

  it("should format pick_many answer", () => {
    const answer = { selected: ["a", "c"] };
    const config = {
      options: [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
        { id: "c", label: "Charlie" },
      ],
    };

    const result = formatAnswer("pick_many", answer, config);

    expect(result).toBe('User selected: "Alpha", "Charlie"');
  });

  it("should format confirm yes", () => {
    const result = formatAnswer("confirm", { choice: "yes" }, {});
    expect(result).toBe("User said yes");
  });

  it("should format confirm no", () => {
    const result = formatAnswer("confirm", { choice: "no" }, {});
    expect(result).toBe("User said no");
  });

  it("should format ask_text answer", () => {
    const result = formatAnswer("ask_text", { text: "Must work offline" }, {});
    expect(result).toBe('User wrote: "Must work offline"');
  });

  it("should format show_options with feedback", () => {
    const answer = { selected: "opt2", feedback: "I prefer this approach" };
    const config = { options: [{ id: "opt2", label: "Option Two" }] };

    const result = formatAnswer("show_options", answer, config);

    expect(result).toBe('User chose "Option Two" with feedback: "I prefer this approach"');
  });

  it("should format thumbs up", () => {
    const result = formatAnswer("thumbs", { choice: "up" }, {});
    expect(result).toBe("User gave thumbs up");
  });

  it("should format slider value", () => {
    const result = formatAnswer("slider", { value: 7 }, {});
    expect(result).toBe("User set value to 7");
  });

  it("should format rank answer", () => {
    const answer = { ranking: ["c", "a", "b"] };
    const config = {
      options: [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
        { id: "c", label: "Charlie" },
      ],
    };

    const result = formatAnswer("rank", answer, config);

    expect(result).toBe("User ranked: 1. Charlie, 2. Alpha, 3. Beta");
  });

  it("should format rate answer", () => {
    const answer = { ratings: { a: 5, b: 3 } };
    const config = {
      options: [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
      ],
    };

    const result = formatAnswer("rate", answer, config);

    expect(result).toContain("Alpha: 5");
    expect(result).toContain("Beta: 3");
  });
});

describe("buildProbeContext", () => {
  it("should build context with no questions", () => {
    const result = buildProbeContext("Build a CLI tool", []);

    expect(result).toContain("ORIGINAL REQUEST:");
    expect(result).toContain("Build a CLI tool");
    expect(result).toContain("(No questions answered yet)");
  });

  it("should build context with Q&A pairs", () => {
    const qaPairs: QAPair[] = [
      {
        questionNumber: 1,
        questionType: "pick_one",
        questionText: "What's the primary goal?",
        answer: { selected: "speed" },
        config: { options: [{ id: "speed", label: "Fast performance" }] },
      },
      {
        questionNumber: 2,
        questionType: "ask_text",
        questionText: "Any constraints?",
        answer: { text: "Must work on macOS" },
        config: {},
      },
    ];

    const result = buildProbeContext("Build a CLI tool", qaPairs);

    expect(result).toContain("ORIGINAL REQUEST:");
    expect(result).toContain("Build a CLI tool");
    expect(result).toContain("CONVERSATION:");
    expect(result).toContain("Q1 [pick_one]: What's the primary goal?");
    expect(result).toContain('A1: User selected "Fast performance"');
    expect(result).toContain("Q2 [ask_text]: Any constraints?");
    expect(result).toContain('A2: User wrote: "Must work on macOS"');
  });
});

describe("buildProbeContext with pending questions", () => {
  it("should show pending questions indicator", () => {
    const qaPairs: QAPair[] = [
      {
        questionNumber: 1,
        questionType: "pick_one",
        questionText: "What's the primary goal?",
        answer: { selected: "speed" },
        config: { options: [{ id: "speed", label: "Fast performance" }] },
      },
    ];
    const pendingQuestions: PendingQuestion[] = [
      { questionNumber: 2, questionType: "ask_text" as const, questionText: "Any constraints?" },
      { questionNumber: 3, questionType: "pick_many" as const, questionText: "Which features?" },
    ];

    const result = buildProbeContext("Build a CLI tool", qaPairs, pendingQuestions);

    expect(result).toContain("ORIGINAL REQUEST:");
    expect(result).toContain("Build a CLI tool");
    expect(result).toContain("CONVERSATION:");
    expect(result).toContain("Q1 [pick_one]: What's the primary goal?");
    expect(result).toContain('A1: User selected "Fast performance"');
    expect(result).toContain("PENDING QUESTIONS:");
    expect(result).toContain("Q2 [ask_text]: Any constraints?");
    expect(result).toContain("Q3 [pick_many]: Which features?");
  });

  it("should not show pending section when no pending questions", () => {
    const qaPairs: QAPair[] = [
      {
        questionNumber: 1,
        questionType: "confirm",
        questionText: "Ready?",
        answer: { choice: "yes" },
        config: {},
      },
    ];

    const result = buildProbeContext("Build a CLI tool", qaPairs, []);

    expect(result).toContain("CONVERSATION:");
    expect(result).not.toContain("PENDING QUESTIONS:");
  });

  it("should handle all questions pending (no answers yet)", () => {
    const pendingQuestions: PendingQuestion[] = [
      { questionNumber: 1, questionType: "pick_one" as const, questionText: "Goal?" },
      { questionNumber: 2, questionType: "ask_text" as const, questionText: "Constraints?" },
    ];

    const result = buildProbeContext("Build a CLI tool", [], pendingQuestions);

    expect(result).toContain("(No questions answered yet)");
    expect(result).toContain("PENDING QUESTIONS:");
    expect(result).toContain("Q1 [pick_one]: Goal?");
    expect(result).toContain("Q2 [ask_text]: Constraints?");
  });
});
