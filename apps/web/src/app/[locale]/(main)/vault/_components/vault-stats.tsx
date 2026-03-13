'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import type { VaultStats as VaultStatsType } from './vault-types';

interface VaultStatsProps {
  stats: VaultStatsType;
}

export function VaultStats({ stats }: VaultStatsProps) {
  const t = useTranslations('vault');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8"
    >
      <Card className="bg-card border-border backdrop-blur-sm">
        <CardContent className="p-4 text-center">
          <div className="text-3xl font-bold text-foreground">{stats.totalItems}</div>
          <div className="text-muted-foreground text-sm">{t('stats.total')}</div>
        </CardContent>
      </Card>
      <Card className="bg-card border-border backdrop-blur-sm">
        <CardContent className="p-4 text-center">
          <div className="text-3xl font-bold text-amber-500 dark:text-amber-400">
            {stats.credentialCount}
          </div>
          <div className="text-muted-foreground text-sm">{t('stats.credentials')}</div>
        </CardContent>
      </Card>
      <Card className="bg-card border-border backdrop-blur-sm">
        <CardContent className="p-4 text-center">
          <div className="text-3xl font-bold text-blue-500 dark:text-blue-400">
            {stats.documentCount}
          </div>
          <div className="text-muted-foreground text-sm">{t('stats.documents')}</div>
        </CardContent>
      </Card>
      <Card className="bg-card border-border backdrop-blur-sm">
        <CardContent className="p-4 text-center">
          <div className="text-3xl font-bold text-emerald-500 dark:text-emerald-400">
            {stats.noteCount}
          </div>
          <div className="text-muted-foreground text-sm">{t('stats.notes')}</div>
        </CardContent>
      </Card>
      <Card className="bg-card border-border backdrop-blur-sm">
        <CardContent className="p-4 text-center">
          <div className="text-3xl font-bold text-violet-500 dark:text-violet-400">
            {stats.certificateCount}
          </div>
          <div className="text-muted-foreground text-sm">{t('stats.certificates')}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
