import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { IndexGroup } from './IndexIndicators';

const messages = {
  schools: {
    indices: {
      safetyIndex: 'Safety Index',
      happinessIndex: 'Campus Life Index',
      foodIndex: 'Dining Index',
      safetyShort: 'Safety',
      lifeShort: 'Campus',
      foodShort: 'Dining',
      noData: 'No Data',
    },
    gradeLabels: {
      'A+': 'A+',
      A: 'A',
      'A-': 'A-',
      'B+': 'B+',
      B: 'B',
      'B-': 'B-',
      'C+': 'C+',
      C: 'C',
      'C-': 'C-',
      'D+': 'D+',
      D: 'D',
      'D-': 'D-',
      F: 'F',
    },
  },
};

function renderWithIntl(ui: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe('IndexGroup', () => {
  it('renders compact campus grade chips with one label per metric', () => {
    renderWithIntl(<IndexGroup safetyGrade="A-" lifeGrade="B+" foodGrade="A" size="md" />);

    expect(screen.getByText('Safety')).toBeInTheDocument();
    expect(screen.getByText('Campus')).toBeInTheDocument();
    expect(screen.getByText('Dining')).toBeInTheDocument();
    expect(screen.getByText('A-')).toBeInTheDocument();
    expect(screen.getByText('B+')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('does not reserve space when all campus grades are missing', () => {
    const { container } = renderWithIntl(<IndexGroup />);

    expect(container.firstChild).toBeNull();
  });

  it('can show empty source-aware chips when requested', () => {
    renderWithIntl(<IndexGroup showEmpty size="sm" />);

    expect(screen.getByText('Safety')).toBeInTheDocument();
    expect(screen.getByText('Campus')).toBeInTheDocument();
    expect(screen.getByText('Dining')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(3);
  });
});
