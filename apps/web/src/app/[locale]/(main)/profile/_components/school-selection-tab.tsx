'use client';

import { useTranslations, useLocale } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn, getSchoolName, getSchoolSubName } from '@/lib/utils';
import { Target, Plus, Trash2 } from 'lucide-react';
import type { TargetSchool } from './types';

interface SchoolSelectionTabProps {
  targetSchools: TargetSchool[];
  defaultRound: string;
  onDefaultRoundChange: (round: string) => void;
  onOpenSchoolSelector: () => void;
  onRemoveSchool: (listItemId: string) => void;
}

export function SchoolSelectionTab({
  targetSchools,
  defaultRound,
  onDefaultRoundChange,
  onOpenSchoolSelector,
  onRemoveSchool,
}: SchoolSelectionTabProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-destructive" />
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-destructive" />
            {t('profile.targetSchools')}
          </CardTitle>
          <CardDescription>{t('profile.targetSchoolsDesc')}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={defaultRound} onValueChange={onDefaultRoundChange}>
            <SelectTrigger className="h-9 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['ED', 'ED2', 'EA', 'REA', 'RD', 'ROLLING'].map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={onOpenSchoolSelector} className="gap-2 bg-destructive hover:opacity-90">
            <Plus className="h-4 w-4" />
            {t('profile.actions.addSchool')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {targetSchools.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {targetSchools.map((school, index) => (
              <motion.div
                key={school.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="group rounded-xl border p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive font-bold">
                      {school.usNewsRank
                        ? `#${school.usNewsRank}`
                        : getSchoolName(school, locale).charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{getSchoolName(school, locale)}</p>
                        {school.prediction && (
                          <span
                            className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', {
                              'bg-success/10 text-success': school.prediction.tier === 'safety',
                              'bg-primary/10 text-primary': school.prediction.tier === 'match',
                              'bg-destructive/10 text-destructive':
                                school.prediction.tier === 'reach',
                              'bg-muted text-muted-foreground': !school.prediction.tier,
                            })}
                          >
                            {Math.round(school.prediction.probability * 100)}%
                          </span>
                        )}
                      </div>
                      {getSchoolSubName(school, locale) && (
                        <p className="text-sm text-muted-foreground">
                          {getSchoolSubName(school, locale)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      if (school._listItemId) {
                        onRemoveSchool(school._listItemId);
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-destructive/10">
              <Target className="h-8 w-8 text-destructive/50" />
            </div>
            <p className="font-medium">{t('profile.empty.noTargets')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('profile.empty.noTargetsHint')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
