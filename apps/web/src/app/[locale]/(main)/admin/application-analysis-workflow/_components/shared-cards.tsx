'use client';

import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';

import { formatMetric } from './utils';

export function MetricCard({ label, value }: { label: string; value: unknown }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{formatMetric(value)}</div>
      </CardContent>
    </Card>
  );
}

export function PreviewCard({
  icon: Icon,
  title,
  content,
}: {
  icon: LucideIcon;
  title: string;
  content: string[];
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 font-medium">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {content.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}
