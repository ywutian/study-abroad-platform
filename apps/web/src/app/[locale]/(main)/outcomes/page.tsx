'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { GraduationCap, Trophy, Upload, ShieldCheck } from 'lucide-react';
import { outcomeRoutes } from '@study-abroad/shared';

import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

interface OutcomeView {
  id: string;
  predictionResultId: string;
  result:
    | 'ADMITTED'
    | 'REJECTED'
    | 'WAITLISTED'
    | 'DEFERRED'
    | 'UNKNOWN'
    | 'CENSORED'
    | 'WITHDRAWN';
  status:
    | 'SELF_REPORTED'
    | 'COUNSELOR_VERIFIED'
    | 'DOCUMENT_VERIFIED'
    | 'REJECTED'
    | 'CONFLICTED'
    | 'REQUEST_EVIDENCE';
  notes: string | null;
  evidenceUrl: string | null;
  round: string | null;
  isFinal: boolean;
  createdAt: string;
  schoolName?: string;
  predictionProbability?: number;
}

interface MyStats {
  totalReported: number;
  selfReported: number;
  verified: number;
  pointsEarned: number;
}

/**
 * /outcomes — My Outcome Reporting page
 *
 * Shows the user all their reported outcomes, their verification status,
 * and lets them upload evidence to upgrade SELF_REPORTED to DOCUMENT_VERIFIED.
 */
export default function OutcomesPage() {
  const t = useTranslations('Outcome');

  const { data: outcomes } = useQuery<OutcomeView[]>({
    queryKey: ['outcomes', 'mine'],
    queryFn: () => apiClient.get<OutcomeView[]>(outcomeRoutes.myList()),
  });

  const { data: stats } = useQuery<MyStats>({
    queryKey: ['outcomes', 'stats'],
    queryFn: () => apiClient.get<MyStats>(outcomeRoutes.myStats()),
  });

  return (
    <PageContainer>
      <PageHeader
        title={t('pageTitle')}
        description={t('pageSubtitle')}
        color="emerald"
        icon={GraduationCap}
      />

      {stats && stats.totalReported > 0 && (
        <Card className="mb-6">
          <CardContent className="grid grid-cols-3 gap-4 p-6">
            <Stat label={t('myHistory')} value={stats.totalReported} icon={GraduationCap} />
            <Stat label={t('statusSelfReported')} value={stats.selfReported} icon={Upload} />
            <Stat label={t('statusCounselorVerified')} value={stats.verified} icon={ShieldCheck} />
          </CardContent>
        </Card>
      )}

      {!outcomes || outcomes.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-12 w-12 text-muted-foreground" />}
          title={t('noOutcomes')}
          description={t('myHistoryDescription')}
        />
      ) : (
        <div className="space-y-3">
          {outcomes.map((o) => (
            <OutcomeCard key={o.id} outcome={o} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 p-2">
        <Icon className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function OutcomeCard({ outcome }: { outcome: OutcomeView }) {
  const t = useTranslations('Outcome');
  const [uploading, setUploading] = useState(false);

  const resultColor: Record<string, string> = {
    ADMITTED: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300',
    REJECTED: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300',
    WAITLISTED: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300',
    DEFERRED: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  };

  const statusBadge = (status: string) => {
    if (status === 'DOCUMENT_VERIFIED')
      return (
        <Badge variant="default" className="bg-emerald-600">
          {t('statusDocumentVerified')}
        </Badge>
      );
    if (status === 'COUNSELOR_VERIFIED')
      return (
        <Badge variant="default" className="bg-blue-600">
          {t('statusCounselorVerified')}
        </Badge>
      );
    return <Badge variant="outline">{t('statusSelfReported')}</Badge>;
  };

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      // apiClient.post handles multipart automatically with FormData payload
      await apiClient.post(outcomeRoutes.uploadEvidence(outcome.id), form);
      toast.success(t('evidenceUploaded'));
      // Re-fetch outcomes
      // @release-navigation-allowed: evidence upload refreshes server-derived file state after multipart submit.
      window.location.reload();
    } catch {
      toast.error(t('reportError'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  resultColor[outcome.result] ?? 'bg-muted'
                }`}
              >
                {t(outcome.result.toLowerCase())}
              </span>
              {outcome.round && (
                <span className="text-xs text-muted-foreground">{outcome.round}</span>
              )}
              {statusBadge(outcome.status)}
            </div>
            <h3 className="font-semibold text-base mt-2 truncate">{outcome.schoolName ?? '—'}</h3>
            {outcome.predictionProbability !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                {t('predictedProbability', {
                  p: `${(outcome.predictionProbability * 100).toFixed(0)}%`,
                })}
              </p>
            )}
            {outcome.notes && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {outcome.notes.replace(/\[share=true\]/g, '').trim()}
              </p>
            )}
          </div>

          {outcome.status === 'SELF_REPORTED' && (
            <div className="shrink-0">
              {outcome.evidenceUrl ? (
                <Badge variant="outline">{t('evidenceUploaded')}</Badge>
              ) : (
                <>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                    id={`upload-${outcome.id}`}
                  />
                  <Button size="sm" variant="outline" asChild disabled={uploading}>
                    <label htmlFor={`upload-${outcome.id}`} className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-1" />
                      {t('uploadEvidence')}
                    </label>
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
