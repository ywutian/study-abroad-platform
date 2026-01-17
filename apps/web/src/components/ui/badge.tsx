import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  // 学术严肃风：使用 rounded-md 替代 rounded-full，添加边框
  'inline-flex items-center justify-center rounded-md border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-colors duration-150 overflow-hidden',
  {
    variants: {
      variant: {
        default: 'border-primary/30 bg-primary/10 text-primary [a&]:hover:bg-primary/15',
        secondary:
          'border-secondary-foreground/20 bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80',
        destructive:
          'border-destructive/30 bg-destructive/10 text-destructive [a&]:hover:bg-destructive/15 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        outline:
          'text-foreground border-border bg-transparent [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
        // 语义变体 - 学术风（低饱和度）
        success: 'border-success/30 bg-success/10 text-success [a&]:hover:bg-success/15',
        warning: 'border-warning/30 bg-warning/10 text-warning [a&]:hover:bg-warning/15',
        info: 'border-primary/30 bg-primary/10 text-primary [a&]:hover:bg-primary/15',
        purple:
          'border-violet-700/30 bg-primary/10 text-violet-700 dark:text-violet-400 [a&]:hover:bg-primary/15',
        // 强调变体（实色，用于重要状态）
        'solid-primary':
          'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
        'solid-success':
          'border-transparent bg-success text-success-foreground [a&]:hover:bg-success/90',
        'solid-warning':
          'border-transparent bg-warning text-warning-foreground [a&]:hover:bg-warning/90',
        'solid-destructive':
          'border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
