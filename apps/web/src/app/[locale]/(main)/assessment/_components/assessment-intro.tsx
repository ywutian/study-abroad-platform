'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Compass, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HOLLAND_ICONS, HOLLAND_COLORS } from './assessment-constants';

interface AssessmentIntroProps {
  onStartTest: (type: 'mbti' | 'holland') => void;
}

export function AssessmentIntro({ onStartTest }: AssessmentIntroProps) {
  const t = useTranslations('assessment');

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* MBTI Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card
            className="overflow-hidden h-full flex flex-col hover:shadow-lg transition-shadow cursor-pointer group"
            onClick={() => onStartTest('mbti')}
          >
            <div className="h-2 bg-violet-500 dark:bg-violet-600" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500 dark:bg-violet-600 text-white">
                  <ClipboardCheck className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">{t('mbti.title')}</CardTitle>
                  <CardDescription>{t('mbti.description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 space-y-4">
                <p className="text-sm text-muted-foreground">{t('mbti.intro')}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{t('mbti.disclaimer')}</p>
                <div className="flex flex-wrap gap-2">
                  {['INTJ', 'ENFP', 'ISTJ', 'ENTP'].map((type) => (
                    <Badge
                      key={type}
                      variant="secondary"
                      className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300"
                    >
                      {type}
                    </Badge>
                  ))}
                  <Badge variant="secondary">+12</Badge>
                </div>
              </div>
              <Button className="w-full mt-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {t('mbti.start')}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Holland Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card
            className="overflow-hidden h-full flex flex-col hover:shadow-lg transition-shadow cursor-pointer group"
            onClick={() => onStartTest('holland')}
          >
            <div className="h-2 bg-emerald-500 dark:bg-emerald-600" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 dark:bg-emerald-600 text-white">
                  <Compass className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">{t('holland.title')}</CardTitle>
                  <CardDescription>{t('holland.description')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="flex-1 space-y-4">
                <p className="text-sm text-muted-foreground">{t('holland.intro')}</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(HOLLAND_ICONS).map(([type, Icon]) => (
                    <Badge
                      key={type}
                      variant="secondary"
                      className={cn('text-white', HOLLAND_COLORS[type])}
                    >
                      <Icon className="h-3 w-3 mr-1" />
                      {type}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button className="w-full mt-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {t('holland.start')}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
