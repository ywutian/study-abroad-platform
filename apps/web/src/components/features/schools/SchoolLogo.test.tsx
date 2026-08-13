import type { ImgHTMLAttributes } from 'react';
/* eslint-disable @next/next/no-img-element -- Test mock intentionally represents next/image as its rendered DOM element. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SchoolLogo } from './SchoolLogo';

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    onError,
    unoptimized: _unoptimized,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement>) => (
    <img src={src} alt={alt} onError={onError} {...props} />
  ),
}));

describe('SchoolLogo', () => {
  it('renders the primary logo when logoUrl is available', () => {
    const { container } = render(
      <SchoolLogo
        logoUrl="https://img.logo.dev/mit.edu?token=test"
        website="https://www.mit.edu"
        name="Massachusetts Institute of Technology"
      />
    );

    const image = container.querySelector('img');
    expect(image).toBeTruthy();
    expect(image?.getAttribute('src')).toContain('img.logo.dev/mit.edu');
  });

  it('falls back to the website favicon when the primary logo fails', async () => {
    const { container } = render(
      <SchoolLogo
        logoUrl="https://img.logo.dev/mit.edu?token=test"
        website="https://www.mit.edu"
        name="Massachusetts Institute of Technology"
      />
    );

    const image = container.querySelector('img');
    expect(image).toBeTruthy();
    fireEvent.error(image as HTMLImageElement);

    await waitFor(() => {
      expect(container.querySelector('img')?.getAttribute('src')).toContain(
        'www.google.com/s2/favicons'
      );
    });
  });

  it('falls back to the school initial when neither logo nor website is usable', () => {
    render(<SchoolLogo name="Harvard University" />);

    expect(screen.getByText('H')).toBeInTheDocument();
  });
});
