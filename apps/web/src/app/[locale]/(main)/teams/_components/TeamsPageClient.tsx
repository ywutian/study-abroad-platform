'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  resumeRoutes,
  teamRoutes,
  type InviteMatchMembersResponseDto,
  type RecruitmentContextDto,
  type TeamMatchDto,
  type TeamMatchInviteResultDto,
  type TeamRecruitmentCardFrontDto,
} from '@study-abroad/shared';
import {
  Users,
  Heart,
  X,
  Sparkles,
  MessageSquare,
  Clock3,
  ShieldCheck,
  Target,
  Copy,
  Check,
} from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/layout';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { useRouter } from '@/lib/i18n/navigation';
import { useAuthStore } from '@/stores/auth';
import {
  getCurrentMemberDisplaySettings,
  getInviteDeliveryState,
} from '@/components/features/teams/team-recruitment-utils';

type MyRecruitmentsResponse = {
  items: Array<{
    team: {
      id: string;
      name: string;
      description?: string | null;
      visibility?: string;
      joinPolicy?: string;
      maxMembers?: number | null;
      memberCount: number;
      myRole: string;
      school?: { id: string; name: string; nameZh?: string | null } | null;
    };
    recruitmentCards: TeamRecruitmentCardFrontDto[];
  }>;
};

type RecruitmentDeckResponse = {
  sourceCard: TeamRecruitmentCardFrontDto | null;
  items: TeamRecruitmentCardFrontDto[];
};

type ResumeOption = {
  id: string;
  title: string;
};

type RecruitmentFormState = {
  teamId?: string;
  teamName: string;
  competitionTrackId: string;
  headline: string;
  detailNote: string;
  offerRoles: string;
  needRoles: string;
  skillTags: string;
  targetTeamSize: string;
  availabilityBand: string;
  collaborationMode: string;
  timezone: string;
  city: string;
  languages: string;
  intentMode: 'TEAM_UP' | 'NETWORKING_ONLY';
};

const DEFAULT_FORM: RecruitmentFormState = {
  teamId: undefined,
  teamName: '',
  competitionTrackId: '',
  headline: '',
  detailNote: '',
  offerRoles: '',
  needRoles: '',
  skillTags: '',
  targetTeamSize: '',
  availabilityBand: '',
  collaborationMode: '',
  timezone: '',
  city: '',
  languages: '',
  intentMode: 'TEAM_UP',
};

export function TeamsPageClient() {
  const t = useTranslations('teams');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const authUserId = useAuthStore((state) => state.user?.id ?? null);

  const [tab, setTab] = useState<'match' | 'matches' | 'my-team'>('match');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('new-solo');
  const [form, setForm] = useState<RecruitmentFormState>(DEFAULT_FORM);
  const [introLine, setIntroLine] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('none');
  const [showSchool, setShowSchool] = useState(false);
  const [showGrade, setShowGrade] = useState(false);
  const [showAwards, setShowAwards] = useState(false);
  const [inviteResultsByMatchId, setInviteResultsByMatchId] = useState<
    Record<string, TeamMatchInviteResultDto[]>
  >({});
  const [copiedInviteUrl, setCopiedInviteUrl] = useState<string | null>(null);

  const { data: contextsData, isLoading: contextsLoading } = useQuery({
    queryKey: ['teams', 'recruitment-contexts'],
    queryFn: () => apiClient.get<RecruitmentContextDto>(teamRoutes.recruitmentContexts()),
  });

  const { data: myRecruitments, isLoading: myRecruitmentsLoading } = useQuery({
    queryKey: ['teams', 'recruitments', 'my'],
    queryFn: () => apiClient.get<MyRecruitmentsResponse>(teamRoutes.myRecruitments()),
  });

  const { data: resumesData } = useQuery({
    queryKey: ['resumes', 'options'],
    queryFn: () => apiClient.get<ResumeOption[]>(resumeRoutes.list()),
  });

  const currentTeamEntry = useMemo(() => {
    if (!myRecruitments?.items?.length) return null;
    if (selectedTeamId === 'new-solo') return myRecruitments.items[0] ?? null;
    return (
      myRecruitments.items.find((item) => item.team.id === selectedTeamId) ??
      myRecruitments.items[0]
    );
  }, [myRecruitments?.items, selectedTeamId]);

  const currentCard = currentTeamEntry?.recruitmentCards[0] ?? null;

  useEffect(() => {
    if (!myRecruitments?.items) return;
    if (myRecruitments.items.length === 0) {
      setSelectedTeamId('new-solo');
      return;
    }
    if (
      selectedTeamId === 'new-solo' ||
      !myRecruitments.items.some((item) => item.team.id === selectedTeamId)
    ) {
      setSelectedTeamId(myRecruitments.items[0].team.id);
    }
  }, [myRecruitments?.items, selectedTeamId]);

  useEffect(() => {
    if (!contextsData?.items?.length) return;
    setForm((prev) => ({
      ...prev,
      teamId: selectedTeamId === 'new-solo' ? undefined : selectedTeamId,
      competitionTrackId: prev.competitionTrackId || contextsData.items[0].id,
      targetTeamSize: prev.targetTeamSize || String(contextsData.items[0].maxTeamSize),
    }));
  }, [contextsData?.items, selectedTeamId]);

  useEffect(() => {
    if (!currentCard) {
      setForm((prev) => ({
        ...DEFAULT_FORM,
        competitionTrackId: prev.competitionTrackId,
        teamId: selectedTeamId === 'new-solo' ? undefined : selectedTeamId,
        teamName: selectedTeamId === 'new-solo' ? prev.teamName : '',
        targetTeamSize: prev.targetTeamSize,
      }));
      return;
    }
    setForm({
      teamId: currentTeamEntry?.team.id,
      teamName: currentTeamEntry?.team.name ?? '',
      competitionTrackId: currentCard.context.trackId,
      headline: currentCard.headline,
      detailNote: currentCard.detailNote ?? '',
      offerRoles: currentCard.offerRoles.join(', '),
      needRoles: currentCard.needRoles.join(', '),
      skillTags: currentCard.skillTags.join(', '),
      targetTeamSize: String(currentCard.team.targetSize),
      availabilityBand: currentCard.availabilityBand ?? '',
      collaborationMode: currentCard.collaborationMode ?? '',
      timezone: currentCard.timezone ?? '',
      city: currentCard.city ?? '',
      languages: currentCard.languages.join(', '),
      intentMode: currentCard.intentMode,
    });
  }, [currentCard, currentTeamEntry?.team.id, currentTeamEntry?.team.name, selectedTeamId]);

  useEffect(() => {
    const displaySettings = getCurrentMemberDisplaySettings(currentCard, authUserId);
    setIntroLine(displaySettings.introLine);
    setSelectedResumeId(displaySettings.selectedResumeId);
    setShowSchool(displaySettings.showSchool);
    setShowGrade(displaySettings.showGrade);
    setShowAwards(displaySettings.showAwards);
  }, [authUserId, currentCard]);

  const { data: deckData, isLoading: deckLoading } = useQuery({
    queryKey: ['teams', 'recruitments', 'deck', currentTeamEntry?.team.id],
    queryFn: () =>
      apiClient.get<RecruitmentDeckResponse>(teamRoutes.recruitmentDeck(), {
        params: currentTeamEntry?.team.id ? { teamId: currentTeamEntry.team.id } : undefined,
      }),
    enabled: !!currentTeamEntry?.team.id,
  });

  const { data: matchesData, isLoading: matchesLoading } = useQuery({
    queryKey: ['teams', 'matches'],
    queryFn: () => apiClient.get<{ items: TeamMatchDto[] }>(teamRoutes.matches()),
  });

  const invalidateRecruitmentQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['teams', 'recruitments'] });
    queryClient.invalidateQueries({ queryKey: ['teams', 'matches'] });
    queryClient.invalidateQueries({ queryKey: ['teams', 'recruitment-contexts'] });
  };

  const createRecruitmentMutation = useMutation({
    mutationFn: () =>
      apiClient.post(teamRoutes.recruitments(), {
        teamId: selectedTeamId === 'new-solo' ? undefined : selectedTeamId,
        teamName: selectedTeamId === 'new-solo' ? form.teamName || undefined : undefined,
        competitionTrackId: form.competitionTrackId,
        headline: form.headline,
        detailNote: form.detailNote || undefined,
        offerRoles: toArray(form.offerRoles),
        needRoles: toArray(form.needRoles),
        skillTags: toArray(form.skillTags),
        targetTeamSize: form.targetTeamSize ? Number(form.targetTeamSize) : undefined,
        availabilityBand: form.availabilityBand || undefined,
        collaborationMode: form.collaborationMode || undefined,
        timezone: form.timezone || undefined,
        city: form.city || undefined,
        languages: toArray(form.languages),
        intentMode: form.intentMode,
      }),
    onSuccess: () => {
      toast.success(locale === 'zh' ? '组队卡已创建' : 'Recruitment card created');
      invalidateRecruitmentQueries();
      setTab('my-team');
    },
  });

  const updateRecruitmentMutation = useMutation({
    mutationFn: () =>
      apiClient.patch(teamRoutes.recruitmentById(currentCard!.id), {
        competitionTrackId: form.competitionTrackId,
        headline: form.headline,
        detailNote: form.detailNote || undefined,
        offerRoles: toArray(form.offerRoles),
        needRoles: toArray(form.needRoles),
        skillTags: toArray(form.skillTags),
        targetTeamSize: form.targetTeamSize ? Number(form.targetTeamSize) : undefined,
        availabilityBand: form.availabilityBand || undefined,
        collaborationMode: form.collaborationMode || undefined,
        timezone: form.timezone || undefined,
        city: form.city || undefined,
        languages: toArray(form.languages),
        intentMode: form.intentMode,
      }),
    onSuccess: () => {
      toast.success(locale === 'zh' ? '组队卡已更新' : 'Recruitment card updated');
      invalidateRecruitmentQueries();
    },
  });

  const publishMutation = useMutation({
    mutationFn: (cardId: string) => apiClient.post(teamRoutes.recruitmentPublish(cardId)),
    onSuccess: () => {
      toast.success(locale === 'zh' ? '组队卡已发布' : 'Recruitment card published');
      invalidateRecruitmentQueries();
    },
  });

  const closeMutation = useMutation({
    mutationFn: (cardId: string) => apiClient.post(teamRoutes.recruitmentClose(cardId)),
    onSuccess: () => {
      toast.success(locale === 'zh' ? '组队卡已关闭' : 'Recruitment card closed');
      invalidateRecruitmentQueries();
    },
  });

  const memberProfileMutation = useMutation({
    mutationFn: (consentConfirmed: boolean) =>
      apiClient.patch(teamRoutes.recruitmentMemberProfile(currentCard!.id), {
        introLine,
        selectedResumeId: selectedResumeId === 'none' ? null : selectedResumeId,
        showSchool,
        showGrade,
        showAwards,
        consentConfirmed,
      }),
    onSuccess: () => {
      toast.success(locale === 'zh' ? '展示信息已更新' : 'Member display updated');
      invalidateRecruitmentQueries();
    },
  });

  const swipeMutation = useMutation({
    mutationFn: (payload: {
      sourceCardId: string;
      targetCardId: string;
      action: 'LIKE' | 'PASS';
    }) =>
      apiClient.post<{ matched?: boolean; match?: { conversationId?: string | null } }>(
        teamRoutes.recruitmentSwipe(payload.sourceCardId),
        {
          targetCardId: payload.targetCardId,
          action: payload.action,
        }
      ),
    onSuccess: (data: { matched?: boolean; match?: { conversationId?: string | null } }) => {
      invalidateRecruitmentQueries();
      if (data?.matched) {
        toast.success(
          locale === 'zh' ? '互相右滑，已创建群聊' : 'It matched and opened a group chat'
        );
      }
    },
  });

  const matchInviteMutation = useMutation({
    mutationFn: (payload: { matchId: string; inviteeIds: string[]; sourceTeamId?: string }) =>
      apiClient.post<InviteMatchMembersResponseDto>(
        teamRoutes.matchInviteMembers(payload.matchId),
        payload
      ),
    onSuccess: (data, variables) => {
      setInviteResultsByMatchId((prev) => ({
        ...prev,
        [variables.matchId]: data.invitations,
      }));

      const manualShareCount = data.invitations.filter(
        (invitation) => getInviteDeliveryState(invitation) === 'manual_share'
      ).length;

      toast.success(
        manualShareCount > 0 ? t('toast.invitesPartiallyDelivered') : t('toast.invitesDelivered')
      );
    },
  });

  const deckCards = deckData?.items ?? [];
  const activeDeckCard = deckCards[0] ?? null;
  const contextOptions = contextsData?.items ?? [];
  const matches = matchesData?.items ?? [];
  const resumes = resumesData ?? [];

  const handleCopyInviteLink = async (inviteUrl: string) => {
    try {
      const absoluteUrl =
        typeof window === 'undefined'
          ? inviteUrl
          : new URL(inviteUrl, window.location.origin).toString();
      await navigator.clipboard.writeText(absoluteUrl);
      setCopiedInviteUrl(absoluteUrl);
      toast.success(t('toast.linkCopied'));
    } catch {
      toast.error(t('toast.copyInviteLinkFailed'));
    }
  };

  return (
    <PageContainer maxWidth="7xl">
      <PageHeader
        title={t('title')}
        description={
          locale === 'zh'
            ? '比赛组队匹配与成队工作台'
            : 'Competition recruitment matching workspace'
        }
        icon={Users}
        color="amber"
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="mt-6">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="match">{locale === 'zh' ? 'Match' : 'Match'}</TabsTrigger>
          <TabsTrigger value="matches">{locale === 'zh' ? 'Matches' : 'Matches'}</TabsTrigger>
          <TabsTrigger value="my-team">{locale === 'zh' ? 'My Team' : 'My Team'}</TabsTrigger>
        </TabsList>

        <TabsContent value="match" className="mt-6">
          {!currentCard ? (
            <EmptyState
              type="teams"
              title={
                locale === 'zh'
                  ? '先创建并发布一张组队卡'
                  : 'Create and publish a recruitment card first'
              }
              action={{
                label: locale === 'zh' ? '前往 My Team' : 'Open My Team',
                onClick: () => setTab('my-team'),
              }}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <Card className="overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
                <CardHeader>
                  <CardTitle>{locale === 'zh' ? 'Swipe Deck' : 'Swipe Deck'}</CardTitle>
                  <CardDescription>
                    {locale === 'zh'
                      ? '只会发同比赛同赛道且人数兼容的卡。'
                      : 'Deck only includes compatible cards from the same competition track.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {deckLoading ? (
                    <Skeleton className="h-[420px] w-full rounded-xl" />
                  ) : activeDeckCard ? (
                    <div className="space-y-4">
                      <RecruitmentCardPreview card={activeDeckCard} locale={locale} />
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          className="flex-1 gap-2"
                          disabled={swipeMutation.isPending}
                          onClick={() =>
                            swipeMutation.mutate({
                              sourceCardId: currentCard.id,
                              targetCardId: activeDeckCard.id,
                              action: 'PASS',
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                          {locale === 'zh' ? '左滑' : 'Pass'}
                        </Button>
                        <Button
                          className="flex-1 gap-2 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600"
                          disabled={swipeMutation.isPending}
                          onClick={() =>
                            swipeMutation.mutate({
                              sourceCardId: currentCard.id,
                              targetCardId: activeDeckCard.id,
                              action: 'LIKE',
                            })
                          }
                        >
                          <Heart className="h-4 w-4" />
                          {locale === 'zh' ? '右滑' : 'Like'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      type="teams"
                      title={locale === 'zh' ? '当前牌堆为空' : 'Deck is empty'}
                      action={{
                        label: locale === 'zh' ? '刷新' : 'Refresh',
                        onClick: () =>
                          queryClient.invalidateQueries({
                            queryKey: ['teams', 'recruitments', 'deck'],
                          }),
                      }}
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{locale === 'zh' ? '当前我的卡' : 'Current Card'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <RecruitmentCardPreview card={currentCard} locale={locale} compact />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="matches" className="mt-6">
          {matchesLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {[1, 2].map((item) => (
                <Skeleton key={item} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : matches.length === 0 ? (
            <EmptyState
              type="teams"
              title={locale === 'zh' ? '还没有新的匹配' : 'No matches yet'}
              action={{
                label: locale === 'zh' ? '去划卡' : 'Open deck',
                onClick: () => setTab('match'),
              }}
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {matches.map((match) => (
                <Card key={match.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{match.otherCard.team.name}</CardTitle>
                        <CardDescription>
                          {match.otherCard.context.competition.abbreviation} /{' '}
                          {match.otherCard.context.trackName}
                        </CardDescription>
                      </div>
                      <Badge variant="secondary">
                        {match.matchKind === 'TEAM_UP'
                          ? locale === 'zh'
                            ? '可组队'
                            : 'Team up'
                          : locale === 'zh'
                            ? '交流'
                            : 'Networking'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RecruitmentCardPreview card={match.otherCard} locale={locale} compact />
                    <div className="flex gap-3">
                      {match.conversationId && (
                        <Button
                          className="flex-1 gap-2"
                          onClick={() => router.push(`/chat?conversation=${match.conversationId}`)}
                        >
                          <MessageSquare className="h-4 w-4" />
                          {locale === 'zh' ? '进入群聊' : 'Open chat'}
                        </Button>
                      )}
                      {match.canInvite && match.otherCard.members.length > 0 && (
                        <Button
                          variant="outline"
                          className="flex-1"
                          disabled={
                            matchInviteMutation.isPending &&
                            matchInviteMutation.variables?.matchId === match.id
                          }
                          onClick={() =>
                            matchInviteMutation.mutate({
                              matchId: match.id,
                              inviteeIds: match.otherCard.members.map((member) => member.userId),
                              sourceTeamId: match.myCard.team.id,
                            })
                          }
                        >
                          {locale === 'zh' ? '邀请对方入队' : 'Invite to my team'}
                        </Button>
                      )}
                    </div>
                    {inviteResultsByMatchId[match.id]?.length ? (
                      <div className="rounded-xl border bg-muted/30 p-3">
                        <p className="text-sm font-medium">{t('inviteResults.title')}</p>
                        <div className="mt-3 space-y-2">
                          {inviteResultsByMatchId[match.id].map((invitation) => {
                            const invitee = match.otherCard.members.find(
                              (member) => member.userId === invitation.inviteeId
                            );
                            const inviteUrl = invitation.inviteUrl
                              ? typeof window === 'undefined'
                                ? invitation.inviteUrl
                                : new URL(invitation.inviteUrl, window.location.origin).toString()
                              : null;
                            const deliveryState = getInviteDeliveryState(invitation);

                            return (
                              <div
                                key={`${match.id}-${invitation.inviteeId}`}
                                className="flex items-center justify-between gap-3 rounded-lg bg-background/70 p-2.5"
                              >
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {invitee?.displayName ?? invitation.inviteeId}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {deliveryState === 'sent'
                                      ? t('inviteResults.sent')
                                      : deliveryState === 'existing_pending'
                                        ? t('inviteResults.existingPending')
                                        : deliveryState === 'already_member'
                                          ? t('inviteResults.alreadyMember')
                                          : t('inviteResults.manualShare')}
                                  </p>
                                </div>
                                {inviteUrl ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => handleCopyInviteLink(inviteUrl)}
                                  >
                                    {copiedInviteUrl === inviteUrl ? (
                                      <Check className="h-4 w-4" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                    {t('inviteResults.copyLink')}
                                  </Button>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-team" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>
                  {locale === 'zh' ? '组队卡编辑器' : 'Recruitment Card Editor'}
                </CardTitle>
                <CardDescription>
                  {locale === 'zh'
                    ? '先选择 backing team；如果没有队伍，可以直接创建一张 solo card。'
                    : 'Choose a backing team first. You can also create a solo card directly.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {myRecruitmentsLoading || contextsLoading ? (
                  <Skeleton className="h-[420px] w-full rounded-xl" />
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label={locale === 'zh' ? '绑定队伍' : 'Backing Team'}>
                        <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new-solo">
                              {locale === 'zh' ? '新建 Solo Team' : 'Create Solo Team'}
                            </SelectItem>
                            {(myRecruitments?.items ?? []).map((item) => (
                              <SelectItem key={item.team.id} value={item.team.id}>
                                {item.team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label={locale === 'zh' ? '比赛赛道' : 'Competition Track'}>
                        <Select
                          value={form.competitionTrackId}
                          onValueChange={(value) =>
                            setForm((prev) => ({ ...prev, competitionTrackId: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={locale === 'zh' ? '选择赛道' : 'Select track'}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {contextOptions.map((track) => (
                              <SelectItem key={track.id} value={track.id}>
                                {track.competition.abbreviation} / {track.edition.seasonLabel} /{' '}
                                {track.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>

                    {selectedTeamId === 'new-solo' && (
                      <Field label={locale === 'zh' ? 'Solo 队伍名' : 'Solo Team Name'}>
                        <Input
                          value={form.teamName}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, teamName: event.target.value }))
                          }
                          placeholder={locale === 'zh' ? '默认会自动生成' : 'Optional'}
                        />
                      </Field>
                    )}

                    <Field label={locale === 'zh' ? '首屏摘要' : 'Headline'}>
                      <Input
                        value={form.headline}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, headline: event.target.value }))
                        }
                        placeholder={
                          locale === 'zh'
                            ? '几秒内让对方知道你想做什么'
                            : 'Make the value proposition obvious in seconds'
                        }
                      />
                    </Field>

                    <Field label={locale === 'zh' ? '详细说明' : 'Detail Note'}>
                      <Textarea
                        value={form.detailNote}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, detailNote: event.target.value }))
                        }
                        rows={5}
                        placeholder={
                          locale === 'zh'
                            ? '补充赛题理解、协作方式、亮点经历'
                            : 'Add context, working style, and highlight experience'
                        }
                      />
                    </Field>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label={locale === 'zh' ? '我能提供' : 'Offer Roles'}>
                        <Input
                          value={form.offerRoles}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, offerRoles: event.target.value }))
                          }
                          placeholder={
                            locale === 'zh' ? '建模, 编程, 答辩' : 'Modeling, Coding, Pitching'
                          }
                        />
                      </Field>
                      <Field label={locale === 'zh' ? '我需要' : 'Need Roles'}>
                        <Input
                          value={form.needRoles}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, needRoles: event.target.value }))
                          }
                          placeholder={locale === 'zh' ? '文案, 设计, PM' : 'Writing, Design, PM'}
                        />
                      </Field>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label={locale === 'zh' ? '技能标签' : 'Skill Tags'}>
                        <Input
                          value={form.skillTags}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, skillTags: event.target.value }))
                          }
                          placeholder={
                            locale === 'zh' ? 'Python, Latex, Figma' : 'Python, Latex, Figma'
                          }
                        />
                      </Field>
                      <Field label={locale === 'zh' ? '目标人数' : 'Target Size'}>
                        <Input
                          value={form.targetTeamSize}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, targetTeamSize: event.target.value }))
                          }
                          type="number"
                          min={2}
                        />
                      </Field>
                      <Field label={locale === 'zh' ? '模式' : 'Intent'}>
                        <Select
                          value={form.intentMode}
                          onValueChange={(value: 'TEAM_UP' | 'NETWORKING_ONLY') =>
                            setForm((prev) => ({ ...prev, intentMode: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TEAM_UP">
                              {locale === 'zh' ? '正式组队' : 'Team up'}
                            </SelectItem>
                            <SelectItem value="NETWORKING_ONLY">
                              {locale === 'zh' ? '仅交流' : 'Networking only'}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>

                    <div className="grid gap-4 md:grid-cols-4">
                      <Field label={locale === 'zh' ? '投入' : 'Availability'}>
                        <Select
                          value={form.availabilityBand || 'none'}
                          onValueChange={(value) =>
                            setForm((prev) => ({
                              ...prev,
                              availabilityBand: value === 'none' ? '' : value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              {locale === 'zh' ? '未设置' : 'Unset'}
                            </SelectItem>
                            <SelectItem value="LESS_THAN_5_HOURS">{'<5h'}</SelectItem>
                            <SelectItem value="FIVE_TO_TEN_HOURS">{'5-10h'}</SelectItem>
                            <SelectItem value="TEN_PLUS_HOURS">{'10h+'}</SelectItem>
                            <SelectItem value="WEEKENDS_ONLY">
                              {locale === 'zh' ? '仅周末' : 'Weekends only'}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label={locale === 'zh' ? '协作方式' : 'Mode'}>
                        <Select
                          value={form.collaborationMode || 'none'}
                          onValueChange={(value) =>
                            setForm((prev) => ({
                              ...prev,
                              collaborationMode: value === 'none' ? '' : value,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              {locale === 'zh' ? '未设置' : 'Unset'}
                            </SelectItem>
                            <SelectItem value="ONLINE">
                              {locale === 'zh' ? '线上' : 'Online'}
                            </SelectItem>
                            <SelectItem value="OFFLINE">
                              {locale === 'zh' ? '线下' : 'Offline'}
                            </SelectItem>
                            <SelectItem value="HYBRID">
                              {locale === 'zh' ? '混合' : 'Hybrid'}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Timezone">
                        <Input
                          value={form.timezone}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, timezone: event.target.value }))
                          }
                          placeholder="UTC+8"
                        />
                      </Field>
                      <Field label={locale === 'zh' ? '城市' : 'City'}>
                        <Input
                          value={form.city}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, city: event.target.value }))
                          }
                          placeholder={
                            locale === 'zh' ? '北京 / 上海 / Remote' : 'SF / NYC / Remote'
                          }
                        />
                      </Field>
                    </div>

                    <Field label={locale === 'zh' ? '语言' : 'Languages'}>
                      <Input
                        value={form.languages}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, languages: event.target.value }))
                        }
                        placeholder={locale === 'zh' ? '中文, English' : 'English, 中文'}
                      />
                    </Field>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() =>
                          currentCard
                            ? updateRecruitmentMutation.mutate()
                            : createRecruitmentMutation.mutate()
                        }
                        disabled={
                          createRecruitmentMutation.isPending ||
                          updateRecruitmentMutation.isPending ||
                          !form.competitionTrackId ||
                          !form.headline.trim()
                        }
                      >
                        {currentCard
                          ? locale === 'zh'
                            ? '保存组队卡'
                            : 'Save card'
                          : locale === 'zh'
                            ? '创建组队卡'
                            : 'Create card'}
                      </Button>
                      {currentCard && (
                        <>
                          <Button
                            variant="secondary"
                            disabled={publishMutation.isPending}
                            onClick={() => publishMutation.mutate(currentCard.id)}
                          >
                            {locale === 'zh' ? '发布' : 'Publish'}
                          </Button>
                          <Button
                            variant="outline"
                            disabled={closeMutation.isPending}
                            onClick={() => closeMutation.mutate(currentCard.id)}
                          >
                            {locale === 'zh' ? '关闭' : 'Close'}
                          </Button>
                        </>
                      )}
                      <Button variant="outline" onClick={() => router.push('/teams/create')}>
                        {locale === 'zh' ? '传统 Team 设置页' : 'Open legacy team settings'}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{locale === 'zh' ? '我的展示信息' : 'My Display Settings'}</CardTitle>
                  <CardDescription>
                    {locale === 'zh'
                      ? '发布前每个成员都要确认自己的展示配置。'
                      : 'Every member has to confirm their own display settings before publish.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field label={locale === 'zh' ? '一句话介绍' : 'Intro Line'}>
                    <Input
                      value={introLine}
                      onChange={(event) => setIntroLine(event.target.value)}
                    />
                  </Field>
                  <Field label={locale === 'zh' ? '展示简历' : 'Selected Resume'}>
                    <Select value={selectedResumeId} onValueChange={setSelectedResumeId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {locale === 'zh' ? '不展示简历' : 'No resume'}
                        </SelectItem>
                        {resumes.map((resume) => (
                          <SelectItem key={resume.id} value={resume.id}>
                            {resume.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <ToggleBadge
                      active={showSchool}
                      onClick={() => setShowSchool((value) => !value)}
                      icon={ShieldCheck}
                      label={locale === 'zh' ? '展示学校' : 'Show school'}
                    />
                    <ToggleBadge
                      active={showGrade}
                      onClick={() => setShowGrade((value) => !value)}
                      icon={Clock3}
                      label={locale === 'zh' ? '展示年级' : 'Show grade'}
                    />
                    <ToggleBadge
                      active={showAwards}
                      onClick={() => setShowAwards((value) => !value)}
                      icon={Sparkles}
                      label={locale === 'zh' ? '展示奖项' : 'Show awards'}
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      disabled={!currentCard || memberProfileMutation.isPending}
                      onClick={() => memberProfileMutation.mutate(false)}
                    >
                      {locale === 'zh' ? '仅保存' : 'Save'}
                    </Button>
                    <Button
                      disabled={!currentCard || memberProfileMutation.isPending}
                      onClick={() => memberProfileMutation.mutate(true)}
                    >
                      {locale === 'zh' ? '确认并同意展示' : 'Confirm consent'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>
                    {locale === 'zh' ? '当前卡片概览' : 'Current Card Overview'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {currentCard ? (
                    <RecruitmentCardPreview card={currentCard} locale={locale} />
                  ) : (
                    <EmptyState
                      type="teams"
                      title={locale === 'zh' ? '还没有组队卡' : 'No recruitment card yet'}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function RecruitmentCardPreview({
  card,
  locale,
  compact = false,
}: {
  card: TeamRecruitmentCardFrontDto;
  locale: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br from-background to-amber-50/70 dark:to-amber-950/30 p-5 ${compact ? 'space-y-3' : 'space-y-4'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {card.context.competition.abbreviation} / {card.context.trackName}
          </p>
          <h3 className="text-lg font-semibold">{card.team.name}</h3>
          <p className="text-sm text-muted-foreground">{card.headline}</p>
        </div>
        <Badge variant={card.status === 'CLOSED' ? 'secondary' : 'default'}>{card.status}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          <Target className="mr-1 h-3 w-3" />
          {card.team.currentSize}/{card.team.targetSize}
        </Badge>
        {card.availabilityBand && <Badge variant="outline">{card.availabilityBand}</Badge>}
        {card.collaborationMode && <Badge variant="outline">{card.collaborationMode}</Badge>}
        {card.timezone && <Badge variant="outline">{card.timezone}</Badge>}
      </div>

      <CardBlock title={locale === 'zh' ? '我能提供' : 'Offer'} items={card.offerRoles} />
      <CardBlock title={locale === 'zh' ? '我需要' : 'Need'} items={card.needRoles} />
      <CardBlock title={locale === 'zh' ? '技能' : 'Skills'} items={card.skillTags} />

      {!compact && card.members.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{locale === 'zh' ? '成员摘要' : 'Members'}</p>
          <div className="grid gap-2">
            {card.members.map((member) => (
              <div key={member.userId} className="rounded-xl border bg-background/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{member.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.introLine || member.targetMajor || member.role}
                    </p>
                  </div>
                  {member.consentConfirmedAt && (
                    <Badge variant="secondary">{locale === 'zh' ? '已确认' : 'Confirmed'}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {card.detailNote && !compact && (
        <div className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
          {card.detailNote}
        </div>
      )}
    </div>
  );
}

function CardBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.length > 0 ? (
          items.map((item) => (
            <Badge key={item} variant="secondary">
              {item}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      {children}
    </div>
  );
}

function ToggleBadge({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof ShieldCheck;
  label: string;
}) {
  return (
    <button type="button" onClick={onClick}>
      <Badge variant={active ? 'default' : 'outline'} className="gap-1.5 px-3 py-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Badge>
    </button>
  );
}

function toArray(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
