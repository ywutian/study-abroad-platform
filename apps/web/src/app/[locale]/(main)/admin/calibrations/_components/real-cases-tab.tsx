'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Loader2,
  Play,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';

import { adminRoutes, REAL_CASES_CSV_REQUIRED_COLUMNS } from '@study-abroad/shared';
import { apiClient } from '@/lib/api';
import { ApiError } from '@/lib/api/api-error';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type SuggestedSchool = { id: string; name: string };

type UnmatchedSchoolRow = {
  line: number;
  name: string;
  rowPreview: string;
  suggestedSchools: SuggestedSchool[];
};

type AmbiguousSchoolRow = {
  line: number;
  inputName: string;
  rowPreview: string;
  candidates: SuggestedSchool[];
};

type IngestSummary = {
  batchId: string;
  dryRun: boolean;
  totalRows: number;
  ingested: number;
  skippedDuplicate: number;
  skippedNoSchool: number;
  skippedAmbiguous: number;
  skippedBadRow: number;
  matchTypeCounts: Record<string, number>;
  perSchool: Record<string, number>;
  perResult: Record<string, number>;
  unmatchedSchools: UnmatchedSchoolRow[];
  ambiguousSchools: AmbiguousSchoolRow[];
  rowErrors: Array<{ line: number; error: string }>;
  warnings: string[];
  rollbackSql: string | null;
  header: string[];
};

/** RFC4180-ish: first row only (header). */
function parseFirstCsvRowFields(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        fields.push(field.trim());
        field = '';
      } else {
        field += c;
      }
    }
  }
  fields.push(field.trim());
  return fields;
}

function getCsvHeaderNames(csv: string): string[] {
  const first = csv.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (!first) return [];
  return parseFirstCsvRowFields(first);
}

function missingRequiredColumns(headers: string[]): string[] {
  return REAL_CASES_CSV_REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
}

export function RealCasesTab() {
  const t = useTranslations('admin.calibrations.realCases');
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<IngestSummary | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const templateMutation = useMutation({
    mutationFn: () => apiClient.get<string>(adminRoutes.predictionsDiagRealCasesTemplate()),
    onSuccess: (csv) => {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'real-cases-template.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('templateDownloaded'));
    },
    onError: (err: unknown) => {
      toast.error(resolveErrorMessage(err, t('templateDownloadFailed')));
    },
  });

  const ingestMutation = useMutation({
    mutationFn: (payload: { csv: string; dryRun: boolean }) =>
      apiClient.post<IngestSummary>(adminRoutes.predictionsDiagIngestCases(), payload),
    onSuccess: (data) => {
      setLastResult(data);
      if (data.dryRun) {
        toast.success(t('dryRunSuccess', { count: data.ingested }));
      } else {
        toast.success(t('commitSuccess', { count: data.ingested }));
      }
    },
    onError: (err: unknown) => {
      toast.error(resolveErrorMessage(err, t('ingestFailed')));
    },
  });

  const applyFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast.error(t('errorNotCsv'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('errorTooLarge'));
        return;
      }
      const text = await file.text();
      const headers = getCsvHeaderNames(text);
      const missing = missingRequiredColumns(headers);
      if (missing.length > 0) {
        toast.error(t('missingColumns', { columns: missing.join(', ') }));
        return;
      }
      setCsvContent(text);
      setFileName(file.name);
      setLastResult(null);
    },
    [t]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await applyFile(file);
  };

  const clearUpload = () => {
    setCsvContent(null);
    setFileName(null);
    setLastResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const lineCount = useMemo(() => {
    if (!csvContent) return 0;
    return csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0).length - 1;
  }, [csvContent]);

  const runDryRun = () => {
    if (!csvContent) return;
    const missing = missingRequiredColumns(getCsvHeaderNames(csvContent));
    if (missing.length > 0) {
      toast.error(t('missingColumns', { columns: missing.join(', ') }));
      return;
    }
    ingestMutation.mutate({ csv: csvContent, dryRun: true });
  };

  const runCommit = () => {
    if (!csvContent) return;
    ingestMutation.mutate({ csv: csvContent, dryRun: false });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void applyFile(file);
  };

  const pending = ingestMutation.isPending || templateMutation.isPending;

  return (
    <div className="space-y-6">
      <Alert>
        <FileText className="h-4 w-4" />
        <AlertTitle>{t('infoTitle')}</AlertTitle>
        <AlertDescription>{t('infoDescription')}</AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> {t('uploadTitle')}
          </CardTitle>
          <CardDescription>{t('uploadDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">{t('encodingHint')}</p>

          <div
            role="button"
            tabIndex={0}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setIsDragging(false);
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className={
              'rounded-lg border-2 border-dashed p-6 text-center transition-colors ' +
              (isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 bg-muted/30')
            }
          >
            <p className="text-sm text-muted-foreground">{t('dropzoneHint')}</p>
            <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <div className="w-full max-w-md text-left">
                <Label htmlFor="csv-file">{t('chooseFile')}</Label>
                <Input
                  ref={fileInputRef}
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  disabled={pending}
                  className="mt-1 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {fileName && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {fileName} · {lineCount} {t('dataRows')}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearUpload}
                disabled={pending}
                className="gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('clearFile')}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => templateMutation.mutate()}
              disabled={pending}
              className="gap-2"
            >
              {templateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t('downloadTemplate')}
            </Button>
            <Button
              type="button"
              disabled={!csvContent || pending}
              onClick={runDryRun}
              variant="secondary"
              className="gap-2"
            >
              {ingestMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {t('dryRun')}
            </Button>
            <Button
              type="button"
              disabled={
                !csvContent ||
                pending ||
                !lastResult ||
                !lastResult.dryRun ||
                lastResult.ingested === 0
              }
              onClick={runCommit}
              className="gap-2"
            >
              {ingestMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {t('commit')}
            </Button>
          </div>

          {lastResult?.dryRun && lastResult.ingested === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{t('dryRunZeroHint')}</p>
          )}
          {lastResult && lastResult.dryRun && lastResult.ingested > 0 && (
            <p className="text-xs text-muted-foreground">{t('commitHint')}</p>
          )}
        </CardContent>
      </Card>

      {lastResult && <ResultsPanel result={lastResult} />}
    </div>
  );
}

function resolveErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.displayMessage || err.message || fallback;
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message);
  }
  return fallback;
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'good' | 'warn' | 'bad' | 'neutral';
}) {
  const color =
    tone === 'good'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'bad'
          ? 'text-rose-600 dark:text-rose-400'
          : 'text-foreground';
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-1 p-4">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-2xl font-semibold tabular-nums ${color}`}>{value}</span>
      </CardContent>
    </Card>
  );
}

function ResultsPanel({ result }: { result: IngestSummary }) {
  const t = useTranslations('admin.calibrations.realCases');
  const ingestedTotal = result.ingested + result.skippedDuplicate;
  const admitted = result.perResult.ADMITTED ?? 0;
  const rejected = result.perResult.REJECTED ?? 0;
  const admittedPct = ingestedTotal > 0 ? (admitted / ingestedTotal) * 100 : 0;
  const rejectedPct = ingestedTotal > 0 ? (rejected / ingestedTotal) * 100 : 0;

  const copyRollback = () => {
    if (!result.rollbackSql) return;
    void navigator.clipboard.writeText(result.rollbackSql);
    toast.success(t('rollbackCopied'));
  };

  const matchEntries = Object.entries(result.matchTypeCounts).sort((a, b) => b[1] - a[1]);

  const matchTypeLabel = (key: string) => {
    switch (key) {
      case 'id':
        return t('matchType.id');
      case 'exact':
        return t('matchType.exact');
      case 'normalized':
        return t('matchType.normalized');
      case 'alias':
        return t('matchType.alias');
      case 'substring':
        return t('matchType.substring');
      default:
        return key;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">
          {result.dryRun ? t('dryRunResultTitle') : t('commitResultTitle')}
        </h3>
        <Badge variant={result.dryRun ? 'outline' : 'default'}>
          {result.dryRun ? 'DRY RUN' : 'COMMITTED'}
        </Badge>
        <span className="text-xs text-muted-foreground">
          batch: <code className="font-mono">{result.batchId}</code>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label={t('stats.ingested')}
          value={result.ingested}
          tone={result.ingested > 0 ? 'good' : 'neutral'}
        />
        <StatCard label={t('stats.duplicate')} value={result.skippedDuplicate} tone="neutral" />
        <StatCard
          label={t('stats.noSchool')}
          value={result.skippedNoSchool}
          tone={result.skippedNoSchool > 0 ? 'bad' : 'neutral'}
        />
        <StatCard
          label={t('stats.ambiguous')}
          value={result.skippedAmbiguous ?? 0}
          tone={(result.skippedAmbiguous ?? 0) > 0 ? 'warn' : 'neutral'}
        />
        <StatCard
          label={t('stats.badRow')}
          value={result.skippedBadRow}
          tone={result.skippedBadRow > 0 ? 'warn' : 'neutral'}
        />
      </div>

      {matchEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('matchTypeTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {matchEntries.map(([key, n]) => (
                <li key={key} className="flex justify-between gap-4">
                  <span>{matchTypeLabel(key)}</span>
                  <span className="tabular-nums text-muted-foreground">{n}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            {t('toggleHeaders')}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 rounded-md border bg-muted/40 p-3 font-mono text-xs">
          {result.header.join(', ')}
        </CollapsibleContent>
      </Collapsible>

      {ingestedTotal > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('distribution')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-28">ADMITTED</span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                <div className="h-full bg-emerald-500" style={{ width: `${admittedPct}%` }} />
              </div>
              <span className="w-24 text-right tabular-nums">
                {admitted} ({admittedPct.toFixed(0)}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-28">REJECTED</span>
              <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
                <div className="h-full bg-rose-500" style={{ width: `${rejectedPct}%` }} />
              </div>
              <span className="w-24 text-right tabular-nums">
                {rejected} ({rejectedPct.toFixed(0)}%)
              </span>
            </div>
            {Object.entries(result.perResult)
              .filter(([k]) => k !== 'ADMITTED' && k !== 'REJECTED')
              .map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-muted-foreground">
                  <span className="w-28">{k}</span>
                  <span>{v}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {result.warnings.length > 0 && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>{t('warningsTitle')}</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {(result.ambiguousSchools?.length ?? 0) > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              {t('ambiguousTitle', {
                count: result.ambiguousSchools?.length ?? 0,
              })}
            </CardTitle>
            <CardDescription>{t('ambiguousHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 space-y-3 overflow-auto text-sm">
              {result.ambiguousSchools!.map((a) => (
                <div key={`${a.line}-${a.inputName}`} className="rounded border bg-muted/40 p-2">
                  <div className="font-medium">
                    line {a.line}: {a.inputName}
                  </div>
                  <ul className="mt-1 list-inside list-disc text-muted-foreground">
                    {a.candidates.map((c) => (
                      <li key={c.id}>
                        {c.name} <code className="text-xs opacity-80">({c.id})</code>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result.unmatchedSchools.length > 0 && (
        <Card className="border-rose-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-rose-600">
              <XCircle className="h-4 w-4" />
              {t('unmatchedTitle', { count: result.unmatchedSchools.length })}
            </CardTitle>
            <CardDescription>{t('unmatchedHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 space-y-3 overflow-auto text-sm">
              {result.unmatchedSchools.map((u) => (
                <div
                  key={`${u.line}-${u.name}`}
                  className="rounded border bg-muted/50 p-2 font-mono text-xs"
                >
                  <div>
                    <span className="text-muted-foreground">line {u.line}</span>{' '}
                    <span className="font-medium text-rose-600">{u.name}</span>
                  </div>
                  {u.rowPreview && (
                    <div className="mt-0.5 text-muted-foreground">{u.rowPreview}</div>
                  )}
                  {u.suggestedSchools.length > 0 && (
                    <div className="mt-2 text-foreground">
                      <span className="text-2xs uppercase tracking-wide text-muted-foreground">
                        {t('suggestedSchools')}
                      </span>
                      <ul className="mt-1 list-inside list-disc">
                        {u.suggestedSchools.map((s) => (
                          <li key={s.id}>
                            {s.name} <code className="opacity-70">({s.id})</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {result.rowErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('rowErrorsTitle', { count: result.rowErrors.length })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-auto rounded border bg-muted/50 p-2 font-mono text-xs">
              {result.rowErrors.slice(0, 50).map((e, i) => (
                <div key={i}>
                  <span className="inline-block w-14 text-muted-foreground">line {e.line}</span>
                  <span>{e.error}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {Object.keys(result.perSchool).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('topSchools')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              {Object.entries(result.perSchool)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([name, n]) => (
                  <div key={name} className="flex items-center justify-between gap-2">
                    <span className="truncate">{name}</span>
                    <span className="tabular-nums text-muted-foreground">{n}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!result.dryRun && result.rollbackSql && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle className="flex flex-wrap items-center gap-2">
            {t('rollbackTitle')}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1"
              onClick={copyRollback}
            >
              <Copy className="h-3.5 w-3.5" />
              {t('copyRollback')}
            </Button>
          </AlertTitle>
          <AlertDescription>
            <pre className="mt-2 overflow-auto rounded bg-muted p-2 font-mono text-xs">
              {result.rollbackSql}
            </pre>
          </AlertDescription>
        </Alert>
      )}

      {!result.dryRun && result.ingested > 0 && (
        <Alert className="border-emerald-500/40 bg-emerald-500/10">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle>{t('nextStepTitle')}</AlertTitle>
          <AlertDescription>
            <code className="mt-2 inline-block rounded bg-muted px-2 py-1 font-mono text-xs">
              pnpm --filter api diag:run
            </code>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
