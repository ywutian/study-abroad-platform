'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface RatingInputProps {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function RatingInput({ label, description, value, onChange, disabled }: RatingInputProps) {
  const [hover, setHover] = useState(0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Label className="font-medium">{label}</Label>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <motion.button
              key={star}
              type="button"
              whileHover={{ scale: disabled ? 1 : 1.1 }}
              whileTap={{ scale: disabled ? 1 : 0.9 }}
              onMouseEnter={() => !disabled && setHover(star)}
              onMouseLeave={() => !disabled && setHover(0)}
              onClick={() => !disabled && onChange(star)}
              disabled={disabled}
              className={cn('p-1', disabled && 'cursor-not-allowed opacity-50')}
            >
              <Star
                className={cn(
                  'h-6 w-6 transition-colors',
                  (hover || value) >= star
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted-foreground/30'
                )}
              />
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
