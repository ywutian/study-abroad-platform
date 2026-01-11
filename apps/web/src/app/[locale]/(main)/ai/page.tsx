'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout';
import { toast } from 'sonner';
import { AgentChat } from '@/components/features/agent-chat';
import {
  Brain,
  FileText,
  Lightbulb,
  GraduationCap,
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Target,
  User,
  Wand2,
  Copy,
  Check,
  Bot,
} from 'lucide-react';

interface ProfileAnalysis {
  overall: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

interface EssayReview {
  overallScore: number;
  structure: { score: number; feedback: string };
  content: { score: number; feedback: string };
  language: { score: number; feedback: string };
  suggestions: string[];
}

interface SchoolMatch {
  name: string;
  fit: 'reach' | 'match' | 'safety';
  reason: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface PolishResult {
  polished: string;
  changes: Array<{ original: string; revised: string; reason: string }>;
}

export default function AiPage() {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState('agent');

  // Profile Analysis
  const [analysisResult, setAnalysisResult] = useState<ProfileAnalysis | null>(null);

  // Essay Review
  const [essayPrompt, setEssayPrompt] = useState('');
  const [essayContent, setEssayContent] = useState('');
  const [essayWordLimit, setEssayWordLimit] = useState('650');
  const [essayReview, setEssayReview] = useState<EssayReview | null>(null);

  // Essay Ideas
  const [ideaTopic, setIdeaTopic] = useState('');
  const [ideaBackground, setIdeaBackground] = useState('');
  const [ideas, setIdeas] = useState<string[]>([]);

  // School Match
  const [schoolMatches, setSchoolMatches] = useState<SchoolMatch[]>([]);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Polish
  const [polishContent, setPolishContent] = useState('');
  const [polishStyle, setPolishStyle] = useState<'formal' | 'vivid' | 'concise'>('formal');
  const [polishResult, setPolishResult] = useState<PolishResult | null>(null);
  const [copiedPolish, setCopiedPolish] = useState(false);

  // Fetch user profile for analysis
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get<any>('/profiles/me'),
  });

  // Profile Analysis Mutation
  const analyzeMutation = useMutation({
    mutationFn: () =>
      apiClient.post<ProfileAnalysis>('/ai/analyze-profile', {
        gpa: profile?.gpa ? Number(profile.gpa) : undefined,
        gpaScale: profile?.gpaScale ? Number(profile.gpaScale) : 4.0,
        testScores: profile?.testScores?.map((s: any) => ({ type: s.type, score: s.score })),
        activities: profile?.activities?.map((a: any) => ({
          name: a.name,
          category: a.category,
          role: a.role,
        })),
        awards: profile?.awards?.map((a: any) => ({ name: a.name, level: a.level })),
        targetMajor: profile?.targetMajor,
      }),
    onSuccess: (data) => {
      setAnalysisResult(data);
      toast.success(t('ai.toast.analysisComplete'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('ai.toast.analysisFailed'));
    },
  });

  // Essay Review Mutation
  const reviewEssayMutation = useMutation({
    mutationFn: () =>
      apiClient.post<EssayReview>('/ai/review-essay', {
        prompt: essayPrompt,
        content: essayContent,
        wordLimit: parseInt(essayWordLimit) || undefined,
      }),
    onSuccess: (data) => {
      setEssayReview(data);
      toast.success(t('ai.toast.evaluationComplete'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('ai.toast.evaluationFailed'));
    },
  });

  // Generate Ideas Mutation
  const generateIdeasMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ ideas: string[] }>('/ai/generate-ideas', {
        topic: ideaTopic,
        background: ideaBackground || undefined,
      }),
    onSuccess: (data) => {
      setIdeas(data.ideas || []);
      toast.success(t('ai.toast.generationComplete'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('ai.toast.generationFailed'));
    },
  });

  // School Match Mutation
  const schoolMatchMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ schools: SchoolMatch[] }>('/ai/school-match', {
        gpa: profile?.gpa ? Number(profile.gpa) : undefined,
        gpaScale: profile?.gpaScale ? Number(profile.gpaScale) : 4.0,
        testScores: profile?.testScores?.map((s: any) => ({ type: s.type, score: s.score })),
        targetMajor: profile?.targetMajor,
      }),
    onSuccess: (data) => {
      setSchoolMatches(data.schools || []);
      toast.success(t('ai.toast.recommendationComplete'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('ai.toast.recommendationFailed'));
    },
  });

  // Chat Mutation
  const chatMutation = useMutation({
    mutationFn: (messages: { role: string; content: string }[]) =>
      apiClient.post<{ response: string }>('/ai/chat', { messages }),
    onSuccess: (data) => {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
    },
    onError: (error: Error) => {
      toast.error(error.message || t('ai.toast.sendFailed'));
    },
  });

  // Polish Mutation
  const polishMutation = useMutation({
    mutationFn: (data: { content: string; style?: 'formal' | 'vivid' | 'concise' }) =>
      apiClient.post<PolishResult>('/ai/polish-essay', data),
    onSuccess: (data) => {
      setPolishResult(data);
      toast.success(t('ai.toast.polishComplete'));
    },
    onError: (error: Error) => {
      toast.error(error.message || t('ai.toast.polishFailed'));
    },
  });

  const handleSendChat = () => {
    if (!chatInput.trim()) return;

    const newMessage: ChatMessage = { role: 'user', content: chatInput };
    setChatMessages((prev) => [...prev, newMessage]);

    const messagesToSend = [...chatMessages, newMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    chatMutation.mutate(messagesToSend);
    setChatInput('');
  };

  const getFitColor = (fit: string) => {
    switch (fit) {
      case 'reach':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'match':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'safety':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getFitLabel = (fit: string) => {
    switch (fit) {
      case 'reach':
        return t('ai.schoolMatch.matchTypes.reach');
      case 'match':
        return t('ai.schoolMatch.matchTypes.match');
      case 'safety':
        return t('ai.schoolMatch.matchTypes.safety');
      default:
        return fit;
    }
  };

  const copyPolishedContent = async () => {
    if (polishResult) {
      await navigator.clipboard.writeText(polishResult.polished);
      setCopiedPolish(true);
      toast.success(t('ai.toast.copiedToClipboard'));
      setTimeout(() => setCopiedPolish(false), 2000);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={t('ai.title')}
        description={t('ai.description')}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Desktop Tabs */}
        <TabsList className="mb-6 hidden h-auto gap-1 bg-transparent p-0 sm:flex flex-wrap">
          <TabsTrigger
            value="agent"
            className="gap-2 rounded-lg border bg-card px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5"
          >
            <Bot className="h-4 w-4" />
            {t('ai.tabs.chat')}
          </TabsTrigger>
          <TabsTrigger
            value="analyze"
            className="gap-2 rounded-lg border bg-card px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5"
          >
            <BarChart3 className="h-4 w-4" />
            {t('ai.tabs.analysis')}
          </TabsTrigger>
          <TabsTrigger
            value="essay"
            className="gap-2 rounded-lg border bg-card px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5"
          >
            <FileText className="h-4 w-4" />
            {t('ai.tabs.essay')}
          </TabsTrigger>
          <TabsTrigger
            value="ideas"
            className="gap-2 rounded-lg border bg-card px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5"
          >
            <Lightbulb className="h-4 w-4" />
            {t('ai.tabs.ideas')}
          </TabsTrigger>
          <TabsTrigger
            value="school"
            className="gap-2 rounded-lg border bg-card px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5"
          >
            <GraduationCap className="h-4 w-4" />
            {t('ai.tabs.schoolMatch')}
          </TabsTrigger>
          <TabsTrigger
            value="polish"
            className="gap-2 rounded-lg border bg-card px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5"
          >
            <Wand2 className="h-4 w-4" />
            {t('ai.tabs.polish')}
          </TabsTrigger>
          <TabsTrigger
            value="chat"
            className="gap-2 rounded-lg border bg-card px-4 py-2 data-[state=active]:border-primary data-[state=active]:bg-primary/5"
          >
            <MessageSquare className="h-4 w-4" />
            {t('ai.tabs.freeChat')}
          </TabsTrigger>
        </TabsList>

        {/* Mobile Select */}
        <div className="mb-6 sm:hidden">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agent">
                <span className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  {t('ai.tabs.chat')}
                </span>
              </SelectItem>
              <SelectItem value="analyze">
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  {t('ai.tabs.analysis')}
                </span>
              </SelectItem>
              <SelectItem value="essay">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {t('ai.tabs.essay')}
                </span>
              </SelectItem>
              <SelectItem value="ideas">
                <span className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  {t('ai.tabs.ideas')}
                </span>
              </SelectItem>
              <SelectItem value="school">
                <span className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" />
                  {t('ai.tabs.schoolMatch')}
                </span>
              </SelectItem>
              <SelectItem value="polish">
                <span className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4" />
                  {t('ai.tabs.polish')}
                </span>
              </SelectItem>
              <SelectItem value="chat">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  {t('ai.tabs.freeChat')}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Agent Chat Tab */}
        <TabsContent value="agent" className="animate-fade-in">
          <Card className="h-[700px] overflow-hidden">
            <AgentChat showHeader={true} showQuickActions={true} />
          </Card>
        </TabsContent>

        {/* Profile Analysis Tab */}
        <TabsContent value="analyze" className="animate-fade-in">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>{t('ai.analysis.title')}</CardTitle>
                    <CardDescription>{t('ai.analysis.description')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile ? (
                  <>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">GPA</p>
                        <p className="font-medium">
                          {profile.gpa ? `${profile.gpa}/${profile.gpaScale || 4.0}` : t('common.notFilled')}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t('ai.analysis.targetMajor')}</p>
                        <p className="font-medium">{profile.targetMajor || t('common.notFilled')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t('ai.analysis.testScores')}</p>
                        <p className="font-medium">{profile.testScores?.length || 0} {t('common.items')}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">{t('ai.analysis.activitiesAwards')}</p>
                        <p className="font-medium">
                          {(profile.activities?.length || 0) + (profile.awards?.length || 0)} {t('common.items')}
                        </p>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => analyzeMutation.mutate()}
                      disabled={analyzeMutation.isPending}
                    >
                      {analyzeMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      {t('ai.analysis.startAnalysis')}
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">{t('common.pleaseCompleteProfile')}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>{t('ai.analysis.resultTitle')}</CardTitle>
                    <CardDescription>{t('ai.analysis.resultDesc')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {analysisResult ? (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-6">
                      <div>
                        <h4 className="mb-2 font-semibold">{t('ai.analysis.overallEvaluation')}</h4>
                        <p className="text-sm text-muted-foreground">{analysisResult.overall}</p>
                      </div>

                      {analysisResult.strengths?.length > 0 && (
                        <div>
                          <h4 className="mb-2 flex items-center gap-2 font-semibold text-green-600">
                            <TrendingUp className="h-4 w-4" />
                            {t('ai.analysis.strengths')}
                          </h4>
                          <ul className="space-y-2">
                            {analysisResult.strengths.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {analysisResult.weaknesses?.length > 0 && (
                        <div>
                          <h4 className="mb-2 flex items-center gap-2 font-semibold text-amber-600">
                            <TrendingDown className="h-4 w-4" />
                            {t('ai.analysis.improvements')}
                          </h4>
                          <ul className="space-y-2">
                            {analysisResult.weaknesses.map((w, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {analysisResult.suggestions?.length > 0 && (
                        <div>
                          <h4 className="mb-2 flex items-center gap-2 font-semibold text-blue-600">
                            <Target className="h-4 w-4" />
                            {t('ai.analysis.suggestions')}
                          </h4>
                          <ul className="space-y-2">
                            {analysisResult.suggestions.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                                  {i + 1}
                                </span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex h-[300px] flex-col items-center justify-center text-muted-foreground">
                    <Brain className="mb-4 h-12 w-12 opacity-30" />
                    <p>{t('ai.analysis.empty')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Essay Review Tab */}
        <TabsContent value="essay" className="animate-fade-in">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('ai.essay.title')}</CardTitle>
                <CardDescription>{t('ai.essay.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('ai.essay.prompt')}</Label>
                  <Input
                    placeholder={t('ai.essay.promptPlaceholder')}
                    value={essayPrompt}
                    onChange={(e) => setEssayPrompt(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('ai.essay.wordLimit')}</Label>
                  <Input
                    type="number"
                    placeholder="650"
                    value={essayWordLimit}
                    onChange={(e) => setEssayWordLimit(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('ai.essay.content')}</Label>
                  <Textarea
                    placeholder={t('ai.essay.contentPlaceholder')}
                    value={essayContent}
                    onChange={(e) => setEssayContent(e.target.value)}
                    rows={12}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('ai.essay.currentWords', { count: essayContent.split(/\s+/).filter(Boolean).length })}
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => reviewEssayMutation.mutate()}
                  disabled={reviewEssayMutation.isPending || !essayPrompt || !essayContent}
                >
                  {reviewEssayMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  {t('ai.essay.evaluate')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('ai.essay.resultTitle')}</CardTitle>
                <CardDescription>{t('ai.essay.resultDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                {essayReview ? (
                  <ScrollArea className="h-[450px] pr-4">
                    <div className="space-y-6">
                      <div className="text-center">
                        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                          <span className="text-3xl font-bold text-primary">
                            {essayReview.overallScore}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{t('ai.essay.overallScore')}</p>
                      </div>

                      <div className="space-y-4">
                        {[
                          { key: 'structure', label: t('ai.essay.dimensions.structure') },
                          { key: 'content', label: t('ai.essay.dimensions.content') },
                          { key: 'language', label: t('ai.essay.dimensions.language') },
                        ].map((item) => {
                          const score = essayReview[item.key as keyof EssayReview] as {
                            score: number;
                            feedback: string;
                          };
                          return (
                            <div key={item.key} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{item.label}</span>
                                <Badge variant="secondary">{score.score}/10</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{score.feedback}</p>
                            </div>
                          );
                        })}
                      </div>

                      {essayReview.suggestions?.length > 0 && (
                        <div>
                          <h4 className="mb-2 font-semibold">{t('ai.essay.improvementSuggestions')}</h4>
                          <ul className="space-y-2">
                            {essayReview.suggestions.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex h-[300px] flex-col items-center justify-center text-muted-foreground">
                    <FileText className="mb-4 h-12 w-12 opacity-30" />
                    <p>{t('ai.essay.empty')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Ideas Tab */}
        <TabsContent value="ideas" className="animate-fade-in">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('ai.ideas.title')}</CardTitle>
                <CardDescription>{t('ai.ideas.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('ai.ideas.topic')}</Label>
                  <Textarea
                    placeholder={t('ai.ideas.topicPlaceholder')}
                    value={ideaTopic}
                    onChange={(e) => setIdeaTopic(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('ai.ideas.background')}</Label>
                  <Textarea
                    placeholder={t('ai.ideas.backgroundPlaceholder')}
                    value={ideaBackground}
                    onChange={(e) => setIdeaBackground(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => generateIdeasMutation.mutate()}
                  disabled={generateIdeasMutation.isPending || !ideaTopic}
                >
                  {generateIdeasMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Lightbulb className="mr-2 h-4 w-4" />
                  )}
                  {t('ai.ideas.generate')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('ai.ideas.resultTitle')}</CardTitle>
                <CardDescription>{t('ai.ideas.resultDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                {ideas.length > 0 ? (
                  <ScrollArea className="h-[350px] pr-4">
                    <ul className="space-y-4">
                      {ideas.map((idea, i) => (
                        <li
                          key={i}
                          className="rounded-lg border bg-muted/30 p-4 transition-colors hover:bg-muted/50"
                        >
                          <div className="mb-2 flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {i + 1}
                            </span>
                            <span className="text-xs text-muted-foreground">{t('ai.ideas.ideaNumber', { number: i + 1 })}</span>
                          </div>
                          <p className="text-sm">{idea}</p>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                ) : (
                  <div className="flex h-[300px] flex-col items-center justify-center text-muted-foreground">
                    <Lightbulb className="mb-4 h-12 w-12 opacity-30" />
                    <p>{t('ai.ideas.empty')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* School Match Tab */}
        <TabsContent value="school" className="animate-fade-in">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('ai.schoolMatch.title')}</CardTitle>
                  <CardDescription>{t('ai.schoolMatch.description')}</CardDescription>
                </div>
                <Button
                  onClick={() => schoolMatchMutation.mutate()}
                  disabled={schoolMatchMutation.isPending || !profile?.gpa}
                >
                  {schoolMatchMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <GraduationCap className="mr-2 h-4 w-4" />
                  )}
                  {t('ai.schoolMatch.getRecommendations')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {schoolMatches.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {schoolMatches.map((school, i) => (
                    <Card key={i} className="transition-all hover:shadow-md">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base">{school.name}</CardTitle>
                          <Badge className={getFitColor(school.fit)}>{getFitLabel(school.fit)}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{school.reason}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex h-[300px] flex-col items-center justify-center text-muted-foreground">
                  <GraduationCap className="mb-4 h-12 w-12 opacity-30" />
                  <p>{t('ai.schoolMatch.empty')}</p>
                  {!profile?.gpa && <p className="mt-2 text-sm">{t('ai.schoolMatch.fillGpaFirst')}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Polish Tab */}
        <TabsContent value="polish" className="animate-fade-in">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('ai.polish.title')}</CardTitle>
                <CardDescription>{t('ai.polish.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('ai.polish.style')}</Label>
                  <Select value={polishStyle} onValueChange={(v: 'formal' | 'vivid' | 'concise') => setPolishStyle(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">{t('ai.polish.styles.formal')}</SelectItem>
                      <SelectItem value="vivid">{t('ai.polish.styles.vivid')}</SelectItem>
                      <SelectItem value="concise">{t('ai.polish.styles.concise')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('ai.polish.content')}</Label>
                  <Textarea
                    placeholder={t('ai.polish.contentPlaceholder')}
                    value={polishContent}
                    onChange={(e) => setPolishContent(e.target.value)}
                    rows={14}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('ai.essay.currentWords', { count: polishContent.split(/\s+/).filter(Boolean).length })}
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => polishMutation.mutate({ content: polishContent, style: polishStyle })}
                  disabled={polishMutation.isPending || !polishContent}
                >
                  {polishMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                  )}
                  {t('ai.polish.polish')}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{t('ai.polish.resultTitle')}</CardTitle>
                    <CardDescription>{t('ai.polish.resultDesc')}</CardDescription>
                  </div>
                  {polishResult && (
                    <Button size="sm" variant="outline" onClick={copyPolishedContent}>
                      {copiedPolish ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {polishResult ? (
                  <ScrollArea className="h-[450px] pr-4">
                    <div className="space-y-6">
                      <div className="rounded-lg border bg-muted/30 p-4">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {polishResult.polished}
                        </p>
                      </div>

                      {polishResult.changes?.length > 0 && (
                        <div>
                          <h4 className="mb-3 font-semibold">{t('common.changes')} ({polishResult.changes.length})</h4>
                          <div className="space-y-3">
                            {polishResult.changes.map((change, i) => (
                              <div key={i} className="rounded-lg border p-3 text-sm">
                                <div className="mb-2">
                                  <Badge variant="outline" className="text-xs">{change.reason}</Badge>
                                </div>
                                <div className="space-y-1">
                                  <p className="line-through text-muted-foreground">{change.original}</p>
                                  <p className="text-green-600 dark:text-green-400">{change.revised}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex h-[400px] flex-col items-center justify-center text-muted-foreground">
                    <Wand2 className="mb-4 h-12 w-12 opacity-30" />
                    <p>{t('ai.polish.empty')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat" className="animate-fade-in">
          <Card className="flex h-[600px] flex-col">
            <CardHeader>
              <CardTitle>{t('ai.chatbot.title')}</CardTitle>
              <CardDescription>{t('ai.freeChat.description')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <ScrollArea className="flex-1 rounded-md border p-4">
                {chatMessages.length > 0 ? (
                  <div className="space-y-4">
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                    {chatMutation.isPending && (
                      <div className="flex justify-start">
                        <div className="rounded-lg bg-muted px-4 py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                    <MessageSquare className="mb-4 h-12 w-12 opacity-30" />
                    <p>{t('ai.freeChat.empty')}</p>
                  </div>
                )}
              </ScrollArea>

              <div className="mt-4 flex gap-2">
                <Input
                  placeholder={t('ai.freeChat.placeholder')}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                />
                <Button onClick={handleSendChat} disabled={chatMutation.isPending || !chatInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
