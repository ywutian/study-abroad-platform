'use client';

import { HelpCircle, Info, ExternalLink } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ContextualHelpProps {
  variant?: 'info' | 'help';
  title: string;
  description: string;
  learnMoreHref?: string;
  learnMoreLabel?: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  size?: 'sm' | 'md';
}

export function ContextualHelp({
  variant = 'help',
  title,
  description,
  learnMoreHref,
  learnMoreLabel,
  side = 'bottom',
  className,
  size = 'sm',
}: ContextualHelpProps) {
  const Icon = variant === 'info' ? Info : HelpCircle;
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-help focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className
          )}
          aria-label={title}
        >
          <Icon className={iconSize} />
        </button>
      </PopoverTrigger>
      <PopoverContent side={side} className="w-80">
        <div className="space-y-2">
          <h4 className="font-medium text-sm leading-none">{title}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          {learnMoreHref && (
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
              <a href={learnMoreHref} target="_blank" rel="noopener noreferrer">
                {learnMoreLabel || 'Learn more'}
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
