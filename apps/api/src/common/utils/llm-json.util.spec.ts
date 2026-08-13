import { Logger } from '@nestjs/common';
import { extractJsonFromLlm } from './llm-json.util';

describe('extractJsonFromLlm', () => {
  describe('extraction strategies', () => {
    it('parses a pure JSON response', () => {
      expect(extractJsonFromLlm('{"a":1}')).toEqual({ a: 1 });
    });

    it('parses a fenced ```json block', () => {
      const res = '好的，结果如下：\n```json\n{"a":1}\n```\n希望有帮助';
      expect(extractJsonFromLlm(res)).toEqual({ a: 1 });
    });

    it('parses an unlabelled ``` block', () => {
      expect(extractJsonFromLlm('```\n{"a":1}\n```')).toEqual({ a: 1 });
    });

    it('pulls a brace-balanced object out of surrounding prose', () => {
      expect(extractJsonFromLlm('Sure! {"a":{"b":2}} — done')).toEqual({
        a: { b: 2 },
      });
    });

    it('pulls a top-level array out of surrounding prose', () => {
      expect(extractJsonFromLlm('Here: [1,2,3] ok')).toEqual([1, 2, 3]);
    });

    // The balanced scanner is the reason this util exists rather than a regex:
    // a regex stops at the first `}` and truncates every nested object.
    it('keeps nested objects whole instead of stopping at the first brace', () => {
      const res = 'text {"outer":{"inner":{"deep":1}},"after":2} tail';
      expect(extractJsonFromLlm(res)).toEqual({
        outer: { inner: { deep: 1 } },
        after: 2,
      });
    });

    it('does not mistake braces inside strings for structure', () => {
      const res = '{"note":"a } brace and a \\" quote","n":1}';
      expect(extractJsonFromLlm(res)).toEqual({
        note: 'a } brace and a " quote',
        n: 1,
      });
    });
  });

  describe('when nothing parses', () => {
    // This is the contract that changed. It used to return
    // `{ result: <the prose> }` typed as the caller's T — an object of the
    // wrong shape, asserted to be the right one. Callers then crashed inside
    // their own `.map`, several frames from the cause.
    it('returns null rather than fabricating an object', () => {
      expect(extractJsonFromLlm('I am sorry, I cannot help with that.')).toBe(
        null,
      );
    });

    it('returns null for an empty response', () => {
      expect(extractJsonFromLlm('')).toBe(null);
    });

    it('returns the wrapped response only when a fallback key is named', () => {
      expect(extractJsonFromLlm('plain prose', 'result')).toEqual({
        result: 'plain prose',
      });
    });

    it('logs a warning so a silent degradation is still visible', () => {
      const spy = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      extractJsonFromLlm('not json at all');

      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });

  // `T` is an assertion, not a check — worth pinning so nobody reads the
  // signature as validation and drops their own normalisation.
  it('does not validate shape: T is asserted, not checked', () => {
    const parsed = extractJsonFromLlm<{ required: string }>('{"other":1}');
    expect(parsed).toEqual({ other: 1 });
    expect(parsed?.required).toBeUndefined();
  });
});
