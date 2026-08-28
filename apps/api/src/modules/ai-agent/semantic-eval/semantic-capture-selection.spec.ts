import {
  captureSelectionVerdict,
  selectCaptureCases,
} from './semantic-capture-selection';

const cases = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
describe('Diagnostic semantic capture selection', () => {
  it('defaults to the entire frozen dataset', () => {
    const selected = selectCaptureCases(cases);
    expect(selected).toEqual({ diagnostic: false, indices: [0, 1, 2] });
    expect(captureSelectionVerdict(selected, 3, false, true)).toMatchObject({
      complete: true,
      pass: true,
      diagnosticPass: false,
    });
  });
  it.each(['', 'a,a', 'a,', 'unknown'])(
    'rejects invalid selection %s',
    (requested) => {
      expect(() => selectCaptureCases(cases, requested)).toThrow(
        'SEMANTIC_SELECTION_INVALID',
      );
    },
  );
  it.each(['a,b', 'a,b,c'])(
    'never labels an explicit selection as full quality PASS: %s',
    (requested) => {
      const selected = selectCaptureCases(cases, requested);
      expect(
        captureSelectionVerdict(selected, selected.indices.length, false, true),
      ).toMatchObject({
        captureScope: 'diagnostic',
        complete: false,
        pass: false,
        diagnosticPass: true,
      });
    },
  );
  it('requires successful cleanup and all requested cases for diagnostic success', () => {
    const selected = selectCaptureCases(cases, 'c,a');
    expect(selected.indices).toEqual([2, 0]);
    for (const [captured, failed, cleaned] of [
      [1, false, true],
      [2, true, true],
      [2, false, false],
    ] as const)
      expect(
        captureSelectionVerdict(selected, captured, failed, cleaned)
          .diagnosticPass,
      ).toBe(false);
  });
});
