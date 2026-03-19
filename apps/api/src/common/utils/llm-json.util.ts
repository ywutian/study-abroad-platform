/**
 * LLM JSON Utility
 *
 * Extracts JSON from LLM responses that may contain markdown
 * code blocks or surrounding text.
 */

/**
 * Extract and parse JSON from an LLM response string.
 * Handles responses wrapped in markdown code blocks or surrounded by text.
 * Returns the parsed object, or the fallback if extraction fails.
 */
export function extractJsonFromLlm<T = any>(
  response: string,
  fallbackKey = 'result',
): T {
  // Try direct parse first
  try {
    return JSON.parse(response);
  } catch {
    // Not pure JSON, try extraction
  }

  // Try extracting JSON object from response
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // JSON extraction failed
  }

  // Try extracting JSON array
  try {
    const arrayMatch = response.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
  } catch {
    // Array extraction failed
  }

  // Return fallback
  return { [fallbackKey]: response } as T;
}
