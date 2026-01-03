// src/tools/questions.ts
import { tool } from "@opencode-ai/plugin/tool";
import type { SessionManager } from "../session/manager";
import type { PickOneConfig, PickManyConfig, ConfirmConfig, RankConfig, RateConfig } from "../types";

export function createQuestionTools(manager: SessionManager) {
  const pick_one = tool({
    description: `Ask user to select ONE option from a list.
Returns immediately with question_id. Use get_answer to retrieve response.`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      question: tool.schema.string().describe("Question to display"),
      options: tool.schema
        .array(
          tool.schema.object({
            id: tool.schema.string().describe("Unique option identifier"),
            label: tool.schema.string().describe("Display label"),
            description: tool.schema.string().optional().describe("Optional description"),
          }),
        )
        .describe("Available options"),
      recommended: tool.schema.string().optional().describe("Recommended option id (highlighted)"),
      allowOther: tool.schema.boolean().optional().describe("Allow custom 'other' input"),
    },
    execute: async (args) => {
      try {
        const config: PickOneConfig = {
          question: args.question,
          options: args.options,
          recommended: args.recommended,
          allowOther: args.allowOther,
        };
        const result = manager.pushQuestion(args.session_id, "pick_one", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const pick_many = tool({
    description: `Ask user to select MULTIPLE options from a list.
Returns immediately with question_id. Use get_answer to retrieve response.`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      question: tool.schema.string().describe("Question to display"),
      options: tool.schema
        .array(
          tool.schema.object({
            id: tool.schema.string().describe("Unique option identifier"),
            label: tool.schema.string().describe("Display label"),
            description: tool.schema.string().optional().describe("Optional description"),
          }),
        )
        .describe("Available options"),
      recommended: tool.schema.array(tool.schema.string()).optional().describe("Recommended option ids"),
      min: tool.schema.number().optional().describe("Minimum selections required"),
      max: tool.schema.number().optional().describe("Maximum selections allowed"),
      allowOther: tool.schema.boolean().optional().describe("Allow custom 'other' input"),
    },
    execute: async (args) => {
      try {
        const config: PickManyConfig = {
          question: args.question,
          options: args.options,
          recommended: args.recommended,
          min: args.min,
          max: args.max,
          allowOther: args.allowOther,
        };
        const result = manager.pushQuestion(args.session_id, "pick_many", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const confirm = tool({
    description: `Ask user for Yes/No confirmation.
Returns immediately with question_id. Use get_answer to retrieve response.`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      question: tool.schema.string().describe("Question to display"),
      context: tool.schema.string().optional().describe("Additional context/details"),
      yesLabel: tool.schema.string().optional().describe("Custom label for yes button"),
      noLabel: tool.schema.string().optional().describe("Custom label for no button"),
      allowCancel: tool.schema.boolean().optional().describe("Show cancel option"),
    },
    execute: async (args) => {
      try {
        const config: ConfirmConfig = {
          question: args.question,
          context: args.context,
          yesLabel: args.yesLabel,
          noLabel: args.noLabel,
          allowCancel: args.allowCancel,
        };
        const result = manager.pushQuestion(args.session_id, "confirm", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const rank = tool({
    description: `Ask user to rank/order items by dragging.
Returns immediately with question_id. Use get_answer to retrieve response.`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      question: tool.schema.string().describe("Question to display"),
      options: tool.schema
        .array(
          tool.schema.object({
            id: tool.schema.string().describe("Unique option identifier"),
            label: tool.schema.string().describe("Display label"),
            description: tool.schema.string().optional().describe("Optional description"),
          }),
        )
        .describe("Items to rank"),
      context: tool.schema.string().optional().describe("Instructions/context"),
    },
    execute: async (args) => {
      try {
        const config: RankConfig = {
          question: args.question,
          options: args.options,
          context: args.context,
        };
        const result = manager.pushQuestion(args.session_id, "rank", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const rate = tool({
    description: `Ask user to rate items on a numeric scale.
Returns immediately with question_id. Use get_answer to retrieve response.`,
    args: {
      session_id: tool.schema.string().describe("Session ID from start_session"),
      question: tool.schema.string().describe("Question to display"),
      options: tool.schema
        .array(
          tool.schema.object({
            id: tool.schema.string().describe("Unique option identifier"),
            label: tool.schema.string().describe("Display label"),
            description: tool.schema.string().optional().describe("Optional description"),
          }),
        )
        .describe("Items to rate"),
      min: tool.schema.number().optional().describe("Minimum rating value (default: 1)"),
      max: tool.schema.number().optional().describe("Maximum rating value (default: 5)"),
      step: tool.schema.number().optional().describe("Rating step (default: 1)"),
    },
    execute: async (args) => {
      try {
        const config: RateConfig = {
          question: args.question,
          options: args.options,
          min: args.min,
          max: args.max,
          step: args.step,
        };
        const result = manager.pushQuestion(args.session_id, "rate", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  // Import remaining tools from other files
  const inputTools = createInputTools(manager);
  const presentationTools = createPresentationTools(manager);
  const quickTools = createQuickTools(manager);

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
function createInputTools(manager: SessionManager) {
  const ask_text = tool({
    description: `Ask user for text input (single or multi-line).
Returns immediately with question_id. Use get_answer to retrieve response.`,
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
        const result = manager.pushQuestion(args.session_id, "ask_text", config);
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
        const result = manager.pushQuestion(args.session_id, "ask_image", config);
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
        const result = manager.pushQuestion(args.session_id, "ask_file", config);
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
        const result = manager.pushQuestion(args.session_id, "ask_code", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  return { ask_text, ask_image, ask_file, ask_code };
}

// Presentation/Feedback tools (show_diff, show_plan, show_options, review_section)
function createPresentationTools(manager: SessionManager) {
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
        const result = manager.pushQuestion(args.session_id, "show_diff", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const show_plan = tool({
    description: `Show a plan/document for user review with annotations.
Returns immediately with question_id. Use get_answer to retrieve response.`,
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
        const result = manager.pushQuestion(args.session_id, "show_plan", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const show_options = tool({
    description: `Show options with pros/cons for user to select.
Returns immediately with question_id. Use get_answer to retrieve response.`,
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
        const config = {
          question: args.question,
          options: args.options,
          recommended: args.recommended,
          allowFeedback: args.allowFeedback,
        };
        const result = manager.pushQuestion(args.session_id, "show_options", config);
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
        const result = manager.pushQuestion(args.session_id, "review_section", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  return { show_diff, show_plan, show_options, review_section };
}

// Quick tools (thumbs, emoji_react, slider)
function createQuickTools(manager: SessionManager) {
  const thumbs = tool({
    description: `Ask user for quick thumbs up/down feedback.
Returns immediately with question_id. Use get_answer to retrieve response.`,
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
        const result = manager.pushQuestion(args.session_id, "thumbs", config);
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
        const result = manager.pushQuestion(args.session_id, "emoji_react", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  const slider = tool({
    description: `Ask user to select a value on a numeric slider.
Returns immediately with question_id. Use get_answer to retrieve response.`,
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
        const result = manager.pushQuestion(args.session_id, "slider", config);
        return `Question pushed: ${result.question_id}\nUse get_answer("${result.question_id}") to retrieve response.`;
      } catch (error) {
        return `Failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  });

  return { thumbs, emoji_react, slider };
}
