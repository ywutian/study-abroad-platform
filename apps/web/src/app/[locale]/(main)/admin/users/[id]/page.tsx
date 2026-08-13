'use client';

import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout';
import { Link } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { adminRoutes, adminAiAgentRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import {
  User,
  ArrowLeft,
  Mail,
  Shield,
  Calendar,
  Ban,
  Zap,
  ScrollText,
  Loader2,
} from 'lucide-react';

interface UserDetail {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  emailVerified: boolean;
  isBanned: boolean;
  bannedUntil: string | null;
  banReason: string | null;
  createdAt: string;
  locale: string | null;
  _count: {
    admissionCases: number;
    reviewsGiven: number;
  };
}

interface UsageStats {
  today: { tokens: number; cost: number; calls: number };
  month: { tokens: number; cost: number; calls: number };
  quota: { daily: number; monthly: number };
  remaining: { daily: number; monthly: number };
}

interface RateLimitInfo {
  isLimited: boolean;
  remaining: number;
  resetAt: string | null;
}

export default function AdminUserDetailPage() {
  const t = useTranslations('admin');
  const params = useParams();
  const userId = params.id as string;
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['adminUser', userId],
    queryFn: () => apiClient.get<UserDetail>(adminRoutes.userById(userId)),
    enabled: !!userId,
  });

  const { data: usage } = useQuery({
    queryKey: ['adminUserUsage', userId],
    queryFn: () => apiClient.get<UsageStats>(adminAiAgentRoutes.userUsage(userId)),
    enabled: !!userId,
  });

  const { data: rateLimit } = useQuery({
    queryKey: ['adminUserRateLimit', userId],
    queryFn: () => apiClient.get<RateLimitInfo>(adminAiAgentRoutes.userRateLimit(userId)),
    enabled: !!userId,
  });

  const resetRateLimitMutation = useMutation({
    mutationFn: () => apiClient.delete(adminAiAgentRoutes.userRateLimit(userId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUserRateLimit', userId] });
      toast.success(t('userDetail.rateLimitReset'));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20 text-muted-foreground">{t('userDetail.notFound')}</div>
    );
  }

  const counts = user._count ?? { admissionCases: 0, reviewsGiven: 0 };
  // Coerce per-field (not just the top-level object): the API may return a
  // partial today/month/remaining (e.g. a user with no AI usage), and a missing
  // sub-field would otherwise crash `.toLocaleString()` / `.toFixed()`.
  const todayUsage = {
    tokens: usage?.today?.tokens ?? 0,
    cost: usage?.today?.cost ?? 0,
    calls: usage?.today?.calls ?? 0,
  };
  const monthUsage = {
    tokens: usage?.month?.tokens ?? 0,
    cost: usage?.month?.cost ?? 0,
    calls: usage?.month?.calls ?? 0,
  };
  const remainingUsage = {
    daily: usage?.remaining?.daily ?? 0,
    monthly: usage?.remaining?.monthly ?? 0,
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('userDetail.back')}
          </Link>
        </Button>
      </div>

      <PageHeader
        title={user.displayName || user.email}
        description={user.email}
        icon={User}
        color="blue"
      />

      <div className="mt-6 space-y-6">
        {/* Basic Info */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                {t('userDetail.role')}
              </div>
              <div className="mt-1">
                <Badge
                  variant={
                    user.role === 'ADMIN'
                      ? 'destructive'
                      : user.role === 'VERIFIED'
                        ? 'success'
                        : 'secondary'
                  }
                >
                  {user.role}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                {t('userDetail.emailVerified')}
              </div>
              <div className="mt-1">
                <Badge variant={user.emailVerified ? 'success' : 'warning'}>
                  {user.emailVerified ? t('userDetail.verified') : t('userDetail.unverified')}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Ban className="h-4 w-4" />
                {t('userDetail.banStatus')}
              </div>
              <div className="mt-1">
                {user.isBanned ? (
                  <div>
                    <Badge variant="destructive">{t('userDetail.banned')}</Badge>
                    {user.banReason && (
                      <p className="text-xs text-muted-foreground mt-1">{user.banReason}</p>
                    )}
                  </div>
                ) : (
                  <Badge variant="success">{t('userDetail.active')}</Badge>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {t('userDetail.joined')}
              </div>
              <p className="text-sm font-medium mt-1">
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* AI Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-body">
                <Zap className="h-5 w-5" />
                {t('userDetail.aiUsage')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {usage ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{t('userDetail.todayTokens')}</p>
                      <p className="text-lg font-bold">{todayUsage.tokens.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('userDetail.remaining')}: {remainingUsage.daily.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('userDetail.monthTokens')}</p>
                      <p className="text-lg font-bold">{monthUsage.tokens.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('userDetail.remaining')}: {remainingUsage.monthly.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">{t('userDetail.todayCost')}</p>
                      <p className="text-sm font-medium">${todayUsage.cost.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">{t('userDetail.monthCost')}</p>
                      <p className="text-sm font-medium">${monthUsage.cost.toFixed(4)}</p>
                    </div>
                  </div>
                  {rateLimit && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">{t('userDetail.rateLimit')}</p>
                        <p className="text-sm">
                          {rateLimit.isLimited
                            ? t('userDetail.rateLimited')
                            : t('userDetail.notLimited')}
                        </p>
                      </div>
                      {rateLimit.isLimited && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resetRateLimitMutation.mutate()}
                          disabled={resetRateLimitMutation.isPending}
                        >
                          {t('userDetail.resetRateLimit')}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('userDetail.loadingUsage')}</p>
              )}
            </CardContent>
          </Card>

          {/* Activity Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-body">
                <ScrollText className="h-5 w-5" />
                {t('userDetail.activity')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm">{t('userDetail.cases')}</span>
                  <Badge variant="secondary">{counts.admissionCases}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm">{t('userDetail.reviews')}</span>
                  <Badge variant="secondary">{counts.reviewsGiven}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm">{t('userDetail.locale')}</span>
                  <Badge variant="outline">{user.locale || '-'}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
