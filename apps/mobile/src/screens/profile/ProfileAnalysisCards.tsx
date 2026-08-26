import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ApplicationAnalysisSchoolResult } from '@study-abroad/shared';
import { Badge, Card, CardContent } from '@/components/ui';
import { useColors } from '@/utils/theme';
import { styles } from './ProfileAnalysisScreen.styles';

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : '—';
}
export function FocusSchoolCard({ school }: { school: ApplicationAnalysisSchoolResult }) {
  const { t } = useTranslation();
  const colors = useColors();
  const probabilityLabel =
    school.prediction?.probability != null
      ? `${Math.round(school.prediction.probability * 100)}%`
      : t('applicationAnalysis.schoolCards.probabilityUnavailable');

  return (
    <Card>
      <CardContent>
        <View style={styles.schoolHeader}>
          <View style={styles.schoolTitleBlock}>
            <Text style={[styles.schoolTitle, { color: colors.foreground }]}>
              {school.schoolName}
            </Text>
            <View style={styles.badgeWrap}>
              <Badge variant="outline">{t(`applicationAnalysis.schoolTier.${school.tier}`)}</Badge>
              {school.round ? <Badge variant="secondary">{school.round}</Badge> : null}
            </View>
          </View>
          <Badge variant="secondary">{school.policyCard.roundContext}</Badge>
        </View>

        <Text style={[styles.sectionBody, { color: colors.foregroundMuted }]}>
          {school.assessment.summary}
        </Text>
        <View style={styles.badgeWrap}>
          <Badge variant="secondary">
            {t(`applicationAnalysis.policy.testing.${school.policyCard.testingPolicy}`)}
          </Badge>
          <Badge variant="secondary">
            {t(`applicationAnalysis.policy.intlAid.${school.policyCard.intlAidPolicy}`)}
          </Badge>
        </View>
        <Text style={[styles.helperText, { color: colors.foregroundMuted }]}>
          {t('applicationAnalysis.schoolCards.probability')}:{' '}
          <Text style={[styles.helperNumeric, { color: colors.foreground }]}>
            {probabilityLabel}
          </Text>
          {school.prediction?.confidence
            ? `  •  ${t('applicationAnalysis.schoolCards.confidence')}: ${t(
                `applicationAnalysis.confidence.${school.prediction.confidence}`
              )}`
            : ''}
          {school.prediction?.updatedAt
            ? `  •  ${t('applicationAnalysis.schoolCards.updated')}: ${formatDate(
                school.prediction.updatedAt
              )}`
            : ''}
        </Text>

        <View style={styles.columnStack}>
          <ListBlock
            title={t('applicationAnalysis.schoolCards.whyHard')}
            items={school.assessment.whyThisIsHard}
            compact
          />
          <ListBlock
            title={t('applicationAnalysis.schoolCards.strengths')}
            items={school.assessment.compensatingStrengths}
            compact
          />
          <ListBlock
            title={t('applicationAnalysis.schoolCards.gaps')}
            items={school.assessment.topGaps}
            compact
          />
          <ListBlock
            title={t('applicationAnalysis.schoolCards.nextActions')}
            items={school.assessment.nextActions}
            compact
          />
          <ListBlock
            title={t('applicationAnalysis.schoolCards.hardStops')}
            items={school.assessment.hardStopRisks}
            compact
          />
          {school.recourse ? (
            <ListBlock
              title={t('applicationAnalysis.schoolCards.recourse')}
              items={[
                school.recourse.goal,
                ...school.recourse.recommendedChanges.map(
                  (item) => `${item.action}: ${item.rationale}`
                ),
                ...school.recourse.constraints,
                school.recourse.whyNotGuaranteed,
              ]}
              compact
            />
          ) : null}
          {school.uncertainty ? (
            <ListBlock
              title={t('applicationAnalysis.schoolCards.uncertainty')}
              items={[
                `${t('applicationAnalysis.schoolCards.uncertaintyRange')}: ${
                  school.uncertainty.probabilityLow != null
                    ? `${Math.round(school.uncertainty.probabilityLow * 100)}%`
                    : '—'
                } - ${
                  school.uncertainty.probabilityHigh != null
                    ? `${Math.round(school.uncertainty.probabilityHigh * 100)}%`
                    : '—'
                }`,
                ...school.uncertainty.reasons,
              ]}
              compact
            />
          ) : null}
        </View>
      </CardContent>
    </Card>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.foregroundMuted }]}>{title}</Text>
      <View style={styles.columnStack}>{children}</View>
    </View>
  );
}

export function InfoCard({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.infoCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.infoLabel, { color: colors.foregroundMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

export function MetricBlock({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={styles.metricBlock}>
      <Text style={[styles.metricLabel, { color: colors.foregroundMuted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

export function ListBlock({
  title,
  items,
  compact = false,
}: {
  title: string;
  items: string[];
  compact?: boolean;
}) {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <View
      style={[
        styles.listCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.listTitle, { color: colors.foreground }]}>{title}</Text>
      {items.length ? (
        items.map((item, index) => (
          <View
            key={`${item}-${index}`}
            style={[styles.listItem, compact && styles.listItemCompact]}
          >
            <Text style={[styles.listBullet, { color: colors.primary }]}>•</Text>
            <Text style={[styles.listText, { color: colors.foregroundMuted }]}>{item}</Text>
          </View>
        ))
      ) : (
        <Text style={[styles.helperText, { color: colors.foregroundMuted }]}>
          {t('applicationAnalysis.emptyList')}
        </Text>
      )}
    </View>
  );
}

export function BulletList({ items }: { items: string[] }) {
  const colors = useColors();
  return (
    <View style={styles.columnStack}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.listItem}>
          <Text style={[styles.listBullet, { color: colors.primary }]}>•</Text>
          <Text style={[styles.listText, { color: colors.foregroundMuted }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}
