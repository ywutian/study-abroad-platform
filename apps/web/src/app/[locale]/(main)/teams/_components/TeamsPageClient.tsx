'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCompetitionTrackLabel,
  getMatchPoolLabel,
  getRecruitmentContext,
  getRecruitmentContextId,
  getRecruitmentContextName,
  resumeRoutes,
  teamRoutes,
  type InviteMatchMembersResponseDto,
  type MatchPoolDto,
  type RecruitmentContextDto,
  type RecruitmentContextItemDto,
  type TeamMatchDto,
  type TeamMatchInviteResultDto,
  type TeamRecruitmentCardFrontDto,
} from '@study-abroad/shared';
import {
  Check,
  Clock3,
  Copy,
  MessageSquare,
  Plus,
  ShieldCheck,
  Lightbulb,
  Target,
  Users,
} from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/layout';
import { apiClient } from '@/lib/api';
import { qk } from '@/lib/query';
import { useAuthReady } from '@/hooks/use-auth-gated-query';
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
import { Link, useRouter } from '@/lib/i18n/navigation';
import { useAuthStore } from '@/stores/auth';
import {
  getCurrentMemberDisplaySettings,
  getInviteDeliveryState,
  getMatchPoolEntrySelectLabel,
  getRecruitmentContextLabel,
  getRecruitmentContextMeta,
  getRecruitmentContextSourceTypeLabel,
  getRecruitmentModerationLabel,
  isCommunityRecruitmentContext,
} from '@/components/features/teams/team-recruitment-utils';
import { RecruitmentSwipeDeck } from '@/components/features/teams/RecruitmentSwipeDeck';
import { trackEvent, trackImpression, TEAM_EVENTS } from '@/lib/analytics';

type TabKey = 'public' | 'private' | 'matches' | 'my-team';

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

type MatchPoolsResponse = {
  items: MatchPoolDto[];
};

type ResumeOption = {
  id: string;
  title: string;
};

type RecruitmentFormState = {
  teamId?: string;
  teamName: string;
  recruitmentContextId: string;
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

type CommunityContextFormState = {
  title: string;
  titleZh: string;
  description: string;
  sourceUrl: string;
  registrationCloseAt: string;
  eventStartAt: string;
  eventEndAt: string;
  locationMode: string;
  locationText: string;
  rolePresets: string;
  minTeamSize: string;
  maxTeamSize: string;
  languages: string;
};

const DEFAULT_FORM: RecruitmentFormState = {
  teamId: undefined,
  teamName: '',
  recruitmentContextId: '',
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

const DEFAULT_COMMUNITY_CONTEXT_FORM: CommunityContextFormState = {
  title: '',
  titleZh: '',
  description: '',
  sourceUrl: '',
  registrationCloseAt: '',
  eventStartAt: '',
  eventEndAt: '',
  locationMode: '',
  locationText: '',
  rolePresets: '',
  minTeamSize: '2',
  maxTeamSize: '4',
  languages: 'English',
};

export function TeamsPageClient() {
  const t = useTranslations('teams');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const authUserId = useAuthStore((state) => state.user?.id ?? null);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthenticated = Boolean(accessToken);
  const authReady = useAuthReady();

  const copy = {
    publicTab: t('recruitment.copy.publicTab'),
    privateTab: t('recruitment.copy.privateTab'),
    matchesTab: t('recruitment.copy.matchesTab'),
    myTeamTab: t('recruitment.copy.myTeamTab'),
    publicTitle: t('recruitment.copy.publicTitle'),
    publicDescription: t('recruitment.copy.publicDescription'),
    privateTitle: t('recruitment.copy.privateTitle'),
    privateDescription: t('recruitment.copy.privateDescription'),
    pool: t('recruitment.copy.pool'),
    poolEntry: t('recruitment.copy.poolEntry'),
    context: t('recruitment.copy.context'),
    myContexts: t('recruitment.copy.myContexts'),
    createContext: t('recruitment.copy.createContext'),
    updateContext: t('recruitment.copy.updateContext'),
    publishContext: t('recruitment.copy.publishContext'),
    openInPublic: t('recruitment.copy.openInPublic'),
    openInPrivate: t('recruitment.copy.openInPrivate'),
    currentSelection: t('recruitment.copy.currentSelection'),
    noPoolEntries: t('recruitment.copy.noPoolEntries'),
    noPublicContext: t('recruitment.copy.noPublicContext'),
    noPrivateContext: t('recruitment.copy.noPrivateContext'),
    sourceUrl: t('recruitment.copy.sourceUrl'),
    registrationCloseAt: t('recruitment.copy.registrationCloseAt'),
    eventStartAt: t('recruitment.copy.eventStartAt'),
    eventEndAt: t('recruitment.copy.eventEndAt'),
    locationMode: t('recruitment.copy.locationMode'),
    locationText: t('recruitment.copy.locationText'),
    rolePresets: t('recruitment.copy.rolePresets'),
    selectContextFirst: t('recruitment.copy.selectContextFirst'),
    existingCards: t('recruitment.copy.existingCards'),
    loadCard: t('recruitment.copy.loadCard'),
    moderationStatus: t('recruitment.copy.moderationStatus'),
    sourceType: t('recruitment.copy.sourceType'),
    communityBadge: t('recruitment.copy.communityBadge'),
    officialBadge: t('recruitment.copy.officialBadge'),
    noCards: t('recruitment.copy.noCards'),
    guestTitle: t('recruitment.guest.title'),
    guestDescription: t('recruitment.guest.description'),
    guestAction: t('recruitment.guest.action'),
  };

  const [tab, setTab] = useState<TabKey>('public');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('new-solo');
  const [selectedPublicPoolId, setSelectedPublicPoolId] = useState('');
  const [selectedPublicEntryId, setSelectedPublicEntryId] = useState('');
  const [selectedPublicContextId, setSelectedPublicContextId] = useState('');
  const [selectedPrivateContextId, setSelectedPrivateContextId] = useState('');
  const [editorContextId, setEditorContextId] = useState('');
  const [form, setForm] = useState<RecruitmentFormState>(DEFAULT_FORM);
  const [communityForm, setCommunityForm] = useState<CommunityContextFormState>(
    DEFAULT_COMMUNITY_CONTEXT_FORM
  );
  const [introLine, setIntroLine] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('none');
  const [showSchool, setShowSchool] = useState(false);
  const [showGrade, setShowGrade] = useState(false);
  const [showAwards, setShowAwards] = useState(false);
  const [showAcademics, setShowAcademics] = useState(false);
  const [showExperiences, setShowExperiences] = useState(false);
  const [showPersonality, setShowPersonality] = useState(false);
  const [inviteResultsByMatchId, setInviteResultsByMatchId] = useState<
    Record<string, TeamMatchInviteResultDto[]>
  >({});
  const [copiedInviteUrl, setCopiedInviteUrl] = useState<string | null>(null);

  const { data: matchPoolsData, isLoading: matchPoolsLoading } = useQuery({
    queryKey: qk.teams.matchPools(),
    queryFn: () => apiClient.get<MatchPoolsResponse>(teamRoutes.matchPools()),
  });

  const { data: selectedPoolDetail, isLoading: selectedPoolLoading } = useQuery({
    queryKey: qk.teams.matchPool(selectedPublicPoolId),
    queryFn: () => apiClient.get<MatchPoolDto>(teamRoutes.matchPoolById(selectedPublicPoolId)),
    enabled: !!selectedPublicPoolId,
  });

  const selectedPublicEntry = useMemo(() => {
    return selectedPoolDetail?.entries?.find((entry) => entry.id === selectedPublicEntryId) ?? null;
  }, [selectedPoolDetail?.entries, selectedPublicEntryId]);

  const selectedOfficialCompetitionId =
    selectedPublicEntry?.competition?.id ?? selectedPublicEntry?.competitionId ?? null;

  const { data: officialContextsData, isLoading: officialContextsLoading } = useQuery({
    queryKey: qk.teams.recruitmentContext('official', selectedOfficialCompetitionId),
    queryFn: () =>
      apiClient.get<RecruitmentContextDto>(
        teamRoutes.recruitmentContextsBySourceTypeAndCompetitionId({
          sourceType: 'OFFICIAL',
          competitionId: selectedOfficialCompetitionId,
        })
      ),
    enabled:
      !!selectedOfficialCompetitionId && selectedPublicEntry?.entryType === 'OFFICIAL_COMPETITION',
  });

  const { data: myCommunityContextsData, isLoading: myCommunityContextsLoading } = useQuery({
    queryKey: qk.teams.communityContexts(),
    queryFn: () => apiClient.get<RecruitmentContextDto>(teamRoutes.communityContexts()),
    enabled: authReady,
  });

  const { data: myRecruitments, isLoading: myRecruitmentsLoading } = useQuery({
    queryKey: qk.teams.recruitmentsMy(),
    queryFn: () => apiClient.get<MyRecruitmentsResponse>(teamRoutes.myRecruitments()),
    enabled: authReady,
  });

  const { data: resumesData } = useQuery({
    queryKey: ['resumes', 'options'],
    queryFn: () => apiClient.get<ResumeOption[]>(resumeRoutes.list()),
    enabled: authReady,
  });

  const currentTeamEntry = useMemo(() => {
    if (!myRecruitments?.items?.length || selectedTeamId === 'new-solo') {
      return null;
    }
    return (
      myRecruitments.items.find((item) => item.team.id === selectedTeamId) ??
      myRecruitments.items[0]
    );
  }, [myRecruitments?.items, selectedTeamId]);

  const currentCard = useMemo(() => {
    if (!currentTeamEntry) return null;
    if (!editorContextId) {
      return currentTeamEntry.recruitmentCards[0] ?? null;
    }
    return (
      currentTeamEntry.recruitmentCards.find(
        (card) => getRecruitmentContextId(card) === editorContextId
      ) ?? null
    );
  }, [currentTeamEntry, editorContextId]);

  const { data: deckData, isLoading: deckLoading } = useQuery({
    queryKey: qk.teams.recruitmentsDeckCard(currentCard?.id),
    queryFn: () =>
      apiClient.get<RecruitmentDeckResponse>(teamRoutes.recruitmentDeck(), {
        params: currentCard?.id ? { cardId: currentCard.id } : undefined,
      }),
    enabled: !!accessToken && !!currentCard?.id && (tab === 'public' || tab === 'private'),
  });

  // Guest-preview deck: fires when user has no published card but has selected
  // a context. Lets new users browse the marketplace before committing to publish.
  const previewContextId = tab === 'public' ? selectedPublicContextId : selectedPrivateContextId;
  const { data: previewDeckData, isLoading: previewDeckLoading } = useQuery({
    queryKey: qk.teams.recruitmentsDeckPreview(previewContextId),
    queryFn: () =>
      apiClient.get<RecruitmentDeckResponse>(teamRoutes.recruitmentDeckPreview(), {
        params: previewContextId ? { recruitmentContextId: previewContextId } : undefined,
      }),
    enabled: !currentCard && !!previewContextId && (tab === 'public' || tab === 'private'),
  });

  const { data: matchesData, isLoading: matchesLoading } = useQuery({
    queryKey: qk.teams.matches(),
    queryFn: () => apiClient.get<{ items: TeamMatchDto[] }>(teamRoutes.matches()),
    enabled: isAuthenticated,
  });

  const publicPools = matchPoolsData?.items ?? [];
  const publicEntries = selectedPoolDetail?.entries ?? [];
  const officialContextOptions = officialContextsData?.items ?? [];
  const privateContexts = myCommunityContextsData?.items ?? [];
  const resumes = resumesData ?? [];
  const matches = matchesData?.items ?? [];
  const deckCards = deckData?.items ?? [];
  const previewDeckCards = previewDeckData?.items ?? [];
  const isPreviewMode = !currentCard && previewDeckCards.length > 0;

  // Funnel: emit a deduped impression event for each card the deck surfaces.
  useEffect(() => {
    const cards = currentCard ? deckCards : previewDeckCards;
    cards.forEach((card, position) => {
      const contextId = currentCard?.context?.trackId ?? previewContextId ?? 'unknown';
      trackImpression(`impression:${card.id}:${card.version}`, TEAM_EVENTS.cardImpression, {
        cardId: card.id,
        contextId,
        competitionAbbr: card.context?.competition?.abbreviation ?? null,
        isPreview: !currentCard,
        position,
      });
    });
  }, [currentCard, deckCards, previewDeckCards, previewContextId]);

  const knownContexts = useMemo(() => {
    const map = new Map<string, RecruitmentContextItemDto>();

    for (const context of officialContextOptions) {
      map.set(context.id, context);
    }
    for (const context of privateContexts) {
      map.set(context.id, context);
    }
    if (selectedPublicEntry?.recruitmentContext?.id) {
      map.set(selectedPublicEntry.recruitmentContext.id, selectedPublicEntry.recruitmentContext);
    }
    for (const item of myRecruitments?.items ?? []) {
      for (const card of item.recruitmentCards) {
        const context = getRecruitmentContext(card);
        if (context?.id) {
          map.set(context.id, context);
        }
      }
    }

    return Array.from(map.values());
  }, [officialContextOptions, privateContexts, selectedPublicEntry, myRecruitments?.items]);

  const activeContext =
    knownContexts.find((context) => context.id === editorContextId) ??
    getRecruitmentContext(currentCard) ??
    null;

  useEffect(() => {
    if (!isAuthenticated && tab !== 'public') {
      setTab('public');
    }
  }, [isAuthenticated, tab]);

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
    if (!publicPools.length) return;
    if (!publicPools.some((pool) => pool.id === selectedPublicPoolId)) {
      setSelectedPublicPoolId(publicPools[0].id);
    }
  }, [publicPools, selectedPublicPoolId]);

  // Funnel event: fire whenever the active pool changes (tab=public only).
  useEffect(() => {
    if (tab !== 'public' || !selectedPublicPoolId) return;
    const pool = publicPools.find((p) => p.id === selectedPublicPoolId);
    if (!pool) return;
    trackEvent(TEAM_EVENTS.poolViewed, {
      poolId: pool.id,
      poolName: pool.name,
    });
  }, [tab, selectedPublicPoolId, publicPools]);

  useEffect(() => {
    if (!publicEntries.length) {
      setSelectedPublicEntryId('');
      return;
    }
    if (!publicEntries.some((entry) => entry.id === selectedPublicEntryId)) {
      setSelectedPublicEntryId(publicEntries[0].id);
    }
  }, [publicEntries, selectedPublicEntryId]);

  useEffect(() => {
    if (!selectedPublicEntry) return;

    if (selectedPublicEntry.entryType === 'PROMOTED_COMMUNITY_CONTEXT') {
      const promotedContextId = selectedPublicEntry.recruitmentContext?.id ?? '';
      setSelectedPublicContextId(promotedContextId);
      return;
    }

    if (selectedPublicEntry.entryType === 'OFFICIAL_COMPETITION') {
      if (!officialContextOptions.length) {
        setSelectedPublicContextId('');
        return;
      }
      if (!officialContextOptions.some((context) => context.id === selectedPublicContextId)) {
        setSelectedPublicContextId(officialContextOptions[0].id);
      }
    }
  }, [selectedPublicEntry, officialContextOptions, selectedPublicContextId]);

  useEffect(() => {
    if (!privateContexts.length) {
      if (selectedPrivateContextId) {
        setSelectedPrivateContextId('');
      }
      return;
    }
    if (!privateContexts.some((context) => context.id === selectedPrivateContextId)) {
      setSelectedPrivateContextId(privateContexts[0].id);
    }
  }, [privateContexts, selectedPrivateContextId]);

  useEffect(() => {
    if (tab === 'public' && selectedPublicContextId) {
      setEditorContextId(selectedPublicContextId);
      setForm((prev) => ({ ...prev, recruitmentContextId: selectedPublicContextId }));
    }
  }, [tab, selectedPublicContextId]);

  useEffect(() => {
    if (tab === 'private' && selectedPrivateContextId) {
      setEditorContextId(selectedPrivateContextId);
      setForm((prev) => ({ ...prev, recruitmentContextId: selectedPrivateContextId }));
    }
  }, [tab, selectedPrivateContextId]);

  useEffect(() => {
    const selectedPrivateContext =
      privateContexts.find((context) => context.id === selectedPrivateContextId) ?? null;
    if (!selectedPrivateContext) {
      setCommunityForm(DEFAULT_COMMUNITY_CONTEXT_FORM);
      return;
    }
    setCommunityForm({
      title: selectedPrivateContext.title ?? selectedPrivateContext.name ?? '',
      titleZh: selectedPrivateContext.titleZh ?? '',
      description: selectedPrivateContext.description ?? '',
      sourceUrl: selectedPrivateContext.sourceUrl ?? '',
      registrationCloseAt: formatDateTimeInput(selectedPrivateContext.registrationCloseAt),
      eventStartAt: formatDateTimeInput(selectedPrivateContext.eventStartAt),
      eventEndAt: formatDateTimeInput(selectedPrivateContext.eventEndAt),
      locationMode: selectedPrivateContext.locationMode ?? '',
      locationText: selectedPrivateContext.locationText ?? '',
      rolePresets: (selectedPrivateContext.rolePresets ?? []).join(', '),
      minTeamSize: String(selectedPrivateContext.minTeamSize ?? 2),
      maxTeamSize: String(selectedPrivateContext.maxTeamSize ?? 4),
      languages: (selectedPrivateContext.languages ?? []).join(', '),
    });
  }, [privateContexts, selectedPrivateContextId]);

  useEffect(() => {
    if (currentCard) {
      setForm({
        teamId: currentTeamEntry?.team.id,
        teamName: currentTeamEntry?.team.name ?? '',
        recruitmentContextId: getRecruitmentContextId(currentCard) ?? '',
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
      return;
    }

    setForm((prev) => ({
      ...DEFAULT_FORM,
      recruitmentContextId: editorContextId,
      teamId: selectedTeamId === 'new-solo' ? undefined : selectedTeamId,
      teamName: selectedTeamId === 'new-solo' ? prev.teamName : (currentTeamEntry?.team.name ?? ''),
      targetTeamSize: activeContext ? String(activeContext.maxTeamSize) : prev.targetTeamSize,
    }));
  }, [
    activeContext,
    currentCard,
    currentTeamEntry?.team.id,
    currentTeamEntry?.team.name,
    editorContextId,
    selectedTeamId,
  ]);

  useEffect(() => {
    const displaySettings = getCurrentMemberDisplaySettings(currentCard, authUserId);
    setIntroLine(displaySettings.introLine);
    setSelectedResumeId(displaySettings.selectedResumeId);
    setShowSchool(displaySettings.showSchool);
    setShowGrade(displaySettings.showGrade);
    setShowAwards(displaySettings.showAwards);
    setShowAcademics(displaySettings.showAcademics);
    setShowExperiences(displaySettings.showExperiences);
    setShowPersonality(displaySettings.showPersonality);
  }, [authUserId, currentCard]);

  const invalidateRecruitmentQueries = () => {
    queryClient.invalidateQueries({ queryKey: qk.teams.all });
  };

  const createCommunityContextMutation = useMutation({
    mutationFn: () =>
      apiClient.post<RecruitmentContextItemDto>(teamRoutes.communityContexts(), {
        title: communityForm.title,
        titleZh: communityForm.titleZh || undefined,
        description: communityForm.description || undefined,
        sourceUrl: communityForm.sourceUrl || undefined,
        registrationCloseAt: communityForm.registrationCloseAt || undefined,
        eventStartAt: communityForm.eventStartAt || undefined,
        eventEndAt: communityForm.eventEndAt || undefined,
        locationMode: communityForm.locationMode || undefined,
        locationText: communityForm.locationText || undefined,
        rolePresets: toArray(communityForm.rolePresets),
        minTeamSize: Number(communityForm.minTeamSize),
        maxTeamSize: Number(communityForm.maxTeamSize),
        languages: toArray(communityForm.languages),
      }),
    onSuccess: (context) => {
      setSelectedPrivateContextId(context.id);
      setEditorContextId(context.id);
      setForm((prev) => ({
        ...prev,
        recruitmentContextId: context.id,
        targetTeamSize: String(context.maxTeamSize),
      }));
      invalidateRecruitmentQueries();
      toast.success(t('recruitment.toast.contextCreated'));
    },
  });

  const updateCommunityContextMutation = useMutation({
    mutationFn: () =>
      apiClient.patch<RecruitmentContextItemDto>(
        teamRoutes.communityContextById(selectedPrivateContextId),
        {
          title: communityForm.title || undefined,
          titleZh: communityForm.titleZh || undefined,
          description: communityForm.description || undefined,
          sourceUrl: communityForm.sourceUrl || undefined,
          registrationCloseAt: communityForm.registrationCloseAt || undefined,
          eventStartAt: communityForm.eventStartAt || undefined,
          eventEndAt: communityForm.eventEndAt || undefined,
          locationMode: communityForm.locationMode || undefined,
          locationText: communityForm.locationText || undefined,
          rolePresets: toArray(communityForm.rolePresets),
          minTeamSize: Number(communityForm.minTeamSize),
          maxTeamSize: Number(communityForm.maxTeamSize),
          languages: toArray(communityForm.languages),
        }
      ),
    onSuccess: (context) => {
      setSelectedPrivateContextId(context.id);
      invalidateRecruitmentQueries();
      toast.success(t('recruitment.toast.contextUpdated'));
    },
  });

  const publishCommunityContextMutation = useMutation({
    mutationFn: () =>
      apiClient.post<RecruitmentContextItemDto>(
        teamRoutes.communityContextPublish(selectedPrivateContextId)
      ),
    onSuccess: () => {
      invalidateRecruitmentQueries();
      toast.success(t('recruitment.toast.contextPublished'));
    },
  });

  const createRecruitmentMutation = useMutation({
    mutationFn: () =>
      apiClient.post<TeamRecruitmentCardFrontDto>(teamRoutes.recruitments(), {
        teamId: selectedTeamId === 'new-solo' ? undefined : selectedTeamId,
        teamName: selectedTeamId === 'new-solo' ? form.teamName || undefined : undefined,
        recruitmentContextId: form.recruitmentContextId,
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
    onSuccess: (card) => {
      const nextContextId = getRecruitmentContextId(card) ?? form.recruitmentContextId;
      setSelectedTeamId(card.team.id);
      setEditorContextId(nextContextId);
      if (isCommunityRecruitmentContext(card)) {
        setSelectedPrivateContextId(nextContextId);
        setTab('private');
      } else {
        setSelectedPublicContextId(nextContextId);
        setTab('public');
      }
      invalidateRecruitmentQueries();
      toast.success(t('recruitment.toast.cardCreated'));
      trackEvent(TEAM_EVENTS.cardCreated, {
        contextId: nextContextId,
        headlineLen: form.headline.length,
        intentMode: form.intentMode,
        isSolo: selectedTeamId === 'new-solo',
      });
    },
  });

  const updateRecruitmentMutation = useMutation({
    mutationFn: () =>
      apiClient.patch<TeamRecruitmentCardFrontDto>(teamRoutes.recruitmentById(currentCard!.id), {
        recruitmentContextId: form.recruitmentContextId,
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
    onSuccess: (card) => {
      setEditorContextId(getRecruitmentContextId(card) ?? form.recruitmentContextId);
      invalidateRecruitmentQueries();
      toast.success(t('recruitment.toast.cardUpdated'));
    },
  });

  const publishMutation = useMutation({
    mutationFn: (cardId: string) => apiClient.post(teamRoutes.recruitmentPublish(cardId)),
    onSuccess: (_data, cardId) => {
      invalidateRecruitmentQueries();
      toast.success(t('recruitment.toast.cardPublished'));
      trackEvent(TEAM_EVENTS.cardPublished, {
        cardId,
        memberCount: currentCard?.members.length ?? null,
      });
    },
  });

  const closeMutation = useMutation({
    mutationFn: (cardId: string) => apiClient.post(teamRoutes.recruitmentClose(cardId)),
    onSuccess: () => {
      invalidateRecruitmentQueries();
      toast.success(t('recruitment.toast.cardClosed'));
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
        showAcademics,
        showExperiences,
        showPersonality,
        consentConfirmed,
      }),
    onSuccess: () => {
      invalidateRecruitmentQueries();
      toast.success(t('recruitment.toast.displayUpdated'));
    },
  });

  const swipeMutation = useMutation({
    mutationFn: (payload: {
      sourceCardId: string;
      targetCardId: string;
      action: 'LIKE' | 'PASS';
    }) =>
      apiClient.post<{
        matched?: boolean;
        match?: { id?: string; matchKind?: string; conversationId?: string | null };
      }>(teamRoutes.recruitmentSwipe(payload.sourceCardId), {
        targetCardId: payload.targetCardId,
        action: payload.action,
      }),
    onSuccess: (data, variables) => {
      invalidateRecruitmentQueries();
      trackEvent(TEAM_EVENTS.cardSwiped, {
        sourceCardId: variables.sourceCardId,
        targetCardId: variables.targetCardId,
        action: variables.action,
        matched: Boolean(data?.matched),
      });
      if (data?.matched) {
        toast.success(t('recruitment.toast.matched'));
        trackEvent(TEAM_EVENTS.matchActivated, {
          matchId: data.match?.id ?? null,
          matchKind: data.match?.matchKind ?? null,
        });
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

  const activeDeckCard = deckCards[0] ?? null;

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

  const selectedPrivateContext =
    privateContexts.find((context) => context.id === selectedPrivateContextId) ?? null;

  const publicContextSelection =
    selectedPublicEntry?.entryType === 'PROMOTED_COMMUNITY_CONTEXT'
      ? (selectedPublicEntry.recruitmentContext ?? null)
      : (officialContextOptions.find((context) => context.id === selectedPublicContextId) ?? null);

  const currentContextLabel = activeContext ? getRecruitmentContextName(activeContext, locale) : '';
  const currentContextMeta = activeContext ? getRecruitmentContextMeta(activeContext, locale) : '';

  return (
    <PageContainer maxWidth="7xl" variant="community">
      <PageHeader
        title={t('title')}
        description={t('recruitment.description')}
        icon={Users}
        variant="community"
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="mt-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="public">{copy.publicTab}</TabsTrigger>
          <TabsTrigger value="private" disabled={!isAuthenticated}>
            {copy.privateTab}
          </TabsTrigger>
          <TabsTrigger value="matches" disabled={!isAuthenticated}>
            {copy.matchesTab}
          </TabsTrigger>
          <TabsTrigger value="my-team" disabled={!isAuthenticated}>
            {copy.myTeamTab}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="public" className="mt-6">
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{copy.publicTitle}</CardTitle>
                  <CardDescription>{copy.publicDescription}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {matchPoolsLoading || selectedPoolLoading ? (
                    <Skeleton className="h-40 rounded-xl" />
                  ) : (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label={copy.pool}>
                          <Select
                            value={selectedPublicPoolId}
                            onValueChange={setSelectedPublicPoolId}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={copy.pool} />
                            </SelectTrigger>
                            <SelectContent>
                              {publicPools.map((pool) => (
                                <SelectItem key={pool.id} value={pool.id}>
                                  {getMatchPoolLabel(pool, locale)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label={copy.poolEntry}>
                          {publicEntries.length > 0 ? (
                            <Select
                              value={selectedPublicEntryId}
                              onValueChange={setSelectedPublicEntryId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={copy.poolEntry} />
                              </SelectTrigger>
                              <SelectContent>
                                {publicEntries.map((entry) => (
                                  <SelectItem key={entry.id} value={entry.id}>
                                    {getMatchPoolEntrySelectLabel(entry, locale)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                              {copy.noPoolEntries}
                            </div>
                          )}
                        </Field>
                      </div>

                      {selectedPublicEntry?.entryType === 'OFFICIAL_COMPETITION' ? (
                        <Field label={copy.context}>
                          {officialContextsLoading ? (
                            <Skeleton className="h-10 rounded-lg" />
                          ) : officialContextOptions.length > 0 ? (
                            <Select
                              value={selectedPublicContextId}
                              onValueChange={setSelectedPublicContextId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={copy.context} />
                              </SelectTrigger>
                              <SelectContent>
                                {officialContextOptions.map((context) => (
                                  <SelectItem key={context.id} value={context.id}>
                                    {getCompetitionTrackLabel(context.competition, locale) ||
                                      'TEAM'}{' '}
                                    / {getRecruitmentContextName(context, locale)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                              {copy.noPublicContext}
                            </div>
                          )}
                        </Field>
                      ) : null}

                      {publicContextSelection ? (
                        <div className="rounded-2xl border bg-muted/20 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{copy.currentSelection}</Badge>
                            <Badge variant="outline">
                              {publicContextSelection.sourceType === 'COMMUNITY'
                                ? copy.communityBadge
                                : copy.officialBadge}
                            </Badge>
                            {publicContextSelection.moderationStatus ? (
                              <Badge variant="outline">
                                {copy.moderationStatus}:{' '}
                                {getRecruitmentModerationLabel(
                                  publicContextSelection.moderationStatus,
                                  t
                                )}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="mt-3 space-y-1">
                            <p className="font-medium">
                              {getRecruitmentContextLabel(publicContextSelection, locale)}
                            </p>
                            {getRecruitmentContextMeta(publicContextSelection, locale) ? (
                              <p className="text-sm text-muted-foreground">
                                {getRecruitmentContextMeta(publicContextSelection, locale)}
                              </p>
                            ) : null}
                            {publicContextSelection.description ? (
                              <p className="text-sm text-muted-foreground">
                                {publicContextSelection.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>

              {isAuthenticated ? (
                <>
                  <RecruitmentEditorCard
                    t={t}
                    copy={copy}
                    selectedTeamId={selectedTeamId}
                    setSelectedTeamId={setSelectedTeamId}
                    myRecruitments={myRecruitments}
                    myRecruitmentsLoading={myRecruitmentsLoading}
                    form={form}
                    setForm={setForm}
                    currentCard={currentCard}
                    currentContextLabel={currentContextLabel}
                    currentContextMeta={currentContextMeta}
                    onCreate={() => createRecruitmentMutation.mutate()}
                    onUpdate={() => updateRecruitmentMutation.mutate()}
                    onPublish={() => currentCard && publishMutation.mutate(currentCard.id)}
                    onClose={() => currentCard && closeMutation.mutate(currentCard.id)}
                    createPending={createRecruitmentMutation.isPending}
                    updatePending={updateRecruitmentMutation.isPending}
                    publishPending={publishMutation.isPending}
                    closePending={closeMutation.isPending}
                  />

                  <DisplaySettingsCard
                    t={t}
                    currentCard={currentCard}
                    resumes={resumes}
                    introLine={introLine}
                    setIntroLine={setIntroLine}
                    selectedResumeId={selectedResumeId}
                    setSelectedResumeId={setSelectedResumeId}
                    showSchool={showSchool}
                    setShowSchool={setShowSchool}
                    showGrade={showGrade}
                    setShowGrade={setShowGrade}
                    showAwards={showAwards}
                    setShowAwards={setShowAwards}
                    showAcademics={showAcademics}
                    setShowAcademics={setShowAcademics}
                    showExperiences={showExperiences}
                    setShowExperiences={setShowExperiences}
                    showPersonality={showPersonality}
                    setShowPersonality={setShowPersonality}
                    onSave={() => memberProfileMutation.mutate(false)}
                    onConfirm={() => memberProfileMutation.mutate(true)}
                    pending={memberProfileMutation.isPending}
                  />
                </>
              ) : (
                <GuestAccessCard
                  title={copy.guestTitle}
                  description={copy.guestDescription}
                  actionLabel={copy.guestAction}
                  onLogin={() => router.push('/login')}
                />
              )}
            </div>

            <DeckPanel
              t={t}
              currentCard={currentCard}
              deckCards={deckCards}
              deckLoading={deckLoading}
              previewCards={previewDeckCards}
              previewLoading={previewDeckLoading}
              isPreviewMode={isPreviewMode}
              swipePending={swipeMutation.isPending}
              activeDeckCard={activeDeckCard}
              onSwipe={(cardId, action) =>
                currentCard &&
                swipeMutation.mutate({
                  sourceCardId: currentCard.id,
                  targetCardId: cardId,
                  action,
                })
              }
              onRefresh={() =>
                queryClient.invalidateQueries({
                  queryKey: qk.teams.recruitmentsDeck(),
                })
              }
            />
          </div>
        </TabsContent>

        <TabsContent value="private" className="mt-6">
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{copy.privateTitle}</CardTitle>
                  <CardDescription>{copy.privateDescription}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {myCommunityContextsLoading ? (
                    <Skeleton className="h-48 rounded-xl" />
                  ) : (
                    <>
                      <Field label={copy.myContexts}>
                        <Select
                          value={selectedPrivateContextId || 'new'}
                          onValueChange={(value) =>
                            setSelectedPrivateContextId(value === 'new' ? '' : value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={copy.myContexts} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">{t('recruitment.contextForm.new')}</SelectItem>
                            {privateContexts.map((context) => (
                              <SelectItem key={context.id} value={context.id}>
                                {context.title ?? context.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label={t('recruitment.contextForm.title')}>
                          <Input
                            value={communityForm.title}
                            onChange={(event) =>
                              setCommunityForm((prev) => ({ ...prev, title: event.target.value }))
                            }
                          />
                        </Field>
                        <Field label={t('recruitment.contextForm.chineseTitle')}>
                          <Input
                            value={communityForm.titleZh}
                            onChange={(event) =>
                              setCommunityForm((prev) => ({ ...prev, titleZh: event.target.value }))
                            }
                          />
                        </Field>
                      </div>

                      <Field label={copy.sourceUrl}>
                        <Input
                          value={communityForm.sourceUrl}
                          onChange={(event) =>
                            setCommunityForm((prev) => ({ ...prev, sourceUrl: event.target.value }))
                          }
                          placeholder="https://..."
                        />
                      </Field>

                      <Field label={copy.rolePresets}>
                        <Input
                          value={communityForm.rolePresets}
                          onChange={(event) =>
                            setCommunityForm((prev) => ({
                              ...prev,
                              rolePresets: event.target.value,
                            }))
                          }
                          placeholder={t('recruitment.contextForm.rolePresetsPlaceholder')}
                        />
                      </Field>

                      <Field label={t('recruitment.contextForm.description')}>
                        <Textarea
                          rows={4}
                          value={communityForm.description}
                          onChange={(event) =>
                            setCommunityForm((prev) => ({
                              ...prev,
                              description: event.target.value,
                            }))
                          }
                        />
                      </Field>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label={copy.registrationCloseAt}>
                          <Input
                            type="datetime-local"
                            value={communityForm.registrationCloseAt}
                            onChange={(event) =>
                              setCommunityForm((prev) => ({
                                ...prev,
                                registrationCloseAt: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label={copy.eventStartAt}>
                          <Input
                            type="datetime-local"
                            value={communityForm.eventStartAt}
                            onChange={(event) =>
                              setCommunityForm((prev) => ({
                                ...prev,
                                eventStartAt: event.target.value,
                              }))
                            }
                          />
                        </Field>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label={copy.eventEndAt}>
                          <Input
                            type="datetime-local"
                            value={communityForm.eventEndAt}
                            onChange={(event) =>
                              setCommunityForm((prev) => ({
                                ...prev,
                                eventEndAt: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label={copy.locationMode}>
                          <Select
                            value={communityForm.locationMode || 'none'}
                            onValueChange={(value) =>
                              setCommunityForm((prev) => ({
                                ...prev,
                                locationMode: value === 'none' ? '' : value,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t('recruitment.option.unset')}</SelectItem>
                              <SelectItem value="ONLINE">
                                {t('recruitment.option.online')}
                              </SelectItem>
                              <SelectItem value="OFFLINE">
                                {t('recruitment.option.offline')}
                              </SelectItem>
                              <SelectItem value="HYBRID">
                                {t('recruitment.option.hybrid')}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <Field label={copy.locationText}>
                          <Input
                            value={communityForm.locationText}
                            onChange={(event) =>
                              setCommunityForm((prev) => ({
                                ...prev,
                                locationText: event.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label={t('recruitment.field.targetSize')}>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              type="number"
                              min={2}
                              value={communityForm.minTeamSize}
                              onChange={(event) =>
                                setCommunityForm((prev) => ({
                                  ...prev,
                                  minTeamSize: event.target.value,
                                }))
                              }
                            />
                            <Input
                              type="number"
                              min={2}
                              value={communityForm.maxTeamSize}
                              onChange={(event) =>
                                setCommunityForm((prev) => ({
                                  ...prev,
                                  maxTeamSize: event.target.value,
                                }))
                              }
                            />
                          </div>
                        </Field>
                        <Field label={t('recruitment.field.languages')}>
                          <Input
                            value={communityForm.languages}
                            onChange={(event) =>
                              setCommunityForm((prev) => ({
                                ...prev,
                                languages: event.target.value,
                              }))
                            }
                          />
                        </Field>
                      </div>

                      {selectedPrivateContext ? (
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">
                            {copy.moderationStatus}:{' '}
                            {getRecruitmentModerationLabel(
                              selectedPrivateContext.moderationStatus,
                              t
                            )}
                          </Badge>
                          <Badge variant="outline">
                            {copy.sourceType}:{' '}
                            {getRecruitmentContextSourceTypeLabel(
                              selectedPrivateContext.sourceType,
                              t
                            )}
                          </Badge>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-3">
                        <Button
                          onClick={() =>
                            selectedPrivateContextId
                              ? updateCommunityContextMutation.mutate()
                              : createCommunityContextMutation.mutate()
                          }
                          disabled={
                            createCommunityContextMutation.isPending ||
                            updateCommunityContextMutation.isPending ||
                            !communityForm.title.trim()
                          }
                        >
                          {selectedPrivateContextId ? copy.updateContext : copy.createContext}
                        </Button>
                        {selectedPrivateContextId ? (
                          <Button
                            variant="outline"
                            onClick={() => publishCommunityContextMutation.mutate()}
                            disabled={publishCommunityContextMutation.isPending}
                          >
                            {copy.publishContext}
                          </Button>
                        ) : null}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <RecruitmentEditorCard
                t={t}
                copy={copy}
                selectedTeamId={selectedTeamId}
                setSelectedTeamId={setSelectedTeamId}
                myRecruitments={myRecruitments}
                myRecruitmentsLoading={myRecruitmentsLoading}
                form={form}
                setForm={setForm}
                currentCard={currentCard}
                currentContextLabel={currentContextLabel}
                currentContextMeta={currentContextMeta}
                onCreate={() => createRecruitmentMutation.mutate()}
                onUpdate={() => updateRecruitmentMutation.mutate()}
                onPublish={() => currentCard && publishMutation.mutate(currentCard.id)}
                onClose={() => currentCard && closeMutation.mutate(currentCard.id)}
                createPending={createRecruitmentMutation.isPending}
                updatePending={updateRecruitmentMutation.isPending}
                publishPending={publishMutation.isPending}
                closePending={closeMutation.isPending}
              />

              <DisplaySettingsCard
                t={t}
                currentCard={currentCard}
                resumes={resumes}
                introLine={introLine}
                setIntroLine={setIntroLine}
                selectedResumeId={selectedResumeId}
                setSelectedResumeId={setSelectedResumeId}
                showSchool={showSchool}
                setShowSchool={setShowSchool}
                showGrade={showGrade}
                setShowGrade={setShowGrade}
                showAwards={showAwards}
                setShowAwards={setShowAwards}
                showAcademics={showAcademics}
                setShowAcademics={setShowAcademics}
                showExperiences={showExperiences}
                setShowExperiences={setShowExperiences}
                showPersonality={showPersonality}
                setShowPersonality={setShowPersonality}
                onSave={() => memberProfileMutation.mutate(false)}
                onConfirm={() => memberProfileMutation.mutate(true)}
                pending={memberProfileMutation.isPending}
              />
            </div>

            <DeckPanel
              t={t}
              currentCard={currentCard}
              deckCards={deckCards}
              deckLoading={deckLoading}
              previewCards={previewDeckCards}
              previewLoading={previewDeckLoading}
              isPreviewMode={isPreviewMode}
              swipePending={swipeMutation.isPending}
              activeDeckCard={activeDeckCard}
              onSwipe={(cardId, action) =>
                currentCard &&
                swipeMutation.mutate({
                  sourceCardId: currentCard.id,
                  targetCardId: cardId,
                  action,
                })
              }
              onRefresh={() =>
                queryClient.invalidateQueries({
                  queryKey: qk.teams.recruitmentsDeck(),
                })
              }
            />
          </div>
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
                label: t('recruitment.copy.openPublicDeck'),
                onClick: () => setTab('public'),
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
                          {getRecruitmentContextMeta(match.otherCard, locale)} /{' '}
                          {getRecruitmentContextLabel(match.otherCard, locale)}
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
                      {match.conversationId ? (
                        <Button
                          className="flex-1 gap-2"
                          onClick={() => router.push(`/chat?conversation=${match.conversationId}`)}
                        >
                          <MessageSquare className="h-4 w-4" />
                          {t('recruitment.openChat')}
                        </Button>
                      ) : null}
                      {match.canInvite && match.otherCard.members.length > 0 ? (
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
                      ) : null}
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
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <DisplaySettingsCard
                t={t}
                currentCard={currentCard}
                resumes={resumes}
                introLine={introLine}
                setIntroLine={setIntroLine}
                selectedResumeId={selectedResumeId}
                setSelectedResumeId={setSelectedResumeId}
                showSchool={showSchool}
                setShowSchool={setShowSchool}
                showGrade={showGrade}
                setShowGrade={setShowGrade}
                showAwards={showAwards}
                setShowAwards={setShowAwards}
                showAcademics={showAcademics}
                setShowAcademics={setShowAcademics}
                showExperiences={showExperiences}
                setShowExperiences={setShowExperiences}
                showPersonality={showPersonality}
                setShowPersonality={setShowPersonality}
                onSave={() => memberProfileMutation.mutate(false)}
                onConfirm={() => memberProfileMutation.mutate(true)}
                pending={memberProfileMutation.isPending}
              />

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

            {myRecruitmentsLoading ? (
              <Skeleton className="h-80 rounded-xl" />
            ) : !myRecruitments?.items?.length ? (
              <EmptyState type="teams" title={copy.noCards} />
            ) : (
              <div className="grid gap-4">
                {myRecruitments.items.map((item) => (
                  <Card key={item.team.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle>{item.team.name}</CardTitle>
                          <CardDescription>
                            {item.team.memberCount} / {item.team.maxMembers ?? '-'} ·{' '}
                            {item.team.myRole}
                          </CardDescription>
                        </div>
                        <Badge variant="outline">{item.team.visibility}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {item.recruitmentCards.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{copy.noCards}</p>
                      ) : (
                        <div className="grid gap-4 lg:grid-cols-2">
                          {item.recruitmentCards.map((card) => {
                            const context = getRecruitmentContext(card);
                            return (
                              <div key={card.id} className="rounded-2xl border p-4">
                                <RecruitmentCardPreview card={card} compact />
                                <div className="mt-4 flex gap-3">
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedTeamId(item.team.id);
                                      if (context?.id) {
                                        setEditorContextId(context.id);
                                      }
                                      if (context?.sourceType === 'COMMUNITY') {
                                        if (context.id) {
                                          setSelectedPrivateContextId(context.id);
                                        }
                                        setTab('private');
                                      } else {
                                        if (context?.id) {
                                          setSelectedPublicContextId(context.id);
                                        }
                                        setTab('public');
                                      }
                                    }}
                                  >
                                    {context?.sourceType === 'COMMUNITY'
                                      ? copy.openInPrivate
                                      : copy.openInPublic}
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function GuestAccessCard({
  title,
  description,
  actionLabel,
  onLogin,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onLogin: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
          {description}
        </div>
        <Button onClick={onLogin}>{actionLabel}</Button>
      </CardContent>
    </Card>
  );
}

function RecruitmentEditorCard({
  t,
  copy,
  selectedTeamId,
  setSelectedTeamId,
  myRecruitments,
  myRecruitmentsLoading,
  form,
  setForm,
  currentCard,
  currentContextLabel,
  currentContextMeta,
  onCreate,
  onUpdate,
  onPublish,
  onClose,
  createPending,
  updatePending,
  publishPending,
  closePending,
}: {
  t: ReturnType<typeof useTranslations<'teams'>>;
  copy: Record<string, string>;
  selectedTeamId: string;
  setSelectedTeamId: (value: string) => void;
  myRecruitments: MyRecruitmentsResponse | undefined;
  myRecruitmentsLoading: boolean;
  form: RecruitmentFormState;
  setForm: React.Dispatch<React.SetStateAction<RecruitmentFormState>>;
  currentCard: TeamRecruitmentCardFrontDto | null;
  currentContextLabel: string;
  currentContextMeta: string;
  onCreate: () => void;
  onUpdate: () => void;
  onPublish: () => void;
  onClose: () => void;
  createPending: boolean;
  updatePending: boolean;
  publishPending: boolean;
  closePending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('recruitment.editor.title')}</CardTitle>
        <CardDescription>
          {currentContextLabel
            ? `${currentContextLabel}${currentContextMeta ? ` · ${currentContextMeta}` : ''}`
            : copy.selectContextFirst}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {myRecruitmentsLoading ? (
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

              <Field label={copy.context}>
                <div className="rounded-xl border bg-muted/20 px-4 py-3 text-sm">
                  {currentContextLabel || copy.selectContextFirst}
                </div>
              </Field>
            </div>

            {selectedTeamId === 'new-solo' ? (
              <Field label={t('recruitment.field.soloTeamName')}>
                <Input
                  value={form.teamName}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, teamName: event.target.value }))
                  }
                  placeholder={t('recruitment.field.soloTeamNamePlaceholder')}
                />
              </Field>
            ) : null}

            <Field label={t('recruitment.field.headline')}>
              <Input
                value={form.headline}
                onChange={(event) => setForm((prev) => ({ ...prev, headline: event.target.value }))}
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
                    <SelectItem value="TEAM_UP">{t('recruitment.intentMode.teamUp')}</SelectItem>
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
                    <SelectItem value="OFFLINE">{t('recruitment.option.offline')}</SelectItem>
                    <SelectItem value="HYBRID">{t('recruitment.option.hybrid')}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('recruitment.field.timezone')}>
                <Input
                  value={form.timezone}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, timezone: event.target.value }))
                  }
                  placeholder={t('recruitment.field.timezonePlaceholder')}
                />
              </Field>
              <Field label={t('recruitment.field.city')}>
                <Input
                  value={form.city}
                  onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
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
                onClick={() => (currentCard ? onUpdate() : onCreate())}
                disabled={
                  createPending ||
                  updatePending ||
                  !form.recruitmentContextId ||
                  !form.headline.trim()
                }
              >
                {currentCard
                  ? t('recruitment.action.saveCard')
                  : t('recruitment.action.createCard')}
              </Button>
              {currentCard ? (
                <>
                  <Button variant="secondary" disabled={publishPending} onClick={onPublish}>
                    {t('recruitment.action.publish')}
                  </Button>
                  <Button variant="outline" disabled={closePending} onClick={onClose}>
                    {t('recruitment.action.close')}
                  </Button>
                </>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DisplaySettingsCard({
  t,
  currentCard,
  resumes,
  introLine,
  setIntroLine,
  selectedResumeId,
  setSelectedResumeId,
  showSchool,
  setShowSchool,
  showGrade,
  setShowGrade,
  showAwards,
  setShowAwards,
  showAcademics,
  setShowAcademics,
  showExperiences,
  setShowExperiences,
  showPersonality,
  setShowPersonality,
  onSave,
  onConfirm,
  pending,
}: {
  t: ReturnType<typeof useTranslations<'teams'>>;
  currentCard: TeamRecruitmentCardFrontDto | null;
  resumes: ResumeOption[];
  introLine: string;
  setIntroLine: (value: string) => void;
  selectedResumeId: string;
  setSelectedResumeId: (value: string) => void;
  showSchool: boolean;
  setShowSchool: (value: boolean) => void;
  showGrade: boolean;
  setShowGrade: (value: boolean) => void;
  showAwards: boolean;
  setShowAwards: (value: boolean) => void;
  showAcademics: boolean;
  setShowAcademics: (value: boolean) => void;
  showExperiences: boolean;
  setShowExperiences: (value: boolean) => void;
  showPersonality: boolean;
  setShowPersonality: (value: boolean) => void;
  onSave: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('recruitment.display.title')}</CardTitle>
        <CardDescription>{t('recruitment.display.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label={t('recruitment.display.introLine')}>
          <Input value={introLine} onChange={(event) => setIntroLine(event.target.value)} />
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
            onClick={() => setShowSchool(!showSchool)}
            icon={ShieldCheck}
            label={t('recruitment.display.showSchool')}
          />
          <ToggleBadge
            active={showGrade}
            onClick={() => setShowGrade(!showGrade)}
            icon={Clock3}
            label={t('recruitment.display.showGrade')}
          />
          <ToggleBadge
            active={showAwards}
            onClick={() => setShowAwards(!showAwards)}
            icon={Lightbulb}
            label={t('recruitment.display.showAwards')}
          />
          <ToggleBadge
            active={showAcademics}
            onClick={() => setShowAcademics(!showAcademics)}
            icon={ShieldCheck}
            label={t('recruitment.display.showAcademics')}
          />
          <ToggleBadge
            active={showExperiences}
            onClick={() => setShowExperiences(!showExperiences)}
            icon={Lightbulb}
            label={t('recruitment.display.showExperiences')}
          />
          <ToggleBadge
            active={showPersonality}
            onClick={() => setShowPersonality(!showPersonality)}
            icon={Users}
            label={t('recruitment.display.showPersonality')}
          />
        </div>
        <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
          <p>{t('recruitment.display.completeProfileHint')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/profile">{t('recruitment.display.completeProfile')}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/assessment">{t('recruitment.display.completeAssessment')}</Link>
            </Button>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" disabled={!currentCard || pending} onClick={onSave}>
            {t('recruitment.display.save')}
          </Button>
          <Button disabled={!currentCard || pending} onClick={onConfirm}>
            {t('recruitment.display.confirmConsent')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DeckPanel({
  t,
  currentCard,
  deckCards,
  deckLoading,
  swipePending,
  activeDeckCard,
  onSwipe,
  onRefresh,
  previewCards,
  previewLoading,
  isPreviewMode,
}: {
  t: ReturnType<typeof useTranslations<'teams'>>;
  currentCard: TeamRecruitmentCardFrontDto | null;
  deckCards: TeamRecruitmentCardFrontDto[];
  deckLoading: boolean;
  swipePending: boolean;
  activeDeckCard: TeamRecruitmentCardFrontDto | null;
  onSwipe: (cardId: string, action: 'LIKE' | 'PASS') => void;
  onRefresh: () => void;
  previewCards: TeamRecruitmentCardFrontDto[];
  previewLoading: boolean;
  isPreviewMode: boolean;
}) {
  // Guest preview: user has no published card but has selected a context.
  // Show the marketplace with disabled swipe and a clear "create yours to match" CTA.
  if (!currentCard && (isPreviewMode || previewLoading)) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm">
          <p className="font-medium text-foreground">{t('recruitment.preview.bannerTitle')}</p>
          <p className="mt-1 text-muted-foreground">{t('recruitment.preview.bannerHint')}</p>
        </div>
        <RecruitmentSwipeDeck
          cards={previewCards}
          onSwipe={() => {
            /* disabled in preview */
          }}
          onEmpty={() => {
            /* no refetch in preview */
          }}
          isLoading={previewLoading}
          isPending={false}
          isPreview
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!currentCard ? (
        <EmptyState type="teams" title={t('recruitment.empty.noCard')} />
      ) : (
        <>
          <RecruitmentSwipeDeck
            cards={deckCards}
            onSwipe={onSwipe}
            onEmpty={onRefresh}
            isLoading={deckLoading}
            isPending={swipePending}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('recruitment.currentCard')}</CardTitle>
              {activeDeckCard ? (
                <CardDescription>{activeDeckCard.team.name}</CardDescription>
              ) : null}
            </CardHeader>
            <CardContent>
              <RecruitmentCardPreview card={currentCard} compact />
            </CardContent>
          </Card>
        </>
      )}
    </div>
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
  const locale = useLocale();
  const contextLabel = getRecruitmentContextLabel(card, locale);
  const contextMeta = getRecruitmentContextMeta(card, locale);
  const statusLabel =
    card.intentMode === 'NETWORKING_ONLY'
      ? t('recruitment.intentMode.networkingOnly')
      : t(`recruitment.status.${card.status}`);

  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br from-background to-amber-50/70 dark:to-amber-950/30 p-5 ${compact ? 'space-y-3' : 'space-y-4'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {contextMeta ? (
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{contextMeta}</p>
          ) : null}
          {contextLabel ? <p className="text-sm font-medium">{contextLabel}</p> : null}
          <h3 className="text-lg font-semibold">{card.team.name}</h3>
          <p className="text-sm text-muted-foreground">{card.headline}</p>
        </div>
        <Badge variant={card.status === 'CLOSED' ? 'secondary' : 'default'}>{statusLabel}</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          <Target className="mr-1 h-3 w-3" />
          {card.team.currentSize}/{card.team.targetSize}
        </Badge>
        {card.availabilityBand ? (
          <Badge variant="outline">{t(`recruitment.availability.${card.availabilityBand}`)}</Badge>
        ) : null}
        {card.collaborationMode ? (
          <Badge variant="outline">
            {t(`recruitment.option.${card.collaborationMode.toLowerCase()}`)}
          </Badge>
        ) : null}
        {card.timezone ? <Badge variant="outline">{card.timezone}</Badge> : null}
      </div>

      <CardBlock title={t('recruitment.card.offer')} items={card.offerRoles} />
      <CardBlock title={t('recruitment.card.need')} items={card.needRoles} />
      <CardBlock title={t('recruitment.card.skills')} items={card.skillTags} />

      {!compact && card.members.length > 0 ? (
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
                  {member.consentConfirmedAt ? (
                    <Badge variant="secondary">{t('recruitment.card.confirmed')}</Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {card.detailNote && !compact ? (
        <div className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
          {card.detailNote}
        </div>
      ) : null}
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
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="inline-flex min-h-10 items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-8"
    >
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

function formatDateTimeInput(value?: string | Date | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
