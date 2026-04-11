'use client';

import { User, Brain } from 'lucide-react';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import type { Profile } from './types';

interface StepProfileGradingProps {
  t: (key: string, values?: Record<string, string | number>) => string;
  profile: Profile | undefined;
  profileLoading: boolean;
  profileScore: number;
  isAnalyzing: boolean;
  onGradeProfile: () => void;
}

export function StepProfileGrading({
  t,
  profile,
  profileLoading,
  profileScore,
  isAnalyzing,
  onGradeProfile,
}: StepProfileGradingProps) {
  const router = useRouter();

  return (
    <Card className="w-full" style={{ backfaceVisibility: 'hidden' }}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          {t('myProfile')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {profileLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : profile ? (
          <div className="space-y-6">
            <div className="rounded-xl border bg-primary/5 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{t('profileReadiness')}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{t('profileReadinessHint')}</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-semibold text-primary">{profileScore}%</div>
                  <div className="text-xs text-muted-foreground">{t('profileScore')}</div>
                </div>
              </div>
              <Progress value={profileScore} className="mt-3" />
            </div>

            {/* Profile Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">GPA</div>
                <div className="font-semibold">{profile.gpa || '-'}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">{t('testScores')}</div>
                <div className="font-semibold">{profile.testScores?.length || 0}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">{t('activities')}</div>
                <div className="font-semibold">{profile.activities?.length || 0}</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="text-xs text-muted-foreground mb-1">{t('awards')}</div>
                <div className="font-semibold">{profile.awards?.length || 0}</div>
              </div>
            </div>

            {/* Grade Profile Button */}
            <Button className="w-full" size="lg" onClick={onGradeProfile} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <>
                  <Brain className="h-4 w-4 mr-2 animate-pulse" />
                  <span className="animate-pulse">{t('aiAnalyzing')}</span>
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  {t('generateAnalysis')}
                </>
              )}
            </Button>

            <Link href="/profile" className="block">
              <Button variant="outline" className="w-full">
                {t('editProfile')}
              </Button>
            </Link>
          </div>
        ) : (
          <EmptyState
            type="first-time"
            title={t('noProfile')}
            description={t('noProfileDesc')}
            action={{
              label: t('createProfile'),
              onClick: () => router.push('/profile'),
            }}
            size="sm"
          />
        )}
      </CardContent>
    </Card>
  );
}
