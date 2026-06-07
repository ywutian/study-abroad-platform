'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, BarChart3, BookOpen, ClipboardCheck, Database, Shield } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function PredictionEvidencePanel() {
  const t = useTranslations('prediction.evidence');

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[1fr_1fr]">
      <Card className="py-0">
        <CardContent className="space-y-4 p-4">
          <div>
            <h2 className="text-base font-semibold">{t('howTitle')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('howDesc')}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <EvidenceSignal icon={BarChart3} label={t('academic')} />
            <EvidenceSignal icon={BookOpen} label={t('historical')} />
            <EvidenceSignal icon={ClipboardCheck} label={t('counselor')} />
          </div>
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardContent className="space-y-4 p-4">
          <div>
            <h2 className="text-base font-semibold">{t('guardrailsTitle')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('guardrailsDesc')}</p>
          </div>
          <div className="space-y-2 text-sm">
            <EvidenceRow icon={Shield} text={t('personalEstimate')} />
            <EvidenceRow icon={Database} text={t('dataSupport')} />
            <EvidenceRow icon={AlertTriangle} text={t('subjectiveFactors')} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EvidenceSignal({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] p-3">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 text-sm font-medium">{label}</p>
    </div>
  );
}

function EvidenceRow({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[var(--theme-radius-button)] border bg-[color:var(--theme-control-bg)] px-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="text-muted-foreground">{text}</span>
      <Badge variant="outline" className="ml-auto">
        OK
      </Badge>
    </div>
  );
}
