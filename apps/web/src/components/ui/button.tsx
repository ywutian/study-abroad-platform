import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--theme-radius-button)] border-[length:var(--theme-button-border-width)] text-sm font-[var(--theme-button-weight)] tracking-[var(--theme-button-tracking)] shadow-[var(--theme-button-shadow)] outline-none transition duration-150 disabled:pointer-events-none disabled:opacity-50 aria-busy:pointer-events-none aria-busy:cursor-wait aria-busy:opacity-80 hover:shadow-[var(--theme-button-hover-shadow)] focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          'border-[color:var(--theme-button-primary-border)] bg-[color:var(--theme-button-primary-bg)] text-[color:var(--theme-button-primary-fg)] hover:opacity-95',
        default:
          'border-[color:var(--theme-button-primary-border)] bg-[color:var(--theme-button-primary-bg)] text-[color:var(--theme-button-primary-fg)] hover:opacity-95',
        tertiary:
          'border-[color:var(--theme-button-tertiary-border)] bg-[color:var(--theme-button-tertiary-bg)] text-[color:var(--theme-button-tertiary-fg)] hover:border-primary/35 hover:bg-[color:var(--theme-control-hover-bg)]',
        destructive:
          'border-destructive bg-[color:var(--theme-button-danger-bg)] text-[color:var(--theme-button-danger-fg)] hover:opacity-95',
        danger:
          'border-destructive bg-[color:var(--theme-button-danger-bg)] text-[color:var(--theme-button-danger-fg)] hover:opacity-95',
        warning:
          'border-warning bg-[color:var(--theme-button-warning-bg)] text-[color:var(--theme-button-warning-fg)] hover:opacity-95',
        success:
          'border-success bg-[color:var(--theme-button-success-bg)] text-[color:var(--theme-button-success-fg)] hover:opacity-95',
        outline:
          'border-[color:var(--theme-border-strong-dynamic)] bg-[color:var(--theme-button-outline-bg)] text-foreground hover:border-primary/45 hover:bg-[color:var(--theme-control-hover-bg)]',
        secondary:
          'border-[color:var(--theme-button-secondary-border)] bg-[color:var(--theme-button-secondary-bg)] text-[color:var(--theme-button-secondary-fg)] hover:border-primary/35 hover:bg-[color:var(--theme-control-hover-bg)]',
        ghost:
          'border-transparent bg-transparent text-foreground shadow-none hover:bg-[color:var(--theme-control-hover-bg)] hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        // Legacy aliases kept for existing pages; new code should use primary/success/warning/danger.
        gradient:
          'border-[color:var(--theme-button-primary-border)] bg-[color:var(--theme-button-primary-bg)] text-[color:var(--theme-button-primary-fg)] font-semibold hover:opacity-95',
        'gradient-success':
          'border-success bg-[color:var(--theme-button-success-bg)] text-[color:var(--theme-button-success-fg)] font-semibold hover:opacity-95',
        'gradient-warning':
          'border-warning bg-[color:var(--theme-button-warning-bg)] text-[color:var(--theme-button-warning-fg)] font-semibold hover:opacity-95',
        'gradient-purple':
          'border-info bg-[color:var(--theme-button-primary-bg)] text-[color:var(--theme-button-primary-fg)] font-semibold hover:opacity-95',
        soft: 'border-[color:var(--theme-button-secondary-border)] bg-[color:var(--theme-button-secondary-bg)] text-[color:var(--theme-button-secondary-fg)] hover:bg-[color:var(--theme-control-hover-bg)]',
        'soft-destructive':
          'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15',
        'soft-success':
          'border-success/30 bg-success/10 text-success hover:bg-success/15 dark:text-success',
      },
      size: {
        default: 'h-[var(--theme-control-height)] px-[var(--theme-button-padding-x)] py-2',
        sm: 'h-8 gap-1.5 px-3 text-xs max-sm:h-10',
        lg: 'h-12 px-6 py-2.5 text-base',
        xl: 'h-14 px-8 py-3 text-lg',
        icon: 'size-10',
        'icon-sm': 'size-8 max-sm:size-10',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
