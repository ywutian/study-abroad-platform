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
import { resumeRoutes } from '@study-abroad/shared';
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
  competitionTrackId: '',
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
      competitionTrackId: prev.competitionTrackId || contextsData.items[0].id,
      targetTeamSize: prev.targetTeamSize || String(contextsData.items[0].maxTeamSize),
    }));
  }, [contextsData?.items]);

  useEffect(() => {
    if (!currentCard) return;
    setForm({
      teamName: currentEntry?.team.name ?? '',
      competitionTrackId: currentCard.context.trackId,
      headline: currentCard.headline,
      detailNote: currentCard.detailNote ?? '',
      offerRoles: currentCard.offerRoles.join(', '),
      needRoles: currentCard.needRoles.join(', '),
      skillTags: currentCard.skillTags.join(', '),
      targetTeamSize: String(currentCard.team.targetSize),
    });
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
        competitionTrackId: form.competitionTrackId,
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
        message: i18n.language.startsWith('zh') ? '组队卡已创建' : 'Recruitment card created',
      });
      invalidate();
      setTab('my-team');
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      teamService.updateRecruitment(currentCard!.id, {
        competitionTrackId: form.competitionTrackId,
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
        message: i18n.language.startsWith('zh') ? '组队卡已更新' : 'Recruitment card updated',
      });
      invalidate();
    },
  });

  const publishMutation = useMutation({
    mutationFn: (cardId: string) => teamService.publishRecruitment(cardId),
    onSuccess: () => {
      toast.show({
        type: 'success',
        message: i18n.language.startsWith('zh') ? '组队卡已发布' : 'Recruitment card published',
      });
      invalidate();
    },
  });

  const profileMutation = useMutation({
    mutationFn: (consentConfirmed: boolean) =>
      teamService.updateRecruitmentMemberProfile(currentCard!.id, {
        introLine,
        selectedResumeId: selectedResumeId === 'none' ? null : selectedResumeId,
        consentConfirmed,
      }),
    onSuccess: () => {
      toast.show({
        type: 'success',
        message: i18n.language.startsWith('zh') ? '展示配置已更新' : 'Display settings updated',
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
          ? i18n.language.startsWith('zh')
            ? '匹配成功，已创建群聊'
            : 'Matched and created a group chat'
          : i18n.language.startsWith('zh')
            ? '已记录划卡'
            : 'Swipe recorded',
      });
      invalidate();
    },
  });

  const contextOptions =
    contextsData?.items.map((track) => ({
      value: track.id,
      label: `${track.competition.abbreviation} / ${track.name}`,
    })) ?? [];

  const teamOptions = [
    {
      value: 'new-solo',
      label: i18n.language.startsWith('zh') ? '新建 Solo Team' : 'Create Solo Team',
    },
    ...((myRecruitments?.items ?? []).map((item) => ({
      value: item.team.id,
      label: item.team.name,
    })) ?? []),
  ];

  const resumeOptions = [
    { value: 'none', label: i18n.language.startsWith('zh') ? '不展示简历' : 'No resume' },
    ...(resumes ?? []).map((resume) => ({ value: resume.id, label: resume.title })),
  ];

  const deckCard = deckData?.items?.[0] ?? null;
  const matches = matchesData?.items ?? [];

  return (
    <PageContainer>
      <PageHeader
        title={t('teams.title')}
        description={
          i18n.language.startsWith('zh') ? '比赛组队匹配工作台' : 'Competition matching workspace'
        }
        icon="people-outline"
        color="#f59e0b"
      />

      <Segment
        segments={[
          { key: 'match', label: 'Match' },
          { key: 'matches', label: 'Matches' },
          { key: 'my-team', label: 'My Team' },
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
            <EmptyState
              icon="people-outline"
              title={
                i18n.language.startsWith('zh')
                  ? '先在 My Team 创建组队卡'
                  : 'Create your card in My Team first'
              }
            />
          ) : !deckCard ? (
            <EmptyState
              icon="heart-outline"
              title={i18n.language.startsWith('zh') ? '当前没有可划的卡' : 'No cards in the deck'}
            />
          ) : (
            <View style={styles.section}>
              <RecruitmentCard card={deckCard} />
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
                  <Text style={[styles.actionLabel, { color: colors.foreground }]}>Pass</Text>
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
                    Like
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
              title={i18n.language.startsWith('zh') ? '还没有匹配' : 'No matches yet'}
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
                    {match.otherCard.context.competition.abbreviation} /{' '}
                    {match.otherCard.context.trackName}
                  </Text>
                  <View style={styles.badges}>
                    <BadgeLike label={match.matchKind} colors={colors} />
                    <BadgeLike label={match.otherCard.status} colors={colors} />
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
                    {i18n.language.startsWith('zh') ? '组队卡编辑器' : 'Recruitment Editor'}
                  </Text>
                  <Select
                    label={i18n.language.startsWith('zh') ? '绑定队伍' : 'Backing team'}
                    options={teamOptions}
                    value={selectedTeamId}
                    onChange={setSelectedTeamId}
                  />
                  <Select
                    label={i18n.language.startsWith('zh') ? '比赛赛道' : 'Competition track'}
                    options={contextOptions}
                    value={form.competitionTrackId}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, competitionTrackId: value }))
                    }
                  />
                  <FieldInput
                    label={i18n.language.startsWith('zh') ? '队伍名（仅 Solo）' : 'Solo team name'}
                    value={form.teamName}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, teamName: value }))}
                  />
                  <FieldInput
                    label={i18n.language.startsWith('zh') ? '摘要' : 'Headline'}
                    value={form.headline}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, headline: value }))}
                  />
                  <FieldInput
                    label={i18n.language.startsWith('zh') ? '详细说明' : 'Detail note'}
                    value={form.detailNote}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, detailNote: value }))}
                    multiline
                  />
                  <FieldInput
                    label={i18n.language.startsWith('zh') ? '我能提供' : 'Offer roles'}
                    value={form.offerRoles}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, offerRoles: value }))}
                  />
                  <FieldInput
                    label={i18n.language.startsWith('zh') ? '我需要' : 'Need roles'}
                    value={form.needRoles}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, needRoles: value }))}
                  />
                  <FieldInput
                    label={i18n.language.startsWith('zh') ? '技能标签' : 'Skill tags'}
                    value={form.skillTags}
                    onChangeText={(value) => setForm((prev) => ({ ...prev, skillTags: value }))}
                  />
                  <FieldInput
                    label={i18n.language.startsWith('zh') ? '目标人数' : 'Target size'}
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
                          ? i18n.language.startsWith('zh')
                            ? '保存'
                            : 'Save'
                          : i18n.language.startsWith('zh')
                            ? '创建'
                            : 'Create'}
                      </Text>
                    </TouchableOpacity>
                    {currentCard && (
                      <TouchableOpacity
                        style={[styles.actionButton, { borderColor: colors.border }]}
                        onPress={() => publishMutation.mutate(currentCard.id)}
                      >
                        <Text style={[styles.actionLabel, { color: colors.foreground }]}>
                          {i18n.language.startsWith('zh') ? '发布' : 'Publish'}
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
                    {i18n.language.startsWith('zh') ? '我的展示配置' : 'My display settings'}
                  </Text>
                  <FieldInput
                    label={i18n.language.startsWith('zh') ? '一句话介绍' : 'Intro line'}
                    value={introLine}
                    onChangeText={setIntroLine}
                  />
                  <Select
                    label={i18n.language.startsWith('zh') ? '展示简历' : 'Selected resume'}
                    options={resumeOptions}
                    value={selectedResumeId}
                    onChange={setSelectedResumeId}
                  />
                  <View style={styles.row}>
                    <TouchableOpacity
                      style={[styles.actionButton, { borderColor: colors.border }]}
                      disabled={!currentCard}
                      onPress={() => profileMutation.mutate(false)}
                    >
                      <Text style={[styles.actionLabel, { color: colors.foreground }]}>
                        {i18n.language.startsWith('zh') ? '仅保存' : 'Save'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                      disabled={!currentCard}
                      onPress={() => profileMutation.mutate(true)}
                    >
                      <Text style={[styles.primaryLabel, { color: colors.primaryForeground }]}>
                        {i18n.language.startsWith('zh') ? '确认同意展示' : 'Confirm consent'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {currentCard && <RecruitmentCard card={currentCard} />}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </PageContainer>
  );
}

function RecruitmentCard({ card }: { card: TeamRecruitmentCardFrontDto }) {
  const colors = useColors();

  return (
    <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.cardKicker, { color: colors.foregroundMuted }]}>
        {card.context.competition.abbreviation} / {card.context.trackName}
      </Text>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>{card.team.name}</Text>
      <Text style={[styles.cardMeta, { color: colors.foregroundMuted }]}>{card.headline}</Text>
      <View style={styles.badges}>
        <BadgeLike label={`${card.team.currentSize}/${card.team.targetSize}`} colors={colors} />
        <BadgeLike label={card.status} colors={colors} />
      </View>
      {!!card.offerRoles.length && (
        <Text style={[styles.listText, { color: colors.foreground }]}>
          Offer: {card.offerRoles.join(', ')}
        </Text>
      )}
      {!!card.needRoles.length && (
        <Text style={[styles.listText, { color: colors.foreground }]}>
          Need: {card.needRoles.join(', ')}
        </Text>
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
