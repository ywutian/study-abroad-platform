'use client';

import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { RankingBadge } from '@/components/ui/ranking-badge';
import { cn, getSchoolName, getSchoolSubName, formatAcceptanceRate } from '@/lib/utils';
import type { SchoolRanking } from '@/lib/utils/ranking';
import { BarChart3, Play, Medal, ExternalLink, ChevronRight } from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';

interface RankedSchool {
  id: string;
  name: string;
  nameZh: string;
  usNewsRank: number;
  rankings?: SchoolRanking[];
  acceptanceRate: number;
  tuition: number;
  avgSalary: number;
  score: number;
  rank: number;
}

interface RankingResultsProps {
  ranking: RankedSchool[] | undefined;
  isLoading: boolean;
  onCalculate: () => void;
}

export function RankingResults({ ranking, isLoading, onCalculate }: RankingResultsProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  return (
    <div className="min-w-0">
      <Card className="overflow-hidden">
        <div className="h-1.5 bg-primary" />
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Medal className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('ranking.rankingResults')}</CardTitle>
              <CardDescription>{t('ranking.rankingResultsDesc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState variant="table" />
          ) : ranking?.length ? (
            <div className="space-y-2">
              <AnimatePresence>
                {ranking.map((school: RankedSchool, index: number) => (
                  <motion.div
                    key={school.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={cn(
                      'group relative rounded-xl border p-4 transition-all hover:shadow-md cursor-pointer',
                      school.rank <= 3 && 'bg-warning/5'
                    )}
                    onClick={() => router.push(`/schools/${school.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-bold',
                          school.rank === 1 &&
                            'bg-gradient-to-br bg-warning text-white border-2 border-amber-500/30',
                          school.rank === 2 &&
                            'bg-gradient-to-br bg-slate-400 dark:bg-slate-500 text-white border-2 border-slate-400/30 dark:border-slate-500/30',
                          school.rank === 3 && 'bg-warning text-white shadow-md',
                          school.rank > 3 && 'bg-muted text-muted-foreground'
                        )}
                      >
                        {school.rank <= 3 ? (
                          <span className="text-lg">
                            {school.rank === 1 ? '🥇' : school.rank === 2 ? '🥈' : '🥉'}
                          </span>
                        ) : (
                          <span>#{school.rank}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate group-hover:text-primary transition-colors">
                            {getSchoolName(school, locale)}
                          </p>
                          <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground" />
                        </div>
                        {getSchoolSubName(school, locale) && (
                          <p className="text-sm text-muted-foreground truncate">
                            {getSchoolSubName(school, locale)}
                          </p>
                        )}
                      </div>
                      <div className="hidden sm:flex items-center gap-3">
                        <div className="text-center px-3">
                          <p className="text-xs text-muted-foreground">Ranking</p>
                          <RankingBadge rankings={school.rankings} usNewsRank={school.usNewsRank} />
                        </div>
                        <div className="text-center px-3 hidden md:block">
                          <p className="text-xs text-muted-foreground">
                            {t('ranking.tableHeaders.acceptance')}
                          </p>
                          <p className="font-semibold">
                            {formatAcceptanceRate(school.acceptanceRate)}
                          </p>
                        </div>
                        <div className="text-center px-3 hidden lg:block">
                          <p className="text-xs text-muted-foreground">
                            {t('ranking.tableHeaders.tuition')}
                          </p>
                          <p className="font-semibold">
                            {school.tuition ? `$${(school.tuition / 1000).toFixed(0)}k` : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {t('ranking.tableHeaders.score')}
                          </p>
                          <p className="text-xl font-bold text-primary">
                            {school.score?.toFixed(1) ?? '-'}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-lg bg-warning/10">
                <BarChart3 className="h-10 w-10 text-amber-500/50" />
              </div>
              <h3 className="text-lg font-semibold">{t('ranking.empty.title')}</h3>
              <p className="mt-1 text-muted-foreground max-w-sm mx-auto">
                {t('ranking.empty.description')}
              </p>
              <Button onClick={onCalculate} className="mt-6 gap-2" variant="outline">
                <Play className="h-4 w-4" />
                {t('ranking.preview')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
