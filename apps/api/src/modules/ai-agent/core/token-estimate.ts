import { getEncoding, Tiktoken, TiktokenEncoding } from 'js-tiktoken';

export type { Tiktoken, TiktokenEncoding };

// One instance per encoding, process-wide: a second o200k_base costs ~63MB of
// heap, so the budget path and TokenTrackerService must share these.
const encoders = new Map<TiktokenEncoding, Tiktoken>();

export function sharedEncoding(name: TiktokenEncoding): Tiktoken {
  const cached = encoders.get(name);
  if (cached) return cached;
  const created = getEncoding(name);
  encoders.set(name, created);
  return created;
}

/**
 * js-tiktoken merges each pre-token with an O(n^2) BPE loop, so one unbroken
 * run of 42000 identical characters takes ~110s and blocks the event loop,
 * while 56KB of ordinary JSON takes 32ms. Encoding in fixed slices is linear
 * in the input and can only raise the count -- a merge lost at a slice
 * boundary is never a merge gained -- which is the safe direction for a budget
 * reservation. Measured over-count on real prompts: ~1%.
 */
const SLICE_CHARS = 1000;

let encodingUnavailable = false;

/**
 * Input tokens for budget reservations and the context-window pre-flight.
 *
 * The previous `chars / 3` was an English heuristic. Measured against
 * o200k_base it returns 0.42x the real count for Chinese prose, 0.74x for the
 * Chinese agent prompts and 0.89x for tool-result JSON, so a reservation
 * cleared while the provider billed up to ~2x, and settlement then blew the
 * Run budget after the answer had already been generated and streamed.
 *
 * No character heuristic replaces this: across the same samples the best one
 * measured spans 0.29x (base64) to 2.16x (English prose), so the encoder is
 * the only usable source. The heuristic below is reached only if the encoding
 * fails to load at all.
 */
export function countTokens(text: string): number {
  if (!encodingUnavailable) {
    try {
      const encoder = sharedEncoding('o200k_base');
      let total = 0;
      for (let i = 0; i < text.length; i += SLICE_CHARS)
        total += encoder.encode(text.slice(i, i + SLICE_CHARS)).length;
      return total;
    } catch {
      encodingUnavailable = true;
    }
  }
  const chinese = (text.match(/[一-龥]/g) || []).length;
  return Math.ceil(chinese + (text.length - chinese) / 3);
}
