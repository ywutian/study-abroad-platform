import * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-[var(--theme-control-height)] w-full min-w-0 rounded-[var(--theme-radius-input)] border bg-[color:var(--theme-control-bg)] px-3 py-2 text-base shadow-[var(--theme-button-shadow)] transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'hover:border-muted-foreground/30',
        'focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:ring-[3px] focus-visible:shadow-md',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        'dark:bg-input/30 dark:hover:bg-input/40',
        className
      )}
      {...props}
    />
  );
}

export { Input };
