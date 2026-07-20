import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import zhMessages from '@/messages/zh.json';

import AboutPage from './page';

describe('AboutPage', () => {
  it('renders the verified brand story and valid footer anchors', () => {
    const { container } = render(
      <NextIntlClientProvider locale="zh" messages={zhMessages}>
        <AboutPage />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('heading', { name: zhMessages.about.title })).toBeInTheDocument();
    expect(screen.getByText(zhMessages.about.subtitle)).toBeInTheDocument();
    expect(screen.getByText(zhMessages.about.team.content)).toBeInTheDocument();
    expect(container.querySelector('#vision')).toBeInTheDocument();
    expect(container.querySelector('#mission')).toBeInTheDocument();
    expect(container.querySelector('#team')).toBeInTheDocument();
    expect(screen.queryByText('50,000+')).not.toBeInTheDocument();
    expect(screen.queryByText('85%')).not.toBeInTheDocument();
  });
});
