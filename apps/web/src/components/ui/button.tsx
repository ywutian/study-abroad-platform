import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]",
  {
    variants: {
      variant: {
        // 学术严肃风：去掉发光阴影，使用实体边框和简洁过渡
        default:
          'bg-primary text-primary-foreground border-2 border-primary hover:bg-primary/90 hover:border-primary/90',
        destructive:
          'bg-destructive text-white border-2 border-destructive hover:bg-destructive/90',
        outline:
          'border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-primary/50',
        secondary:
          'bg-secondary text-secondary-foreground border border-secondary-foreground/10 hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        // 强调变体（用于核心 CTA，保留但简化）
        gradient:
          'bg-primary text-primary-foreground border-2 border-primary/80 hover:bg-primary/90 font-semibold',
        'gradient-success':
          'bg-success text-success-foreground border-2 border-success/80 hover:bg-success/90 font-semibold',
        'gradient-warning':
          'bg-warning text-warning-foreground border-2 border-warning/80 hover:bg-warning/90 font-semibold',
        'gradient-purple':
          'bg-primary text-white border-2 border-violet-600 hover:bg-primary font-semibold dark:bg-primary dark:hover:bg-primary',
        // 柔和变体
        soft: 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 hover:border-primary/30',
        'soft-destructive':
          'bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15',
        'soft-success':
          'bg-success/10 text-success border border-success/20 hover:bg-success/15 dark:text-success',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md gap-1.5 px-3 text-xs',
        lg: 'h-12 rounded-lg px-6 py-2.5 text-base',
        xl: 'h-14 rounded-xl px-8 py-3 text-lg',
        icon: 'size-10',
        'icon-sm': 'size-8',
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
