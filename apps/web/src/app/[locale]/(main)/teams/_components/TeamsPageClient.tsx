'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
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
import { RecruitmentSwipeDeck } from '@/components/features/teams/RecruitmentSwipeDeck';

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
  const router = useRouter();
  const queryClient = useQueryClient();
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const accessToken = useAuthStore((state) => state.accessToken);

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
    enabled: !!accessToken,
  });

  const { data: myRecruitments, isLoading: myRecruitmentsLoading } = useQuery({
    queryKey: ['teams', 'recruitments', 'my'],
    queryFn: () => apiClient.get<MyRecruitmentsResponse>(teamRoutes.myRecruitments()),
    enabled: !!accessToken,
  });

  const { data: resumesData } = useQuery({
    queryKey: ['resumes', 'options'],
    queryFn: () => apiClient.get<ResumeOption[]>(resumeRoutes.list()),
    enabled: !!accessToken,
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
    enabled: !!accessToken && !!currentTeamEntry?.team.id,
  });

  const { data: matchesData, isLoading: matchesLoading } = useQuery({
    queryKey: ['teams', 'matches'],
    queryFn: () => apiClient.get<{ items: TeamMatchDto[] }>(teamRoutes.matches()),
    enabled: !!accessToken,
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
      toast.success(t('recruitment.toast.cardCreated'));
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
      toast.success(t('recruitment.toast.cardUpdated'));
      invalidateRecruitmentQueries();
    },
  });

  const publishMutation = useMutation({
    mutationFn: (cardId: string) => apiClient.post(teamRoutes.recruitmentPublish(cardId)),
    onSuccess: () => {
      toast.success(t('recruitment.toast.cardPublished'));
      invalidateRecruitmentQueries();
    },
  });

  const closeMutation = useMutation({
    mutationFn: (cardId: string) => apiClient.post(teamRoutes.recruitmentClose(cardId)),
    onSuccess: () => {
      toast.success(t('recruitment.toast.cardClosed'));
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
      toast.success(t('recruitment.toast.displayUpdated'));
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
        toast.success(t('recruitment.toast.matched'));
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
        description={t('recruitment.description')}
        icon={Users}
        color="amber"
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)} className="mt-6">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="match">{t('recruitment.tab.match')}</TabsTrigger>
          <TabsTrigger value="matches">{t('recruitment.tab.matches')}</TabsTrigger>
          <TabsTrigger value="my-team">{t('recruitment.tab.myTeam')}</TabsTrigger>
        </TabsList>

        <TabsContent value="match" className="mt-6">
          {!currentCard ? (
            <EmptyState
              type="teams"
              title={t('recruitment.empty.noCard')}
              action={{
                label: t('recruitment.tab.myTeam'),
                onClick: () => setTab('my-team'),
              }}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] items-start">
              <RecruitmentSwipeDeck
                cards={deckCards}
                onSwipe={(cardId, action) =>
                  swipeMutation.mutate({
                    sourceCardId: currentCard.id,
                    targetCardId: cardId,
                    action,
                  })
                }
                onEmpty={() =>
                  queryClient.invalidateQueries({
                    queryKey: ['teams', 'recruitments', 'deck'],
                  })
                }
                isLoading={deckLoading}
                isPending={swipeMutation.isPending}
              />

              <Card className="hidden lg:block sticky top-24">
                <CardHeader>
                  <CardTitle className="text-base">{t('recruitment.currentCard')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <RecruitmentCardPreview card={currentCard} compact />
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
              title={t('recruitment.empty.noMatches')}
              action={{
                label: t('recruitment.openDeck'),
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
                          ? t('recruitment.matchKind.teamUp')
                          : t('recruitment.matchKind.networking')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RecruitmentCardPreview card={match.otherCard} compact />
                    <div className="flex gap-3">
                      {match.conversationId && (
                        <Button
                          className="flex-1 gap-2"
                          onClick={() => router.push(`/chat?conversation=${match.conversationId}`)}
                        >
                          <MessageSquare className="h-4 w-4" />
                          {t('recruitment.openChat')}
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
                          {t('recruitment.inviteToTeam')}
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
                <CardTitle>{t('recruitment.editor.title')}</CardTitle>
                <CardDescription>{t('recruitment.editor.description')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {myRecruitmentsLoading || contextsLoading ? (
                  <Skeleton className="h-[420px] w-full rounded-xl" />
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label={t('recruitment.field.backingTeam')}>
                        <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new-solo">
                              {t('recruitment.field.createSoloTeam')}
                            </SelectItem>
                            {(myRecruitments?.items ?? []).map((item) => (
                              <SelectItem key={item.team.id} value={item.team.id}>
                                {item.team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label={t('recruitment.field.competitionTrack')}>
                        <Select
                          value={form.competitionTrackId}
                          onValueChange={(value) =>
                            setForm((prev) => ({ ...prev, competitionTrackId: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('recruitment.field.selectTrack')} />
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
                      <Field label={t('recruitment.field.soloTeamName')}>
                        <Input
                          value={form.teamName}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, teamName: event.target.value }))
                          }
                          placeholder={t('recruitment.field.soloTeamNamePlaceholder')}
                        />
                      </Field>
                    )}

                    <Field label={t('recruitment.field.headline')}>
                      <Input
                        value={form.headline}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, headline: event.target.value }))
                        }
                        placeholder={t('recruitment.field.headlinePlaceholder')}
                      />
                    </Field>

                    <Field label={t('recruitment.field.detailNote')}>
                      <Textarea
                        value={form.detailNote}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, detailNote: event.target.value }))
                        }
                        rows={5}
                        placeholder={t('recruitment.field.detailNotePlaceholder')}
                      />
                    </Field>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label={t('recruitment.field.offerRoles')}>
                        <Input
                          value={form.offerRoles}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, offerRoles: event.target.value }))
                          }
                          placeholder={t('recruitment.field.offerRolesPlaceholder')}
                        />
                      </Field>
                      <Field label={t('recruitment.field.needRoles')}>
                        <Input
                          value={form.needRoles}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, needRoles: event.target.value }))
                          }
                          placeholder={t('recruitment.field.needRolesPlaceholder')}
                        />
                      </Field>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label={t('recruitment.field.skillTags')}>
                        <Input
                          value={form.skillTags}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, skillTags: event.target.value }))
                          }
                          placeholder={t('recruitment.field.skillTagsPlaceholder')}
                        />
                      </Field>
                      <Field label={t('recruitment.field.targetSize')}>
                        <Input
                          value={form.targetTeamSize}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, targetTeamSize: event.target.value }))
                          }
                          type="number"
                          min={2}
                        />
                      </Field>
                      <Field label={t('recruitment.field.intent')}>
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
                              {t('recruitment.intentMode.teamUp')}
                            </SelectItem>
                            <SelectItem value="NETWORKING_ONLY">
                              {t('recruitment.intentMode.networkingOnly')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>

                    <div className="grid gap-4 md:grid-cols-4">
                      <Field label={t('recruitment.field.availability')}>
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
                            <SelectItem value="none">{t('recruitment.option.unset')}</SelectItem>
                            <SelectItem value="LESS_THAN_5_HOURS">{'<5h'}</SelectItem>
                            <SelectItem value="FIVE_TO_TEN_HOURS">{'5-10h'}</SelectItem>
                            <SelectItem value="TEN_PLUS_HOURS">{'10h+'}</SelectItem>
                            <SelectItem value="WEEKENDS_ONLY">
                              {t('recruitment.option.weekendsOnly')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label={t('recruitment.field.collaborationMode')}>
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
                            <SelectItem value="none">{t('recruitment.option.unset')}</SelectItem>
                            <SelectItem value="ONLINE">{t('recruitment.option.online')}</SelectItem>
                            <SelectItem value="OFFLINE">
                              {t('recruitment.option.offline')}
                            </SelectItem>
                            <SelectItem value="HYBRID">{t('recruitment.option.hybrid')}</SelectItem>
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
                      <Field label={t('recruitment.field.city')}>
                        <Input
                          value={form.city}
                          onChange={(event) =>
                            setForm((prev) => ({ ...prev, city: event.target.value }))
                          }
                          placeholder={t('recruitment.field.cityPlaceholder')}
                        />
                      </Field>
                    </div>

                    <Field label={t('recruitment.field.languages')}>
                      <Input
                        value={form.languages}
                        onChange={(event) =>
                          setForm((prev) => ({ ...prev, languages: event.target.value }))
                        }
                        placeholder={t('recruitment.field.languagesPlaceholder')}
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
                          ? t('recruitment.action.saveCard')
                          : t('recruitment.action.createCard')}
                      </Button>
                      {currentCard && (
                        <>
                          <Button
                            variant="secondary"
                            disabled={publishMutation.isPending}
                            onClick={() => publishMutation.mutate(currentCard.id)}
                          >
                            {t('recruitment.action.publish')}
                          </Button>
                          <Button
                            variant="outline"
                            disabled={closeMutation.isPending}
                            onClick={() => closeMutation.mutate(currentCard.id)}
                          >
                            {t('recruitment.action.close')}
                          </Button>
                        </>
                      )}
                      <Button variant="outline" onClick={() => router.push('/teams/create')}>
                        {t('recruitment.action.legacySettings')}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('recruitment.display.title')}</CardTitle>
                  <CardDescription>{t('recruitment.display.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field label={t('recruitment.display.introLine')}>
                    <Input
                      value={introLine}
                      onChange={(event) => setIntroLine(event.target.value)}
                    />
                  </Field>
                  <Field label={t('recruitment.display.selectedResume')}>
                    <Select value={selectedResumeId} onValueChange={setSelectedResumeId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('recruitment.display.noResume')}</SelectItem>
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
                      label={t('recruitment.display.showSchool')}
                    />
                    <ToggleBadge
                      active={showGrade}
                      onClick={() => setShowGrade((value) => !value)}
                      icon={Clock3}
                      label={t('recruitment.display.showGrade')}
                    />
                    <ToggleBadge
                      active={showAwards}
                      onClick={() => setShowAwards((value) => !value)}
                      icon={Sparkles}
                      label={t('recruitment.display.showAwards')}
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      disabled={!currentCard || memberProfileMutation.isPending}
                      onClick={() => memberProfileMutation.mutate(false)}
                    >
                      {t('recruitment.display.save')}
                    </Button>
                    <Button
                      disabled={!currentCard || memberProfileMutation.isPending}
                      onClick={() => memberProfileMutation.mutate(true)}
                    >
                      {t('recruitment.display.confirmConsent')}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('recruitment.currentCardOverview')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {currentCard ? (
                    <RecruitmentCardPreview card={currentCard} />
                  ) : (
                    <EmptyState type="teams" title={t('recruitment.empty.noCardYet')} />
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
  compact = false,
}: {
  card: TeamRecruitmentCardFrontDto;
  compact?: boolean;
}) {
  const t = useTranslations('teams');
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

      <CardBlock title={t('recruitment.card.offer')} items={card.offerRoles} />
      <CardBlock title={t('recruitment.card.need')} items={card.needRoles} />
      <CardBlock title={t('recruitment.card.skills')} items={card.skillTags} />

      {!compact && card.members.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('recruitment.card.members')}</p>
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
                    <Badge variant="secondary">{t('recruitment.card.confirmed')}</Badge>
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
