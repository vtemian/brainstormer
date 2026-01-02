// src/index.ts
import type { Plugin } from "@opencode-ai/plugin";
import { SessionManager } from "./session/manager";
import { createBrainstormerTools } from "./tools";
import { agents } from "./agents";

const BrainstormerPlugin: Plugin = async (ctx) => {
  // Create session manager
  const sessionManager = new SessionManager();

  // Track which brainstormer sessions belong to which OpenCode sessions
  const sessionsByOpenCodeSession = new Map<string, Set<string>>();

  // Create all tools with session tracking
  const baseTools = createBrainstormerTools(sessionManager);

  // Wrap start_session to track ownership, but use original execute for enforcement
  const originalStartSession = baseTools.start_session;
  const wrappedStartSession = {
    ...originalStartSession,
    execute: async (args: any, toolCtx: any) => {
      // Call original execute (which has enforcement)
      const result = await originalStartSession.execute(args, toolCtx);

      // If successful, track the session
      const sessionIdMatch = result.match(/ses_[a-z0-9]+/);
      if (sessionIdMatch) {
        const openCodeSessionId = toolCtx?.sessionID;
        if (openCodeSessionId) {
          if (!sessionsByOpenCodeSession.has(openCodeSessionId)) {
            sessionsByOpenCodeSession.set(openCodeSessionId, new Set());
          }
          sessionsByOpenCodeSession.get(openCodeSessionId)!.add(sessionIdMatch[0]);
        }
      }

      return result;
    },
  };

  return {
    tool: {
      ...baseTools,
      start_session: wrappedStartSession,
    },

    config: async (config) => {
      // Add brainstormer agent
      config.agent = {
        ...config.agent,
        ...agents,
      };
    },

    event: async ({ event }) => {
      // Cleanup sessions when OpenCode session is deleted
      if (event.type === "session.deleted") {
        const props = event.properties as { info?: { id?: string } } | undefined;
        const openCodeSessionId = props?.info?.id;

        if (openCodeSessionId) {
          const brainstormerSessions = sessionsByOpenCodeSession.get(openCodeSessionId);
          if (brainstormerSessions) {
            for (const sessionId of brainstormerSessions) {
              await sessionManager.endSession(sessionId);
            }
            sessionsByOpenCodeSession.delete(openCodeSessionId);
          }
        }
      }
    },
  };
};

export default BrainstormerPlugin;

// Re-export types for consumers
export type * from "./types";
