'use client';

import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      {/* 学术风 Logo：实体背景 + 边框，无发光效果 */}
      <div
        className={cn(
          'flex items-center justify-center rounded-md border-2 border-primary/20 bg-primary',
          sizes[size].container
        )}
      >
        <GraduationCap className={cn('text-primary-foreground', sizes[size].icon)} />
      </div>
      {showText && (
        <span className={cn('font-bold text-foreground', sizes[size].text)}>StudyAbroad</span>
      )}
    </div>
  );
}
