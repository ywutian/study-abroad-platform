'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  BookOpen,
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
  Gift,
  ShieldCheck,
} from 'lucide-react';

interface PointRule {
  action: string;
  points: number;
  description: string;
  type: 'earn' | 'spend';
}

interface PointRulesResponse {
  earn: PointRule[];
  spend: PointRule[];
}

// 动作图标映射
const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  SUBMIT_CASE: FileText,
  CASE_VERIFIED: ShieldCheck,
  CASE_HELPFUL: Award,
  COMPLETE_PROFILE: UserPlus,
  REFER_USER: Gift,
  VERIFICATION_APPROVED: CheckCircle,
  VIEW_CASE_DETAIL: Eye,
  AI_ANALYSIS: Brain,
  MESSAGE_VERIFIED: MessageSquare,
  ESSAY_POLISH: Sparkles,
  ESSAY_REVIEW: FileText,
};

interface PointsRulesCardProps {
  className?: string;
}

export function PointsRulesCard({ className }: PointsRulesCardProps) {
  const t = useTranslations('points.rules');
  const { data: rules, isLoading } = useQuery({
    queryKey: ['points-rules'],
    queryFn: () => apiClient.get<PointRulesResponse>('/users/me/points/rules'),
  });

  if (isLoading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="p-6">
          <div className="h-64 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="h-1 bg-primary" />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="earn" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="earn" className="gap-1.5">
              <TrendingUp className="h-4 w-4" />
              {t('earn')}
            </TabsTrigger>
            <TabsTrigger value="spend" className="gap-1.5">
              <TrendingDown className="h-4 w-4" />
              {t('spend')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="earn" className="mt-0">
            <div className="space-y-2">
              {rules?.earn.map((rule, index) => {
                const Icon = ACTION_ICONS[rule.action] || Gift;
                return (
                  <motion.div
                    key={rule.action}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
                      <Icon className="h-4 w-4 text-emerald-500" />
                    </div>
                    <span className="flex-1 text-sm">{rule.description}</span>
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 font-mono font-bold">
                      +{rule.points}
                    </Badge>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="spend" className="mt-0">
            <div className="space-y-2">
              {rules?.spend.map((rule, index) => {
                const Icon = ACTION_ICONS[rule.action] || Eye;
                return (
                  <motion.div
                    key={rule.action}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 hover:bg-red-500/10 transition-colors"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10">
                      <Icon className="h-4 w-4 text-red-500" />
                    </div>
                    <span className="flex-1 text-sm">{rule.description}</span>
                    <Badge className="bg-red-500/10 text-red-600 border-red-200 font-mono font-bold">
                      {rule.points}
                    </Badge>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* 提示信息 */}
        <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs text-amber-700">{t('tip')}</p>
        </div>
      </CardContent>
    </Card>
  );
}
