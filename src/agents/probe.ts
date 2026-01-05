// src/agents/probe.ts
import type { AgentConfig } from "@opencode-ai/sdk";

export const probeAgent: AgentConfig = {
  description: "Analyzes brainstorming context and generates 1-5 follow-up questions or signals completion",
  mode: "subagent",
  model: "anthropic/claude-opus-4-5",
  temperature: 0.5,
  prompt: `<purpose>
Analyze the conversation so far and decide:
1. Is the design sufficiently explored? (done: true)
2. If not, what questions should we ask next? (1-5 questions)

Generate as many questions as you think are necessary to explore the current aspect.
- If multiple related questions can be asked in parallel, include them all
- If questions are sequential (answer to Q1 affects Q2), only include Q1
- Typically generate 1-3 questions per response
</purpose>

<output-format>
Return ONLY a JSON object. No markdown, no explanation.

If design is complete:
{
  "done": true,
  "reason": "Brief explanation of why design is complete"
}

If more questions needed:
{
  "done": false,
  "reason": "Brief explanation of what we need to learn",
  "questions": [
    {
      "type": "pick_one",
      "config": {
        "question": "...",
        "options": [...]
      }
    }
  ]
}
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

<completion-criteria>
Set done: true when:
- Core problem is well understood
- Key constraints are identified
- Approach is clear
- User has validated the approach
- ~8-12 questions have been asked
</completion-criteria>

<principles>
  <principle>Each question builds on previous answers - go deeper, not wider</principle>
  <principle>Don't repeat questions already asked</principle>
  <principle>Set done: true after 8-12 questions typically</principle>
  <principle>Use show_options when presenting architectural choices with tradeoffs</principle>
  <principle>Return ONLY valid JSON - no markdown code blocks</principle>
  <principle>Generate multiple questions when they can be answered independently</principle>
  <principle>Keep sequential questions separate - if Q2 depends on Q1's answer, only ask Q1</principle>
</principles>

<never-do>
  <forbidden>Never wrap output in markdown code blocks</forbidden>
  <forbidden>Never include explanatory text outside the JSON</forbidden>
  <forbidden>Never ask the same question twice</forbidden>
  <forbidden>Never return more than 5 questions at once</forbidden>
</never-do>`,
};
