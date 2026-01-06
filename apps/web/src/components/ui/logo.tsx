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
    sm: { icon: 'h-5 w-5', text: 'text-base' },
    md: { icon: 'h-6 w-6', text: 'text-lg' },
    lg: { icon: 'h-8 w-8', text: 'text-2xl' },
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 blur-sm opacity-50" />
        <div className="relative flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 p-1.5">
          <GraduationCap className={cn('text-white', sizes[size].icon)} />
        </div>
      </div>
      {showText && (
        <span className={cn('font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent', sizes[size].text)}>
          StudyAbroad
        </span>
      )}
    </div>
  );
}





