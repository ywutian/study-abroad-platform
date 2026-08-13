/**
 * Assessment Page - Personality assessments (MBTI, Holland, Major Match)
 * with questionnaire UI and results visualization.
 */
import {
  AnimatedButton,
  AnimatedCard,
  Badge,
  CardContent,
  EmptyState,
  Loading,
  Progress,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { qk } from '@/lib/query';
import { fontFamily, fontWeight, spacing, useColors, withOpacity } from '@/utils/theme';
import { Ionicons } from '@expo/vector-icons';
import { API_ROUTES } from '@study-abroad/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Stack, router } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LayoutAnimation,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { S } from './assessment.styles';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Types ────────────────────────────────────────────────
enum AssessmentTypeEnum {
  MBTI = 'MBTI',
  HOLLAND = 'HOLLAND',
  MAJOR_MATCH = 'MAJOR_MATCH',
}

interface QuestionOptionDto {
  value: string | number;
  text: string;
  textZh: string;
}
interface QuestionDto {
  id: string;
  text: string;
  textZh: string;
  options: QuestionOptionDto[];
  dimension?: string;
}
interface AssessmentDto {
  id: string;
  type: AssessmentTypeEnum;
  title: string;
  titleZh: string;
  description?: string;
  descriptionZh?: string;
  questions: QuestionDto[];
}
interface SubmitAssessmentDto {
  type: AssessmentTypeEnum;
  answers: { questionId: string; answer: string }[];
}
interface MbtiResultDto {
  type: string;
  scores: Record<string, number>;
  title: string;
  titleZh: string;
  description: string;
  descriptionZh: string;
  strengths: string[];
  careers: string[];
  majors: string[];
}
interface HollandResultDto {
  codes: string;
  scores: Record<string, number>;
  types: string[];
  typesZh: string[];
  fields: string[];
  fieldsZh: string[];
  majors: string[];
}
interface AssessmentResultDto {
  id: string;
  type: AssessmentTypeEnum;
  mbtiResult?: MbtiResultDto;
  hollandResult?: HollandResultDto;
  completedAt: Date;
}

// ── Constants ────────────────────────────────────────────
const MBTI_DIMS: [string, string][] = [
  ['E', 'I'],
  ['S', 'N'],
  ['T', 'F'],
  ['J', 'P'],
];
const HOLLAND_KEYS = ['R', 'I', 'A', 'S', 'E', 'C'];
const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  MBTI: 'extension-puzzle-outline',
  HOLLAND: 'compass-outline',
  MAJOR_MATCH: 'school-outline',
};
type ViewState = 'select' | 'quiz' | 'result' | 'history';

// ── Main Component ───────────────────────────────────────
export default function AssessmentPage() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const isZh = i18n.language === 'zh';
  const loc = useCallback((en: string, zh: string) => (isZh ? zh : en), [isZh]);

  // Token-driven category colors (dark-mode safe — derived from theme).
  const TYPE_COLORS: Record<string, string> = {
    MBTI: colors.violet,
    HOLLAND: colors.warning,
    MAJOR_MATCH: colors.info,
  };
  const MBTI_DIM_COLORS: Record<string, string> = {
    E: colors.foreground,
    I: colors.foreground,
    S: colors.success,
    N: colors.success,
    T: colors.warning,
    F: colors.warning,
    J: colors.error,
    P: colors.error,
  };
  const HOLLAND_COLORS: Record<string, string> = {
    R: colors.error,
    I: colors.info,
    A: colors.violet,
    S: colors.success,
    E: colors.warning,
    C: colors.foregroundMuted,
  };

  const [viewState, setViewState] = useState<ViewState>('select');
  const [selectedType, setSelectedType] = useState<AssessmentTypeEnum | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left');
  const [result, setResult] = useState<AssessmentResultDto | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Queries ────────────────────────────────────────────
  const {
    data: assessment,
    isLoading: quizLoading,
    refetch: refetchQuiz,
  } = useQuery<AssessmentDto>({
    queryKey: qk.assessment.byType(selectedType),
    queryFn: () => apiClient.get(`${API_ROUTES.ASSESSMENTS}/${selectedType}`),
    enabled: !!selectedType && viewState === 'quiz',
    staleTime: 10 * 60_000,
  });

  const {
    data: history,
    isLoading: histLoading,
    refetch: refetchHist,
  } = useQuery<AssessmentResultDto[]>({
    queryKey: qk.assessment.history(),
    queryFn: () => apiClient.get(`${API_ROUTES.ASSESSMENTS}/history/me`),
    enabled: viewState === 'history',
    staleTime: 5 * 60_000,
  });

  const submitMut = useMutation<AssessmentResultDto, Error, SubmitAssessmentDto>({
    mutationFn: (dto) => apiClient.post<AssessmentResultDto>(API_ROUTES.ASSESSMENTS, dto),
    onSuccess: (data) => {
      setResult(data);
      setViewState('result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('assessment.result.title'));
    },
    onError: (err) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(err.message);
    },
  });

  // ── Handlers ───────────────────────────────────────────
  const handleSelectType = useCallback((type: AssessmentTypeEnum) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedType(type);
    setCurrentIndex(0);
    setAnswers(new Map());
    setResult(null);
    setViewState('quiz');
  }, []);

  const handleAnswer = useCallback(
    (qId: string, val: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setAnswers((prev) => new Map(prev).set(qId, val));
      if (autoRef.current) clearTimeout(autoRef.current);
      autoRef.current = setTimeout(() => {
        if (assessment && currentIndex < assessment.questions.length - 1) {
          setSlideDir('left');
          setCurrentIndex((i) => i + 1);
        }
      }, 350);
    },
    [assessment, currentIndex]
  );

  const handleNav = useCallback(
    (dir: 'next' | 'prev') => {
      if (dir === 'next' && assessment && currentIndex < assessment.questions.length - 1) {
        setSlideDir('left');
        setCurrentIndex((i) => i + 1);
      } else if (dir === 'prev' && currentIndex > 0) {
        setSlideDir('right');
        setCurrentIndex((i) => i - 1);
      }
    },
    [assessment, currentIndex]
  );

  const handleSubmit = useCallback(() => {
    if (!selectedType || !assessment) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    submitMut.mutate({
      type: selectedType,
      answers: Array.from(answers.entries()).map(([questionId, answer]) => ({
        questionId,
        answer,
      })),
    });
  }, [selectedType, assessment, answers, submitMut]);

  const goBack = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (autoRef.current) clearTimeout(autoRef.current);
    setViewState('select');
    setSelectedType(null);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (viewState === 'history') await refetchHist();
    if (viewState === 'quiz') await refetchQuiz();
    setRefreshing(false);
  }, [viewState, refetchHist, refetchQuiz]);

  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleDateString(isZh ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const badgeVariant = (tp: AssessmentTypeEnum) =>
    tp === AssessmentTypeEnum.MBTI
      ? ('default' as const)
      : tp === AssessmentTypeEnum.HOLLAND
        ? ('warning' as const)
        : ('secondary' as const);

  // ── Render: Selection ──────────────────────────────────
  const renderSelection = () => (
    <Animated.View entering={FadeInDown.duration(400).springify()}>
      <Text style={[S.title, { color: colors.foreground }]}>{t('assessment.selectType')}</Text>
      {[AssessmentTypeEnum.MBTI, AssessmentTypeEnum.HOLLAND, AssessmentTypeEnum.MAJOR_MATCH].map(
        (type, idx) => {
          const c = TYPE_COLORS[type];
          return (
            <Animated.View key={type} entering={FadeInUp.delay(idx * 100).springify()}>
              <AnimatedCard
                style={[S.typeCard, S.typeCardAccent, { borderLeftColor: c }]}
                onPress={() => handleSelectType(type)}
                accessibilityLabel={t(`assessment.types.${type}.title`, type)}
              >
                <CardContent>
                  <View style={S.typeRow}>
                    <View style={[S.typeIcon, { backgroundColor: withOpacity(c, 0.1) }]}>
                      <Ionicons name={TYPE_ICONS[type]} size={28} color={c} />
                    </View>
                    <View style={S.typeInfo}>
                      <Text style={[S.typeTitle, { color: colors.foreground }]}>
                        {t(`assessment.types.${type}.title`, type)}
                      </Text>
                      <Text
                        style={[S.typeDesc, { color: colors.foregroundMuted }]}
                        numberOfLines={2}
                      >
                        {t(`assessment.types.${type}.description`, '')}
                      </Text>
                    </View>
                    <AnimatedButton
                      onPress={() => handleSelectType(type)}
                      size="sm"
                      style={{ backgroundColor: c }}
                    >
                      {t('assessment.start')}
                    </AnimatedButton>
                  </View>
                </CardContent>
              </AnimatedCard>
            </Animated.View>
          );
        }
      )}
      <AnimatedButton
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setViewState('history');
        }}
        variant="outline"
        size="lg"
        style={S.fullBtn}
        leftIcon={<Ionicons name="time-outline" size={20} color={colors.foreground} />}
      >
        {t('assessment.history.title')}
      </AnimatedButton>
    </Animated.View>
  );

  // ── Render: Quiz ───────────────────────────────────────
  const renderQuiz = () => {
    if (quizLoading || !assessment) return <Loading text={t('assessment.loading')} />;
    const qs = assessment.questions;
    const q = qs[currentIndex];
    if (!q) return null;
    const cur = answers.get(q.id);
    const allDone = qs.every((x) => answers.has(x.id));
    const isLast = currentIndex === qs.length - 1;
    const Slide = slideDir === 'left' ? SlideInRight : SlideInLeft;
    const tc = TYPE_COLORS[selectedType!];
    return (
      <View>
        <View style={S.quizHeader}>
          <TouchableOpacity
            onPress={goBack}
            style={S.iconBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text
            style={[S.progText, { color: colors.foregroundMuted, fontFamily: fontFamily.mono }]}
          >
            {t('assessment.questionOf', {
              current: currentIndex + 1,
              total: qs.length,
            })}
          </Text>
        </View>
        <Progress
          value={currentIndex + 1}
          max={qs.length}
          height={4}
          color={tc}
          trackColor={colors.muted}
          style={S.quizProgress}
        />
        <Animated.View
          key={`q-${currentIndex}`}
          entering={Slide.duration(300).springify()}
          style={S.questionStage}
        >
          <Text style={[S.qNum, { color: tc, fontFamily: fontFamily.mono }]}>
            Q{currentIndex + 1}
          </Text>
          <Text style={[S.qText, { color: colors.foreground }]}>{loc(q.text, q.textZh)}</Text>
          <View style={{ gap: spacing.sm }}>
            {q.options.map((o, oi) => {
              const sel = cur === String(o.value);
              return (
                <Animated.View key={`${q.id}-${oi}`} entering={FadeInUp.delay(oi * 50).springify()}>
                  <TouchableOpacity
                    onPress={() => handleAnswer(q.id, String(o.value))}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sel }}
                    accessibilityLabel={loc(o.text, o.textZh)}
                    style={[
                      S.opt,
                      sel ? S.selectedOption : S.defaultOption,
                      {
                        backgroundColor: sel ? withOpacity(tc, 0.125) : colors.card,
                        borderColor: sel ? tc : colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        S.optDot,
                        sel
                          ? { backgroundColor: tc, borderColor: tc }
                          : { borderColor: colors.foregroundMuted },
                      ]}
                    >
                      {sel && (
                        <Ionicons name="checkmark" size={12} color={colors.primaryForeground} />
                      )}
                    </View>
                    <Text
                      style={[
                        S.optText,
                        {
                          color: sel ? tc : colors.foreground,
                          fontWeight: sel ? fontWeight.semibold : fontWeight.normal,
                        },
                      ]}
                    >
                      {loc(o.text, o.textZh)}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
        <View style={S.navRow}>
          <AnimatedButton
            onPress={() => handleNav('prev')}
            variant="outline"
            disabled={currentIndex === 0}
            leftIcon={<Ionicons name="chevron-back" size={18} color={colors.foreground} />}
          >
            {t('assessment.previous')}
          </AnimatedButton>
          {isLast && allDone ? (
            <AnimatedButton
              onPress={handleSubmit}
              loading={submitMut.isPending}
              style={{ backgroundColor: tc }}
            >
              {submitMut.isPending ? t('assessment.submitting') : t('assessment.submit')}
            </AnimatedButton>
          ) : (
            <AnimatedButton
              onPress={() => handleNav('next')}
              disabled={!cur || isLast}
              rightIcon={
                <Ionicons name="chevron-forward" size={18} color={colors.primaryForeground} />
              }
            >
              {t('assessment.next')}
            </AnimatedButton>
          )}
        </View>
      </View>
    );
  };

  // ── Render: MBTI Result ────────────────────────────────
  const renderMbti = (m: MbtiResultDto) => {
    const tc = TYPE_COLORS.MBTI;
    return (
      <Animated.View entering={FadeInDown.duration(500).springify()}>
        <View
          style={[S.hero, { backgroundColor: withOpacity(tc, 0.0625), borderColor: colors.border }]}
        >
          <Animated.Text
            entering={FadeInDown.delay(200).springify()}
            style={[S.mbtiType, { color: tc, fontFamily: fontFamily.mono }]}
          >
            {m.type}
          </Animated.Text>
          <Text style={[S.heroTitle, { color: colors.foreground }]}>{loc(m.title, m.titleZh)}</Text>
          <Text style={[S.heroDesc, { color: colors.foregroundSecondary }]}>
            {loc(m.description, m.descriptionZh)}
          </Text>
        </View>
        <View style={S.sec}>
          <Text style={[S.secLabel, { color: colors.foreground }]}>
            {t('assessment.result.dimensions')}
          </Text>
          {MBTI_DIMS.map(([l, r], i) => {
            const ls = m.scores[l] || 0,
              rs = m.scores[r] || 0,
              tot = ls + rs || 1;
            const lp = Math.round((ls / tot) * 100),
              rp = 100 - lp;
            const dc = MBTI_DIM_COLORS[l];
            return (
              <Animated.View
                key={`${l}${r}`}
                entering={FadeInUp.delay(i * 100).springify()}
                style={{ marginBottom: spacing.lg }}
              >
                <View style={S.dimLabels}>
                  <Text style={[S.dimLbl, { color: dc, fontFamily: fontFamily.mono }]}>
                    {l} {lp}%
                  </Text>
                  <Text style={[S.dimLbl, { color: dc, fontFamily: fontFamily.mono }]}>
                    {rp}% {r}
                  </Text>
                </View>
                <View style={[S.dimTrack, { backgroundColor: colors.muted }]}>
                  <View
                    style={[
                      S.dimFill,
                      S.dimFillLeft,
                      {
                        width: `${lp}%`,
                        backgroundColor: dc,
                      },
                    ]}
                  />
                  <View
                    style={[
                      S.dimFill,
                      S.dimFillRight,
                      {
                        width: `${rp}%`,
                        backgroundColor: withOpacity(dc, 0.25),
                      },
                    ]}
                  />
                </View>
              </Animated.View>
            );
          })}
        </View>
        {m.strengths.length > 0 && (
          <View style={S.sec}>
            <Text style={[S.secLabel, { color: colors.foreground }]}>
              {t('assessment.result.strengths')}
            </Text>
            {m.strengths.map((s, i) => (
              <View key={i} style={S.listRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={[S.listText, { color: colors.foregroundSecondary }]}>{s}</Text>
              </View>
            ))}
          </View>
        )}
        {m.careers.length > 0 && renderChips(t('assessment.result.careers'), m.careers, tc)}
        {m.majors.length > 0 && renderChips(t('assessment.result.majors'), m.majors, colors.info)}
      </Animated.View>
    );
  };

  // ── Render: Holland Result ─────────────────────────────
  const renderHolland = (h: HollandResultDto) => {
    const tc = TYPE_COLORS.HOLLAND;
    const mx = Math.max(...Object.values(h.scores), 1);
    return (
      <Animated.View entering={FadeInDown.duration(500).springify()}>
        <View
          style={[S.hero, { backgroundColor: withOpacity(tc, 0.0625), borderColor: colors.border }]}
        >
          <Animated.Text
            entering={FadeInDown.delay(200).springify()}
            style={[S.hollandCode, { color: tc, fontFamily: fontFamily.mono }]}
          >
            {h.codes}
          </Animated.Text>
          <View style={S.hollandTypes}>
            {(isZh ? h.typesZh : h.types).map((tp, i) => (
              <Badge key={i} variant="warning" style={{ marginRight: spacing.xs }}>
                {tp}
              </Badge>
            ))}
          </View>
        </View>
        <View style={S.sec}>
          <Text style={[S.secLabel, { color: colors.foreground }]}>
            {t('assessment.result.dimensions')}
          </Text>
          {HOLLAND_KEYS.map((k, i) => {
            const sc = h.scores[k] || 0,
              pct = Math.round((sc / mx) * 100),
              bc = HOLLAND_COLORS[k];
            return (
              <Animated.View key={k} entering={FadeInUp.delay(i * 80).springify()} style={S.hBar}>
                <View style={[S.hKey, { backgroundColor: bc }]}>
                  <Text style={[S.hKeyTxt, { color: colors.primaryForeground }]}>{k}</Text>
                </View>
                <View style={S.flex}>
                  <Progress
                    value={pct}
                    max={100}
                    height={10}
                    color={bc}
                    trackColor={colors.muted}
                    borderRadius={5}
                  />
                </View>
                <Text style={[S.hScore, { color: colors.foreground, fontFamily: fontFamily.mono }]}>
                  {sc}
                </Text>
              </Animated.View>
            );
          })}
        </View>
        {h.fields.length > 0 &&
          renderChips(t('assessment.result.fields'), isZh ? h.fieldsZh : h.fields, tc)}
        {h.majors.length > 0 &&
          renderChips(t('assessment.result.recommendedMajors'), h.majors, colors.info)}
      </Animated.View>
    );
  };

  // ── Shared: Chips section ──────────────────────────────
  const renderChips = (label: string, items: string[], color: string) => (
    <View style={S.sec}>
      <Text style={[S.secLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={S.chips}>
        {items.map((item, i) => (
          <View key={i} style={[S.chip, { backgroundColor: withOpacity(color, 0.125) }]}>
            <Text style={[S.chipTxt, { color }]}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  // ── Render: Result ─────────────────────────────────────
  const renderResult = () => {
    if (!result) return null;
    return (
      <View>
        <View style={S.rHeader}>
          <TouchableOpacity
            onPress={goBack}
            style={S.iconBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[S.rHeaderTitle, { color: colors.foreground }]}>
            {t('assessment.result.title')}
          </Text>
          <View style={S.headerSpacer} />
        </View>
        {result.mbtiResult && renderMbti(result.mbtiResult)}
        {result.hollandResult && renderHolland(result.hollandResult)}
        {!result.mbtiResult && !result.hollandResult && (
          <View
            style={[
              S.hero,
              {
                backgroundColor: withOpacity(TYPE_COLORS[result.type], 0.0625),
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name={TYPE_ICONS[result.type]} size={48} color={TYPE_COLORS[result.type]} />
            <Text style={[S.heroTitle, { color: colors.foreground, marginTop: spacing.md }]}>
              {t('assessment.result.title')}
            </Text>
          </View>
        )}
        <View style={S.resultActions}>
          <AnimatedButton
            onPress={() => result?.type && handleSelectType(result.type)}
            variant="outline"
            size="lg"
            style={S.fullBtn}
            leftIcon={<Ionicons name="refresh-outline" size={20} color={colors.foreground} />}
          >
            {t('assessment.retake')}
          </AnimatedButton>
          <AnimatedButton onPress={goBack} variant="ghost" size="lg" style={S.fullBtn}>
            {t('assessment.selectType')}
          </AnimatedButton>
        </View>
      </View>
    );
  };

  // ── Render: History ────────────────────────────────────
  const renderHistory = () => {
    if (histLoading) return <Loading text={t('assessment.history.loading')} />;
    if (!history || history.length === 0) {
      return (
        <EmptyState
          icon="time-outline"
          title={t('assessment.history.empty')}
          description={t('assessment.history.emptyDesc')}
          action={{ label: t('assessment.start'), onPress: goBack }}
        />
      );
    }
    return (
      <Animated.View entering={FadeInUp.duration(400).springify()}>
        <View style={S.histHeader}>
          <TouchableOpacity
            onPress={goBack}
            style={S.iconBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[S.title, { color: colors.foreground }]}>
            {t('assessment.history.title')}
          </Text>
          <View style={S.headerSpacer} />
        </View>
        {history.map((item, idx) => {
          const tc = TYPE_COLORS[item.type];
          const summary = item.mbtiResult?.type || item.hollandResult?.codes || item.type;
          return (
            <Animated.View key={item.id} entering={FadeInUp.delay(idx * 80).springify()}>
              <AnimatedCard
                style={S.histCard}
                onPress={() => {
                  setResult(item);
                  setViewState('result');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                accessibilityLabel={`${item.type} ${summary} ${fmtDate(item.completedAt)}`}
              >
                <CardContent>
                  <View style={S.histRow}>
                    <View style={[S.histIcon, { backgroundColor: withOpacity(tc, 0.125) }]}>
                      <Ionicons name={TYPE_ICONS[item.type]} size={22} color={tc} />
                    </View>
                    <View style={S.flex}>
                      <View style={S.histTop}>
                        <Badge variant={badgeVariant(item.type)}>{item.type}</Badge>
                        <Text style={[S.histSum, { color: tc, fontFamily: fontFamily.mono }]}>
                          {summary}
                        </Text>
                      </View>
                      <Text style={[S.histDate, { color: colors.foregroundMuted }]}>
                        {fmtDate(item.completedAt)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.foregroundMuted} />
                  </View>
                </CardContent>
              </AnimatedCard>
            </Animated.View>
          );
        })}
      </Animated.View>
    );
  };

  // ── Main Render ────────────────────────────────────────
  return (
    <>
      {/*
       * Keep this short, refreshable ScrollView out of UIKit's automatic
       * navigation-bar scroll-edge observation. With a native header here,
       * iOS can attach both the root stack and the still-mounted tab stack's
       * RNSNavigationController to the same UIScrollView during a push.
       */}
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={[
          S.navigationHeader,
          {
            paddingTop: insets.top,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={S.navigationBack}
          hitSlop={8}
          accessible
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[S.navigationTitle, { color: colors.foreground }]}>
          {t('assessment.title')}
        </Text>
        <View style={S.navigationBack} />
      </View>
      <ScrollView
        style={[S.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
        contentInsetAdjustmentBehavior="never"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={S.body}>
          {viewState === 'select' && renderSelection()}
          {viewState === 'quiz' && renderQuiz()}
          {viewState === 'result' && renderResult()}
          {viewState === 'history' && renderHistory()}
        </View>
      </ScrollView>
    </>
  );
}

// ── Styles ───────────────────────────────────────────────
