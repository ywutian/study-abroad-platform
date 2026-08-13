'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { usePreviewPrediction } from '@/hooks/use-prediction';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TIER_CONFIG } from './constants';
import type { PredictionPreviewScenario, PredictionResult, SchoolSearchItem } from './types';

const ROUND_OPTIONS = ['CURRENT', 'RD', 'ED', 'ED2', 'EA', 'REA', 'SCEA', 'ROLLING'] as const;

interface PredictionWhatIfPanelProps {
  selectedSchools: SchoolSearchItem[];
  profile?: {
    gpa?: number | string | null;
    gpaScale?: number | string | null;
    targetMajor?: string | null;
    intendedMajor?: string | null;
    grade?: string | null;
    applyingTestOptional?: boolean | null;
  } | null;
  disabled?: boolean;
}

export function PredictionWhatIfPanel({
  selectedSchools,
  profile,
  disabled,
}: PredictionWhatIfPanelProps) {
  const t = useTranslations('prediction');
  const previewMutation = usePreviewPrediction();
  const [gpa, setGpa] = useState(toInputValue(profile?.gpa));
  const [gpaScale, setGpaScale] = useState(toInputValue(profile?.gpaScale ?? 4));
  const [satScore, setSatScore] = useState('');
  const [actScore, setActScore] = useState('');
  const [targetMajor, setTargetMajor] = useState(
    profile?.targetMajor ?? profile?.intendedMajor ?? ''
  );
  const [grade, setGrade] = useState(profile?.grade ?? '');
  const [applicationRound, setApplicationRound] =
    useState<(typeof ROUND_OPTIONS)[number]>('CURRENT');
  const [applyingTestOptional, setApplyingTestOptional] = useState(
    Boolean(profile?.applyingTestOptional)
  );
  const [previewResults, setPreviewResults] = useState<PredictionResult[]>([]);
  // `hasRun` (not previewResults.length) drives the result area: a run that
  // returns 0 schools must show an explicit empty state, not silently nothing —
  // that "silent success" was the "no response" the user reported.
  const [hasRun, setHasRun] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const schoolIds = useMemo(() => selectedSchools.map((school) => school.id), [selectedSchools]);
  const canRun = schoolIds.length > 0 && !disabled && !previewMutation.isPending;

  // Why the button is dead, in the panel itself.
  //
  // `disabled:pointer-events-none` (button.tsx:8) means a disabled Preview
  // swallows the click with no cursor change, no toast, nothing — which is
  // exactly the reported "我按这个是没有反应的". The empty-selection case had a
  // hint; the `disabled` case had NOTHING, because the profile blockers render
  // in COL2 while this panel sits in COL1.
  //
  // (The `toast.error(t('whatIf.selectSchools'))` guard at the top of
  // `runPreview` is unreachable for the same reason — the button is already
  // disabled in precisely that case. Left in place as a defence for
  // programmatic callers; the hint below is what a user actually sees.)
  const disabledReason = previewMutation.isPending
    ? null
    : schoolIds.length === 0
      ? t('whatIf.selectSchoolsHint')
      : disabled
        ? t('whatIf.profileBlockedHint')
        : null;

  // The result renders below a tall form, so pull it into view after a run —
  // otherwise it looks like nothing happened.
  useEffect(() => {
    if (hasRun) resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [hasRun, previewResults]);

  const reset = () => {
    setGpa(toInputValue(profile?.gpa));
    setGpaScale(toInputValue(profile?.gpaScale ?? 4));
    setSatScore('');
    setActScore('');
    setTargetMajor(profile?.targetMajor ?? profile?.intendedMajor ?? '');
    setGrade(profile?.grade ?? '');
    setApplicationRound('CURRENT');
    setApplyingTestOptional(Boolean(profile?.applyingTestOptional));
    setPreviewResults([]);
    setHasRun(false);
  };

  const runPreview = () => {
    if (schoolIds.length === 0) {
      toast.error(t('whatIf.selectSchools'));
      return;
    }

    const scenario: PredictionPreviewScenario = {
      ...numberField('gpa', gpa),
      ...numberField('gpaScale', gpaScale),
      ...numberField('satScore', satScore),
      ...numberField('actScore', actScore),
      ...(targetMajor.trim() ? { targetMajor: targetMajor.trim() } : {}),
      ...(grade.trim() ? { grade: grade.trim() } : {}),
      applyingTestOptional,
      ...(applicationRound !== 'CURRENT' ? { applicationRound } : {}),
    };

    previewMutation.mutate(
      { schoolIds, scenario },
      {
        onSuccess: (data) => {
          // Treat an incomplete success envelope as an empty result set. A
          // provider/proxy degradation must not crash the whole prediction page
          // while rendering `results.length`.
          const results = Array.isArray(data?.results) ? data.results : [];
          setPreviewResults(results);
          setHasRun(true);
          toast.success(t('whatIf.success', { count: results.length }));
        },
        onError: () => toast.error(t('whatIf.error')),
      }
    );
  };

  return (
    <div className="rounded-[var(--theme-radius-card)] border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">{t('whatIf.title')}</h2>
          </div>
          <p className="text-xs text-muted-foreground">{t('whatIf.subtitle')}</p>
        </div>
        <Badge variant="outline" className="shrink-0 text-2xs">
          {t('whatIf.previewBadge')}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Field label={t('whatIf.gpa')}>
          <Input
            aria-label={t('whatIf.gpa')}
            value={gpa}
            inputMode="decimal"
            placeholder="3.85"
            onChange={(event) => setGpa(event.target.value)}
          />
        </Field>
        <Field label={t('whatIf.gpaScale')}>
          <Input
            aria-label={t('whatIf.gpaScale')}
            value={gpaScale}
            inputMode="decimal"
            placeholder="4"
            onChange={(event) => setGpaScale(event.target.value)}
          />
        </Field>
        <Field label={t('whatIf.sat')}>
          <Input
            aria-label={t('whatIf.sat')}
            value={satScore}
            inputMode="numeric"
            placeholder="1500"
            onChange={(event) => setSatScore(event.target.value)}
          />
        </Field>
        <Field label={t('whatIf.act')}>
          <Input
            aria-label={t('whatIf.act')}
            value={actScore}
            inputMode="numeric"
            placeholder="34"
            onChange={(event) => setActScore(event.target.value)}
          />
        </Field>
      </div>

      <div className="mt-2 grid gap-2">
        <Field label={t('whatIf.major')}>
          <Input
            aria-label={t('whatIf.major')}
            value={targetMajor}
            placeholder={t('whatIf.majorPlaceholder')}
            onChange={(event) => setTargetMajor(event.target.value)}
          />
        </Field>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_120px] gap-2">
          <Field label={t('whatIf.round')}>
            <Select
              value={applicationRound}
              onValueChange={(value) =>
                setApplicationRound(value as (typeof ROUND_OPTIONS)[number])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROUND_OPTIONS.map((round) => (
                  <SelectItem key={round} value={round}>
                    {round === 'CURRENT' ? t('whatIf.currentRound') : round}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t('whatIf.grade')}>
            <Input
              aria-label={t('whatIf.grade')}
              value={grade}
              placeholder="12"
              onChange={(event) => setGrade(event.target.value)}
            />
          </Field>
        </div>
      </div>

      <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-[var(--theme-radius-button)] border bg-muted/30 p-2 text-xs">
        <Checkbox
          checked={applyingTestOptional}
          onCheckedChange={(checked) => setApplyingTestOptional(checked === true)}
        />
        <span className="leading-5 text-muted-foreground">{t('whatIf.testOptional')}</span>
      </label>

      <div className="mt-4 flex items-center gap-2">
        <Button type="button" size="sm" onClick={runPreview} disabled={!canRun} className="flex-1">
          {previewMutation.isPending ? t('whatIf.running') : t('whatIf.run')}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={reset}
          aria-label={t('whatIf.reset')}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{t('whatIf.notSaved')}</p>

      {disabledReason ? (
        <p role="status" className="mt-2 text-2xs text-muted-foreground">
          {disabledReason}
        </p>
      ) : null}

      {hasRun ? (
        <div ref={resultsRef} className="mt-4 space-y-2" data-testid="prediction-preview-results">
          <p className="text-overline text-muted-foreground">{t('whatIf.resultsTitle')}</p>
          {previewResults.length > 0 ? (
            <>
              {previewResults.slice(0, 4).map((result) => (
                <PreviewRow key={result.schoolId} result={result} />
              ))}
              {previewResults.length > 4 ? (
                <p className="text-xs text-muted-foreground">
                  {t('whatIf.moreResults', { count: previewResults.length - 4 })}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{t('whatIf.noResults')}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function PreviewRow({ result }: { result: PredictionResult }) {
  const t = useTranslations('prediction');
  const tierConfig = TIER_CONFIG[result.tier] ?? TIER_CONFIG.unavailable;
  const probability =
    result.probabilityLow != null && result.probabilityHigh != null
      ? `${Math.round(result.probabilityLow * 100)}-${Math.round(result.probabilityHigh * 100)}%`
      : result.probability != null
        ? `${Math.round(result.probability * 100)}%`
        : t('tier.unavailable');

  return (
    <div className="rounded-[var(--theme-radius-button)] border bg-muted/20 p-2">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-medium">{result.schoolName}</span>
        <span className={cn('shrink-0 text-xs font-semibold tabular-nums', tierConfig.text)}>
          {probability}
        </span>
      </div>
      <Badge variant="outline" className={cn('mt-1 h-5 px-1.5 text-2xs', tierConfig.badge)}>
        {t(`tier.${result.tier}`)}
      </Badge>
    </div>
  );
}

function toInputValue(value: unknown) {
  if (value == null) return '';
  return String(value);
}

function numberField<K extends keyof PredictionPreviewScenario>(key: K, value: string) {
  if (!value.trim()) return {};
  const parsed = Number(value);
  return Number.isFinite(parsed) ? { [key]: parsed } : {};
}
