'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiClient } from '@/lib/api';
import { cn, getSchoolName } from '@/lib/utils';
import { VerificationUploadDialog } from './VerificationUploadDialog';
import { VerificationBadge } from './VerificationBadge';
import {
  Shield,
  BadgeCheck,
  Clock,
  XCircle,
  Upload,
  ChevronRight,
  GraduationCap,
  Calendar,
  AlertTriangle,
  Sparkles,
  Trophy,
} from 'lucide-react';

interface VerificationRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  proofType: string;
  createdAt: string;
  reviewNote?: string;
  case: {
    id: string;
    year: number;
    round: string;
    school: {
      id: string;
      name: string;
      nameZh?: string;
    };
  };
}

interface VerificationStatusCardProps {
  userId: string;
  className?: string;
  compact?: boolean;
}

export function VerificationStatusCard({
  userId,
  className,
  compact = false,
}: VerificationStatusCardProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<{ id: string; schoolName: string } | null>(null);

  const { data: verifications, isLoading } = useQuery<VerificationRequest[]>({
    queryKey: ['myVerifications', userId],
    queryFn: () => apiClient.get('/verification/my'),
    enabled: !!userId,
  });

  const approvedVerification = verifications?.find((v) => v.status === 'APPROVED');
  const pendingVerification = verifications?.find((v) => v.status === 'PENDING');
  const rejectedVerifications = verifications?.filter((v) => v.status === 'REJECTED') || [];

  const hasVerification = !!approvedVerification;
  const hasPending = !!pendingVerification;

  const getStatusConfig = () => {
    if (hasVerification) {
      return {
        status: 'VERIFIED' as const,
        gradient: 'bg-primary',
        icon: BadgeCheck,
        title: t('verification.status.verified'),
        description: t('verification.status.verifiedDesc'),
      };
    }
    if (hasPending) {
      return {
        status: 'PENDING' as const,
        gradient: 'bg-warning',
        icon: Clock,
        title: t('verification.status.pending'),
        description: t('verification.status.pendingDesc'),
      };
    }
    return {
      status: 'NONE' as const,
      gradient: 'bg-primary',
      icon: Shield,
      title: t('verification.status.notVerified'),
      description: t('verification.status.notVerifiedDesc'),
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const handleStartVerification = (caseId?: string, schoolName?: string) => {
    if (caseId && schoolName) {
      setSelectedCase({ id: caseId, schoolName });
    }
    setUploadDialogOpen(true);
  };

  // Compact 模式
  if (compact) {
    return (
      <>
        <Card className={cn('overflow-hidden', className)}>
          <div className={cn('h-1 bg-gradient-to-r', config.gradient)} />
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl',
                    `bg-gradient-to-br ${config.gradient} text-white shadow-lg`
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{config.title}</span>
                    <VerificationBadge status={config.status} showLabel={false} size="sm" />
                  </div>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                </div>
              </div>
              {!hasVerification && !hasPending && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStartVerification()}
                  className="shrink-0"
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  {t('verification.verify')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <VerificationUploadDialog
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          caseId={selectedCase?.id}
          schoolName={selectedCase?.schoolName}
        />
      </>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={className}
      >
        <Card className="overflow-hidden">
          <div className={cn('h-1.5 bg-gradient-to-r', config.gradient)} />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl',
                    `bg-gradient-to-br ${config.gradient} text-white shadow-lg`
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">{config.title}</CardTitle>
                  <CardDescription>{config.description}</CardDescription>
                </div>
              </div>
              <VerificationBadge status={config.status} showLabel={false} size="lg" />
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* 已认证状态 */}
            {hasVerification && approvedVerification && (
              <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                    <GraduationCap className="h-5 w-5 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-blue-600 dark:text-blue-400">
                      {getSchoolName(approvedVerification.case.school, locale)}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {approvedVerification.case.year} {approvedVerification.case.round}
                      </span>
                    </div>
                  </div>
                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                    <BadgeCheck className="h-3 w-3 mr-1" />
                    {t('verification.verified')}
                  </Badge>
                </div>

                {/* 认证权益 */}
                <div className="mt-4 pt-4 border-t border-blue-500/10">
                  <p className="text-xs font-medium text-blue-600 mb-2 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {t('verification.benefits.title')}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3 text-blue-500" />
                      {t('verification.benefits.badge')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Trophy className="h-3 w-3 text-amber-500" />
                      {t('verification.benefits.points')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 审核中状态 */}
            {hasPending && pendingVerification && (
              <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                    <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-amber-600 dark:text-amber-400">
                      {getSchoolName(pendingVerification.case.school, locale)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('verification.pendingReview')}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>{t('verification.estimatedTime')}</span>
                    <span>1-3 {t('common.days')}</span>
                  </div>
                  <Progress value={33} className="h-1.5 bg-amber-500/20" />
                </div>
              </div>
            )}

            {/* 被拒绝的申请 */}
            {rejectedVerifications.length > 0 && (
              <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  <p className="font-medium text-sm">{t('verification.rejected')}</p>
                </div>
                {rejectedVerifications.slice(0, 1).map((v) => (
                  <div key={v.id} className="text-sm text-muted-foreground">
                    <p>{getSchoolName(v.case.school, locale)}</p>
                    {v.reviewNote && (
                      <p className="mt-1 text-xs">
                        {t('verification.reason')}: {v.reviewNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 未认证状态 - 申请入口 */}
            {!hasVerification && !hasPending && (
              <div className="rounded-xl bg-primary/5 border border-violet-500/20 p-4">
                <div className="text-center space-y-3">
                  <div className="flex justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div>
                    <p className="font-medium">{t('verification.startTitle')}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t('verification.startDesc')}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleStartVerification()}
                    className="w-full bg-primary dark:bg-primary hover:opacity-90 gap-2"
                  >
                    <Shield className="h-4 w-4" />
                    {t('verification.startButton')}
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <VerificationUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        caseId={selectedCase?.id}
        schoolName={selectedCase?.schoolName}
      />
    </>
  );
}
