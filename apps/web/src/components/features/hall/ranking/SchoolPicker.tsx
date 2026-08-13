'use client';

/**
 * SchoolPicker — left column card: open the SchoolSelector, list the chosen
 * schools, and trigger the manual ranking query.
 */

import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RankingBadge } from '@/components/ui/ranking-badge';
import { Target, GraduationCap, TrendingUp, Loader2 } from 'lucide-react';
import { getSchoolName } from '@/lib/utils';
import type { School } from '@/types/hall';

interface SchoolPickerProps {
  selectedSchools: School[];
  isFetching: boolean;
  onOpenSelector: () => void;
  onFetchRanking: () => void;
}

export function SchoolPicker({
  selectedSchools,
  isFetching,
  onOpenSelector,
  onFetchRanking,
}: SchoolPickerProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <Card className="overflow-hidden lg:col-span-1">
      <div className="h-1.5 bg-warning" />
      <CardHeader>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
            <Target className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="">{t('hall.ranking.selectSchools')}</CardTitle>
            <CardDescription>{t('hall.ranking.selectSchoolsDesc')}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" className="w-full h-11 gap-2" onClick={onOpenSelector}>
          <GraduationCap className="h-4 w-4" />
          {selectedSchools.length > 0
            ? t('hall.ranking.selectedCount', { count: selectedSchools.length })
            : t('hall.ranking.selectSchoolsButton')}
        </Button>

        {selectedSchools.length > 0 && (
          <div className="space-y-2">
            {selectedSchools.slice(0, 5).map((school, index) => (
              <motion.div
                key={school.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between gap-2 rounded-lg bg-warning/5 px-3 py-2 text-sm"
              >
                <span className="truncate min-w-0">{getSchoolName(school, locale)}</span>
                <RankingBadge rankings={school.rankings} usNewsRank={school.usNewsRank} />
              </motion.div>
            ))}
            {selectedSchools.length > 5 && (
              <p className="text-center text-xs text-muted-foreground">
                {t('hall.ranking.moreSchools', { count: selectedSchools.length - 5 })}
              </p>
            )}
          </div>
        )}

        <Button
          className="w-full h-11 gap-2 bg-warning hover:bg-warning/90"
          onClick={onFetchRanking}
          disabled={selectedSchools.length === 0 || isFetching}
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <TrendingUp className="h-4 w-4" />
          )}
          {t('hall.ranking.viewRanking')}
        </Button>
      </CardContent>
    </Card>
  );
}
