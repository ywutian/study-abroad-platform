'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, FileText, Sparkles, Zap, GraduationCap, BarChart } from 'lucide-react';
import dynamic from 'next/dynamic';
import { VerificationStatusCard, PointsOverview } from '@/components/features';
import type { ProfileData } from './types';

const ProfileAIAnalysis = dynamic(
  () => import('@/components/features').then((m) => ({ default: m.ProfileAIAnalysis })),
  { ssr: false }
);

interface ProfileHeaderProps {
  completeness: number;
  profile: ProfileData | undefined;
  onOpenResumeExport: () => void;
  onSetActiveTab: (tab: string) => void;
}

export function ProfileHeader({
  completeness,
  profile,
  onOpenResumeExport,
  onSetActiveTab,
}: ProfileHeaderProps) {
  const t = useTranslations();

  return (
    <div className="mb-8">
      {/* Completeness bar */}
      <div className="mt-6 rounded-xl border bg-primary/5 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{t('profile.completeness')}</span>
          </div>
          <span className="text-sm font-bold text-primary">{completeness}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${completeness}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {completeness < 100 ? t('profile.completenessHint') : t('profile.completenessComplete')}
        </p>
      </div>

      {/* AI Analysis */}
      {completeness >= 30 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <ProfileAIAnalysis compact />
        </motion.div>
      )}

      {/* Points & Verification cards */}
      {profile && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <PointsOverview compact />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <VerificationStatusCard userId={profile.userId} compact />
          </motion.div>
        </div>
      )}

      {/* Quick Start prompt for new users */}
      {completeness < 30 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          <Card className="overflow-hidden border-primary/30 bg-primary/5">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-lg">
                  <Zap className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-primary">{t('profile.quickStart.title')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('profile.quickStart.description')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSetActiveTab('gpa')}
                    className="gap-1.5"
                  >
                    <GraduationCap className="h-4 w-4" />
                    {t('profile.quickStart.fillGpa')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onSetActiveTab('scores')}
                    className="gap-1.5 bg-primary hover:opacity-90"
                  >
                    <BarChart className="h-4 w-4" />
                    {t('profile.quickStart.fillScore')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
