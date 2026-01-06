'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout';
import { ProbabilityRing, SchoolSelector } from '@/components/features';
import { EmptyState } from '@/components/ui/empty-state';
import { Target, TrendingUp, TrendingDown, Minus, Sparkles, Plus, X, GraduationCap } from 'lucide-react';

interface School {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
}

interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  detail: string;
}

interface PredictionResult {
  schoolId: string;
  schoolName: string;
  probability: number;
  factors: PredictionFactor[];
}

export default function PredictionPage() {
  const t = useTranslations();
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [selectedSchools, setSelectedSchools] = useState<School[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);

  const predictMutation = useMutation({
    mutationFn: (schoolIds: string[]) =>
      apiClient.post<{ results: PredictionResult[] }>('/predictions', { schoolIds }),
    onSuccess: (data) => {
      setResults(data?.results || []);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handlePredict = () => {
    if (selectedSchools.length === 0) {
      toast.error('请先选择目标院校');
      return;
    }
    predictMutation.mutate(selectedSchools.map((s) => s.id));
  };

  const removeSchool = (schoolId: string) => {
    setSelectedSchools(selectedSchools.filter((s) => s.id !== schoolId));
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positive':
        return <TrendingUp className="h-3.5 w-3.5" />;
      case 'negative':
        return <TrendingDown className="h-3.5 w-3.5" />;
      default:
        return <Minus className="h-3.5 w-3.5" />;
    }
  };

  const getImpactStyle = (impact: string) => {
    switch (impact) {
      case 'positive':
        return 'bg-success/10 text-success border-success/20';
      case 'negative':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <PageContainer maxWidth="4xl">
      <PageHeader
        title={t('prediction.title')}
        description="基于 AI 分析你的背景，预测各校录取概率"
      />

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{t('prediction.selectSchools')}</CardTitle>
              <CardDescription>选择目标院校，获取个性化录取预测</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Selected schools */}
          {selectedSchools.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                已选择 {selectedSchools.length} 所学校
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedSchools.map((school) => (
                  <Badge
                    key={school.id}
                    variant="secondary"
                    className="gap-1.5 py-1.5 pl-3 pr-1.5"
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    {school.nameZh || school.name}
                    {school.usNewsRank && (
                      <span className="text-muted-foreground">#{school.usNewsRank}</span>
                    )}
                    <button
                      onClick={() => removeSchool(school.id)}
                      className="ml-1 rounded-full p-0.5 hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed p-8 text-center">
              <GraduationCap className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">尚未选择学校</p>
              <p className="text-sm text-muted-foreground">点击下方按钮添加目标院校</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSelectorOpen(true)} className="flex-1">
              <Plus className="mr-2 h-4 w-4" />
              选择学校
            </Button>
            <Button
              onClick={handlePredict}
              disabled={predictMutation.isPending || selectedSchools.length === 0}
              className="flex-1"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {predictMutation.isPending ? t('common.loading') : t('prediction.runPrediction')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">预测结果</h2>
          {results.map((result, index) => (
            <Card
              key={result.schoolId}
              className="animate-initial animate-fade-in-up overflow-hidden"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                  {/* 左侧概率环 */}
                  <div className="flex items-center justify-center border-b bg-muted/30 p-6 sm:border-b-0 sm:border-r sm:p-8">
                    <ProbabilityRing
                      value={Math.round(result.probability * 100)}
                      size="lg"
                      label={result.schoolName}
                    />
                  </div>

                  {/* 右侧因素分析 */}
                  <div className="flex-1 p-6">
                    <h3 className="mb-4 font-semibold">{t('prediction.factors')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.factors.map((factor, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className={`gap-1.5 px-3 py-1.5 ${getImpactStyle(factor.impact)}`}
                        >
                          {getImpactIcon(factor.impact)}
                          <span className="font-medium">{factor.name}:</span>
                          <span>{factor.detail}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {results.length === 0 && !predictMutation.isPending && selectedSchools.length === 0 && (
        <EmptyState
          icon={<Target className="h-12 w-12" />}
          title="开始你的预测之旅"
          description="选择目标院校并运行预测，查看你的录取概率分析"
        />
      )}

      <SchoolSelector
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        selectedSchools={selectedSchools}
        onSelect={setSelectedSchools}
        maxSelection={10}
        title="选择目标院校"
      />
    </PageContainer>
  );
}
