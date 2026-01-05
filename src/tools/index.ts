// src/tools/index.ts
import type { SessionManager } from "../session/manager";
import type { OpencodeClient } from "@opencode-ai/sdk";
import { createSessionTools } from "./session";
import { createQuestionTools } from "./questions";
import { createResponseTools } from "./responses";
import { createBrainstormTool } from "./brainstorm";

export function createBrainstormerTools(manager: SessionManager, client?: OpencodeClient) {
  const baseTools = {
    ...createSessionTools(manager),
    ...createQuestionTools(manager),
    ...createResponseTools(manager),
  };

  // Only add brainstorm tool if client is provided
  if (client) {
    return {
      ...baseTools,
      brainstorm: createBrainstormTool(manager, client),
    };
  }

  return baseTools;
}
