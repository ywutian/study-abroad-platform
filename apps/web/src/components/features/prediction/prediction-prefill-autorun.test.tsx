import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { SchoolSelectorCard } from './SchoolSelectorCard';
import enMessages from '@/messages/en.json';

/**
 * Pins the estimate list's DEFAULT — and the label change that goes with it.
 *
 * `/prediction` used to fill this card with the user's entire school list on
 * every mount, so the first thing anyone did here was delete rows one at a
 * time. #480 added `Import my list` / `Clear` but left the prefill effect in
 * place, so the button read as a *re*-import of an already-full box and the
 * complaint came back verbatim five weeks later — with no test to contradict
 * "fixed".
 *
 * The `?autorun=1` half of the change — the one that fails SILENTLY — is pinned
 * separately by `app/[locale]/(main)/prediction/prediction-autorun-contract.test.ts`.
 *
 * Uses the real `en.json` rather than a hand-written message subset: a subset
 * turns every unrelated key this card starts rendering into a spurious
 * MISSING_MESSAGE failure, and the message keys are part of what is being
 * asserted.
 */
function renderCard(selected: Array<{ id: string; name: string }>) {
  // The card's search box is a useQuery; retry off so a failed fetch in the
  // test env cannot turn a render assertion into a timeout.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SchoolSelectorCard
          selectedSchools={selected}
          onAdd={vi.fn()}
          onRemove={vi.fn()}
          onClearAll={vi.fn()}
          onImportList={vi.fn()}
          importListCount={12}
          onPredict={vi.fn()}
          isPredicting={false}
          profileBlocked={false}
          predictionTiers={{}}
          hasPredictions={false}
          compact
        />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('estimate list default', () => {
  it('a plain visit lists no schools at all', () => {
    renderCard([]);
    // Two elements render this string — the always-on header badge
    // (`selectorProgress`, SchoolSelectorCard.tsx:77) and the list heading
    // (`selectedCount`, :177) which only appears above a non-empty list. Both
    // resolve to "{count} selected" in English, so the count alone is a weak
    // signal; the school rows are the unambiguous one.
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    expect(screen.queryByText('Brown University')).not.toBeInTheDocument();
  });

  it('offers an explicit way to pull the school list in, labelled as an add', () => {
    // The label matters: while the box started full, "Import my list" read as a
    // re-import of something already there. It is now the primary path in.
    renderCard([]);
    expect(screen.getByText('Add all from my list (12)')).toBeInTheDocument();
  });

  it('shows what is selected when a selection is supplied (the autorun path)', () => {
    renderCard([
      { id: 's1', name: 'Brown University' },
      { id: 's2', name: 'Duke University' },
    ]);
    // getAllByText: both the badge and the list heading say it (see above).
    expect(screen.getAllByText('2 selected').length).toBeGreaterThan(0);
    expect(screen.getByText('Brown University')).toBeInTheDocument();
    expect(screen.getByText('Duke University')).toBeInTheDocument();
  });
});
