import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { useTranslation } from 'react-i18next';
import { AnimatedButton, Badge } from '@/components/ui';
import { useColors, withOpacity } from '@/utils/theme';
import { styles } from './EssayEditorScreen.styles';
import type {
  AIReviewResult,
  AIPolishResult,
  AIBrainstormResult,
  AIContinueResult,
  AIOpeningResult,
  AIRewriteResult,
} from './EssayEditorScreen';
// Sub-components for AI results

export function ReviewResult({
  result,
  colors,
  t,
}: {
  result: AIReviewResult;
  colors: ReturnType<typeof useColors>;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  return (
    <ScrollView style={styles.resultContainer}>
      {/* Overall Score */}
      <View
        style={[
          styles.scoreCard,
          { backgroundColor: withOpacity(colors.primary, 0.1), borderColor: colors.border },
        ]}
      >
        <Text style={[styles.scoreValue, { color: colors.primary }]}>{result.overallScore}</Text>
        <Text style={[styles.scoreLabel, { color: colors.foregroundMuted }]}>
          {t('essayEditor.overallScore')}
        </Text>
      </View>

      {/* Category Scores */}
      {result.scores?.map((score, i) => (
        <View key={i} style={[styles.categoryRow, { borderBottomColor: colors.border }]}>
          <View style={styles.categoryInfo}>
            <Text style={[styles.categoryName, { color: colors.foreground }]}>
              {score.category}
            </Text>
            <Text style={[styles.categoryFeedback, { color: colors.foregroundMuted }]}>
              {score.feedback}
            </Text>
          </View>
          <Badge variant={score.score >= 8 ? 'success' : score.score >= 6 ? 'warning' : 'error'}>
            {String(score.score)}/10
          </Badge>
        </View>
      ))}

      {/* Summary */}
      {result.summary && (
        <View style={styles.summarySection}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
            {t('essayEditor.summary')}
          </Text>
          <Text style={[styles.summaryText, { color: colors.foregroundMuted }]}>
            {result.summary}
          </Text>
        </View>
      )}

      {/* Suggestions */}
      {result.suggestions?.length > 0 && (
        <View style={styles.suggestionsSection}>
          <Text style={[styles.suggestionsTitle, { color: colors.foreground }]}>
            {t('essayEditor.suggestions')}
          </Text>
          {result.suggestions.map((suggestion, i) => (
            <View key={i} style={styles.suggestionRow}>
              <Ionicons name="bulb-outline" size={16} color={colors.warning} />
              <Text style={[styles.suggestionText, { color: colors.foregroundMuted }]}>
                {suggestion}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

export function PolishResult({
  result,
  colors,
  t,
  onApply,
  onCopy,
}: {
  result: AIPolishResult;
  colors: ReturnType<typeof useColors>;
  t: ReturnType<typeof useTranslation>['t'];
  onApply: () => void;
  onCopy: () => void;
}) {
  return (
    <ScrollView style={styles.resultContainer}>
      {/* Changes */}
      {result.changes?.map((change, i) => (
        <View
          key={i}
          style={[styles.changeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text
            style={[
              styles.changeOriginal,
              { color: colors.error, backgroundColor: withOpacity(colors.error, 0.1) },
            ]}
          >
            {change.original}
          </Text>
          <Ionicons
            name="arrow-down"
            size={16}
            color={colors.foregroundMuted}
            style={styles.changeArrow}
          />
          <Text
            style={[
              styles.changeRevised,
              { color: colors.success, backgroundColor: withOpacity(colors.success, 0.1) },
            ]}
          >
            {change.revised}
          </Text>
          <Text style={[styles.changeReason, { color: colors.foregroundMuted }]}>
            {change.reason}
          </Text>
        </View>
      ))}

      <View style={styles.resultActions}>
        <AnimatedButton onPress={onApply} style={styles.resultActionBtn}>
          {t('essayEditor.applyChanges')}
        </AnimatedButton>
        <AnimatedButton onPress={onCopy} variant="outline" style={styles.resultActionBtn}>
          {t('essayEditor.copy')}
        </AnimatedButton>
      </View>
    </ScrollView>
  );
}

export function BrainstormResult({
  result,
  colors,
  t,
  onCopy,
}: {
  result: AIBrainstormResult;
  colors: ReturnType<typeof useColors>;
  t: ReturnType<typeof useTranslation>['t'];
  onCopy: (text: string) => void;
}) {
  return (
    <ScrollView style={styles.resultContainer}>
      {result.ideas?.map((idea, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => onCopy(idea.description)}
          accessibilityRole="button"
          accessibilityLabel={`${idea.title} — ${t('essayEditor.tapToCopy')}`}
          style={[styles.ideaCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={styles.ideaHeader}>
            <Ionicons name="bulb" size={18} color={colors.warning} />
            <Text style={[styles.ideaTitle, { color: colors.foreground }]}>{idea.title}</Text>
          </View>
          <Text style={[styles.ideaDesc, { color: colors.foregroundMuted }]}>
            {idea.description}
          </Text>
          <Text style={[styles.tapToCopy, { color: colors.primary }]}>
            {t('essayEditor.tapToCopy')}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

export function ContinueResult({
  result,
  colors,
  t,
  onAppend,
  onCopy,
}: {
  result: AIContinueResult;
  colors: ReturnType<typeof useColors>;
  t: ReturnType<typeof useTranslation>['t'];
  onAppend: () => void;
  onCopy: () => void;
}) {
  return (
    <ScrollView style={styles.resultContainer}>
      <Text
        style={[
          styles.continuationText,
          { color: colors.foreground, backgroundColor: withOpacity(colors.primary, 0.05) },
        ]}
      >
        {result.continuation}
      </Text>
      {result.suggestions?.length > 0 && (
        <View style={styles.suggestionsSection}>
          <Text style={[styles.suggestionsTitle, { color: colors.foreground }]}>
            {t('essayEditor.suggestions')}
          </Text>
          {result.suggestions.map((s, i) => (
            <Text key={i} style={[styles.suggestionText, { color: colors.foregroundMuted }]}>
              • {s}
            </Text>
          ))}
        </View>
      )}
      <View style={styles.resultActions}>
        <AnimatedButton onPress={onAppend} style={styles.resultActionBtn}>
          {t('essayEditor.appendToEssay')}
        </AnimatedButton>
        <AnimatedButton onPress={onCopy} variant="outline" style={styles.resultActionBtn}>
          {t('essayEditor.copy')}
        </AnimatedButton>
      </View>
    </ScrollView>
  );
}

export function OpeningResult({
  result,
  colors,
  t,
  onApply,
  onCopy,
}: {
  result: AIOpeningResult;
  colors: ReturnType<typeof useColors>;
  t: ReturnType<typeof useTranslation>['t'];
  onApply: (text: string) => void;
  onCopy: (text: string) => void;
}) {
  return (
    <ScrollView style={styles.resultContainer}>
      {result.openings?.map((opening, i) => (
        <View
          key={i}
          style={[styles.openingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Badge variant="secondary">{opening.style}</Badge>
          <Text style={[styles.openingText, { color: colors.foreground }]}>{opening.content}</Text>
          <View style={styles.openingActions}>
            <TouchableOpacity
              onPress={() => onApply(opening.content)}
              accessibilityRole="button"
              accessibilityLabel={t('essayEditor.use')}
              hitSlop={8}
              style={[styles.smallAction, { backgroundColor: withOpacity(colors.primary, 0.125) }]}
            >
              <Ionicons name="checkmark" size={16} color={colors.primary} />
              <Text style={[styles.smallActionText, { color: colors.primary }]}>
                {t('essayEditor.use')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onCopy(opening.content)}
              accessibilityRole="button"
              accessibilityLabel={t('essayEditor.copy')}
              hitSlop={8}
              style={[
                styles.smallAction,
                { backgroundColor: withOpacity(colors.foregroundMuted, 0.125) },
              ]}
            >
              <Ionicons name="copy" size={16} color={colors.foregroundMuted} />
              <Text style={[styles.smallActionText, { color: colors.foregroundMuted }]}>
                {t('essayEditor.copy')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

export function RewriteResult({
  result,
  colors,
  t,
  onApply,
  onCopy,
}: {
  result: AIRewriteResult;
  colors: ReturnType<typeof useColors>;
  t: ReturnType<typeof useTranslation>['t'];
  onApply: (text: string) => void;
  onCopy: (text: string) => void;
}) {
  return (
    <ScrollView style={styles.resultContainer}>
      {result.versions?.map((version, i) => (
        <View
          key={i}
          style={[styles.openingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Badge variant="default">{version.style}</Badge>
          <Text style={[styles.openingText, { color: colors.foreground }]}>{version.content}</Text>
          <View style={styles.openingActions}>
            <TouchableOpacity
              onPress={() => onApply(version.content)}
              accessibilityRole="button"
              accessibilityLabel={t('essayEditor.use')}
              hitSlop={8}
              style={[styles.smallAction, { backgroundColor: withOpacity(colors.primary, 0.125) }]}
            >
              <Ionicons name="checkmark" size={16} color={colors.primary} />
              <Text style={[styles.smallActionText, { color: colors.primary }]}>
                {t('essayEditor.use')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onCopy(version.content)}
              accessibilityRole="button"
              accessibilityLabel={t('essayEditor.copy')}
              hitSlop={8}
              style={[
                styles.smallAction,
                { backgroundColor: withOpacity(colors.foregroundMuted, 0.125) },
              ]}
            >
              <Ionicons name="copy" size={16} color={colors.foregroundMuted} />
              <Text style={[styles.smallActionText, { color: colors.foregroundMuted }]}>
                {t('essayEditor.copy')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
