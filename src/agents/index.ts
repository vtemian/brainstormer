// src/agents/index.ts
import type { AgentConfig } from "@opencode-ai/sdk";
import { octtoAgent } from "./octto";
import { bootstrapperAgent } from "./bootstrapper";

export const agents: Record<string, AgentConfig> = {
  octto: octtoAgent,
  bootstrapper: bootstrapperAgent,
};

export { octtoAgent, bootstrapperAgent };
