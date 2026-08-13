/**
 * LLM JSON Utility
 *
 * Extracts JSON from LLM responses that may contain markdown
 * code blocks or surrounding text.
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('extractJsonFromLlm');

/**
 * Find the outermost brace-balanced JSON substring starting with `open`.
 * Returns the substring or null if no balanced block is found.
 */
function extractBalanced(
  text: string,
  open: string,
  close: string,
): string | null {
  const start = text.indexOf(open);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

/**
 * Extract and parse JSON from an LLM response string.
 *
 * Strategy (in order):
 * 1. Direct JSON.parse (pure JSON response)
 * 2. Markdown code block extraction (```json ... ```)
 * 3. Brace-balanced object extraction (handles nested JSON correctly)
 * 4. Brace-balanced array extraction
 * 5. Give up: `null`, or `{ [fallbackKey]: response }` if a key was named.
 *
 * **Returns `T | null`, and `T` is an assertion, not a check.** Nothing here
 * validates shape — `JSON.parse` yields `any`, so whatever the model emitted
 * silently satisfies the type argument. `<{ answer?: unknown }>` is honest
 * about that; `<ValidationResult>` is a promise this function cannot keep. Use
 * an all-optional shape and normalise the fields, or validate after parsing.
 *
 * This used to return `{ [fallbackKey]: response } as T` unconditionally when
 * extraction failed — fabricating an object of the wrong shape and typing it
 * as the caller's `T`. A caller reading `parsed.dimensions.map(…)` then got a
 * `TypeError` from inside its own mapper, several frames from the actual
 * cause: the model returned prose. The fallback is now opt-in, so a caller
 * that wants it says so, and everyone else gets a `null` they must handle.
 */
export function extractJsonFromLlm<T = unknown>(
  response: string,
  fallbackKey?: string,
): T | null {
  // 1. Try direct parse first
  try {
    const parsed: unknown = JSON.parse(response);
    return parsed as T;
  } catch {
    // Not pure JSON, try extraction
  }

  // 2. Try markdown code block (```json ... ``` or ``` ... ```)
  try {
    const codeBlockMatch = response.match(
      /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/,
    );
    if (codeBlockMatch?.[1]) {
      const parsed: unknown = JSON.parse(codeBlockMatch[1].trim());
      return parsed as T;
    }
  } catch {
    // Code block content wasn't valid JSON
  }

  // 3. Try brace-balanced object extraction (handles nested JSON correctly)
  try {
    const objectStr = extractBalanced(response, '{', '}');
    if (objectStr) {
      const parsed: unknown = JSON.parse(objectStr);
      return parsed as T;
    }
  } catch {
    // JSON object extraction failed
  }

  // 4. Try brace-balanced array extraction
  try {
    const arrayStr = extractBalanced(response, '[', ']');
    if (arrayStr) {
      const parsed: unknown = JSON.parse(arrayStr);
      return parsed as T;
    }
  } catch {
    // Array extraction failed
  }

  // 5. Return fallback with warning
  logger.warn(
    `JSON extraction failed. Response preview: ${response.slice(0, 200)}`,
  );
  if (fallbackKey) return { [fallbackKey]: response } as T;
  return null;
}
