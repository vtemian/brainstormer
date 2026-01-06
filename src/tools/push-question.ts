// src/tools/push-question.ts
import { tool } from "@opencode-ai/plugin/tool";
import type { QuestionConfig, QuestionType, SessionManager } from "@session";

export function createPushQuestionTool(manager: SessionManager) {
  const push_question = tool({
    description: `Push a question to the session queue. This is the generic tool for adding any question type.
The question will appear in the browser for the user to answer.`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      type: tool.schema
        .enum([
          "pick_one",
          "pick_many",
          "confirm",
          "ask_text",
          "show_options",
          "review_section",
          "thumbs",
          "slider",
          "rank",
          "rate",
        ])
        .describe("Question type"),
      config: tool.schema.object({}).passthrough().describe("Question configuration (varies by type)"),
    },
    execute: async (args) => {
      try {
        const result = manager.pushQuestion(
          args.session_id,
          args.type as QuestionType,
          args.config as unknown as QuestionConfig,
        );
        return `Question pushed: ${result.question_id}
Type: ${args.type}
Use get_next_answer(session_id, block=true) to wait for the user's response.`;
      } catch (error) {
        return `Failed to push question: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  return { push_question };
}
