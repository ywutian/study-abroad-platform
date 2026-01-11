'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { AlertTriangle, RefreshCw, WifiOff, ServerCrash, ShieldX } from 'lucide-react';
import { Button } from './button';

type ErrorVariant = 'default' | 'network' | 'server' | 'permission' | 'notFound';

const variantIcons = {
  default: AlertTriangle,
  network: WifiOff,
  server: ServerCrash,
  permission: ShieldX,
  notFound: AlertTriangle,
};

const variantTextKeys: Record<ErrorVariant, { title: string; description: string }> = {
  default: { title: 'default', description: 'defaultDesc' },
  network: { title: 'network', description: 'networkDesc' },
  server: { title: 'server', description: 'serverDesc' },
  permission: { title: 'permission', description: 'permissionDesc' },
  notFound: { title: 'notFound', description: 'notFoundDesc' },
};

interface ErrorStateProps {
  variant?: ErrorVariant;
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  variant = 'default',
  title,
  description,
  onRetry,
  className,
}: ErrorStateProps) {
  const t = useTranslations('ui.errorState');
  const tCommon = useTranslations('common');
  const Icon = variantIcons[variant];
  const textKeys = variantTextKeys[variant];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-12 text-center',
        className
      )}
    >
      <div className="mb-4 rounded-full bg-destructive/10 p-4">
        <Icon className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="mb-1 text-lg font-semibold">{title || t(textKeys.title)}</h3>
      <p className="mb-4 max-w-sm text-sm text-muted-foreground">
        {description || t(textKeys.description)}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          {tCommon('retry')}
        </Button>
      )}
    </div>
  );
}





