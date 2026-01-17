'use client';

import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Sparkles,
  GraduationCap,
  Target,
  Shield,
  Rocket,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  History,
  MapPin,
  DollarSign,
  BookOpen,
  ChevronRight,
  Star,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

interface RecommendedSchool {
  schoolId?: string;
  schoolName: string;
  tier: 'reach' | 'match' | 'safety';
  estimatedProbability: number;
  fitScore: number;
  reasons: string[];
  concerns?: string[];
}

interface RecommendationAnalysis {
  strengths: string[];
  weaknesses: string[];
  improvementTips: string[];
}

interface RecommendationResult {
  id: string;
  recommendations: RecommendedSchool[];
  analysis: RecommendationAnalysis;
  summary: string;
  tokenUsed: number;
  createdAt: string;
}

const TIER_STYLES = {
  reach: {
    icon: Rocket,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  match: {
    icon: Target,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
  },
  safety: {
    icon: Shield,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
};

export default function RecommendationPage() {
  const t = useTranslations('recommendation');
  const format = useFormatter();

  const getTierLabel = (tier: string) => {
    const labels: Record<string, string> = {
      reach: t('tiers.reach'),
      match: t('tiers.match'),
      safety: t('tiers.safety'),
    };
    return labels[tier] || tier;
  };

  const BUDGET_OPTIONS = [
    { value: 'low', label: t('budgetOptions.low') },
    { value: 'medium', label: t('budgetOptions.medium') },
    { value: 'high', label: t('budgetOptions.high') },
    { value: 'unlimited', label: t('budgetOptions.unlimited') },
  ];
  const [activeTab, setActiveTab] = useState('generate');
  const [result, setResult] = useState<RecommendationResult | null>(null);

  // Form state
  const [preferredRegions, setPreferredRegions] = useState('');
  const [preferredMajors, setPreferredMajors] = useState('');
  const [budget, setBudget] = useState<string>('');
  const [additionalPreferences, setAdditionalPreferences] = useState('');

  // History query
  const { data: history, refetch: refetchHistory } = useQuery<RecommendationResult[]>({
    queryKey: ['recommendation-history'],
    queryFn: () => apiClient.get('/recommendation/history'),
    enabled: activeTab === 'history',
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<RecommendationResult>('/recommendation', {
        preferredRegions: preferredRegions
          ? preferredRegions.split(',').map((s) => s.trim())
          : undefined,
        preferredMajors: preferredMajors
          ? preferredMajors.split(',').map((s) => s.trim())
          : undefined,
        budget: budget || undefined,
        additionalPreferences: additionalPreferences || undefined,
      });
      return response;
    },
    onSuccess: (data) => {
      setResult(data);
      refetchHistory();
      toast.success(t('success'));
    },
    onError: (error: any) => {
      toast.error(error.message || t('failed'));
    },
  });

  const getProbabilityColor = (prob: number) => {
    if (prob >= 60) return 'text-green-600';
    if (prob >= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const renderSchoolCard = (school: RecommendedSchool, index: number) => {
    const tierStyle = TIER_STYLES[school.tier as keyof typeof TIER_STYLES];
    const TierIcon = tierStyle.icon;

    return (
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
      >
        <Card className={cn('hover:shadow-md transition-shadow', tierStyle.borderColor)}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={cn('p-2 rounded-lg', tierStyle.bgColor)}>
                  <TierIcon className={cn('h-5 w-5', tierStyle.color)} />
                </div>
                <div>
                  <CardTitle className="text-base">{school.schoolName}</CardTitle>
                  <Badge
                    variant="outline"
                    className={cn('mt-1', tierStyle.color, tierStyle.borderColor)}
                  >
                    {getTierLabel(school.tier)}
                  </Badge>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={cn(
                    'text-2xl font-bold',
                    getProbabilityColor(school.estimatedProbability)
                  )}
                >
                  {school.estimatedProbability}%
                </p>
                <p className="text-xs text-muted-foreground">{t('probability')}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Fit Score */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('fitScore')}</span>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                <span className="font-medium">{school.fitScore}/100</span>
              </div>
            </div>

            {/* Reasons */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{t('reasons')}</p>
              <ul className="space-y-1">
                {school.reasons.slice(0, 2).map((reason, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>

            {/* Concerns */}
            {school.concerns && school.concerns.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-amber-600">
                  {t('concerns')}: {school.concerns[0]}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 rounded-xl bg-primary/10">
          <GraduationCap className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-title">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="generate" className="gap-2">
            <Sparkles className="h-4 w-4" />
            {t('generate')}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            {t('history')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          {!result ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('preferences')}</CardTitle>
                  <CardDescription>{t('preferencesDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {t('regions')}
                    </Label>
                    <Input
                      placeholder={t('regionsPlaceholder')}
                      value={preferredRegions}
                      onChange={(e) => setPreferredRegions(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      {t('majors')}
                    </Label>
                    <Input
                      placeholder={t('majorsPlaceholder')}
                      value={preferredMajors}
                      onChange={(e) => setPreferredMajors(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      {t('budget')}
                    </Label>
                    <Select value={budget} onValueChange={setBudget}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('budgetPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {BUDGET_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('additional')}</Label>
                    <Textarea
                      placeholder={t('additionalPlaceholder')}
                      value={additionalPreferences}
                      onChange={(e) => setAdditionalPreferences(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="pt-4">
                    <Button
                      onClick={() => generateMutation.mutate()}
                      disabled={generateMutation.isPending}
                      className="w-full"
                      size="lg"
                    >
                      {generateMutation.isPending ? (
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-5 w-5" />
                      )}
                      {t('generateBtn')}
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      {t('cost', { points: 25 })}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Info Card */}
              <Card className="bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-lg">{t('howItWorks')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 h-fit">
                      <Target className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{t('step1Title')}</p>
                      <p className="text-sm text-muted-foreground">{t('step1Desc')}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 h-fit">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{t('step2Title')}</p>
                      <p className="text-sm text-muted-foreground">{t('step2Desc')}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 h-fit">
                      <GraduationCap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{t('step3Title')}</p>
                      <p className="text-sm text-muted-foreground">{t('step3Desc')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Action Bar */}
              <div className="flex items-center justify-between">
                <h2 className="text-body-lg font-semibold">{t('result')}</h2>
                <Button variant="outline" onClick={() => setResult(null)}>
                  {t('newRecommendation')}
                </Button>
              </div>

              {/* Summary */}
              <Card className="bg-primary/5">
                <CardContent className="pt-6">
                  <p className="text-sm leading-relaxed">{result.summary}</p>
                </CardContent>
              </Card>

              {/* Schools by Tier */}
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Reach */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Rocket className="h-5 w-5 text-red-600" />
                    <h3 className="font-semibold">{t('reach')}</h3>
                    <Badge variant="outline" className="text-red-600 border-red-200">
                      {result.recommendations.filter((r) => r.tier === 'reach').length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {result.recommendations
                      .filter((r) => r.tier === 'reach')
                      .map((school, i) => renderSchoolCard(school, i))}
                  </div>
                </div>

                {/* Match */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-yellow-600" />
                    <h3 className="font-semibold">{t('match')}</h3>
                    <Badge variant="outline" className="text-yellow-600 border-yellow-200">
                      {result.recommendations.filter((r) => r.tier === 'match').length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {result.recommendations
                      .filter((r) => r.tier === 'match')
                      .map((school, i) => renderSchoolCard(school, i))}
                  </div>
                </div>

                {/* Safety */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold">{t('safety')}</h3>
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      {result.recommendations.filter((r) => r.tier === 'safety').length}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {result.recommendations
                      .filter((r) => r.tier === 'safety')
                      .map((school, i) => renderSchoolCard(school, i))}
                  </div>
                </div>
              </div>

              {/* Analysis */}
              <div className="grid gap-6 md:grid-cols-3">
                {/* Strengths */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-green-600">
                      <TrendingUp className="h-5 w-5" />
                      {t('strengths')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.analysis.strengths.map((s, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-green-500 mt-1">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Weaknesses */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-red-600">
                      <TrendingDown className="h-5 w-5" />
                      {t('weaknesses')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.analysis.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-red-500 mt-1">•</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Tips */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-primary">
                      <Lightbulb className="h-5 w-5" />
                      {t('tips')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.analysis.improvementTips.map((tip, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <Badge variant="outline" className="shrink-0 h-5 w-5 p-0 justify-center">
                            {i + 1}
                          </Badge>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {history && history.length > 0 ? (
            <div className="space-y-4">
              {history.map((item) => (
                <Card
                  key={item.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setResult(item);
                    setActiveTab('generate');
                  }}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="text-red-600 border-red-200">
                          {t('reach')}:{' '}
                          {item.recommendations.filter((r) => r.tier === 'reach').length}
                        </Badge>
                        <Badge variant="outline" className="text-yellow-600 border-yellow-200">
                          {t('match')}:{' '}
                          {item.recommendations.filter((r) => r.tier === 'match').length}
                        </Badge>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          {t('safety')}:{' '}
                          {item.recommendations.filter((r) => r.tier === 'safety').length}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format.dateTime(new Date(item.createdAt), 'medium')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.summary}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">{t('noHistory')}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
