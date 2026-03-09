'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const SIZE_CLASSES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-lg',
  lg: 'w-16 h-16 text-2xl',
} as const;

const SIZE_PX: Record<keyof typeof SIZE_CLASSES, number> = {
  sm: 32,
  md: 48,
  lg: 64,
};

const OPTIMIZABLE_HOSTS = new Set(['www.google.com', 'img.logo.dev']);

function canOptimize(url: string): boolean {
  try {
    return OPTIMIZABLE_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export interface SchoolLogoProps {
  /** Logo image URL. When missing or failed to load, fallback to initial. */
  logoUrl?: string | null;
  /** School name (or display name) for initial fallback. */
  name: string;
  /** Size variant. */
  size?: keyof typeof SIZE_CLASSES;
  /** Optional: call when image fails to load (e.g. to track in parent state). */
  onError?: () => void;
  /** Extra class for the container. */
  className?: string;
  /** Use rounded-lg instead of rounded-xl for detail hero style. */
  rounded?: 'xl' | 'lg';
  /** 'hero' = dark container + white initial (e.g. detail page). */
  variant?: 'default' | 'hero';
}

/**
 * Enterprise school logo: next/image with retina-aware srcset,
 * error fallback to initial, and muted container background.
 */
export function SchoolLogo({
  logoUrl,
  name,
  size = 'md',
  onError,
  className,
  rounded = 'xl',
  variant = 'default',
}: SchoolLogoProps) {
  const [failed, setFailed] = useState(false);
  const showImage = !!logoUrl && !failed;
  const initial = name.trim().charAt(0) || '?';

  const handleError = () => {
    setFailed(true);
    onError?.();
  };

  const isDecorative = variant === 'default' && size !== 'lg';
  const px = SIZE_PX[size];

  return (
    <div
      className={cn(
        'shrink-0 flex items-center justify-center overflow-hidden',
        variant === 'default' && 'border border-border/50 bg-muted/50 ring-1 ring-black/5',
        variant === 'hero' && 'bg-primary text-white',
        SIZE_CLASSES[size],
        rounded === 'xl' ? 'rounded-xl' : 'rounded-lg',
        className
      )}
      role="img"
      aria-label={isDecorative ? undefined : `Logo of ${name}`}
      aria-hidden={isDecorative}
    >
      {showImage ? (
        <Image
          src={logoUrl}
          alt=""
          width={px}
          height={px}
          quality={90}
          className="w-full h-full object-cover"
          unoptimized={!canOptimize(logoUrl)}
          onError={handleError}
        />
      ) : (
        <span
          className={cn(
            'font-bold',
            variant === 'hero' ? 'text-white' : 'bg-primary bg-clip-text text-transparent'
          )}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
