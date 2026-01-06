// src/tools/question-factory.ts

import { tool } from "@opencode-ai/plugin/tool";

import type { QuestionConfig, QuestionType, SessionStore } from "@/session";

import type { OcttoTool } from "./types";

type ArgsSchema = Parameters<typeof tool>[0]["args"];

interface QuestionToolConfig<T> {
  type: QuestionType;
  description: string;
  args: ArgsSchema;
  validate?: (args: T) => string | null;
  toConfig: (args: T) => QuestionConfig;
}

export function createQuestionToolFactory(sessions: SessionStore) {
  return function createQuestionTool<T extends { session_id: string }>(config: QuestionToolConfig<T>): OcttoTool {
    return tool({
      description: `${config.description}
Returns immediately with question_id. Use get_answer to retrieve response.`,
      args: {
        session_id: tool.schema.string().describe("Session ID from start_session"),
        ...config.args,
      },
      execute: async (args) => {
        const validationError = config.validate?.(args as unknown as T);
        if (validationError) return `Failed: ${validationError}`;

        try {
          const questionConfig = config.toConfig(args as unknown as T);
          const result = sessions.pushQuestion(args.session_id as string, config.type, questionConfig);
          return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
        } catch (error) {
          return `Failed: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    });
  };
}
