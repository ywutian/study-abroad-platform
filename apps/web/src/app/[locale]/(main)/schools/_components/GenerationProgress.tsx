'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function GenerationProgress() {
  const t = useTranslations('recommendation');

  return (
    <motion.div
      key="progress"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-lg font-medium">{t('generating')}</p>
          <p className="text-sm text-muted-foreground">{t('generatingDesc')}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
