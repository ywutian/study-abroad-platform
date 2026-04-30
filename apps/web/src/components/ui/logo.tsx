'use client';

import { cn } from '@/lib/utils';
import { LumniMark } from './lumni-mark';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, showText = true, size = 'md' }: LogoProps) {
  const sizes = {
    sm: { icon: 'h-5 w-5', text: 'text-base', container: 'p-1' },
    md: { icon: 'h-6 w-6', text: 'text-lg', container: 'p-1.5' },
    lg: { icon: 'h-8 w-8', text: 'text-2xl', container: 'p-2' },
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <LumniMark
        className={cn('border-2', sizes[size].container)}
        iconClassName={sizes[size].icon}
      />
      {showText && (
        <span className={cn('font-bold text-foreground hidden sm:inline', sizes[size].text)}>
          Lumni
        </span>
      )}
    </div>
  );
}
