// src/tools/index.ts

import type { SessionStore } from "@/session";

import { createBrainstormTools } from "./brainstorm";
import { createPushQuestionTool } from "./factory";
import { createQuestionTools } from "./questions";
import { createResponseTools } from "./responses";
import { createSessionTools } from "./session";
import type { OcttoTools } from "./types";

export function createOcttoTools(sessions: SessionStore): OcttoTools {
  return {
    ...createSessionTools(sessions),
    ...createQuestionTools(sessions),
    ...createResponseTools(sessions),
    ...createPushQuestionTool(sessions),
    ...createBrainstormTools(sessions),
  };
}
