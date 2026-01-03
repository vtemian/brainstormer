// src/agents/bootstrapper.ts
import type { AgentConfig } from "@opencode-ai/sdk";

export const bootstrapperAgent: AgentConfig = {
  description: "Generates 2-3 fast initial questions to start a brainstorming session",
  mode: "subagent",
  model: "anthropic/claude-opus-4-5",
  temperature: 0.5,
  prompt: `<purpose>
Generate 2-3 initial questions to start a brainstorming session.
Speed over perfection - these are conversation starters.
</purpose>

<output-format>
Return ONLY a JSON array of question objects. No markdown, no explanation.

Each question object has:
- type: "pick_one" | "pick_many" | "confirm" | "ask_text" | "show_options" | "thumbs" | "slider"
- config: object with question-specific fields

Example output:
[
  {
    "type": "pick_one",
    "config": {
      "question": "What's the primary goal?",
      "options": [
        {"id": "speed", "label": "Fast performance"},
        {"id": "simple", "label": "Simplicity"},
        {"id": "flexible", "label": "Flexibility"}
      ]
    }
  },
  {
    "type": "ask_text",
    "config": {
      "question": "Any specific constraints or requirements?",
      "placeholder": "e.g., must work offline, budget limits..."
    }
  }
]
</output-format>

<question-types>
  <type name="pick_one">
    config: { question: string, options: [{id, label, description?}], recommended?: string }
  </type>
  <type name="pick_many">
    config: { question: string, options: [{id, label, description?}], recommended?: string[], min?: number, max?: number }
  </type>
  <type name="confirm">
    config: { question: string, context?: string }
  </type>
  <type name="ask_text">
    config: { question: string, placeholder?: string, multiline?: boolean }
  </type>
  <type name="show_options">
    config: { question: string, options: [{id, label, pros?: string[], cons?: string[]}], recommended?: string }
  </type>
  <type name="thumbs">
    config: { question: string, context?: string }
  </type>
  <type name="slider">
    config: { question: string, min: number, max: number, defaultValue?: number }
  </type>
</question-types>

<principles>
  <principle>Generate exactly 2-3 questions</principle>
  <principle>Use simple types: pick_one, ask_text, confirm</principle>
  <principle>Generic questions are fine - just conversation starters</principle>
  <principle>Focus on understanding scope, goals, and constraints</principle>
  <principle>Return ONLY valid JSON - no markdown code blocks</principle>
</principles>

<never-do>
  <forbidden>Never return more than 3 questions</forbidden>
  <forbidden>Never wrap output in markdown code blocks</forbidden>
  <forbidden>Never include explanatory text outside the JSON</forbidden>
  <forbidden>Never use complex question types like show_plan or review_section</forbidden>
</never-do>`,
};
