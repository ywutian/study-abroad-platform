import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TeamRecruitmentCardFrontDto } from '@study-abroad/shared';
import {
  getCompetitionTrackLabel,
  getRecruitmentContext,
  getRecruitmentContextName,
} from '@study-abroad/shared';
import { useColors, withOpacity } from '@/utils/theme';
import { styles } from './TeamsScreen.styles';
type TranslationFn = (key: string, options?: Record<string, unknown>) => string;
type RecruitmentMember = TeamRecruitmentCardFrontDto['members'][number];
type RecruitmentHighlight = NonNullable<RecruitmentMember['highlights']>['academics'][number];

export function RecruitmentCard({
  card,
  locale,
}: {
  card: TeamRecruitmentCardFrontDto;
  locale: string;
}) {
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
              key={member.userId ?? member.displayName}
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

export function getStatusLabel(t: TranslationFn, status: string) {
  return t(`teams.recruitment.status.${status}`);
}

export function getMatchKindLabel(t: TranslationFn, kind: string) {
  return kind === 'NETWORKING'
    ? t('teams.recruitment.matchKind.networking')
    : t('teams.recruitment.matchKind.teamUp');
}

function getToneStyle(tone: RecruitmentHighlight['tone'], colors: ReturnType<typeof useColors>) {
  switch (tone) {
    case 'success':
      return { backgroundColor: withOpacity(colors.success, 0.125), color: colors.success };
    case 'warning':
      return { backgroundColor: withOpacity(colors.warning, 0.125), color: colors.warning };
    case 'danger':
      return { backgroundColor: withOpacity(colors.error, 0.125), color: colors.error };
    default:
      return { backgroundColor: withOpacity(colors.info, 0.125), color: colors.info };
  }
}

function HighlightChipGroup({ title, chips }: { title: string; chips: RecruitmentHighlight[] }) {
  const colors = useColors();
  if (chips.length === 0) return null;

  return (
    <View style={styles.highlightBlock}>
      <Text style={[styles.highlightTitle, { color: colors.foregroundMuted }]}>{title}</Text>
      <View style={styles.chipRow}>
        {chips.map((chip, index) => {
          const toneStyle = getToneStyle(chip.tone, colors);
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
        accessibilityRole="button"
        accessibilityLabel={t('teams.recruitment.card.coordination')}
        accessibilityState={{ expanded }}
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

export function FieldInput({
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
    <View style={styles.fieldContainer}>
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
          },
          multiline ? styles.multilineInput : styles.singleLineInput,
        ]}
        placeholderTextColor={colors.placeholder}
      />
    </View>
  );
}

export function BadgeLike({
  label,
  colors,
}: {
  label: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.badge, { borderColor: colors.border, backgroundColor: colors.muted }]}>
      <Text style={[styles.badgeText, { color: colors.foreground }]}>{label}</Text>
    </View>
  );
}

export function ToggleChip({
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
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: active }}
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

export function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
