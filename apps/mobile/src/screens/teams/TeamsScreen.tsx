import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState, Loading, Segment, Select } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { teamService } from '@/lib/api/services/team';
import { qk } from '@/lib/query';
import { spacing, useColors } from '@/utils/theme';
import { Ionicons } from '@expo/vector-icons';
import type {
  RecruitmentContextDto,
  TeamMatchDto,
  TeamRecruitmentCardFrontDto,
} from '@study-abroad/shared';
import {
  getCompetitionTrackLabel,
  getRecruitmentContext,
  getRecruitmentContextId,
  getRecruitmentContextName,
  MAX_RECRUITMENT_ROLES,
  MAX_RECRUITMENT_SKILL_TAGS,
  resumeRoutes,
} from '@study-abroad/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import {
  BadgeLike,
  FieldInput,
  getMatchKindLabel,
  getStatusLabel,
  RecruitmentCard,
  splitList,
  ToggleChip,
} from './TeamsScreen.components';
import { styles } from './TeamsScreen.styles';

type MyRecruitmentsResponse = {
  items: Array<{
    team: {
      id: string;
      name: string;
      memberCount: number;
      maxMembers?: number | null;
      myRole: string;
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

const EMPTY_FORM = {
  teamName: '',
  recruitmentContextId: '',
  headline: '',
  detailNote: '',
  offerRoles: '',
  needRoles: '',
  skillTags: '',
  targetTeamSize: '',
};

export default function TeamsScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'match' | 'matches' | 'my-team'>('match');
  const [selectedTeamId, setSelectedTeamId] = useState('new-solo');
  const [form, setForm] = useState(EMPTY_FORM);
  const [introLine, setIntroLine] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState('none');
  const [showAcademics, setShowAcademics] = useState(false);
  const [showExperiences, setShowExperiences] = useState(false);
  const [showPersonality, setShowPersonality] = useState(false);

  const { data: contextsData, isLoading: contextsLoading } = useQuery({
    queryKey: qk.teams.contexts(),
    queryFn: () => teamService.getRecruitmentContexts() as Promise<RecruitmentContextDto>,
  });

  const { data: myRecruitments, isLoading: myRecruitmentsLoading } = useQuery({
    queryKey: qk.teams.mine(),
    queryFn: () => teamService.getMyRecruitments() as Promise<MyRecruitmentsResponse>,
  });

  const { data: resumes } = useQuery({
    queryKey: qk.teams.resumes(),
    queryFn: () => apiClient.get<ResumeOption[]>(resumeRoutes.list()),
  });

  const currentEntry = useMemo(() => {
    if (!myRecruitments?.items?.length) return null;
    if (selectedTeamId === 'new-solo') return myRecruitments.items[0] ?? null;
    return (
      myRecruitments.items.find((item) => item.team.id === selectedTeamId) ??
      myRecruitments.items[0]
    );
  }, [myRecruitments?.items, selectedTeamId]);

  const currentCard = currentEntry?.recruitmentCards[0] ?? null;

  useEffect(() => {
    if (!contextsData?.items?.length) return;
    setForm((prev) => ({
      ...prev,
      recruitmentContextId:
        prev.recruitmentContextId || getRecruitmentContextId(contextsData.items[0]) || '',
      targetTeamSize: prev.targetTeamSize || String(contextsData.items[0].maxTeamSize),
    }));
  }, [contextsData?.items]);

  useEffect(() => {
    if (!currentCard) return;
    const currentContext = getRecruitmentContext(currentCard);
    const currentMember = currentCard.members[0];
    setForm({
      teamName: currentEntry?.team.name ?? '',
      recruitmentContextId: getRecruitmentContextId(currentCard) ?? '',
      headline: currentCard.headline,
      detailNote: currentCard.detailNote ?? '',
      offerRoles: currentCard.offerRoles.join(', '),
      needRoles: currentCard.needRoles.join(', '),
      skillTags: currentCard.skillTags.join(', '),
      targetTeamSize: String(currentCard.team.targetSize || currentContext?.maxTeamSize || ''),
    });
    setIntroLine(currentMember?.introLine ?? '');
    setSelectedResumeId(currentMember?.resume?.id ?? 'none');
    setShowAcademics(currentMember?.showAcademics ?? false);
    setShowExperiences(currentMember?.showExperiences ?? false);
    setShowPersonality(currentMember?.showPersonality ?? false);
  }, [currentCard, currentEntry?.team.name]);

  const { data: deckData, isLoading: deckLoading } = useQuery({
    queryKey: qk.teams.deck(currentEntry?.team.id),
    queryFn: () =>
      teamService.getRecruitmentDeck(
        currentEntry?.team.id ? { teamId: currentEntry.team.id } : undefined
      ) as Promise<RecruitmentDeckResponse>,
    enabled: !!currentEntry?.team.id,
  });

  const { data: matchesData, isLoading: matchesLoading } = useQuery({
    queryKey: qk.teams.matches(),
    queryFn: () => teamService.getMatches() as Promise<{ items: TeamMatchDto[] }>,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: qk.teams.all });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      teamService.createRecruitment({
        teamId: selectedTeamId === 'new-solo' ? undefined : selectedTeamId,
        teamName: selectedTeamId === 'new-solo' ? form.teamName || undefined : undefined,
        recruitmentContextId: form.recruitmentContextId,
        competitionTrackId: form.recruitmentContextId,
        headline: form.headline,
        detailNote: form.detailNote || undefined,
        offerRoles: splitList(form.offerRoles),
        needRoles: splitList(form.needRoles),
        skillTags: splitList(form.skillTags),
        targetTeamSize: form.targetTeamSize ? Number(form.targetTeamSize) : undefined,
      }),
    onSuccess: () => {
      toast.show({
        type: 'success',
        message: t('teams.recruitment.toast.cardCreated'),
      });
      invalidate();
      setTab('my-team');
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      teamService.updateRecruitment(currentCard!.id, {
        recruitmentContextId: form.recruitmentContextId,
        competitionTrackId: form.recruitmentContextId,
        headline: form.headline,
        detailNote: form.detailNote || undefined,
        offerRoles: splitList(form.offerRoles),
        needRoles: splitList(form.needRoles),
        skillTags: splitList(form.skillTags),
        targetTeamSize: form.targetTeamSize ? Number(form.targetTeamSize) : undefined,
      }),
    onSuccess: () => {
      toast.show({
        type: 'success',
        message: t('teams.recruitment.toast.cardUpdated'),
      });
      invalidate();
    },
  });

  // Pre-validate the free-form comma inputs against the shared @ArrayMaxSize caps so
  // an over-limit list shows a toast instead of 400'ing silently at the backend
  // ValidationPipe (#396 bug class). Mirrors the web TeamsPageClient guard.
  const submitCard = () => {
    if (splitList(form.offerRoles).length > MAX_RECRUITMENT_ROLES) {
      toast.show({
        type: 'error',
        message: t('teams.recruitment.toast.tooManyOfferRoles', { max: MAX_RECRUITMENT_ROLES }),
      });
      return;
    }
    if (splitList(form.needRoles).length > MAX_RECRUITMENT_ROLES) {
      toast.show({
        type: 'error',
        message: t('teams.recruitment.toast.tooManyNeedRoles', { max: MAX_RECRUITMENT_ROLES }),
      });
      return;
    }
    if (splitList(form.skillTags).length > MAX_RECRUITMENT_SKILL_TAGS) {
      toast.show({
        type: 'error',
        message: t('teams.recruitment.toast.tooManySkillTags', {
          max: MAX_RECRUITMENT_SKILL_TAGS,
        }),
      });
      return;
    }
    if (currentCard) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const publishMutation = useMutation({
    mutationFn: (cardId: string) => teamService.publishRecruitment(cardId),
    onSuccess: () => {
      toast.show({
        type: 'success',
        message: t('teams.recruitment.toast.cardPublished'),
      });
      invalidate();
    },
  });

  const profileMutation = useMutation({
    mutationFn: (consentConfirmed: boolean) =>
      teamService.updateRecruitmentMemberProfile(currentCard!.id, {
        introLine,
        selectedResumeId: selectedResumeId === 'none' ? null : selectedResumeId,
        showAcademics,
        showExperiences,
        showPersonality,
        consentConfirmed,
      }),
    onSuccess: () => {
      toast.show({
        type: 'success',
        message: t('teams.recruitment.toast.displayUpdated'),
      });
      invalidate();
    },
  });

  const swipeMutation = useMutation({
    mutationFn: (payload: {
      sourceCardId: string;
      targetCardId: string;
      action: 'LIKE' | 'PASS';
    }) =>
      teamService.swipeRecruitment(payload.sourceCardId, {
        targetCardId: payload.targetCardId,
        action: payload.action,
      }) as Promise<{ matched?: boolean }>,
    onSuccess: (result: { matched?: boolean }) => {
      toast.show({
        type: 'success',
        message: result?.matched
          ? t('teams.recruitment.toast.matched')
          : t('teams.recruitment.toast.swipeRecorded'),
      });
      invalidate();
    },
  });

  const contextOptions =
    contextsData?.items.map((track) => ({
      value: getRecruitmentContextId(track) ?? track.id,
      label: `${getCompetitionTrackLabel(track.competition, i18n.language) || t('teams.recruitment.card.teamFallback')} / ${getRecruitmentContextName(track, i18n.language)}`,
    })) ?? [];

  const teamOptions = [
    {
      value: 'new-solo',
      label: t('teams.recruitment.field.createSoloTeam'),
    },
    ...((myRecruitments?.items ?? []).map((item) => ({
      value: item.team.id,
      label: item.team.name,
    })) ?? []),
  ];

  const resumeOptions = [
    { value: 'none', label: t('teams.recruitment.display.noResume') },
    ...(resumes ?? []).map((resume) => ({ value: resume.id, label: resume.title })),
  ];

  const deckCard = deckData?.items?.[0] ?? null;
  const matches = matchesData?.items ?? [];

  return (
    <PageContainer variant="community">
      <PageHeader
        title={t('teams.title')}
        description={t('teams.recruitment.description')}
        icon="people-outline"
        variant="community"
      />

      <Segment
        segments={[
          { key: 'match', label: t('teams.recruitment.tab.match') },
          { key: 'matches', label: t('teams.recruitment.tab.matches') },
          { key: 'my-team', label: t('teams.recruitment.tab.myTeam') },
        ]}
        value={tab}
        onChange={(value) => setTab(value as typeof tab)}
        style={{ marginBottom: spacing.lg }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'match' &&
          (deckLoading ? (
            <Loading />
          ) : !currentCard ? (
            <EmptyState icon="people-outline" title={t('teams.recruitment.empty.noCard')} />
          ) : !deckCard ? (
            <EmptyState icon="heart-outline" title={t('teams.recruitment.empty.deckEmpty')} />
          ) : (
            <View style={styles.section}>
              <RecruitmentCard card={deckCard} locale={i18n.language} />
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.actionButton, { borderColor: colors.border }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('teams.recruitment.swipeDeck.pass')}
                  onPress={() =>
                    swipeMutation.mutate({
                      sourceCardId: currentCard.id,
                      targetCardId: deckCard.id,
                      action: 'PASS',
                    })
                  }
                >
                  <Ionicons name="close" size={18} color={colors.foreground} />
                  <Text style={[styles.actionLabel, { color: colors.foreground }]}>
                    {t('teams.recruitment.swipeDeck.pass')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel={t('teams.recruitment.swipeDeck.like')}
                  onPress={() =>
                    swipeMutation.mutate({
                      sourceCardId: currentCard.id,
                      targetCardId: deckCard.id,
                      action: 'LIKE',
                    })
                  }
                >
                  <Ionicons name="heart" size={18} color={colors.primaryForeground} />
                  <Text style={[styles.primaryLabel, { color: colors.primaryForeground }]}>
                    {t('teams.recruitment.swipeDeck.like')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

        {tab === 'matches' &&
          (matchesLoading ? (
            <Loading />
          ) : matches.length === 0 ? (
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title={t('teams.recruitment.empty.noMatches')}
            />
          ) : (
            <View style={styles.section}>
              {matches.map((match) => (
                <View
                  key={match.id}
                  style={[
                    styles.panel,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                    {match.otherCard.team.name}
                  </Text>
                  <Text style={[styles.cardMeta, { color: colors.foregroundMuted }]}>
                    {getCompetitionTrackLabel(
                      getRecruitmentContext(match.otherCard)?.competition,
                      i18n.language
                    ) || t('teams.recruitment.card.teamFallback')}{' '}
                    /{' '}
                    {getRecruitmentContextName(
                      getRecruitmentContext(match.otherCard),
                      i18n.language
                    )}
                  </Text>
                  <View style={styles.badges}>
                    <BadgeLike label={getMatchKindLabel(t, match.matchKind)} colors={colors} />
                    <BadgeLike label={getStatusLabel(t, match.otherCard.status)} colors={colors} />
                  </View>
                </View>
              ))}
            </View>
          ))}

        {tab === 'my-team' && (
          <View style={styles.section}>
            {(myRecruitmentsLoading || contextsLoading) && <Loading />}
            {!myRecruitmentsLoading && !contextsLoading && (
              <>
                <View
                  style={[
                    styles.panel,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    {t('teams.recruitment.editor.title')}
                  </Text>
                  <Select
                    label={t('teams.recruitment.field.backingTeam')}
                    options={teamOptions}
                    value={selectedTeamId}
                    onChange={setSelectedTeamId}
                  />
                  <Select
                    label={t('teams.recruitment.field.competitionTrack')}
                    options={contextOptions}
                    value={form.recruitmentContextId}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, recruitmentContextId: value }))
                    }
                  />
                  <FieldInput
                    label={t('teams.recruitment.field.soloTeamName')}
                    value={form.teamName}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, teamName: value }))}
                  />
                  <FieldInput
                    label={t('teams.recruitment.field.headline')}
                    value={form.headline}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, headline: value }))}
                  />
                  <FieldInput
                    label={t('teams.recruitment.field.detailNote')}
                    value={form.detailNote}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, detailNote: value }))}
                    multiline
                  />
                  <FieldInput
                    label={t('teams.recruitment.field.offerRoles')}
                    value={form.offerRoles}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, offerRoles: value }))}
                  />
                  <FieldInput
                    label={t('teams.recruitment.field.needRoles')}
                    value={form.needRoles}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, needRoles: value }))}
                  />
                  <FieldInput
                    label={t('teams.recruitment.field.skillTags')}
                    value={form.skillTags}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, skillTags: value }))}
                  />
                  <FieldInput
                    label={t('teams.recruitment.field.targetSize')}
                    value={form.targetTeamSize}
                    onChangeText={(value) =>
                      setForm((prev) => ({ ...prev, targetTeamSize: value }))
                    }
                    keyboardType="number-pad"
                  />
                  <View style={styles.row}>
                    <TouchableOpacity
                      style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        currentCard
                          ? t('teams.recruitment.action.saveCard')
                          : t('teams.recruitment.action.createCard')
                      }
                      onPress={submitCard}
                    >
                      <Text style={[styles.primaryLabel, { color: colors.primaryForeground }]}>
                        {currentCard
                          ? t('teams.recruitment.action.saveCard')
                          : t('teams.recruitment.action.createCard')}
                      </Text>
                    </TouchableOpacity>
                    {currentCard && (
                      <TouchableOpacity
                        style={[styles.actionButton, { borderColor: colors.border }]}
                        accessibilityRole="button"
                        accessibilityLabel={t('teams.recruitment.action.publish')}
                        onPress={() => publishMutation.mutate(currentCard.id)}
                      >
                        <Text style={[styles.actionLabel, { color: colors.foreground }]}>
                          {t('teams.recruitment.action.publish')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View
                  style={[
                    styles.panel,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    {t('teams.recruitment.display.title')}
                  </Text>
                  <FieldInput
                    label={t('teams.recruitment.display.introLine')}
                    value={introLine}
                    onChangeText={setIntroLine}
                  />
                  <Select
                    label={t('teams.recruitment.display.selectedResume')}
                    options={resumeOptions}
                    value={selectedResumeId}
                    onChange={setSelectedResumeId}
                  />
                  <View style={styles.toggleRow}>
                    <ToggleChip
                      label={t('teams.recruitment.display.showAcademics')}
                      active={showAcademics}
                      onPress={() => setShowAcademics((value) => !value)}
                    />
                    <ToggleChip
                      label={t('teams.recruitment.display.showExperiences')}
                      active={showExperiences}
                      onPress={() => setShowExperiences((value) => !value)}
                    />
                    <ToggleChip
                      label={t('teams.recruitment.display.showPersonality')}
                      active={showPersonality}
                      onPress={() => setShowPersonality((value) => !value)}
                    />
                  </View>
                  <Text style={[styles.helperText, { color: colors.foregroundMuted }]}>
                    {t('teams.recruitment.display.completeProfileHint')}
                  </Text>
                  <View style={styles.row}>
                    <TouchableOpacity
                      style={[styles.actionButton, { borderColor: colors.border }]}
                      disabled={!currentCard}
                      accessibilityRole="button"
                      accessibilityLabel={t('teams.recruitment.display.save')}
                      accessibilityState={{ disabled: !currentCard }}
                      onPress={() => profileMutation.mutate(false)}
                    >
                      <Text style={[styles.actionLabel, { color: colors.foreground }]}>
                        {t('teams.recruitment.display.save')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                      disabled={!currentCard}
                      accessibilityRole="button"
                      accessibilityLabel={t('teams.recruitment.display.confirmConsent')}
                      accessibilityState={{ disabled: !currentCard }}
                      onPress={() => profileMutation.mutate(true)}
                    >
                      <Text style={[styles.primaryLabel, { color: colors.primaryForeground }]}>
                        {t('teams.recruitment.display.confirmConsent')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {currentCard && <RecruitmentCard card={currentCard} locale={i18n.language} />}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </PageContainer>
  );
}
