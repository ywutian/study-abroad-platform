'use client';

/**
 * 工具调用卡片组件 - 显示 AI Agent 工具调用状态
 */

import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Wrench,
  CheckCircle2,
  User,
  Search,
  FileText,
  BarChart3,
  School,
  Calendar,
  AlertCircle,
  Database,
  Gauge,
} from 'lucide-react';
import { ToolCallInfo } from './types';
import { transitions } from '@/lib/motion';

// 工具图标映射
export const TOOL_ICONS: Record<string, React.ReactNode> = {
  search_schools: <School className="h-3 w-3" />,
  get_user_profile: <User className="h-3 w-3" />,
  analyze_profile: <BarChart3 className="h-3 w-3" />,
  search_cases: <Search className="h-3 w-3" />,
  get_deadlines: <Calendar className="h-3 w-3" />,
  review_essay: <FileText className="h-3 w-3" />,
  query_database: <Database className="h-3 w-3" />,
  analyze_admission_chance: <Gauge className="h-3 w-3" />,
  get_prediction_history: <BarChart3 className="h-3 w-3" />,
  get_prediction_dashboard: <BarChart3 className="h-3 w-3" />,
  get_school_list_predictions: <School className="h-3 w-3" />,
  get_prediction_trace_summary: <Search className="h-3 w-3" />,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function unwrapToolResult(result: unknown): unknown {
  if (isRecord(result) && 'result' in result) {
    return result.result;
  }
  return result;
}

function getSchoolName(school: unknown, locale: string) {
  if (typeof school === 'string') return school;
  if (!isRecord(school)) return undefined;
  if (locale === 'zh' && typeof school.nameZh === 'string' && school.nameZh.trim()) {
    return school.nameZh;
  }
  if (typeof school.name === 'string' && school.name.trim()) {
    return school.name;
  }
  return typeof school.nameZh === 'string' ? school.nameZh : undefined;
}

function getNumericValue(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function formatProbability(probability: unknown) {
  const numeric = getNumericValue(probability);
  if (numeric == null) return undefined;
  return `${Math.round(numeric * 100)}%`;
}

function formatDate(value: unknown, locale: string) {
  if (typeof value !== 'string' && !(value instanceof Date)) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatMachineLabel(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return value.replace(/[_-]+/g, ' ').trim();
}

interface ToolCallCardProps {
  tool: ToolCallInfo;
  isUser: boolean;
  index: number;
}

export function ToolCallCard({ tool, isUser, index }: ToolCallCardProps) {
  const t = useTranslations('agentChat');
  const predictionT = useTranslations('prediction');
  const locale = useLocale();
  const isRunning = tool.status === 'running';
  const isError = tool.status === 'error';
  const payload = unwrapToolResult(tool.result);

  const formatTierLabel = (tier: unknown) => {
    if (tier === 'reach' || tier === 'match' || tier === 'safety') {
      return predictionT(`tier.${tier}`);
    }
    return formatMachineLabel(tier);
  };

  const formatToolName = (name: string): string => {
    const labelKeys: Record<string, string> = {
      search_schools: 'tools.searchSchools',
      get_user_profile: 'tools.getProfile',
      analyze_profile: 'tools.analyzeProfile',
      search_cases: 'tools.searchCases',
      get_deadlines: 'tools.getDeadlines',
      review_essay: 'tools.reviewEssay',
      query_database: 'tools.queryDatabase',
      generate_essay_outline: 'tools.generateOutline',
      recommend_schools: 'tools.recommendSchools',
      analyze_admission_chance: 'tools.analyzeChance',
      get_prediction_history: 'tools.predictionHistory',
      get_prediction_dashboard: 'tools.predictionDashboard',
      get_school_list_predictions: 'tools.schoolListPredictions',
      get_prediction_trace_summary: 'tools.predictionTrace',
    };
    const key = labelKeys[name];
    return key ? t(key as never) : name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const renderPredictionPreview = () => {
    if (isRunning || isError || payload == null) return null;

    const renderMetaRow = (label: string, value?: string) => {
      if (!value) return null;
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{value}</span>
        </div>
      );
    };

    if (tool.name === 'analyze_admission_chance' && isRecord(payload)) {
      const schoolLabel = getSchoolName(payload.school, locale);
      const probability =
        (typeof payload.percentage === 'string' && payload.percentage) ||
        formatProbability(payload.probability);
      const confidence = formatMachineLabel(payload.confidence);
      const explanation =
        typeof payload.confidenceReason === 'string' ? payload.confidenceReason : undefined;

      return (
        <div className="mt-2 rounded-md bg-background/60 px-2.5 py-2 text-2xs space-y-1.5">
          {schoolLabel ? <div className="font-medium truncate">{schoolLabel}</div> : null}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {renderMetaRow(t('toolPreview.probability'), probability)}
            {renderMetaRow(t('toolPreview.tier'), formatTierLabel(payload.tier))}
            {renderMetaRow(t('toolPreview.confidence'), confidence)}
          </div>
          {explanation ? (
            <p className="text-muted-foreground leading-relaxed">{explanation}</p>
          ) : null}
        </div>
      );
    }

    if (tool.name === 'get_prediction_history' && isRecord(payload)) {
      const schoolLabel = getSchoolName(payload.school, locale);
      const current = isRecord(payload.current) ? payload.current : null;
      const history = Array.isArray(payload.history) ? payload.history : [];
      const probability = current ? formatProbability(current.probability) : undefined;
      const tierKey = current && typeof current.tier === 'string' ? current.tier : undefined;
      const updated = current ? formatDate(current.updatedAt, locale) : undefined;

      return (
        <div className="mt-2 rounded-md bg-background/60 px-2.5 py-2 text-2xs space-y-1.5">
          {schoolLabel ? <div className="font-medium truncate">{schoolLabel}</div> : null}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {renderMetaRow(t('toolPreview.probability'), probability)}
            {renderMetaRow(t('toolPreview.tier'), formatTierLabel(tierKey))}
            {renderMetaRow(t('toolPreview.historyPoints'), String(history.length))}
            {renderMetaRow(t('toolPreview.updated'), updated)}
          </div>
        </div>
      );
    }

    if (tool.name === 'get_prediction_dashboard' && isRecord(payload)) {
      const predictions = Array.isArray(payload.predictions) ? payload.predictions : [];
      const previewItems = predictions.slice(0, 3);

      return (
        <div className="mt-2 rounded-md bg-background/60 px-2.5 py-2 text-2xs space-y-1.5">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {renderMetaRow(
              t('toolPreview.schools'),
              typeof payload.totalSchools === 'number' ? String(payload.totalSchools) : undefined
            )}
            {renderMetaRow(
              t('toolPreview.avgProbability'),
              typeof payload.avgProbability === 'number' ? `${payload.avgProbability}%` : undefined
            )}
          </div>
          {previewItems.length > 0 ? (
            <div className="space-y-1">
              {previewItems.map((item, idx) => {
                if (!isRecord(item)) return null;
                const label = getSchoolName(item.school, locale) ?? t('toolPreview.notAvailable');
                const probability = formatProbability(item.probability);
                return (
                  <div key={`${label}-${idx}`} className="flex items-center justify-between gap-2">
                    <span className="truncate">{label}</span>
                    <span className="font-medium shrink-0">{probability ?? '—'}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    }

    if (tool.name === 'get_school_list_predictions' && Array.isArray(payload)) {
      const predictedItems = payload.filter((item) => isRecord(item) && isRecord(item.prediction));
      const previewItems = predictedItems.slice(0, 3);

      return (
        <div className="mt-2 rounded-md bg-background/60 px-2.5 py-2 text-2xs space-y-1.5">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {renderMetaRow(t('toolPreview.schools'), String(payload.length))}
            {renderMetaRow(t('toolPreview.predicted'), String(predictedItems.length))}
          </div>
          {previewItems.length > 0 ? (
            <div className="space-y-1">
              {previewItems.map((item, idx) => {
                const schoolLabel = isRecord(item)
                  ? (getSchoolName(item.school, locale) ?? t('toolPreview.notAvailable'))
                  : t('toolPreview.notAvailable');
                const prediction =
                  isRecord(item) && isRecord(item.prediction) ? item.prediction : null;
                return (
                  <div
                    key={`${schoolLabel}-${idx}`}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{schoolLabel}</span>
                    <span className="font-medium shrink-0">
                      {prediction ? (formatProbability(prediction.probability) ?? '—') : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      );
    }

    if (tool.name === 'get_prediction_trace_summary' && isRecord(payload)) {
      const schoolLabel = getSchoolName(payload.school, locale);
      const trace = isRecord(payload.trace) ? payload.trace : null;
      if (!trace) {
        return (
          <div className="mt-2 rounded-md bg-background/60 px-2.5 py-2 text-2xs text-muted-foreground">
            {t('toolPreview.noPublicTrace')}
          </div>
        );
      }

      const sourceCount = Array.isArray(trace.sourceSummary) ? trace.sourceSummary.length : 0;
      const uncertaintyCount = Array.isArray(trace.uncertaintyReasons)
        ? trace.uncertaintyReasons.length
        : 0;
      const explanation =
        typeof trace.confidenceReason === 'string' ? trace.confidenceReason : undefined;

      return (
        <div className="mt-2 rounded-md bg-background/60 px-2.5 py-2 text-2xs space-y-1.5">
          {schoolLabel ? <div className="font-medium truncate">{schoolLabel}</div> : null}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {renderMetaRow(t('toolPreview.round'), formatMachineLabel(trace.roundContext))}
            {renderMetaRow(t('toolPreview.sources'), String(sourceCount))}
            {renderMetaRow(t('toolPreview.uncertainty'), String(uncertaintyCount))}
            {renderMetaRow(t('toolPreview.updated'), formatDate(trace.updatedAt, locale))}
          </div>
          {explanation ? (
            <p className="text-muted-foreground leading-relaxed">{explanation}</p>
          ) : null}
        </div>
      );
    }

    return null;
  };

  const preview = renderPredictionPreview();

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'text-xs px-2.5 py-1.5 rounded-lg',
        isUser
          ? 'bg-primary-foreground/10'
          : isError
            ? 'bg-destructive/10 border border-destructive/20'
            : isRunning
              ? 'bg-primary/10 border border-primary/20'
              : 'bg-muted/50 border border-border/50'
      )}
    >
      <div className="flex items-center gap-2">
        {/* Status Icon */}
        {isRunning ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="h-3 w-3 text-primary" />
          </motion.div>
        ) : isError ? (
          <AlertCircle className="h-3 w-3 text-destructive" />
        ) : (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={transitions.springSnappy}
          >
            <CheckCircle2 className="h-3 w-3 text-success" />
          </motion.div>
        )}

        {/* Tool Icon */}
        {TOOL_ICONS[tool.name] || <Wrench className="h-3 w-3" />}

        {/* Tool Name */}
        <span className={cn('font-medium', isRunning && 'text-primary')}>
          {formatToolName(tool.name)}
        </span>

        {/* Running Animation */}
        {isRunning && (
          <motion.div className="flex gap-0.5 ml-auto">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="w-1 h-1 rounded-full bg-primary"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </motion.div>
        )}
      </div>
      {preview}
    </motion.div>
  );
}
