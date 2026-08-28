export function selectCaptureCases(
  cases: ReadonlyArray<{ id: string }>,
  requested?: string,
) {
  if (requested === undefined)
    return { diagnostic: false, indices: cases.map((_, index) => index) };
  const ids = requested.split(',').map((id) => id.trim());
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
    throw new Error('SEMANTIC_SELECTION_INVALID');
  const indices = ids.map((id) => cases.findIndex((item) => item.id === id));
  if (indices.some((index) => index < 0))
    throw new Error('SEMANTIC_SELECTION_INVALID');
  return { diagnostic: true, indices };
}

export function captureSelectionVerdict(
  selection: ReturnType<typeof selectCaptureCases>,
  captured: number,
  failed: boolean,
  cleaned: boolean,
) {
  const selectionComplete = !failed && captured === selection.indices.length;
  return {
    captureScope: selection.diagnostic ? 'diagnostic' : 'full',
    selectedCases: selection.indices.length,
    selectionComplete,
    complete: !selection.diagnostic && selectionComplete,
    pass: !selection.diagnostic && selectionComplete && cleaned,
    diagnosticPass: selection.diagnostic && selectionComplete && cleaned,
  };
}
