import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PredictionWhatIfPanel } from './PredictionWhatIfPanel';
import enMessages from '@/messages/en.json';

/**
 * A disabled button must say why.
 *
 * `button.tsx:8` carries `disabled:pointer-events-none`, so a disabled Preview
 * eats the click with no cursor change and no toast — the literal reported
 * symptom, "我按这个是没有反应的". The empty-selection case had a hint; the
 * profile-blocked case had none at all, because the blockers render in the
 * page's COL2 while this panel sits in COL1.
 *
 * #480 shipped a fix for this same complaint with no test and the complaint
 * returned five weeks later. This is that test.
 */
const { mutatePreview } = vi.hoisted(() => ({ mutatePreview: vi.fn() }));

vi.mock('@/hooks/use-prediction', () => ({
  usePreviewPrediction: () => ({ mutate: mutatePreview, isPending: false }),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const SCHOOL = { id: 's1', name: 'Brown University' };

function renderPanel(props: { selectedSchools?: (typeof SCHOOL)[]; disabled?: boolean }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <PredictionWhatIfPanel
          selectedSchools={props.selectedSchools ?? [SCHOOL]}
          profile={{ gpa: 3.9, gpaScale: 4 }}
          disabled={props.disabled ?? false}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

const previewButton = () => screen.getByRole('button', { name: /preview/i });

describe('What-if — a disabled Preview explains itself', () => {
  beforeEach(() => {
    mutatePreview.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('says which input is missing when no school is selected', () => {
    renderPanel({ selectedSchools: [] });
    expect(previewButton()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/pick at least one school/i);
  });

  it('says why when the profile blocks the run — the case that had NO feedback', () => {
    renderPanel({ disabled: true });
    expect(previewButton()).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(/complete your profile/i);
  });

  it('shows no reason when the button is actually usable', () => {
    renderPanel({});
    expect(previewButton()).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('never leaves the button disabled without a reason', () => {
    // The invariant itself, rather than three examples of it: whatever makes
    // canRun false must also produce a hint. A new disable condition added
    // without a matching reason fails here.
    for (const props of [{ selectedSchools: [] }, { disabled: true }]) {
      const { unmount } = renderPanel(props);
      expect(previewButton()).toBeDisabled();
      expect(screen.getByRole('status').textContent?.trim()).toBeTruthy();
      unmount();
    }
  });

  it('turns a malformed success response into an empty result instead of crashing', () => {
    renderPanel({});
    fireEvent.click(previewButton());

    const options = mutatePreview.mock.calls[0]?.[1] as
      { onSuccess?: (data: unknown) => void } | undefined;
    act(() => options?.onSuccess?.({}));

    expect(screen.getByTestId('prediction-preview-results')).toBeVisible();
    expect(screen.getByText(enMessages.prediction.whatIf.noResults)).toBeVisible();
  });
});
