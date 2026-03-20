'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ContextualHelp, type ContextualHelpProps } from '@/components/ui/contextual-help';
import { cn } from '@/lib/utils';

interface AdminSectionProps {
  title: string;
  description?: string;
  help?: Omit<ContextualHelpProps, 'className'>;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function AdminSection({
  title,
  description,
  help,
  actions,
  children,
  className,
  noPadding,
}: AdminSectionProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{title}</CardTitle>
              {help && <ContextualHelp {...help} />}
            </div>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </CardHeader>
      <CardContent className={cn(noPadding && 'p-0')}>{children}</CardContent>
    </Card>
  );
}
