# Code Style Guide

## Naming Conventions

### Files and Directories

| Type | Convention | Example |
|------|------------|---------|
| Source files | `kebab-case.ts` or `camelCase.ts` | `manager.ts`, `bundle.ts` |
| Test files | `{name}.test.ts` | `manager.test.ts` |
| Directories | `lowercase` | `session/`, `tools/`, `agents/` |
| Index files | `index.ts` | Re-exports module's public API |

### Code Identifiers

| Type | Convention | Example |
|------|------------|---------|
| Classes | `PascalCase` | `SessionManager` |
| Interfaces | `PascalCase` | `Question`, `Session` |
| Type aliases | `PascalCase` | `QuestionType`, `QuestionStatus` |
| Functions | `camelCase` | `createServer`, `formatAnswer` |
| Variables | `camelCase` | `sessionId`, `questionToSession` |
| Constants | `camelCase` or `UPPER_SNAKE_CASE` | `wsUrl`, `DEFAULT_TIMEOUT` |
| Private fields | `camelCase` (no prefix) | `this.sessions`, `this.options` |
| Tool names | `snake_case` | `start_session`, `get_next_answer` |
| Agent names | `lowercase` | `octto`, `bootstrapper`, `probe` |

### ID Prefixes

Generated IDs use consistent prefixes:
- Sessions: `ses_` + 8 random alphanumeric chars
- Questions: `q_` + 8 random alphanumeric chars

## File Organization

### Module Structure

Each module follows this pattern:

```typescript
// 1. File header comment (optional, describes purpose)
// src/tools/session.ts

// 2. Type imports (from external packages first, then local)
import { tool } from "@opencode-ai/plugin/tool";
import type { SessionManager } from "../session/manager";

// 3. Type definitions (if not in separate types.ts)

// 4. Main exports (functions, classes, constants)
export function createSessionTools(manager: SessionManager) {
  // ...
}
```

### Index Files

Index files re-export public API:

```typescript
// src/agents/index.ts
import type { AgentConfig } from "@opencode-ai/sdk";
import { octtoAgent } from "./octto";
import { bootstrapperAgent } from "./bootstrapper";
import { probeAgent } from "./probe";

export const agents: Record<string, AgentConfig> = {
  octto: octtoAgent,
  bootstrapper: bootstrapperAgent,
  probe: probeAgent,
};

export { octtoAgent, bootstrapperAgent, probeAgent };
```

## Import Style

### Order

1. External packages (alphabetical)
2. Blank line
3. Local imports (by distance: `../` before `./`)

### Type-Only Imports

Use `import type` for type-only imports:

```typescript
import type { ServerWebSocket } from "bun";
import type { Session, Question } from "./types";
```

### Path Style

- Use relative paths for local imports
- No path aliases configured

## Code Patterns

### Tool Definitions

Tools use the `@opencode-ai/plugin/tool` helper:

```typescript
const pick_one = tool({
  description: `Ask user to select ONE option from a list.
Returns immediately with question_id. Use get_answer to retrieve response.`,
  args: {
    session_id: tool.schema.string().describe("Session ID from start_session"),
    question: tool.schema.string().describe("Question to display"),
    options: tool.schema.array(
      tool.schema.object({
        id: tool.schema.string().describe("Unique option identifier"),
        label: tool.schema.string().describe("Display label"),
        description: tool.schema.string().optional().describe("Optional description"),
      }),
    ).describe("Available options"),
  },
  execute: async (args) => {
    // Implementation
  },
});
```

### Agent Definitions

Agents use XML-style prompts with clear sections:

```typescript
export const probeAgent: AgentConfig = {
  description: "Generates thoughtful follow-up questions based on conversation context",
  mode: "subagent",
  model: "anthropic/claude-opus-4-5",
  temperature: 0.6,
  prompt: `<purpose>
Analyze the conversation so far and decide...
</purpose>

<output-format>
Return ONLY a JSON object...
</output-format>

<principles>
  <principle>Each question builds on previous answers</principle>
</principles>

<never-do>
  <forbidden>Never return more than 1 question at a time</forbidden>
</never-do>`,
};
```

### Class Structure

```typescript
export class SessionManager {
  // Private fields first
  private sessions: Map<string, Session> = new Map();
  private options: SessionManagerOptions;

  // Constructor
  constructor(options: SessionManagerOptions = {}) {
    this.options = options;
  }

  // Public methods (grouped by functionality)
  async startSession(input: StartSessionInput): Promise<StartSessionOutput> {
    // ...
  }

  // Private/internal methods at the end
  private generateId(prefix: string): string {
    // ...
  }
}
```

### Async/Await

- Prefer `async/await` over raw Promises
- Use `Promise<T>` return types explicitly

```typescript
async startSession(input: StartSessionInput): Promise<StartSessionOutput> {
  const { server, port } = await createServer(sessionId, this);
  // ...
}
```

### Error Handling

- Throw errors for invalid states
- Return result objects for expected failures

```typescript
// Throw for programming errors
if (!session) {
  throw new Error(`Session not found: ${sessionId}`);
}

// Return result for expected cases
async endSession(sessionId: string): Promise<EndSessionOutput> {
  const session = this.sessions.get(sessionId);
  if (!session) {
    return { ok: false };  // Expected: session may not exist
  }
  // ...
  return { ok: true };
}
```

### Type Guards and Assertions

Use type assertions sparingly, prefer type guards:

```typescript
// Type assertion (when necessary)
const ans = answer as Record<string, unknown>;

// Non-null assertion (use when confident)
sessionsByOpenCodeSession.get(openCodeSessionId)!.add(sessionIdMatch[0]);
```

## Testing

### Test File Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SessionManager } from "../../src/session/manager";

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager({ skipBrowser: true });
  });

  afterEach(async () => {
    await manager.cleanup();
  });

  describe("startSession", () => {
    it("should create a session with unique ID", async () => {
      const result = await manager.startSession({ title: "Test Session" });
      expect(result.session_id).toMatch(/^ses_[a-z0-9]{8}$/);
    });
  });
});
```

### Test Patterns

- Use `skipBrowser: true` in tests to avoid opening browsers
- Clean up resources in `afterEach`
- Simulate WebSocket messages via `manager.handleWsMessage()`
- Use short timeouts (100ms) for timeout tests

## Logging

- Use `console.error` for error logging
- Prefix with `[octto]` for identification

```typescript
console.error("[octto] Failed to parse WebSocket message:", error);
```

## Do's and Don'ts

### Do

- Use TypeScript strict mode
- Export types with `export type *` for type-only re-exports
- Use descriptive tool descriptions (multi-line with examples)
- Keep UI bundle self-contained (no external dependencies except fonts)
- Use `Map` for ID-keyed collections
- Clean up resources (servers, sessions) on shutdown

### Don't

- Don't use `any` without good reason (disabled in biome)
- Don't use non-null assertions without verification
- Don't leave console.log statements in production code
- Don't import from `dist/` - always use `src/`
- Don't use synchronous file operations
- Don't hardcode ports (use port 0 for auto-assignment)

## Formatting

Enforced by Biome:

| Setting | Value |
|---------|-------|
| Indent | 2 spaces |
| Line width | 120 characters |
| Quote style | Double quotes |
| Semicolons | Required (default) |
| Trailing commas | ES5 style |

Run `bun run format` to auto-format.
