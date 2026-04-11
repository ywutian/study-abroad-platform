'use client';

/**
 * 学校推荐卡片组件 - 按 tier 分组展示推荐学校
 */

import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { cn, getSchoolName, getSchoolSubName } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { School } from 'lucide-react';

// 学校推荐数据类型
export interface SchoolRecommendation {
  name: string;
  nameZh: string;
  tier: 'reach' | 'target' | 'safety';
  reason: string;
}

export function SchoolRecommendationCards({ schools }: { schools: SchoolRecommendation[] }) {
  const t = useTranslations('agentChat');
  const locale = useLocale();
  const tierConfig = {
    reach: {
      label: t('tierReach'),
      description: t('tierReachDesc'),
      color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      icon: '🎯',
    },
    target: {
      label: t('tierTarget'),
      description: t('tierTargetDesc'),
      color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      icon: '✅',
    },
    safety: {
      label: t('tierSafety'),
      description: t('tierSafetyDesc'),
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      icon: '🛡️',
    },
  };

  // 按 tier 分组
  const grouped = schools.reduce(
    (acc, school) => {
      const tier = school.tier || 'target';
      if (!acc[tier]) acc[tier] = [];
      acc[tier].push(school);
      return acc;
    },
    {} as Record<string, SchoolRecommendation[]>
  );

  const tierOrder: Array<'reach' | 'target' | 'safety'> = ['reach', 'target', 'safety'];

  return (
    <div className="my-3 space-y-3">
      <p className="text-xs text-muted-foreground">{t('tierStrategyDisclaimer')}</p>
      {tierOrder.map((tier) => {
        const tierSchools = grouped[tier];
        if (!tierSchools?.length) return null;
        const config = tierConfig[tier];

        return (
          <div key={tier} className="space-y-2">
            <div className="flex items-center gap-2">
              <span>{config.icon}</span>
              <Badge variant="secondary" className={cn('text-xs', config.color)}>
                {t('tierSchoolCount', { label: config.label, count: tierSchools.length })}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            <div className="grid gap-2">
              {tierSchools.map((school, idx) => (
                <motion.div
                  key={`${school.name}-${idx}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <School className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{getSchoolName(school, locale)}</span>
                      {getSchoolSubName(school, locale) && (
                        <span className="text-xs text-muted-foreground">
                          {getSchoolSubName(school, locale)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {school.reason}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
