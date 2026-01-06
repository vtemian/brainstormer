// src/tools/questions.ts
import { tool } from "@opencode-ai/plugin/tool";

import type { SessionStore } from "@/session";

import type { ConfirmConfig, PickManyConfig, PickOneConfig, RankConfig, RateConfig } from "../types";
import { createQuestionToolFactory } from "./question-factory";
import type { OcttoTools } from "./types";

const optionsSchema = tool.schema
  .array(
    tool.schema.object({
      id: tool.schema.string().describe("Unique option identifier"),
      label: tool.schema.string().describe("Display label"),
      description: tool.schema.string().optional().describe("Optional description"),
    }),
  )
  .describe("Available options");

function requireOptions(args: { options?: unknown[] }): string | null {
  if (!args.options || args.options.length === 0) return "options array must not be empty";
  return null;
}

export function createQuestionTools(sessions: SessionStore): OcttoTools {
  const createTool = createQuestionToolFactory(sessions);

  const pick_one = createTool<PickOneConfig & { session_id: string }>({
    type: "pick_one",
    description: `Ask user to select ONE option from a list.
Response format: { selected: string } where selected is the chosen option id.`,
    args: {
      question: tool.schema.string().describe("Question to display"),
      options: optionsSchema,
      recommended: tool.schema.string().optional().describe("Recommended option id (highlighted)"),
      allowOther: tool.schema.boolean().optional().describe("Allow custom 'other' input"),
    },
    validate: requireOptions,
    toConfig: (args) => ({
      question: args.question,
      options: args.options,
      recommended: args.recommended,
      allowOther: args.allowOther,
    }),
  });

  const pick_many = createTool<PickManyConfig & { session_id: string }>({
    type: "pick_many",
    description: `Ask user to select MULTIPLE options from a list.
Response format: { selected: string[] } where selected is array of chosen option ids.`,
    args: {
      question: tool.schema.string().describe("Question to display"),
      options: optionsSchema,
      recommended: tool.schema.array(tool.schema.string()).optional().describe("Recommended option ids"),
      min: tool.schema.number().optional().describe("Minimum selections required"),
      max: tool.schema.number().optional().describe("Maximum selections allowed"),
      allowOther: tool.schema.boolean().optional().describe("Allow custom 'other' input"),
    },
    validate: (args) => {
      if (!args.options || args.options.length === 0) return "options array must not be empty";
      if (args.min !== undefined && args.max !== undefined && args.min > args.max) {
        return `min (${args.min}) cannot be greater than max (${args.max})`;
      }
      return null;
    },
    toConfig: (args) => ({
      question: args.question,
      options: args.options,
      recommended: args.recommended,
      min: args.min,
      max: args.max,
      allowOther: args.allowOther,
    }),
  });

  const confirm = createTool<ConfirmConfig & { session_id: string }>({
    type: "confirm",
    description: `Ask user for Yes/No confirmation.
Response format: { choice: "yes" | "no" | "cancel" }`,
    args: {
      question: tool.schema.string().describe("Question to display"),
      context: tool.schema.string().optional().describe("Additional context/details"),
      yesLabel: tool.schema.string().optional().describe("Custom label for yes button"),
      noLabel: tool.schema.string().optional().describe("Custom label for no button"),
      allowCancel: tool.schema.boolean().optional().describe("Show cancel option"),
    },
    toConfig: (args) => ({
      question: args.question,
      context: args.context,
      yesLabel: args.yesLabel,
      noLabel: args.noLabel,
      allowCancel: args.allowCancel,
    }),
  });

  const rank = createTool<RankConfig & { session_id: string }>({
    type: "rank",
    description: `Ask user to rank/order items by dragging.
Response format: { ranked: string[] } where ranked is array of option ids in user's order (first = highest).`,
    args: {
      question: tool.schema.string().describe("Question to display"),
      options: optionsSchema.describe("Items to rank"),
      context: tool.schema.string().optional().describe("Instructions/context"),
    },
    validate: requireOptions,
    toConfig: (args) => ({
      question: args.question,
      options: args.options,
      context: args.context,
    }),
  });

  const rate = createTool<RateConfig & { session_id: string }>({
    type: "rate",
    description: `Ask user to rate items on a numeric scale.
Response format: { ratings: Record<string, number> } where key is option id, value is rating.`,
    args: {
      question: tool.schema.string().describe("Question to display"),
      options: optionsSchema.describe("Items to rate"),
      min: tool.schema.number().optional().describe("Minimum rating value (default: 1)"),
      max: tool.schema.number().optional().describe("Maximum rating value (default: 5)"),
      step: tool.schema.number().optional().describe("Rating step (default: 1)"),
    },
    validate: (args) => {
      if (!args.options || args.options.length === 0) return "options array must not be empty";
      const min = args.min ?? 1;
      const max = args.max ?? 5;
      if (min >= max) return `min (${min}) must be less than max (${max})`;
      return null;
    },
    toConfig: (args) => ({
      question: args.question,
      options: args.options,
      min: args.min ?? 1,
      max: args.max ?? 5,
      step: args.step,
    }),
  });

  // Import remaining tools from other files
  const inputTools = createInputTools(sessions);
  const presentationTools = createPresentationTools(sessions);
  const quickTools = createQuickTools(sessions);

  return {
    pick_one,
    pick_many,
    confirm,
    rank,
    rate,
    ...inputTools,
    ...presentationTools,
    ...quickTools,
  };
}

// Input tools (ask_text, ask_image, ask_file, ask_code)
function createInputTools(sessions: SessionStore) {
  const ask_text = tool({
    description: `Ask user for text input (single or multi-line).
Returns immediately with question_id. Use get_answer to retrieve response.
Response format: { text: string }`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      question: tool.schema.string().describe("Question to display"),
      placeholder: tool.schema.string().optional().describe("Placeholder text"),
      context: tool.schema.string().optional().describe("Instructions/context"),
      multiline: tool.schema.boolean().optional().describe("Multi-line input (default: false)"),
      minLength: tool.schema.number().optional().describe("Minimum text length"),
      maxLength: tool.schema.number().optional().describe("Maximum text length"),
    },
    execute: async (args) => {
      try {
        const config = {
          question: args.question,
          placeholder: args.placeholder,
          context: args.context,
          multiline: args.multiline,
          minLength: args.minLength,
          maxLength: args.maxLength,
        };
        const result = sessions.pushQuestion(args.session_id, "ask_text", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const ask_image = tool({
    description: `Ask user to upload/paste image(s).
Returns immediately with question_id. Use get_answer to retrieve response.`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      question: tool.schema.string().describe("Question to display"),
      context: tool.schema.string().optional().describe("Instructions/context"),
      multiple: tool.schema.boolean().optional().describe("Allow multiple images"),
      maxImages: tool.schema.number().optional().describe("Maximum number of images"),
    },
    execute: async (args) => {
      try {
        const config = {
          question: args.question,
          context: args.context,
          multiple: args.multiple,
          maxImages: args.maxImages,
        };
        const result = sessions.pushQuestion(args.session_id, "ask_image", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const ask_file = tool({
    description: `Ask user to upload file(s).
Returns immediately with question_id. Use get_answer to retrieve response.`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      question: tool.schema.string().describe("Question to display"),
      context: tool.schema.string().optional().describe("Instructions/context"),
      multiple: tool.schema.boolean().optional().describe("Allow multiple files"),
      maxFiles: tool.schema.number().optional().describe("Maximum number of files"),
      accept: tool.schema.array(tool.schema.string()).optional().describe("Allowed file types"),
      maxSize: tool.schema.number().optional().describe("Maximum file size in bytes"),
    },
    execute: async (args) => {
      try {
        const config = {
          question: args.question,
          context: args.context,
          multiple: args.multiple,
          maxFiles: args.maxFiles,
          accept: args.accept,
          maxSize: args.maxSize,
        };
        const result = sessions.pushQuestion(args.session_id, "ask_file", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const ask_code = tool({
    description: `Ask user for code input with syntax highlighting.
Returns immediately with question_id. Use get_answer to retrieve response.`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      question: tool.schema.string().describe("Question to display"),
      context: tool.schema.string().optional().describe("Instructions/context"),
      language: tool.schema.string().optional().describe("Programming language for highlighting"),
      placeholder: tool.schema.string().optional().describe("Placeholder code"),
    },
    execute: async (args) => {
      try {
        const config = {
          question: args.question,
          context: args.context,
          language: args.language,
          placeholder: args.placeholder,
        };
        const result = sessions.pushQuestion(args.session_id, "ask_code", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  return { ask_text, ask_image, ask_file, ask_code };
}

// Presentation/Feedback tools (show_diff, show_plan, show_options, review_section)
function createPresentationTools(sessions: SessionStore) {
  const show_diff = tool({
    description: `Show a diff and ask user to approve/reject/edit.
Returns immediately with question_id. Use get_answer to retrieve response.`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      question: tool.schema.string().describe("Title/description of the change"),
      before: tool.schema.string().describe("Original content"),
      after: tool.schema.string().describe("Modified content"),
      filePath: tool.schema.string().optional().describe("File path for context"),
      language: tool.schema.string().optional().describe("Language for syntax highlighting"),
    },
    execute: async (args) => {
      try {
        const config = {
          question: args.question,
          before: args.before,
          after: args.after,
          filePath: args.filePath,
          language: args.language,
        };
        const result = sessions.pushQuestion(args.session_id, "show_diff", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const show_plan = tool({
    description: `Show a plan/document for user review with annotations.
Returns immediately with question_id. Use get_answer to retrieve response.
Response format: { approved: boolean, annotations?: Record<sectionId, string> }`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      question: tool.schema.string().describe("Plan title"),
      sections: tool.schema
        .array(
          tool.schema.object({
            id: tool.schema.string().describe("Section identifier"),
            title: tool.schema.string().describe("Section title"),
            content: tool.schema.string().describe("Section content (markdown)"),
          }),
        )
        .optional()
        .describe("Plan sections"),
      markdown: tool.schema.string().optional().describe("Full markdown (alternative to sections)"),
    },
    execute: async (args) => {
      try {
        const config = {
          question: args.question,
          sections: args.sections || [],
          markdown: args.markdown,
        };
        const result = sessions.pushQuestion(args.session_id, "show_plan", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const show_options = tool({
    description: `Show options with pros/cons for user to select.
Returns immediately with question_id. Use get_answer to retrieve response.
Response format: { selected: string, feedback?: string } where selected is the chosen option id.`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      question: tool.schema.string().describe("Question to display"),
      options: tool.schema
        .array(
          tool.schema.object({
            id: tool.schema.string().describe("Unique option identifier"),
            label: tool.schema.string().describe("Display label"),
            description: tool.schema.string().optional().describe("Optional description"),
            pros: tool.schema.array(tool.schema.string()).optional().describe("Advantages"),
            cons: tool.schema.array(tool.schema.string()).optional().describe("Disadvantages"),
          }),
        )
        .describe("Options with pros/cons"),
      recommended: tool.schema.string().optional().describe("Recommended option id"),
      allowFeedback: tool.schema.boolean().optional().describe("Allow text feedback with selection"),
    },
    execute: async (args) => {
      try {
        if (!args.options || args.options.length === 0) {
          return `Failed: options array must not be empty`;
        }
        const config = {
          question: args.question,
          options: args.options,
          recommended: args.recommended,
          allowFeedback: args.allowFeedback,
        };
        const result = sessions.pushQuestion(args.session_id, "show_options", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const review_section = tool({
    description: `Show content section for user review with inline feedback.
Returns immediately with question_id. Use get_answer to retrieve response.`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      question: tool.schema.string().describe("Section title"),
      content: tool.schema.string().describe("Section content (markdown)"),
      context: tool.schema.string().optional().describe("Context about what to review"),
    },
    execute: async (args) => {
      try {
        const config = {
          question: args.question,
          content: args.content,
          context: args.context,
        };
        const result = sessions.pushQuestion(args.session_id, "review_section", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  return { show_diff, show_plan, show_options, review_section };
}

// Quick tools (thumbs, emoji_react, slider)
function createQuickTools(sessions: SessionStore) {
  const thumbs = tool({
    description: `Ask user for quick thumbs up/down feedback.
Returns immediately with question_id. Use get_answer to retrieve response.
Response format: { choice: "up" | "down" }`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      question: tool.schema.string().describe("Question to display"),
      context: tool.schema.string().optional().describe("Context to show"),
    },
    execute: async (args) => {
      try {
        const config = {
          question: args.question,
          context: args.context,
        };
        const result = sessions.pushQuestion(args.session_id, "thumbs", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const emoji_react = tool({
    description: `Ask user to react with an emoji.
Returns immediately with question_id. Use get_answer to retrieve response.`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      question: tool.schema.string().describe("Question to display"),
      context: tool.schema.string().optional().describe("Context to show"),
      emojis: tool.schema.array(tool.schema.string()).optional().describe("Available emoji options"),
    },
    execute: async (args) => {
      try {
        const config = {
          question: args.question,
          context: args.context,
          emojis: args.emojis,
        };
        const result = sessions.pushQuestion(args.session_id, "emoji_react", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const slider = tool({
    description: `Ask user to select a value on a numeric slider.
Returns immediately with question_id. Use get_answer to retrieve response.
Response format: { value: number }`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      question: tool.schema.string().describe("Question to display"),
      min: tool.schema.number().describe("Minimum value"),
      max: tool.schema.number().describe("Maximum value"),
      step: tool.schema.number().optional().describe("Step size (default: 1)"),
      defaultValue: tool.schema.number().optional().describe("Default value"),
      context: tool.schema.string().optional().describe("Instructions/context"),
    },
    execute: async (args) => {
      try {
        if (args.min >= args.max) {
          return `Failed: min (${args.min}) must be less than max (${args.max})`;
        }
        const config = {
          question: args.question,
          min: args.min,
          max: args.max,
          step: args.step,
          defaultValue: args.defaultValue,
          context: args.context,
        };
        const result = sessions.pushQuestion(args.session_id, "slider", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  return { thumbs, emoji_react, slider };
}
