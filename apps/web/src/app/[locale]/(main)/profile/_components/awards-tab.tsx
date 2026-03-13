'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Trophy, Plus, Pencil, Trash2 } from 'lucide-react';
import { AWARD_LEVEL_KEYS } from './constants';
import type { Award } from './types';

interface AwardsTabProps {
  awards: Award[];
  onAddAward: () => void;
  onEditAward: (award: Award) => void;
  onDeleteAward: (id: string) => void;
}

export function AwardsTab({ awards, onAddAward, onEditAward, onDeleteAward }: AwardsTabProps) {
  const t = useTranslations();

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-warning" />
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-warning" />
            {t('profile.awards')}
          </CardTitle>
          <CardDescription>{t('profile.awardsDesc')}</CardDescription>
        </div>
        <Button onClick={onAddAward} className="gap-2 bg-warning hover:opacity-90">
          <Plus className="h-4 w-4" />
          {t('profile.actions.addAward')}
        </Button>
      </CardHeader>
      <CardContent>
        {awards.length > 0 ? (
          <div className="space-y-3">
            {awards.map((award, index) => (
              <motion.div
                key={award.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group rounded-xl border p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 text-warning">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{award.name}</p>
                        <Badge
                          className={cn(
                            'text-xs',
                            award.level === 'INTERNATIONAL' &&
                              'bg-primary/10 text-primary border-primary/20',
                            award.level === 'NATIONAL' &&
                              'bg-destructive/10 text-destructive border-destructive/20',
                            award.level === 'STATE' &&
                              'bg-primary/10 text-primary border-primary/20'
                          )}
                        >
                          {t(AWARD_LEVEL_KEYS[award.level] || 'profile.awardLevels.school')}
                        </Badge>
                      </div>
                      {award.year && <p className="text-sm text-muted-foreground">{award.year}</p>}
                      {award.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {award.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEditAward(award)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => onDeleteAward(award.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-warning/10">
              <Trophy className="h-8 w-8 text-warning/50" />
            </div>
            <p className="font-medium">{t('profile.empty.noAwards')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('profile.empty.noAwardsHint')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
