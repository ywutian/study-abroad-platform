'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  User,
  Sparkles,
  Trash2,
  Plus,
  Target,
  Shield,
  Zap,
  TrendingUp,
  Calendar,
  Download,
  RotateCcw,
  BookOpen,
  Award,
  Activity,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  Brain,
} from 'lucide-react';

import ReactMarkdown from 'react-markdown';
import { PageContainer } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api/client';
import { cn, getSchoolName } from '@/lib/utils';
import { toast } from 'sonner';

// AI Agent 类型定义
enum AgentType {
  ORCHESTRATOR = 'orchestrator',
  ESSAY = 'essay',
  SCHOOL = 'school',
  PROFILE = 'profile',
  TIMELINE = 'timeline',
}

interface AgentResponse {
  message: string;
  agentType: AgentType;
  toolsUsed?: string[];
  suggestions?: string[];
  data?: {
    schools?: any[];
    analysis?: any;
    [key: string]: any;
  };
}

interface SchoolListItem {
  id: string;
  schoolId: string;
  tier: 'SAFETY' | 'TARGET' | 'REACH';
  school: {
    id: string;
    name: string;
    nameZh?: string;
    usNewsRank?: number;
    acceptanceRate?: number;
  };
  isAIRecommended: boolean;
}

interface Profile {
  id: string;
  realName?: string;
  gpa?: number;
  grade?: string;
  testScores: Array<{ type: string; score: number }>;
  activities: Array<{ id: string; name: string }>;
  awards: Array<{ id: string; name: string }>;
}

interface AIAnalysis {
  overallScore: number;
  admissionPrediction: string;
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  recommendedActivities: string[];
  timeline: Array<{ date: string; task: string }>;
  projectedImprovement: number;
}

// AI Agent API 调用函数 (增加超时时间到 60 秒)
async function callAIAgent(
  agent: AgentType,
  message: string,
  conversationId?: string
): Promise<AgentResponse> {
  const response = await apiClient.post<AgentResponse>(
    '/ai-agent/agent',
    {
      agent,
      message,
      conversationId,
    },
    {
      timeout: 60000, // 60 秒超时，AI 处理需要更长时间
    }
  );
  return response;
}

const tierConfig = {
  SAFETY: { label: 'Safety', color: 'bg-emerald-500', icon: Shield },
  TARGET: { label: 'Target', color: 'bg-blue-500', icon: Target },
  REACH: { label: 'Reach', color: 'bg-amber-500', icon: Zap },
};

export default function UncommonAppPage() {
  const t = useTranslations('uncommonApp');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [isFlipped, setIsFlipped] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<{
    safety: any[];
    target: any[];
    reach: any[];
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [conversationId] = useState<string | undefined>();
  const [agentThinking, setAgentThinking] = useState<string>('');

  // Fetch user's school list
  const { data: schoolList, isLoading: listLoading } = useQuery({
    queryKey: ['school-lists'],
    queryFn: () => apiClient.get<SchoolListItem[]>('/school-lists'),
  });

  // Fetch profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => apiClient.get<Profile>('/profiles/me'),
  });

  // Delete from list mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/school-lists/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-lists'] });
      toast.success(t('removedFromList'));
    },
  });

  // 使用 AI Agent 进行档案评估
  const handleGradeProfile = async () => {
    setIsAnalyzing(true);
    setAgentThinking('');

    try {
      // 调用 Profile Agent 进行档案分析
      const response = await callAIAgent(
        AgentType.PROFILE,
        t('aiPrompts.analyzeProfile'),
        conversationId
      );

      // 解析 AI 响应为结构化数据
      const parsedSections = parseMarkdownSections(response.message);

      const analysisResult: AIAnalysis = {
        overallScore: extractScore(response.message) || 85,
        admissionPrediction: response.message,
        strengths: response.data?.analysis?.strengths || parsedSections.strengths,
        weaknesses: response.data?.analysis?.weaknesses || parsedSections.weaknesses,
        improvements: response.data?.analysis?.improvements || parsedSections.improvements,
        recommendedActivities: response.data?.analysis?.activities || parsedSections.activities,
        timeline: response.data?.analysis?.timeline || [
          { date: t('defaults.nearTerm'), task: t('defaults.nearTermTask') },
          { date: t('defaults.laterTerm'), task: t('defaults.laterTermTask') },
        ],
        projectedImprovement: response.data?.analysis?.improvement || 15,
      };

      setAnalysis(analysisResult);
      setIsFlipped(true);
      toast.success(t('analysisComplete'));
    } catch (error: any) {
      console.error('Profile analysis failed:', error);
      // 根据错误类型显示不同提示
      if (error?.message?.includes('超时') || error?.message?.includes('timeout')) {
        toast.error(t('aiTimeout'));
      } else if (error?.message?.includes('401') || error?.message?.includes('Session')) {
        toast.error(t('loginRequired'));
      } else {
        toast.error(t('analysisError'));
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 从 AI 文本响应中解析学校推荐 (优先提取 JSON，回退到文本解析)
  function parseSchoolRecommendations(text: string): {
    safety: any[];
    target: any[];
    reach: any[];
  } {
    const result = { safety: [] as any[], target: [] as any[], reach: [] as any[] };

    // 优先尝试从消息中提取 JSON 块
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[1].trim());
        if (jsonData.schools && Array.isArray(jsonData.schools)) {
          for (const school of jsonData.schools) {
            const tier = school.tier?.toLowerCase() || school.fit?.toLowerCase();
            if (tier === 'reach') {
              result.reach.push(school);
            } else if (tier === 'target' || tier === 'match') {
              result.target.push(school);
            } else if (tier === 'safety') {
              result.safety.push(school);
            }
          }
          if (result.reach.length || result.target.length || result.safety.length) {
            return result;
          }
        }
      } catch (_e) {
        console.warn('Failed to parse JSON from AI response:', _e);
      }
    }

    // 回退：匹配不同格式的分类标题
    const reachPatterns = [/冲刺校|Reach|reach|冲刺/i];
    const targetPatterns = [/匹配校|Target|target|匹配/i];
    const safetyPatterns = [/保底校|Safety|safety|保底/i];

    // 按行分析
    const lines = text.split('\n');
    let currentTier: 'reach' | 'target' | 'safety' | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // 检测分类标题
      if (reachPatterns.some((p) => p.test(trimmedLine))) {
        currentTier = 'reach';
        continue;
      }
      if (targetPatterns.some((p) => p.test(trimmedLine))) {
        currentTier = 'target';
        continue;
      }
      if (safetyPatterns.some((p) => p.test(trimmedLine))) {
        currentTier = 'safety';
        continue;
      }

      // 提取学校名称（支持多种格式：- 学校名、1. 学校名、**学校名**等）
      if (currentTier && trimmedLine) {
        // 匹配列表项格式
        const listMatch = trimmedLine.match(/^[-•*\d.)\]]\s*\*{0,2}(.+?)\*{0,2}(?:\s*[-–:]|$)/);
        if (listMatch) {
          const schoolName = listMatch[1].trim().replace(/\*+/g, '');
          if (
            schoolName &&
            schoolName.length > 1 &&
            !schoolName.match(/^(冲刺|匹配|保底|Reach|Target|Safety)/i)
          ) {
            result[currentTier].push({ name: schoolName, nameZh: schoolName });
          }
        }
        // 匹配直接的学校名（不是标题）
        else if (
          !trimmedLine.match(/^#+\s/) &&
          !trimmedLine.match(/^(冲刺|匹配|保底|Reach|Target|Safety)/i)
        ) {
          const schoolName = trimmedLine.replace(/\*+/g, '').trim();
          if (schoolName && schoolName.length > 2 && schoolName.length < 50) {
            result[currentTier].push({ name: schoolName, nameZh: schoolName });
          }
        }
      }
    }

    return result;
  }

  // 使用 AI Agent 获取选校推荐
  const handleGetAIRecommendations = async () => {
    setAiLoading(true);
    setAgentThinking('');

    try {
      // 调用 School Agent 进行选校推荐
      const response = await callAIAgent(
        AgentType.SCHOOL,
        t('aiPrompts.recommendSchools'),
        conversationId
      );

      console.log('AI Agent response:', response);

      // 优先使用结构化数据
      let recommendations = {
        reach:
          response.data?.schools?.filter((s: any) => s.tier === 'reach' || s.fit === 'reach') || [],
        target:
          response.data?.schools?.filter((s: any) => s.tier === 'target' || s.fit === 'match') ||
          [],
        safety:
          response.data?.schools?.filter((s: any) => s.tier === 'safety' || s.fit === 'safety') ||
          [],
      };

      // 如果没有结构化数据，从文本中解析
      if (
        !recommendations.reach.length &&
        !recommendations.target.length &&
        !recommendations.safety.length
      ) {
        recommendations = parseSchoolRecommendations(response.message);
      }

      // 如果仍然没有解析到学校，显示原始消息
      if (
        !recommendations.reach.length &&
        !recommendations.target.length &&
        !recommendations.safety.length
      ) {
        setAiRecommendations({
          reach: [{ name: t('defaults.viewRecommendation'), description: response.message }],
          target: [],
          safety: [],
        });
      } else {
        setAiRecommendations(recommendations);
      }

      toast.success(t('aiRecommendationsLoaded'));
    } catch (error: any) {
      console.error('AI recommendations failed:', error);
      // 根据错误类型显示不同提示
      if (error?.message?.includes('超时') || error?.message?.includes('timeout')) {
        toast.error(t('aiTimeout'));
      } else if (error?.message?.includes('401') || error?.message?.includes('Session')) {
        toast.error(t('loginRequired'));
      } else {
        toast.error(t('aiRecommendationsError'));
      }
    } finally {
      setAiLoading(false);
    }
  };

  // 辅助函数：从文本中提取分数
  function extractScore(text: string): number | null {
    // 匹配 "85/100" 或 "8.5/10" 格式
    const scoreMatch = text.match(/(\d{1,3}(?:\.\d)?)\s*[\/]\s*(?:100|10)/);
    if (scoreMatch) {
      const score = parseFloat(scoreMatch[1]);
      return score > 10 ? Math.min(100, Math.round(score)) : Math.min(100, Math.round(score * 10));
    }
    // 匹配 "整体评分为**8.5/10**" 格式
    const boldMatch = text.match(/\*\*(\d{1,3}(?:\.\d)?)\s*[\/]\s*(?:100|10)\*\*/);
    if (boldMatch) {
      const score = parseFloat(boldMatch[1]);
      return score > 10 ? Math.min(100, Math.round(score)) : Math.min(100, Math.round(score * 10));
    }
    return null;
  }

  // 从完整 Markdown 解析所有部分
  function parseMarkdownSections(text: string): {
    strengths: string[];
    weaknesses: string[];
    improvements: string[];
    activities: string[];
  } {
    const lines = text.split('\n');
    const sections: Record<string, string[]> = {
      strengths: [],
      weaknesses: [],
      improvements: [],
      activities: [],
    };

    let currentSection: keyof typeof sections | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // 检测标题行，确定当前部分
      if (trimmedLine.match(/^#{1,3}\s*\d*\)?\s*优势/i)) {
        currentSection = 'strengths';
        continue;
      }
      if (trimmedLine.match(/^#{1,3}\s*\d*\)?\s*(不足|劣势|弱点|待提升)/i)) {
        currentSection = 'weaknesses';
        continue;
      }
      if (trimmedLine.match(/^#{1,3}\s*\d*\)?\s*(提升|建议|改进)/i)) {
        currentSection = 'improvements';
        continue;
      }
      if (trimmedLine.match(/^#{1,3}\s*\d*\)?\s*(推荐活动|活动建议|推荐)/i)) {
        currentSection = 'activities';
        continue;
      }
      // 遇到其他标题，重置当前部分
      if (trimmedLine.match(/^#{1,3}\s*\d*\)?\s*(整体|评分|预计|时间|总结)/i)) {
        currentSection = null;
        continue;
      }

      // 如果当前在某个部分中，提取列表项
      if (currentSection && trimmedLine.startsWith('-')) {
        // 清理 Markdown 格式: - **xxx**: yyy 或 - xxx
        const item = trimmedLine
          .replace(/^-\s*/, '') // 移除开头的 -
          .replace(/\*\*/g, '') // 移除所有 **
          .trim();

        if (item.length > 2) {
          sections[currentSection].push(item);
        }
      }
    }

    return {
      strengths: sections.strengths.slice(0, 8),
      weaknesses: sections.weaknesses.slice(0, 8),
      improvements: sections.improvements.slice(0, 8),
      activities: sections.activities.slice(0, 8),
    };
  }

  const handleExportReport = () => {
    toast.success(t('reportExported'));
    // TODO: Implement actual PDF export
  };

  const handleDone = () => {
    setIsFlipped(false);
  };

  // Group schools by tier
  const groupedSchools = {
    REACH: schoolList?.filter((s) => s.tier === 'REACH') || [],
    TARGET: schoolList?.filter((s) => s.tier === 'TARGET') || [],
    SAFETY: schoolList?.filter((s) => s.tier === 'SAFETY') || [],
  };

  // Calculate profile completeness
  const profileScore = profile
    ? (profile.gpa ? 20 : 0) +
      (profile.testScores?.length ? 30 : 0) +
      (profile.activities?.length ? 25 : 0) +
      (profile.awards?.length ? 25 : 0)
    : 0;

  // Markdown 组件样式
  const MarkdownContent = ({ content }: { content: string }) => (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className="text-xl font-bold mb-3 text-primary">{children}</h1>,
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold mb-2 mt-4 text-foreground">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-medium mb-2 mt-3 text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-sm font-medium mb-1 mt-2 text-muted-foreground">{children}</h4>
        ),
        p: ({ children }) => (
          <p className="text-sm leading-relaxed mb-2 text-muted-foreground">{children}</p>
        ),
        ul: ({ children }) => <ul className="space-y-1.5 mb-3">{children}</ul>,
        ol: ({ children }) => (
          <ol className="space-y-1.5 mb-3 list-decimal list-inside">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-sm flex items-start gap-2">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
            <span className="flex-1">{children}</span>
          </li>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-foreground">{children}</strong>
        ),
        em: ({ children }) => <em className="text-primary">{children}</em>,
      }}
    >
      {content}
    </ReactMarkdown>
  );

  // 渲染 AI 分析完整内容（新的 Tab 布局）
  const renderFullAnalysis = () => {
    if (!analysis) return null;

    return (
      <div className="space-y-4">
        {/* 分数卡片 */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-primary/10 via-violet-500/10 to-primary/10 border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('analysis.prediction.subtitle')}</p>
              <p className="text-3xl font-bold text-primary">
                {analysis.overallScore}
                <span className="text-lg text-muted-foreground">/100</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <Badge
              variant="secondary"
              className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              {t('potential', { score: analysis.projectedImprovement })}
            </Badge>
          </div>
        </div>

        {/* Tab 内容 */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-9">
            <TabsTrigger value="overview" className="text-xs">
              {t('tabs.overview')}
            </TabsTrigger>
            <TabsTrigger value="strengths" className="text-xs">
              {t('tabs.strengths')}
            </TabsTrigger>
            <TabsTrigger value="suggestions" className="text-xs">
              {t('tabs.suggestions')}
            </TabsTrigger>
            <TabsTrigger value="activities" className="text-xs">
              {t('tabs.activities')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-3">
            <ScrollArea className="h-[280px] pr-4">
              <MarkdownContent content={analysis.admissionPrediction} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="strengths" className="mt-3">
            <ScrollArea className="h-[280px] pr-4">
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <h4 className="font-medium text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    {t('analysis.strengths.label')}
                  </h4>
                  <ul className="space-y-2">
                    {analysis.strengths.length > 0 ? (
                      analysis.strengths.map((s, i) => (
                        <li
                          key={i}
                          className="text-sm text-emerald-800 dark:text-emerald-300 flex items-start gap-2"
                        >
                          <span className="text-emerald-500">•</span>
                          {s}
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-muted-foreground">{t('analysis.noData')}</li>
                    )}
                  </ul>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <h4 className="font-medium text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {t('analysis.weaknesses.label')}
                  </h4>
                  <ul className="space-y-2">
                    {analysis.weaknesses.length > 0 ? (
                      analysis.weaknesses.map((w, i) => (
                        <li
                          key={i}
                          className="text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2"
                        >
                          <span className="text-amber-500">•</span>
                          {w}
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-muted-foreground">{t('analysis.noData')}</li>
                    )}
                  </ul>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="suggestions" className="mt-3">
            <ScrollArea className="h-[280px] pr-4">
              <div className="space-y-2">
                {analysis.improvements.length > 0 ? (
                  analysis.improvements.map((item, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-muted/50 border flex items-start gap-3"
                    >
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{i + 1}</span>
                      </div>
                      <p className="text-sm flex-1">{item}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {t('analysis.noData')}
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="activities" className="mt-3">
            <ScrollArea className="h-[280px] pr-4">
              <div className="space-y-2">
                {analysis.recommendedActivities.length > 0 ? (
                  analysis.recommendedActivities.map((activity, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-violet-500/5 border flex items-start gap-3"
                    >
                      <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-sm flex-1">{activity}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {t('analysis.noData')}
                  </p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  return (
    <PageContainer maxWidth="7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-title mb-2">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Side - School List */}
        <div className="space-y-6">
          {/* My School List */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  {t('mySchoolList')}
                </CardTitle>
                <Link href="/find-college">
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    {t('addSchool')}
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {listLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : schoolList?.length ? (
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-4">
                    {(['REACH', 'TARGET', 'SAFETY'] as const).map((tier) => {
                      const schools = groupedSchools[tier];
                      if (!schools.length) return null;
                      const config = tierConfig[tier];

                      return (
                        <div key={tier}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={cn('w-2 h-2 rounded-full', config.color)} />
                            <span className="text-sm font-medium">
                              {t(`tier.${tier.toLowerCase()}`)}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {schools.length}
                            </Badge>
                          </div>
                          <div className="space-y-2 ml-4">
                            {schools.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 group"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium w-8">
                                    #{item.school.usNewsRank || '-'}
                                  </span>
                                  <span className="text-sm">
                                    {getSchoolName(item.school, locale)}
                                  </span>
                                  {item.isAIRecommended && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Sparkles className="h-3 w-3 mr-1" />
                                      AI
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover:opacity-100"
                                  onClick={() => deleteMutation.mutate(item.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <EmptyState
                  type="schools"
                  title={t('emptyList')}
                  description={t('emptyListDesc')}
                  action={{
                    label: t('startAdding'),
                    onClick: () => (window.location.href = '/find-college'),
                  }}
                  size="sm"
                />
              )}
            </CardContent>
          </Card>

          {/* AI Recommendations - 接入 AI Agent */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {t('aiRecommendations')}
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                    <Brain className="h-3 w-3 mr-1" />
                    School Agent
                  </Badge>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGetAIRecommendations}
                  disabled={aiLoading}
                  className="gap-1"
                >
                  {aiLoading ? (
                    <>
                      <Brain className="h-4 w-4 animate-pulse" />
                      <span className="animate-pulse">{t('analyzing')}</span>
                    </>
                  ) : (
                    t('getRecommendations')
                  )}
                </Button>
              </div>
              <CardDescription className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                {t('aiRecommendationsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiRecommendations ? (
                <div className="space-y-3">
                  {(['safety', 'target', 'reach'] as const).map((tier) => {
                    const schools = aiRecommendations[tier] || [];
                    const config = tierConfig[tier.toUpperCase() as keyof typeof tierConfig];
                    return (
                      <div key={tier} className="flex items-center gap-2">
                        <div className={cn('w-2 h-2 rounded-full', config.color)} />
                        <span className="text-sm font-medium w-16">{config.label}:</span>
                        <span className="text-sm text-muted-foreground">
                          {schools.map((s: any) => getSchoolName(s, locale)).join(', ') || '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('clickToGetRecommendations')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side - Profile with Flip Card */}
        <div className="relative" style={{ perspective: '1000px' }}>
          <motion.div
            className="relative w-full"
            style={{ transformStyle: 'preserve-3d' }}
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.6, type: 'spring' }}
          >
            {/* Front - Profile */}
            <Card
              className={cn('w-full backface-hidden', isFlipped && 'invisible')}
              style={{ backfaceVisibility: 'hidden' }}
            >
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
                    {/* Profile Score */}
                    <div className="text-center p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                      <div className="text-5xl font-bold text-primary mb-2">{profileScore}</div>
                      <div className="text-sm text-muted-foreground">{t('profileScore')}</div>
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

                    {/* Grade Profile Button - 接入 AI Agent */}
                    <Button
                      className="w-full bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90"
                      size="lg"
                      onClick={handleGradeProfile}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? (
                        <>
                          <Brain className="h-4 w-4 mr-2 animate-pulse" />
                          <span className="animate-pulse">{t('aiAnalyzing')}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          {t('gradeProfile')}
                        </>
                      )}
                    </Button>

                    {/* AI Agent 标识 */}
                    <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                      <Brain className="h-3 w-3" />
                      <span>Powered by AI Agent</span>
                    </div>

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
                      onClick: () => (window.location.href = '/profile'),
                    }}
                    size="sm"
                  />
                )}
              </CardContent>
            </Card>

            {/* Back - AI Analysis */}
            <Card
              className={cn(
                'absolute inset-0 w-full backface-hidden overflow-hidden',
                !isFlipped && 'invisible'
              )}
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Brain className="h-5 w-5 text-primary" />
                    {t('aiAnalysis')}
                    <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                      Profile Agent
                    </Badge>
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={handleDone}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {analysis ? (
                  renderFullAnalysis()
                ) : (
                  <div className="flex items-center justify-center h-[400px]">
                    <div className="text-center text-muted-foreground">
                      <Brain className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                      <p>{t('analysis.noData')}</p>
                    </div>
                  </div>
                )}

                {/* Bottom Actions */}
                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t">
                  <Button variant="outline" size="sm" onClick={handleExportReport}>
                    <Download className="h-4 w-4 mr-1" />
                    {t('exportReport')}
                  </Button>
                  <Button size="sm" onClick={handleGradeProfile} disabled={isAnalyzing}>
                    {isAnalyzing ? (
                      <>
                        <Brain className="h-4 w-4 mr-1 animate-pulse" />
                        {t('reAnalyzing')}
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4 mr-1" />
                        {t('reAnalyze')}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </PageContainer>
  );
}
