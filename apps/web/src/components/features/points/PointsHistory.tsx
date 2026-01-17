'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import {
  History,
  TrendingUp,
  TrendingDown,
  FileText,
  CheckCircle,
  Eye,
  Brain,
  MessageSquare,
  UserPlus,
  Award,
  Sparkles,
} from 'lucide-react';

interface PointHistoryItem {
  id: string;
  action: string;
  points: number;
  description: string;
  type: 'earn' | 'spend';
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// 动作图标映射
const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  SUBMIT_CASE: FileText,
  CASE_VERIFIED: CheckCircle,
  CASE_HELPFUL: Award,
  COMPLETE_PROFILE: UserPlus,
  REFER_USER: UserPlus,
  VERIFICATION_APPROVED: CheckCircle,
  VIEW_CASE_DETAIL: Eye,
  AI_ANALYSIS: Brain,
  MESSAGE_VERIFIED: MessageSquare,
  ESSAY_POLISH: Sparkles,
  ESSAY_REVIEW: FileText,
};

interface PointsHistoryProps {
  limit?: number;
  className?: string;
}

export function PointsHistory({ limit = 20, className }: PointsHistoryProps) {
  const t = useTranslations('points.history');
  const locale = useLocale();
  const dateLocale = locale === 'zh' ? zhCN : enUS;
  const { data: history, isLoading } = useQuery({
    queryKey: ['points-history', limit],
    queryFn: () => apiClient.get<PointHistoryItem[]>(`/users/me/points/history?limit=${limit}`),
  });

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 bg-muted rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-20 bg-muted rounded" />
                </div>
                <div className="h-5 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="h-1 bg-primary" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-blue-500" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {history && history.length > 0 ? (
            <div className="divide-y">
              <AnimatePresence>
                {history.map((item, index) => {
                  const Icon = ACTION_ICONS[item.action] || History;
                  const isEarn = item.type === 'earn';

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full',
                          isEarn ? 'bg-emerald-500/10' : 'bg-red-500/10'
                        )}
                      >
                        <Icon
                          className={cn('h-5 w-5', isEarn ? 'text-emerald-500' : 'text-red-500')}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.createdAt), {
                            addSuffix: true,
                            locale: dateLocale,
                          })}
                        </p>
                      </div>

                      <Badge
                        variant="outline"
                        className={cn(
                          'font-mono font-bold',
                          isEarn
                            ? 'text-emerald-600 border-emerald-200 bg-emerald-50'
                            : 'text-red-600 border-red-200 bg-red-50'
                        )}
                      >
                        {isEarn ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {isEarn ? '+' : ''}
                        {item.points}
                      </Badge>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted mb-4">
                <History className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium text-center">{t('noRecords')}</p>
              <p className="text-sm text-muted-foreground text-center mt-1">{t('noRecordsHint')}</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
