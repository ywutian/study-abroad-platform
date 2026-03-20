'use client';

/**
 * 工具调用卡片组件 - 显示 AI Agent 工具调用状态
 */

import { useTranslations } from 'next-intl';
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
};

interface ToolCallCardProps {
  tool: ToolCallInfo;
  isUser: boolean;
  index: number;
}

export function ToolCallCard({ tool, isUser, index }: ToolCallCardProps) {
  const t = useTranslations('agentChat');
  const isRunning = tool.status === 'running';
  const isError = tool.status === 'error';

  const formatToolName = (name: string): string => {
    const labels: Record<string, string> = {
      search_schools: t('tools.searchSchools'),
      get_user_profile: t('tools.getProfile'),
      analyze_profile: t('tools.analyzeProfile'),
      search_cases: t('tools.searchCases'),
      get_deadlines: t('tools.getDeadlines'),
      review_essay: t('tools.reviewEssay'),
      query_database: t('tools.queryDatabase'),
      generate_essay_outline: t('tools.generateOutline'),
      recommend_schools: t('tools.recommendSchools'),
      analyze_admission_chance: t('tools.analyzeChance'),
    };
    return labels[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg',
        isUser
          ? 'bg-primary-foreground/10'
          : isError
            ? 'bg-destructive/10 border border-destructive/20'
            : isRunning
              ? 'bg-primary/10 border border-primary/20'
              : 'bg-muted/50 border border-border/50'
      )}
    >
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
    </motion.div>
  );
}
