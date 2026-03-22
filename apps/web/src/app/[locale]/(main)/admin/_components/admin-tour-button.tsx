'use client';

import { useEffect } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TourStep {
  id: string;
  element: string;
  popover: {
    title: string;
    description: string;
    side?: 'top' | 'bottom' | 'left' | 'right';
  };
}

interface AdminTourConfig {
  tourId: string;
  steps: TourStep[];
}

interface AdminTourButtonProps {
  tourId: string;
  label?: string;
  tourConfig: AdminTourConfig;
}

let tourProviderModule: typeof import('@/components/features/onboarding/tour-provider') | null =
  null;

export function AdminTourButton({ tourId, label, tourConfig }: AdminTourButtonProps) {
  useEffect(() => {
    import('@/components/features/onboarding/tour-provider').then((mod) => {
      tourProviderModule = mod;
    });
  }, []);

  const handleStartTour = () => {
    if (!tourProviderModule) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { driver } = require('driver.js');
      const driverInstance = driver({
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        steps: tourConfig.steps.map((step) => ({
          element: step.element,
          popover: {
            title: step.popover.title,
            description: step.popover.description,
            side: step.popover.side || 'bottom',
          },
        })),
        onDestroyStarted: () => {
          if (typeof window !== 'undefined') {
            try {
              const key = 'completed_tours';
              const stored = localStorage.getItem(key);
              const completed = stored ? new Set(JSON.parse(stored)) : new Set();
              completed.add(tourId);
              localStorage.setItem(key, JSON.stringify([...completed]));
            } catch {
              /* ignore */
            }
          }
          driverInstance.destroy();
        },
      });
      driverInstance.drive();
    } catch {
      /* driver.js not available */
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleStartTour} className="gap-1.5">
      <CircleHelp className="h-3.5 w-3.5" />
      {label || 'Take a tour'}
    </Button>
  );
}
