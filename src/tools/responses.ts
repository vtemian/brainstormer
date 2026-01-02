// src/tools/responses.ts
import { tool } from "@opencode-ai/plugin/tool";
import type { SessionManager } from "../session/manager";

export function createResponseTools(manager: SessionManager) {
  const get_answer = tool({
    description: `Get the answer to a question.
By default returns immediately with current status.
Set block=true to wait for user response (with optional timeout).`,
    args: {
      question_id: tool.schema.string().describe("Question ID from a question tool"),
      block: tool.schema.boolean().optional().describe("Wait for response (default: false)"),
      timeout: tool.schema
        .number()
        .optional()
        .describe("Max milliseconds to wait if blocking (default: 300000 = 5 min)"),
    },
    execute: async (args) => {
      const result = await manager.getAnswer({
        question_id: args.question_id,
        block: args.block,
        timeout: args.timeout,
      });

      if (result.completed) {
        return `## Answer Received

**Status:** ${result.status}

**Response:**
\`\`\`json
${JSON.stringify(result.response, null, 2)}
\`\`\``;
      }

      return `## Waiting for Answer

**Status:** ${result.status}
**Reason:** ${result.reason}

${result.status === "pending" ? "User has not answered yet. Call again with block=true to wait." : ""}`;
    },
  });

  const list_questions = tool({
    description: `List all questions and their status for a session.`,
    args: {
      session_id: tool.schema.string().optional().describe("Session ID (omit for all sessions)"),
    },
    execute: async (args) => {
      const result = manager.listQuestions(args.session_id);

      if (result.questions.length === 0) {
        return "No questions found.";
      }

      let output = "## Questions\n\n";
      output += "| ID | Type | Status | Created | Answered |\n";
      output += "|----|------|--------|---------|----------|\n";

      for (const q of result.questions) {
        output += `| ${q.id} | ${q.type} | ${q.status} | ${q.createdAt} | ${q.answeredAt || "-"} |\n`;
      }

      return output;
    },
  });

  const cancel_question = tool({
    description: `Cancel a pending question.
The question will be removed from the user's queue.`,
    args: {
      question_id: tool.schema.string().describe("Question ID to cancel"),
    },
    execute: async (args) => {
      const result = manager.cancelQuestion(args.question_id);
      if (result.ok) {
        return `Question ${args.question_id} cancelled.`;
      }
      return `Could not cancel question ${args.question_id}. It may already be answered or not exist.`;
    },
  });

  return { get_answer, list_questions, cancel_question };
}
