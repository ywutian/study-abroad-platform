'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { cn } from '@/lib/utils';

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

const RESULT_CONFIG: Record<string, { label: string; labelZh: string; color: string; icon: any }> = {
  ADMITTED: { label: 'Admitted', labelZh: '录取', color: 'bg-emerald-500', icon: CheckCircle2 },
  REJECTED: { label: 'Rejected', labelZh: '拒绝', color: 'bg-red-500', icon: null },
  WAITLISTED: { label: 'Waitlisted', labelZh: '候补', color: 'bg-amber-500', icon: null },
  DEFERRED: { label: 'Deferred', labelZh: '延期', color: 'bg-blue-500', icon: null },
};

const FILTERS = [
  { value: 'all', label: '全部认证' },
  { value: 'admitted', label: '仅录取' },
  { value: 'top20', label: 'Top 20 名校' },
  { value: 'ivy', label: '藤校+' },
];

export default function VerifiedRankingPage() {
  const t = useTranslations('verifiedRanking');
  const [filter, setFilter] = useState('all');
  const [year, setYear] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  // 获取可用年份
  const { data: years } = useQuery<number[]>({
    queryKey: ['verified-ranking-years'],
    queryFn: () => apiClient.get('/hall/verified-ranking/years'),
  });

  // 获取排行榜数据
  const { data, isLoading, isFetching } = useQuery<VerifiedRankingResponse>({
    queryKey: ['verified-ranking', filter, year, offset],
    queryFn: () =>
      apiClient.get('/hall/verified-ranking', {
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
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
          <Crown className="h-5 w-5 text-white" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center shadow-lg shadow-gray-400/30">
          <Medal className="h-5 w-5 text-white" />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-600/30">
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
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="relative mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 via-background to-yellow-500/10 p-6 sm:p-8">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-500/20 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-500 shadow-lg shadow-amber-500/25">
              <Trophy className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('title')}</h1>
              <p className="text-muted-foreground">{t('description')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 统计卡片 */}
      {data?.stats && (
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">{t('totalVerified')}</p>
                    <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                      {data.stats.totalVerified}
                    </p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-emerald-500/30" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 border-blue-200 dark:border-blue-800">
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
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 border-purple-200 dark:border-purple-800">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 dark:text-purple-400">{t('topSchools')}</p>
                    <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                      {data.stats.topSchoolsCount}
                    </p>
                  </div>
                  <Star className="h-8 w-8 text-purple-500/30" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/30 border-amber-200 dark:border-amber-800">
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
          </motion.div>
        </div>
      )}

      {/* 筛选 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{t('filters')}:</span>
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
                <SelectItem value="all">{t('all')}</SelectItem>
                {years?.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 排行榜列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            {t('title')}
          </CardTitle>
          <CardDescription>
            共 {data?.total || 0} 条认证记录
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : data?.users && data.users.length > 0 ? (
            <div className="space-y-3">
              {data.users.map((user, index) => {
                const resultConfig = RESULT_CONFIG[user.result] || RESULT_CONFIG.ADMITTED;

                return (
                  <motion.div
                    key={user.caseId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={cn(
                      'flex items-center gap-4 p-4 rounded-lg border transition-colors',
                      user.rank <= 3 ? 'bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-950/20' : 'hover:bg-muted/50'
                    )}
                  >
                    {/* 排名 */}
                    {renderRankBadge(user.rank)}

                    {/* 用户信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold truncate">{user.userName}</span>
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          已认证
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {user.schoolNameZh || user.schoolName}
                          {user.schoolRank && (
                            <Badge variant="outline" className="ml-1 text-xs">
                              #{user.schoolRank}
                            </Badge>
                          )}
                        </span>
                        <span>{user.year} {user.round}</span>
                        {user.major && <span>{user.major}</span>}
                      </div>
                    </div>

                    {/* 成绩信息 */}
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

                    {/* 结果 */}
                    <Badge className={cn('text-white', resultConfig.color)}>
                      {resultConfig.labelZh}
                    </Badge>

                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                );
              })}

              {/* 加载更多 */}
              {data.hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isFetching}
                  >
                    {isFetching ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    加载更多
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold">暂无数据</h3>
              <p className="text-sm text-muted-foreground">
                尝试调整筛选条件
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

