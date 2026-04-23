'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertCircle,
  Download,
  FileJson,
  Gauge,
  Loader2,
  Play,
  RefreshCcw,
  Upload,
} from 'lucide-react';

import type {
  BenchmarkProfile,
  BenchmarkProfileInput,
  CompetitorBenchmarkReport,
  CompetitorRunDetail,
  CompetitorRunSummary,
  CompetitorSourceSummary,
} from '@study-abroad/shared';
import { adminRoutes } from '@study-abroad/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/lib/api/api-error';
import { formatProbability, getSchoolName } from '@/lib/utils';

const DEFAULT_PROFILE_JSON = `{
  "applicationRound": "RD",
  "targetMajor": "Computer Science",
  "isInternational": true,
  "nationality": "China",
  "gpa": 3.9,
  "gpaScale": 4.0,
  "testScores": [
    { "type": "SAT", "score": 1520 }
  ],
  "activities": [
    {
      "name": "Research",
      "category": "RESEARCH",
      "role": "Lead",
      "hoursPerWeek": 8,
      "weeksPerYear": 30
    }
  ],
  "awards": []
}`;

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.displayMessage || error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function formatPercentPointDelta(delta?: number | null): string {
  if (delta == null) return '—';
  const sign = delta > 0 ? '+' : '';
  return `${sign}${(delta * 100).toFixed(1)}pp`;
}

function buildCsv(report: CompetitorBenchmarkReport, locale: string): string {
  const headers = [
    'schoolKey',
    'schoolName',
    'rawSchoolName',
    'oursProbability',
    'theirsProbability',
    'delta',
    'oursTier',
    'theirsTier',
    'tierAgree',
    'matchStatus',
    'externalSource',
    'note',
  ];

  const escapeCell = (value: unknown) => {
    const text = value == null ? '' : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const rows = report.rows.map((row) => [
    row.schoolKey,
    getSchoolName(row.school, locale),
    row.rawSchoolName,
    row.oursProbability != null ? (row.oursProbability * 100).toFixed(2) : '',
    row.theirsProbability != null ? (row.theirsProbability * 100).toFixed(2) : '',
    row.delta != null ? (row.delta * 100).toFixed(2) : '',
    row.oursTier ?? '',
    row.theirsTier ?? '',
    row.tierAgree == null ? '' : row.tierAgree ? 'true' : 'false',
    row.matchStatus,
    row.externalSource,
    row.note ?? '',
  ]);

  return [headers, ...rows].map((line) => line.map(escapeCell).join(',')).join('\n');
}

export function BenchmarkTab() {
  const t = useTranslations('admin.calibrations.benchmark');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedSourceKey, setSelectedSourceKey] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');
  const [profileLabel, setProfileLabel] = useState('');
  const [profileJsonText, setProfileJsonText] = useState(DEFAULT_PROFILE_JSON);
  const [runLimit, setRunLimit] = useState('');
  const [runHeaded, setRunHeaded] = useState(true);
  const [sessionFileName, setSessionFileName] = useState('');
  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const sessionFileInputRef = useRef<HTMLInputElement>(null);

  const profilesQuery = useQuery<BenchmarkProfile[]>({
    queryKey: ['competitorBenchmarkProfiles'],
    queryFn: () => apiClient.get(adminRoutes.predictionsBenchmarkProfiles()),
  });

  const sourcesQuery = useQuery<CompetitorSourceSummary[]>({
    queryKey: ['competitorBenchmarkSources'],
    queryFn: () => apiClient.get(adminRoutes.predictionsBenchmarkSources()),
  });

  const runsQuery = useQuery<CompetitorRunSummary[]>({
    queryKey: ['competitorBenchmarkRuns'],
    queryFn: () => apiClient.get(adminRoutes.predictionsBenchmarkRuns()),
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (!selectedProfileId && profilesQuery.data?.length) {
      setSelectedProfileId(profilesQuery.data[0].id);
    }
  }, [profilesQuery.data, selectedProfileId]);

  useEffect(() => {
    if (!selectedSourceKey && sourcesQuery.data?.length) {
      setSelectedSourceKey(sourcesQuery.data[0].key);
    }
  }, [selectedSourceKey, sourcesQuery.data]);

  useEffect(() => {
    if (!selectedRunId && runsQuery.data?.length) {
      setSelectedRunId(runsQuery.data[0].id);
    }
  }, [runsQuery.data, selectedRunId]);

  const createProfileMutation = useMutation({
    mutationFn: (payload: { label: string; profileJson: BenchmarkProfileInput }) =>
      apiClient.post<BenchmarkProfile>(adminRoutes.predictionsBenchmarkProfiles(), payload),
    onSuccess: (profile) => {
      toast.success(t('profileCreated'));
      setSelectedProfileId(profile.id);
      queryClient.invalidateQueries({ queryKey: ['competitorBenchmarkProfiles'] });
    },
    onError: (error: unknown) => {
      toast.error(resolveErrorMessage(error, t('profileCreateFailed')));
    },
  });

  const uploadSessionMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiClient.upload<{ success: true }>(
        adminRoutes.predictionsBenchmarkSourceSession(selectedSourceKey),
        formData
      );
    },
    onSuccess: () => {
      toast.success(t('sessionUploaded'));
      queryClient.invalidateQueries({ queryKey: ['competitorBenchmarkSources'] });
    },
    onError: (error: unknown) => {
      toast.error(resolveErrorMessage(error, t('sessionUploadFailed')));
    },
  });

  const startRunMutation = useMutation({
    mutationFn: () =>
      apiClient.post<CompetitorRunSummary>(adminRoutes.predictionsBenchmarkRuns(), {
        profileId: selectedProfileId,
        sourceKey: selectedSourceKey,
        limit: runLimit ? Number(runLimit) : undefined,
        headed: runHeaded,
      }),
    onSuccess: (run) => {
      toast.success(t('runStarted'));
      setSelectedRunId(run.id);
      queryClient.invalidateQueries({ queryKey: ['competitorBenchmarkRuns'] });
    },
    onError: (error: unknown) => {
      toast.error(resolveErrorMessage(error, t('runStartFailed')));
    },
  });

  const runDetailQuery = useQuery<CompetitorRunDetail>({
    queryKey: ['competitorBenchmarkRunDetail', selectedRunId],
    queryFn: () => apiClient.get(adminRoutes.predictionsBenchmarkRunById(selectedRunId)),
    enabled: Boolean(selectedRunId),
    refetchInterval: (query) => {
      const status = (query.state.data as CompetitorRunDetail | undefined)?.status;
      return status === 'PENDING' || status === 'RUNNING' ? 3000 : false;
    },
  });

  const reportQuery = useQuery<CompetitorBenchmarkReport>({
    queryKey: ['competitorBenchmarkReport', selectedRunId],
    queryFn: () => apiClient.get(adminRoutes.predictionsBenchmarkRunReport(selectedRunId)),
    enabled: Boolean(selectedRunId),
    refetchInterval: () => {
      const status = runDetailQuery.data?.status;
      return status === 'PENDING' || status === 'RUNNING' ? 3000 : false;
    },
  });

  const selectedSource = useMemo(
    () => sourcesQuery.data?.find((item) => item.key === selectedSourceKey),
    [selectedSourceKey, sourcesQuery.data]
  );

  const canStartRun =
    Boolean(selectedProfileId) &&
    Boolean(selectedSourceKey) &&
    (selectedSource?.hasSession || selectedSourceKey === 'mock');

  const handleCreateProfile = () => {
    try {
      const parsed = JSON.parse(profileJsonText) as BenchmarkProfileInput;
      createProfileMutation.mutate({
        label: profileLabel.trim(),
        profileJson: parsed,
      });
    } catch {
      toast.error(t('invalidJson'));
    }
  };

  const handleProfileJsonFile = async (file: File) => {
    const text = await file.text();
    setProfileJsonText(text);
  };

  const handleSessionFile = (file: File) => {
    setSessionFileName(file.name);
    uploadSessionMutation.mutate(file);
  };

  const handleDownloadCsv = () => {
    if (!reportQuery.data) return;
    const csv = buildCsv(reportQuery.data, locale);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `competitor-benchmark-${reportQuery.data.runId}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const report = reportQuery.data;

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('introTitle')}</AlertTitle>
        <AlertDescription>{t('introDescription')}</AlertDescription>
      </Alert>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileJson className="h-4 w-4" />
              {t('profileTitle')}
            </CardTitle>
            <CardDescription>{t('profileDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('profileSelect')}</Label>
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('profileSelectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {(profilesQuery.data ?? []).map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('profileLabel')}</Label>
              <Input
                value={profileLabel}
                onChange={(event) => setProfileLabel(event.target.value)}
                placeholder={t('profileLabelPlaceholder')}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('profileJson')}</Label>
              <Textarea
                value={profileJsonText}
                onChange={(event) => setProfileJsonText(event.target.value)}
                className="min-h-[240px] font-mono text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => profileFileInputRef.current?.click()}>
                <Upload className="mr-1.5 h-4 w-4" />
                {t('loadProfileJson')}
              </Button>
              <Button
                onClick={handleCreateProfile}
                disabled={createProfileMutation.isPending || !profileLabel.trim()}
              >
                {createProfileMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <FileJson className="mr-1.5 h-4 w-4" />
                )}
                {t('createProfile')}
              </Button>
            </div>

            <input
              ref={profileFileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleProfileJsonFile(file);
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gauge className="h-4 w-4" />
              {t('sourceTitle')}
            </CardTitle>
            <CardDescription>{t('sourceDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t('sourceSelect')}</Label>
              <Select value={selectedSourceKey} onValueChange={setSelectedSourceKey}>
                <SelectTrigger>
                  <SelectValue placeholder={t('sourceSelectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {(sourcesQuery.data ?? []).map((source) => (
                    <SelectItem key={source.key} value={source.key}>
                      {source.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSource ? (
              <div className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={selectedSource.hasSession ? 'default' : 'secondary'}>
                    {selectedSource.hasSession ? t('sessionReady') : t('sessionMissing')}
                  </Badge>
                  <Badge variant={selectedSource.enabled ? 'default' : 'destructive'}>
                    {selectedSource.enabled ? t('sourceEnabled') : t('sourceDisabled')}
                  </Badge>
                </div>
                <p className="mt-2 text-muted-foreground">{selectedSource.baseUrl}</p>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>{t('sessionUpload')}</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => sessionFileInputRef.current?.click()}
                  disabled={!selectedSourceKey}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  {t('uploadStorageState')}
                </Button>
                {sessionFileName ? <Badge variant="secondary">{sessionFileName}</Badge> : null}
              </div>
              <p className="text-xs text-muted-foreground">{t('sessionHint')}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('runLimit')}</Label>
                <Input
                  value={runLimit}
                  onChange={(event) => setRunLimit(event.target.value)}
                  placeholder={t('runLimitPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('browserMode')}</Label>
                <Select
                  value={runHeaded ? 'headed' : 'headless'}
                  onValueChange={(value) => setRunHeaded(value === 'headed')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="headed">{t('headed')}</SelectItem>
                    <SelectItem value="headless">{t('headless')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => startRunMutation.mutate()}
                disabled={!canStartRun || startRunMutation.isPending}
              >
                {startRunMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-1.5 h-4 w-4" />
                )}
                {t('startRun')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['competitorBenchmarkRuns'] });
                  queryClient.invalidateQueries({ queryKey: ['competitorBenchmarkRunDetail'] });
                  queryClient.invalidateQueries({ queryKey: ['competitorBenchmarkReport'] });
                }}
              >
                <RefreshCcw className="mr-1.5 h-4 w-4" />
                {t('refresh')}
              </Button>
            </div>

            <input
              ref={sessionFileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleSessionFile(file);
              }}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('runHistoryTitle')}</CardTitle>
          <CardDescription>{t('runHistoryDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {runsQuery.isLoading ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : runsQuery.data?.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {runsQuery.data.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  className={`rounded-lg border p-3 text-left transition ${
                    selectedRunId === run.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedRunId(run.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{run.sourceLabel}</span>
                    <Badge variant={run.status === 'FAILED' ? 'destructive' : 'secondary'}>
                      {run.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{run.profileLabel}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('processedCount', { count: run.processedCount })}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('emptyRuns')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">{t('reportTitle')}</CardTitle>
              <CardDescription>{t('reportDescription')}</CardDescription>
            </div>
            <Button variant="outline" onClick={handleDownloadCsv} disabled={!report}>
              <Download className="mr-1.5 h-4 w-4" />
              {t('downloadCsv')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {runDetailQuery.isLoading || reportQuery.isLoading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : report ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('summary.matched')}</p>
                  <p className="text-2xl font-semibold">{report.summary.matchedCount}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    {t('summary.probabilityComparable')}
                  </p>
                  <p className="text-2xl font-semibold">{report.summary.matchedProbabilityCount}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('summary.mae')}</p>
                  <p className="text-2xl font-semibold">
                    {report.summary.mae != null
                      ? `${(report.summary.mae * 100).toFixed(1)}pp`
                      : '—'}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('summary.meanDelta')}</p>
                  <p className="text-2xl font-semibold">
                    {report.summary.meanDelta != null
                      ? `${(report.summary.meanDelta * 100).toFixed(1)}pp`
                      : '—'}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('summary.tierAgreement')}</p>
                  <p className="text-2xl font-semibold">
                    {report.summary.tierAgreementRate != null
                      ? `${Math.round(report.summary.tierAgreementRate * 100)}%`
                      : '—'}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t('summary.coverageGap')}</p>
                  <p className="text-2xl font-semibold">{report.summary.coverageGapCount}</p>
                </div>
              </div>

              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('table.school')}</TableHead>
                      <TableHead>{t('table.ours')}</TableHead>
                      <TableHead>{t('table.theirs')}</TableHead>
                      <TableHead>{t('table.delta')}</TableHead>
                      <TableHead>{t('table.tier')}</TableHead>
                      <TableHead>{t('table.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows.map((row) => (
                      <TableRow key={row.schoolKey}>
                        <TableCell className="align-top">
                          <div className="font-medium">
                            {getSchoolName(row.school, locale) || row.rawSchoolName}
                          </div>
                          {row.school ? (
                            <p className="text-xs text-muted-foreground">{row.rawSchoolName}</p>
                          ) : null}
                          {row.note ? (
                            <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>{formatProbability(row.oursProbability)}</TableCell>
                        <TableCell>{formatProbability(row.theirsProbability)}</TableCell>
                        <TableCell>{formatPercentPointDelta(row.delta)}</TableCell>
                        <TableCell className="align-top">
                          <div className="text-sm">
                            {row.oursTier ?? '—'} / {row.theirsTier ?? '—'}
                          </div>
                          {row.matchStatus === 'matched-tier-only' ? (
                            <p className="text-xs text-muted-foreground">{t('tierOnlyHint')}</p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{row.matchStatus}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('emptyReport')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
