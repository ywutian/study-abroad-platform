'use client';

import { Star, StarHalf } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingDisplayProps {
  rating: number; // 1-5
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  showNumber?: boolean;
}

export function RatingDisplay({
  rating,
  count,
  size = 'md',
  showNumber = true,
}: RatingDisplayProps) {
  const sizeClass = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }[size];

  const textSize = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size];

  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {Array(fullStars)
          .fill(0)
          .map((_, i) => (
            <Star key={`full-${i}`} className={cn(sizeClass, 'fill-amber-400 text-amber-400')} />
          ))}
        {hasHalf && <StarHalf className={cn(sizeClass, 'fill-amber-400 text-amber-400')} />}
        {Array(emptyStars)
          .fill(0)
          .map((_, i) => (
            <Star key={`empty-${i}`} className={cn(sizeClass, 'text-muted-foreground/30')} />
          ))}
      </div>
      {showNumber && <span className={cn(textSize, 'font-medium')}>{rating.toFixed(1)}</span>}
      {count !== undefined && (
        <span className={cn(textSize, 'text-muted-foreground')}>({count})</span>
      )}
    </div>
  );
}
