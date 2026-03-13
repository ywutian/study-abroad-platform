'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Plus, Pencil, Trash2 } from 'lucide-react';
import type { TestScore } from './types';

interface TestScoresTabProps {
  testScores: TestScore[];
  onAddScore: () => void;
  onEditScore: (score: TestScore) => void;
  onDeleteScore: (id: string) => void;
}

export function TestScoresTab({
  testScores,
  onAddScore,
  onEditScore,
  onDeleteScore,
}: TestScoresTabProps) {
  const t = useTranslations();

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-primary" />
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5 text-primary" />
            {t('profile.testScores')}
          </CardTitle>
          <CardDescription>{t('profile.testScoresDesc')}</CardDescription>
        </div>
        <Button onClick={onAddScore} className="gap-2 bg-primary hover:opacity-90">
          <Plus className="h-4 w-4" />
          {t('profile.actions.addScore')}
        </Button>
      </CardHeader>
      <CardContent>
        {testScores.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {testScores.map((score, index) => (
              <motion.div
                key={score.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                className="group relative rounded-xl border bg-primary/5 p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white shadow-md">
                      <span className="text-lg font-bold">{score.type?.slice(0, 2)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-muted-foreground">{score.type}</p>
                      <p className="text-2xl font-bold">{score.score}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEditScore(score)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => onDeleteScore(score.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {score.subScores && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(score.subScores).map(([k, v]) => (
                      <Badge key={k} variant="secondary" className="text-xs">
                        {k}: {String(v)}
                      </Badge>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
              <BarChart className="h-8 w-8 text-primary/50" />
            </div>
            <p className="font-medium">{t('profile.empty.noScores')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('profile.empty.noScoresHint')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
