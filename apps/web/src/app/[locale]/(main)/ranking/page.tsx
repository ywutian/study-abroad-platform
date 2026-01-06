'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout';
import { LoadingState } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { BarChart3, Save, Play, Medal, ExternalLink } from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface RankingWeights {
  usNewsRank: number;
  acceptanceRate: number;
  tuition: number;
  avgSalary: number;
}

interface RankedSchool {
  id: string;
  name: string;
  nameZh: string;
  usNewsRank: number;
  acceptanceRate: number;
  tuition: number;
  avgSalary: number;
  score: number;
  rank: number;
}

export default function RankingPage() {
  const t = useTranslations();
  const router = useRouter();

  const [weights, setWeights] = useState<RankingWeights>({
    usNewsRank: 30,
    acceptanceRate: 20,
    tuition: 25,
    avgSalary: 25,
  });

  const [rankingName, setRankingName] = useState('');

  const { data: ranking, isLoading, refetch } = useQuery({
    queryKey: ['ranking', weights],
    queryFn: () => apiClient.post<RankedSchool[]>('/rankings/calculate', weights),
    enabled: false,
  });

  const saveMutation = useMutation({
    mutationFn: (data: { name: string; isPublic: boolean } & RankingWeights) =>
      apiClient.post('/rankings', data),
    onSuccess: () => {
      toast.success('排名已保存！');
      setRankingName('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleCalculate = () => {
    refetch();
  };

  const handleSave = () => {
    if (!rankingName.trim()) {
      toast.error('请输入排名名称');
      return;
    }
    saveMutation.mutate({
      name: rankingName,
      isPublic: false,
      ...weights,
    });
  };

  const updateWeight = (key: keyof RankingWeights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  };

  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Badge className="bg-yellow-500">🥇</Badge>;
    if (rank === 2) return <Badge className="bg-gray-400">🥈</Badge>;
    if (rank === 3) return <Badge className="bg-amber-600">🥉</Badge>;
    return <span className="text-muted-foreground">#{rank}</span>;
  };

  return (
    <PageContainer>
      <PageHeader
        title={t('ranking.title')}
        description="自定义权重，生成你的个性化院校排名"
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Weights Configuration */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>{t('ranking.weights')}</CardTitle>
                <CardDescription>
                  总权重: <span className={totalWeight === 100 ? 'text-success' : 'text-warning'}>{totalWeight}%</span>
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>{t('ranking.usNewsRank')}</Label>
                <span className="text-sm font-medium text-primary">{weights.usNewsRank}%</span>
              </div>
              <Slider
                value={[weights.usNewsRank]}
                onValueChange={([v]) => updateWeight('usNewsRank', v)}
                max={100}
                step={5}
                className="[&_[role=slider]]:bg-primary"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>{t('ranking.acceptanceRate')}</Label>
                <span className="text-sm font-medium text-primary">{weights.acceptanceRate}%</span>
              </div>
              <Slider
                value={[weights.acceptanceRate]}
                onValueChange={([v]) => updateWeight('acceptanceRate', v)}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">录取率越低 = 分数越高</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>{t('ranking.tuition')}</Label>
                <span className="text-sm font-medium text-primary">{weights.tuition}%</span>
              </div>
              <Slider
                value={[weights.tuition]}
                onValueChange={([v]) => updateWeight('tuition', v)}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground">学费越低 = 分数越高</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>{t('ranking.avgSalary')}</Label>
                <span className="text-sm font-medium text-primary">{weights.avgSalary}%</span>
              </div>
              <Slider
                value={[weights.avgSalary]}
                onValueChange={([v]) => updateWeight('avgSalary', v)}
                max={100}
                step={5}
              />
            </div>

            <Button onClick={handleCalculate} className="w-full" disabled={isLoading}>
              <Play className="mr-2 h-4 w-4" />
              {isLoading ? t('common.loading') : t('ranking.preview')}
            </Button>

            <div className="border-t pt-4 space-y-3">
              <Label>{t('ranking.saveRanking')}</Label>
              <Input
                placeholder="我的自定义排名"
                value={rankingName}
                onChange={(e) => setRankingName(e.target.value)}
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSave}
                disabled={saveMutation.isPending || !ranking?.length}
              >
                <Save className="mr-2 h-4 w-4" />
                {saveMutation.isPending ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Ranking Results */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2 text-primary">
                <Medal className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>排名结果</CardTitle>
                <CardDescription>根据你的权重计算的院校排名</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingState variant="table" />
            ) : ranking?.length ? (
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">排名</TableHead>
                      <TableHead>学校</TableHead>
                      <TableHead className="text-right">US News</TableHead>
                      <TableHead className="text-right hidden sm:table-cell">录取率</TableHead>
                      <TableHead className="text-right hidden md:table-cell">学费</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">薪资</TableHead>
                      <TableHead className="text-right">得分</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.slice(0, 50).map((school: RankedSchool, index: number) => (
                      <TableRow
                        key={school.id}
                        className="animate-initial animate-fade-in"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <TableCell className="font-medium">{getRankBadge(school.rank)}</TableCell>
                        <TableCell>
                          <button
                            onClick={() => router.push(`/schools/${school.id}`)}
                            className="text-left hover:underline group"
                          >
                            <div className="font-medium group-hover:text-primary flex items-center gap-1">
                              {school.name}
                              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            {school.nameZh && <div className="text-xs text-muted-foreground">{school.nameZh}</div>}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">{school.usNewsRank || '-'}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          {school.acceptanceRate ? `${school.acceptanceRate}%` : '-'}
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell">
                          {school.tuition ? `$${school.tuition.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="text-right hidden lg:table-cell">
                          {school.avgSalary ? `$${school.avgSalary.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="font-mono">
                            {school.score.toFixed(1)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            ) : (
              <EmptyState
                icon={<BarChart3 className="h-12 w-12" />}
                title="点击「预览排名」查看结果"
                description="调整左侧权重参数，生成你的个性化院校排名"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
