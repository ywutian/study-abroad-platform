import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type EnterpriseStatusTone = 'ready' | 'attention' | 'blocked' | 'verified';

export interface EnterpriseStatusItem {
  tone: EnterpriseStatusTone;
  label: string;
  value: string;
  description: string;
  icon?: LucideIcon;
}

const toneMeta: Record<
  EnterpriseStatusTone,
  { icon: LucideIcon; badge: 'success' | 'warning' | 'destructive' | 'default'; className: string }
> = {
  ready: {
    icon: CheckCircle2,
    badge: 'success',
    className: 'border-success/25 bg-success/10',
  },
  attention: {
    icon: Clock3,
    badge: 'warning',
    className: 'border-warning/25 bg-warning/10',
  },
  blocked: {
    icon: AlertTriangle,
    badge: 'destructive',
    className: 'border-destructive/25 bg-destructive/10',
  },
  verified: {
    icon: ShieldCheck,
    badge: 'default',
    className: 'border-primary/25 bg-primary/10',
  },
};

export function EnterpriseStatusStrip({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: EnterpriseStatusItem[];
}) {
  return (
    <Card className="border-primary/15 bg-[color:var(--theme-card-bg)]">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => {
            const meta = toneMeta[item.tone];
            const Icon = item.icon ?? meta.icon;
            return (
              <div
                key={`${item.label}-${item.value}`}
                className={cn(
                  'rounded-[var(--theme-radius-card)] border p-3 transition-colors',
                  meta.className
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="truncate text-sm font-medium">{item.label}</span>
                  </div>
                  <Badge variant={meta.badge}>{item.value}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
