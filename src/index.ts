// src/index.ts

import { agents } from "@agents";
import { loadConfig, mergeAgentConfigs } from "@config";
import type { Plugin } from "@opencode-ai/plugin";
import { SessionManager } from "@session";
import { createOcttoTools } from "@tools";

const OcttoPlugin: Plugin = async (ctx) => {
  // Load user configuration and merge with default agents
  const userConfig = await loadConfig();
  const mergedAgents = mergeAgentConfigs(agents, userConfig);
  const sessionManager = new SessionManager();
  const sessionsByOpenCodeSession = new Map<string, Set<string>>();

  const baseTools = createOcttoTools(sessionManager, ctx.client);

  // Wrap start_session to track for cleanup
  const originalStartSession = baseTools.start_session;
  const wrappedStartSession = {
    ...originalStartSession,
    execute: async (args: Record<string, unknown>, toolCtx: import("@opencode-ai/plugin/tool").ToolContext) => {
      type StartSessionArgs = Parameters<typeof originalStartSession.execute>[0];
      const result = await originalStartSession.execute(args as StartSessionArgs, toolCtx);

      const sessionIdMatch = result.match(/ses_[a-z0-9]+/);
      if (sessionIdMatch && toolCtx.sessionID) {
        const octtoSessionId = sessionIdMatch[0];
        const openCodeSessionId = toolCtx.sessionID;

        if (!sessionsByOpenCodeSession.has(openCodeSessionId)) {
          sessionsByOpenCodeSession.set(openCodeSessionId, new Set());
        }
        sessionsByOpenCodeSession.get(openCodeSessionId)!.add(octtoSessionId);
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
      config.agent = {
        ...config.agent,
        ...mergedAgents,
      };
    },

    event: async ({ event }) => {
      if (event.type === "session.deleted") {
        const props = event.properties as { info?: { id?: string } } | undefined;
        const openCodeSessionId = props?.info?.id;

        if (openCodeSessionId) {
          const octtoSessions = sessionsByOpenCodeSession.get(openCodeSessionId);
          if (octtoSessions) {
            for (const sessionId of octtoSessions) {
              await sessionManager.endSession(sessionId);
            }
            sessionsByOpenCodeSession.delete(openCodeSessionId);
          }
        }
      }
    },
  };
};

export default OcttoPlugin;

export type * from "./types";
