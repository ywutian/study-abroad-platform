import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  resumeRoutes,
} from '@study-abroad/shared';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';
import { EmptyState, Loading, Segment, Select } from '@/components/ui';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { teamService } from '@/lib/api/services/team';
import { apiClient } from '@/lib/api/client';

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
    queryKey: ['mobile-teams', 'contexts'],
    queryFn: () => teamService.getRecruitmentContexts() as Promise<RecruitmentContextDto>,
  });

  const { data: myRecruitments, isLoading: myRecruitmentsLoading } = useQuery({
    queryKey: ['mobile-teams', 'mine'],
    queryFn: () => teamService.getMyRecruitments() as Promise<MyRecruitmentsResponse>,
  });

  const { data: resumes } = useQuery({
    queryKey: ['mobile-teams', 'resumes'],
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
    queryKey: ['mobile-teams', 'deck', currentEntry?.team.id],
    queryFn: () =>
      teamService.getRecruitmentDeck(
        currentEntry?.team.id ? { teamId: currentEntry.team.id } : undefined
      ) as Promise<RecruitmentDeckResponse>,
    enabled: !!currentEntry?.team.id,
  });

  const { data: matchesData, isLoading: matchesLoading } = useQuery({
    queryKey: ['mobile-teams', 'matches'],
    queryFn: () => teamService.getMatches() as Promise<{ items: TeamMatchDto[] }>,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['mobile-teams'] });
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
                      onPress={() =>
                        currentCard ? updateMutation.mutate() : createMutation.mutate()
                      }
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
                      onPress={() => profileMutation.mutate(false)}
                    >
                      <Text style={[styles.actionLabel, { color: colors.foreground }]}>
                        {t('teams.recruitment.display.save')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                      disabled={!currentCard}
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

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;
type RecruitmentMember = TeamRecruitmentCardFrontDto['members'][number];
type RecruitmentHighlight = NonNullable<RecruitmentMember['highlights']>['academics'][number];

function RecruitmentCard({ card, locale }: { card: TeamRecruitmentCardFrontDto; locale: string }) {
  const { t } = useTranslation();
  const colors = useColors();
  const context = getRecruitmentContext(card);
  const primaryMember = card.members[0];
  const isSingleMember = card.members.length <= 1;
  const visibleMembers = card.members.slice(0, isSingleMember ? 1 : 2);
  const title = isSingleMember ? primaryMember?.displayName || card.team.name : card.team.name;
  const meta = [primaryMember?.grade, primaryMember?.school, card.city].filter(Boolean);
  const highlights = mergeMemberHighlights(visibleMembers);
  const hasHighlights =
    highlights.academics.length > 0 ||
    highlights.experiences.length > 0 ||
    highlights.personality.length > 0;

  return (
    <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.cardKicker, { color: colors.foregroundMuted }]}>
        {getCompetitionTrackLabel(context?.competition, locale) ||
          t('teams.recruitment.card.teamFallback')}{' '}
        / {getRecruitmentContextName(context, locale)}
      </Text>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{title}</Text>
      {meta.length > 0 && (
        <Text style={[styles.cardMeta, { color: colors.foregroundMuted }]}>{meta.join(' · ')}</Text>
      )}
      <Text style={[styles.cardMeta, { color: colors.foregroundMuted }]}>{card.headline}</Text>
      <View style={styles.badges}>
        <BadgeLike
          label={t('teams.recruitment.card.memberCount', {
            current: card.team.currentSize,
            max: card.team.targetSize,
          })}
          colors={colors}
        />
        <BadgeLike label={getStatusLabel(t, card.status)} colors={colors} />
      </View>

      {hasHighlights ? (
        <View style={styles.highlights}>
          <HighlightChipGroup
            title={t('teams.recruitment.card.academics')}
            chips={highlights.academics}
          />
          <ExperienceList
            title={t('teams.recruitment.card.experience')}
            items={highlights.experiences}
          />
          <HighlightChipGroup
            title={t('teams.recruitment.card.personality')}
            chips={highlights.personality}
          />
        </View>
      ) : (
        <View style={[styles.emptyHighlights, { borderColor: colors.border }]}>
          <Text style={[styles.helperText, { color: colors.foregroundMuted }]}>
            {t('teams.recruitment.card.noHighlights')}
          </Text>
        </View>
      )}

      <RoleChipGroup label={t('teams.recruitment.card.offer')} items={card.offerRoles} />
      <RoleChipGroup label={t('teams.recruitment.card.need')} items={card.needRoles} />
      <RoleChipGroup label={t('teams.recruitment.card.skills')} items={card.skillTags} />

      {!isSingleMember && visibleMembers.length > 0 && (
        <View style={styles.memberRow}>
          {visibleMembers.map((member) => (
            <BadgeLike
              key={member.userId}
              label={member.displayName || member.role}
              colors={colors}
            />
          ))}
        </View>
      )}

      <CoordinationDetails card={card} />
    </View>
  );
}

function mergeMemberHighlights(members: RecruitmentMember[]) {
  return {
    academics: members.flatMap((member) => member.highlights?.academics ?? []).slice(0, 8),
    experiences: members.flatMap((member) => member.highlights?.experiences ?? []).slice(0, 3),
    personality: members.flatMap((member) => member.highlights?.personality ?? []).slice(0, 6),
  };
}

function getStatusLabel(t: TranslationFn, status: string) {
  return t(`teams.recruitment.status.${status}`);
}

function getMatchKindLabel(t: TranslationFn, kind: string) {
  return kind === 'NETWORKING'
    ? t('teams.recruitment.matchKind.networking')
    : t('teams.recruitment.matchKind.teamUp');
}

function getToneStyle(tone: RecruitmentHighlight['tone']) {
  switch (tone) {
    case 'success':
      return { backgroundColor: '#ece8d2', color: '#555d3c' };
    case 'warning':
      return { backgroundColor: '#fef3c7', color: '#92400e' };
    case 'danger':
      return { backgroundColor: '#fee2e2', color: '#991b1b' };
    default:
      return { backgroundColor: '#e0f2fe', color: '#075985' };
  }
}

function HighlightChipGroup({ title, chips }: { title: string; chips: RecruitmentHighlight[] }) {
  if (chips.length === 0) return null;

  return (
    <View style={styles.highlightBlock}>
      <Text style={styles.highlightTitle}>{title}</Text>
      <View style={styles.chipRow}>
        {chips.map((chip, index) => {
          const toneStyle = getToneStyle(chip.tone);
          return (
            <View
              key={`${chip.source}-${chip.sourceId ?? chip.label}-${index}`}
              style={[styles.highlightChip, { backgroundColor: toneStyle.backgroundColor }]}
            >
              <Text style={[styles.highlightChipText, { color: toneStyle.color }]}>
                {chip.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ExperienceList({ title, items }: { title: string; items: RecruitmentHighlight[] }) {
  const colors = useColors();
  if (items.length === 0) return null;

  return (
    <View style={styles.highlightBlock}>
      <Text style={styles.highlightTitle}>{title}</Text>
      {items.map((item, index) => (
        <Text
          key={`${item.source}-${item.sourceId ?? item.label}-${index}`}
          style={[styles.experienceText, { color: colors.foreground }]}
        >
          {item.label}
        </Text>
      ))}
    </View>
  );
}

function RoleChipGroup({ label, items }: { label: string; items: string[] }) {
  const colors = useColors();
  if (items.length === 0) return null;

  return (
    <View style={styles.roleGroup}>
      <Text style={[styles.roleLabel, { color: colors.foregroundMuted }]}>{label}</Text>
      <View style={styles.chipRow}>
        {items.map((item) => (
          <BadgeLike key={item} label={item} colors={colors} />
        ))}
      </View>
    </View>
  );
}

function CoordinationDetails({ card }: { card: TeamRecruitmentCardFrontDto }) {
  const { t } = useTranslation();
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    Boolean(card.availabilityBand || card.collaborationMode || card.timezone || card.detailNote) ||
    card.languages.length > 0;

  if (!hasDetails) return null;

  return (
    <View style={[styles.coordination, { borderColor: colors.border }]}>
      <TouchableOpacity
        style={styles.coordinationHeader}
        onPress={() => setExpanded((value) => !value)}
      >
        <Text style={[styles.coordinationTitle, { color: colors.foregroundMuted }]}>
          {t('teams.recruitment.card.coordination')}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.foregroundMuted}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.coordinationBody}>
          <View style={styles.chipRow}>
            {card.availabilityBand && (
              <BadgeLike
                label={t(`teams.recruitment.availability.${card.availabilityBand}`)}
                colors={colors}
              />
            )}
            {card.collaborationMode && (
              <BadgeLike
                label={t(`teams.recruitment.option.${card.collaborationMode.toLowerCase()}`)}
                colors={colors}
              />
            )}
            {card.timezone && <BadgeLike label={card.timezone} colors={colors} />}
            {card.languages.map((language) => (
              <BadgeLike key={language} label={language} colors={colors} />
            ))}
          </View>
          {card.detailNote ? (
            <Text style={[styles.listText, { color: colors.foregroundMuted }]}>
              {card.detailNote}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

function FieldInput({
  label,
  value,
  onChangeText,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: 'default' | 'number-pad';
}) {
  const colors = useColors();

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[
          styles.input,
          {
            color: colors.foreground,
            borderColor: colors.border,
            backgroundColor: colors.input,
            minHeight: multiline ? 100 : 48,
          },
        ]}
        placeholderTextColor={colors.placeholder}
      />
    </View>
  );
}

function BadgeLike({ label, colors }: { label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.badge, { borderColor: colors.border, backgroundColor: colors.muted }]}>
      <Text style={[styles.badgeText, { color: colors.foreground }]}>{label}</Text>
    </View>
  );
}

function ToggleChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.toggleChip,
        {
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primary : colors.muted,
        },
      ]}
    >
      <Ionicons
        name={active ? 'checkmark-circle' : 'ellipse-outline'}
        size={14}
        color={active ? colors.primaryForeground : colors.foregroundMuted}
      />
      <Text
        style={[
          styles.toggleChipText,
          { color: active ? colors.primaryForeground : colors.foreground },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
    paddingBottom: spacing['2xl'],
  },
  section: {
    gap: spacing.md,
  },
  panel: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.md,
  },
  cardKicker: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  cardMeta: {
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
  highlights: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  highlightBlock: {
    gap: spacing.xs,
  },
  highlightTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: '#6f665b',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  highlightChip: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  highlightChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  experienceText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  emptyHighlights: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  roleGroup: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  roleLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  memberRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  coordination: {
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  coordinationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coordinationTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  coordinationBody: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  badge: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  listText: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.xs,
  },
  helperText: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  toggleChip: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toggleChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  primaryButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  primaryLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});
