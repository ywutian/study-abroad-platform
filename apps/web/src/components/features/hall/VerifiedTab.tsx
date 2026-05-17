/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getLocalizedName } from '@/lib/i18n/locale-utils';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RankingBadge } from '@/components/ui/ranking-badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Trophy,
  CheckCircle2,
  GraduationCap,
  Medal,
  Crown,
  Star,
  Users,
  Award,
  Building2,
  ChevronRight,
  Filter,
  Calendar,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { API_ROUTES } from '@study-abroad/shared';
import { cn } from '@/lib/utils';
import { useRouter } from '@/lib/i18n/navigation';
import { ChinaAdmitDashboard } from './ChinaAdmitDashboard';

interface VerifiedUser {
  rank: number;
  caseId: string;
  userId: string;
  userName?: string;
  gpaRange?: string;
  satRange?: string;
  actRange?: string;
  toeflRange?: string;
  schoolName: string;
  schoolNameZh?: string;
  schoolRank?: number;
  result: string;
  year: number;
  round?: string;
  major?: string;
  isVerified: boolean;
  verifiedAt?: string;
}

interface VerifiedRankingStats {
  totalVerified: number;
  totalAdmitted: number;
  topSchoolsCount: number;
  ivyCount: number;
}

interface VerifiedRankingResponse {
  users: VerifiedUser[];
  stats: VerifiedRankingStats;
  total: number;
  hasMore: boolean;
}

const RESULT_STYLES: Record<string, { color: string; icon: any }> = {
  ADMITTED: { color: 'bg-emerald-500', icon: CheckCircle2 },
  REJECTED: { color: 'bg-red-500', icon: null },
  WAITLISTED: { color: 'bg-amber-500', icon: null },
  DEFERRED: { color: 'bg-blue-500', icon: null },
};

export function VerifiedTab() {
  const t = useTranslations('verifiedRanking');
  const tc = useTranslations('cases');
  const locale = useLocale();
  const router = useRouter();

  const getResultLabel = (result: string) => {
    const labels: Record<string, string> = {
      ADMITTED: tc('result.admitted'),
      REJECTED: tc('result.rejected'),
      WAITLISTED: tc('result.waitlisted'),
      DEFERRED: tc('result.deferred'),
    };
    return labels[result] || result;
  };

  const FILTERS = [
    { value: 'all', label: t('filters.all') },
    { value: 'admitted', label: t('filters.admitted') },
    { value: 'top20', label: t('filters.top20') },
    { value: 'ivy', label: t('filters.ivy') },
  ];
  const [filter, setFilter] = useState('all');
  const [year, setYear] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data: years } = useQuery<number[]>({
    queryKey: ['verified-ranking-years'],
    queryFn: () => apiClient.get(`${API_ROUTES.HALLS}/verified-ranking/years`),
  });
  const verifiedYears = Array.isArray(years) ? years : [];

  const { data, isLoading, isFetching } = useQuery<VerifiedRankingResponse>({
    queryKey: ['verified-ranking', filter, year, offset],
    queryFn: () =>
      apiClient.get(`${API_ROUTES.HALLS}/verified-ranking`, {
        params: {
          filter,
          ...(year && { year }),
          limit: String(limit),
          offset: String(offset),
        },
      }),
  });

  const handleLoadMore = () => {
    setOffset((prev) => prev + limit);
  };

  const renderRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br bg-warning flex items-center justify-center border-2 border-amber-500/30">
          <Crown className="h-5 w-5 text-white" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-10 h-10 rounded-full bg-slate-400 dark:bg-slate-500 flex items-center justify-center shadow-md">
          <Medal className="h-5 w-5 text-white" />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-10 h-10 rounded-full bg-warning flex items-center justify-center shadow-md">
          <Award className="h-5 w-5 text-white" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground">
        {rank}
      </div>
    );
  };

  return (
    <motion.div
      key="verified"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      {/* Stats */}
      {data?.stats && (
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card className="bg-success/10 border-emerald-200 dark:border-emerald-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    {t('totalVerified')}
                  </p>
                  <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                    {data.stats.totalVerified}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/10 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">{t('totalAdmitted')}</p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                    {data.stats.totalAdmitted}
                  </p>
                </div>
                <GraduationCap className="h-8 w-8 text-blue-500/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/10 border-primary/30 dark:border-purple-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-primary dark:text-purple-400">{t('topSchools')}</p>
                  <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                    {data.stats.topSchoolsCount}
                  </p>
                </div>
                <Star className="h-8 w-8 text-primary/30" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-warning/10 border-amber-200 dark:border-amber-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-600 dark:text-amber-400">{t('ivyPlus')}</p>
                  <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                    {data.stats.ivyCount}
                  </p>
                </div>
                <Crown className="h-8 w-8 text-amber-500/30" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stage 3 — China Admit Dashboard (中国大陆录取数据中心) */}
      <ChinaAdmitDashboard />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t('filtersLabel')}:</span>
            </div>

            <Tabs value={filter} onValueChange={setFilter} className="flex-1">
              <TabsList>
                {FILTERS.map((f) => (
                  <TabsTrigger key={f.value} value={f.value} className="text-xs sm:text-sm">
                    {f.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <Select value={year || 'all'} onValueChange={(v) => setYear(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t('year')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filters.all')}</SelectItem>
                {verifiedYears.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            {t('title')}
          </CardTitle>
          <CardDescription>{t('totalRecords', { count: data?.total || 0 })}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : data?.users && data.users.length > 0 ? (
            <div className="space-y-3">
              {data.users.map((user, index) => {
                const resultStyle = RESULT_STYLES[user.result] || RESULT_STYLES.ADMITTED;
                return (
                  <motion.div
                    key={user.caseId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/cases/${user.caseId}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(`/cases/${user.caseId}`);
                      }
                    }}
                    className={cn(
                      'flex items-center gap-4 p-4 rounded-lg border transition-colors cursor-pointer',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      user.rank <= 3 ? 'bg-warning/5' : 'hover:bg-muted/50'
                    )}
                  >
                    {renderRankBadge(user.rank)}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold truncate">{user.userName}</span>
                        <Badge
                          variant="secondary"
                          className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {t('verified')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {getLocalizedName(user.schoolNameZh, user.schoolName, locale)}
                          <RankingBadge usNewsRank={user.schoolRank} variant="plain" />
                        </span>
                        <span>
                          {user.year} {user.round}
                        </span>
                        {user.major && <span>{user.major}</span>}
                      </div>
                    </div>

                    <div className="hidden md:flex items-center gap-3 text-sm">
                      {user.gpaRange && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">GPA</p>
                          <p className="font-medium">{user.gpaRange}</p>
                        </div>
                      )}
                      {user.satRange && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">SAT</p>
                          <p className="font-medium">{user.satRange}</p>
                        </div>
                      )}
                      {user.toeflRange && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">TOEFL</p>
                          <p className="font-medium">{user.toeflRange}</p>
                        </div>
                      )}
                    </div>

                    <Badge className={cn('text-white', resultStyle.color)}>
                      {getResultLabel(user.result)}
                    </Badge>

                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                );
              })}

              {data.hasMore && (
                <div className="flex justify-center pt-4">
                  <Button variant="outline" onClick={handleLoadMore} disabled={isFetching}>
                    {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {t('loadMore')}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold">{t('noData')}</h3>
              <p className="text-sm text-muted-foreground">{t('adjustFilters')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
