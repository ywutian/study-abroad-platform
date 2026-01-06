'use client';

import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ProgressBar
        height="3px"
        color="oklch(0.55 0.22 265)"
        options={{ showSpinner: false }}
        shallowRouting
      />
    </>
  );
}




