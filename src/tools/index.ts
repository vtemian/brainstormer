// src/tools/index.ts
import type { SessionManager } from "../session/manager";
import { createSessionTools } from "./session";
import { createQuestionTools } from "./questions";
import { createResponseTools } from "./responses";

export function createBrainstormerTools(manager: SessionManager) {
  return {
    ...createSessionTools(manager),
    ...createQuestionTools(manager),
    ...createResponseTools(manager),
  };
}
