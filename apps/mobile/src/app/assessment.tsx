/**
 * Assessment Page - Personality assessments (MBTI, Holland, Major Match)
 * with questionnaire UI and results visualization.
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation } from '@tanstack/react-query';
import Animated, { FadeInDown, FadeInUp, SlideInRight, SlideInLeft } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  AnimatedButton,
  AnimatedCard,
  CardContent,
  Badge,
  EmptyState,
  Loading,
  Progress,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

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
const TYPE_COLORS: Record<string, string> = {
  MBTI: '#8b5cf6',
  HOLLAND: '#f59e0b',
  MAJOR_MATCH: '#3b82f6',
};
const MBTI_DIM_COLORS: Record<string, string> = {
  E: '#6366f1',
  I: '#6366f1',
  S: '#10b981',
  N: '#10b981',
  T: '#f59e0b',
  F: '#f59e0b',
  J: '#ef4444',
  P: '#ef4444',
};
const HOLLAND_COLORS: Record<string, string> = {
  R: '#ef4444',
  I: '#3b82f6',
  A: '#8b5cf6',
  S: '#10b981',
  E: '#f59e0b',
  C: '#64748b',
};
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
    queryKey: ['assessment', selectedType],
    queryFn: () => apiClient.get(`/assessment/${selectedType}`),
    enabled: !!selectedType && viewState === 'quiz',
    staleTime: 10 * 60_000,
  });

  const {
    data: history,
    isLoading: histLoading,
    refetch: refetchHist,
  } = useQuery<AssessmentResultDto[]>({
    queryKey: ['assessment', 'history'],
    queryFn: () => apiClient.get('/assessment/history/me'),
    enabled: viewState === 'history',
    staleTime: 5 * 60_000,
  });

  const submitMut = useMutation<AssessmentResultDto, Error, SubmitAssessmentDto>({
    mutationFn: (dto) => apiClient.post<AssessmentResultDto>('/assessment', dto),
    onSuccess: (data) => {
      setResult(data);
      setViewState('result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('assessment.result.title', 'Assessment Complete'));
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
      <Text style={[S.title, { color: colors.foreground }]}>
        {t('assessment.selectType', 'Choose an Assessment')}
      </Text>
      {[AssessmentTypeEnum.MBTI, AssessmentTypeEnum.HOLLAND, AssessmentTypeEnum.MAJOR_MATCH].map(
        (type, idx) => {
          const c = TYPE_COLORS[type];
          return (
            <Animated.View key={type} entering={FadeInUp.delay(idx * 100).springify()}>
              <AnimatedCard
                style={[S.typeCard, { borderLeftColor: c, borderLeftWidth: 4 }]}
                onPress={() => handleSelectType(type)}
              >
                <CardContent>
                  <View style={S.typeRow}>
                    <View style={[S.typeIcon, { backgroundColor: c + '18' }]}>
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
                      {t('assessment.start', 'Start')}
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
        {t('assessment.history.title', 'View History')}
      </AnimatedButton>
    </Animated.View>
  );

  // ── Render: Quiz ───────────────────────────────────────
  const renderQuiz = () => {
    if (quizLoading || !assessment) return <Loading text={t('assessment.loading', 'Loading...')} />;
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
          <TouchableOpacity onPress={goBack} style={S.iconBtn}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[S.progText, { color: colors.foregroundMuted }]}>
            {t('assessment.questionOf', '{{current}} / {{total}}', {
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
          style={{ marginBottom: spacing.xl }}
        />
        <Animated.View
          key={`q-${currentIndex}`}
          entering={Slide.duration(300).springify()}
          style={{ minHeight: 280 }}
        >
          <Text style={[S.qNum, { color: tc }]}>Q{currentIndex + 1}</Text>
          <Text style={[S.qText, { color: colors.foreground }]}>{loc(q.text, q.textZh)}</Text>
          <View style={{ gap: spacing.sm }}>
            {q.options.map((o, oi) => {
              const sel = cur === String(o.value);
              return (
                <Animated.View key={`${q.id}-${oi}`} entering={FadeInUp.delay(oi * 50).springify()}>
                  <TouchableOpacity
                    onPress={() => handleAnswer(q.id, String(o.value))}
                    activeOpacity={0.7}
                    style={[
                      S.opt,
                      {
                        backgroundColor: sel ? tc + '15' : colors.card,
                        borderColor: sel ? tc : colors.border,
                        borderWidth: sel ? 2 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        S.optDot,
                        {
                          backgroundColor: sel ? tc : 'transparent',
                          borderColor: sel ? tc : colors.foregroundMuted,
                        },
                      ]}
                    >
                      {sel && <Ionicons name="checkmark" size={12} color="#fff" />}
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
            {t('assessment.previous', 'Back')}
          </AnimatedButton>
          {isLast && allDone ? (
            <AnimatedButton
              onPress={handleSubmit}
              loading={submitMut.isPending}
              style={{ backgroundColor: tc }}
            >
              {submitMut.isPending
                ? t('assessment.submitting', 'Submitting...')
                : t('assessment.submit', 'Submit')}
            </AnimatedButton>
          ) : (
            <AnimatedButton
              onPress={() => handleNav('next')}
              disabled={!cur || isLast}
              rightIcon={
                <Ionicons name="chevron-forward" size={18} color={colors.primaryForeground} />
              }
            >
              {t('assessment.next', 'Next')}
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
        <View style={[S.hero, { backgroundColor: tc + '10' }]}>
          <Animated.Text
            entering={FadeInDown.delay(200).springify()}
            style={[S.mbtiType, { color: tc }]}
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
            {t('assessment.result.dimensions', 'Dimensions')}
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
                  <Text style={[S.dimLbl, { color: dc }]}>
                    {l} {lp}%
                  </Text>
                  <Text style={[S.dimLbl, { color: dc }]}>
                    {rp}% {r}
                  </Text>
                </View>
                <View style={[S.dimTrack, { backgroundColor: colors.muted }]}>
                  <View
                    style={[
                      S.dimFill,
                      {
                        width: `${lp}%`,
                        backgroundColor: dc,
                        borderTopLeftRadius: 4,
                        borderBottomLeftRadius: 4,
                      },
                    ]}
                  />
                  <View
                    style={[
                      S.dimFill,
                      {
                        width: `${rp}%`,
                        backgroundColor: dc + '40',
                        borderTopRightRadius: 4,
                        borderBottomRightRadius: 4,
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
              {t('assessment.result.strengths', 'Strengths')}
            </Text>
            {m.strengths.map((s, i) => (
              <View key={i} style={S.listRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={[S.listText, { color: colors.foregroundSecondary }]}>{s}</Text>
              </View>
            ))}
          </View>
        )}
        {m.careers.length > 0 &&
          renderChips(t('assessment.result.careers', 'Careers'), m.careers, tc)}
        {m.majors.length > 0 &&
          renderChips(t('assessment.result.majors', 'Majors'), m.majors, colors.info)}
      </Animated.View>
    );
  };

  // ── Render: Holland Result ─────────────────────────────
  const renderHolland = (h: HollandResultDto) => {
    const tc = TYPE_COLORS.HOLLAND;
    const mx = Math.max(...Object.values(h.scores), 1);
    return (
      <Animated.View entering={FadeInDown.duration(500).springify()}>
        <View style={[S.hero, { backgroundColor: tc + '10' }]}>
          <Animated.Text
            entering={FadeInDown.delay(200).springify()}
            style={[S.hollandCode, { color: tc }]}
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
            {t('assessment.result.dimensions', 'Score Profile')}
          </Text>
          {HOLLAND_KEYS.map((k, i) => {
            const sc = h.scores[k] || 0,
              pct = Math.round((sc / mx) * 100),
              bc = HOLLAND_COLORS[k];
            return (
              <Animated.View key={k} entering={FadeInUp.delay(i * 80).springify()} style={S.hBar}>
                <View style={[S.hKey, { backgroundColor: bc }]}>
                  <Text style={S.hKeyTxt}>{k}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Progress
                    value={pct}
                    max={100}
                    height={10}
                    color={bc}
                    trackColor={colors.muted}
                    borderRadius={5}
                  />
                </View>
                <Text style={[S.hScore, { color: colors.foreground }]}>{sc}</Text>
              </Animated.View>
            );
          })}
        </View>
        {h.fields.length > 0 &&
          renderChips(t('assessment.result.fields', 'Fields'), isZh ? h.fieldsZh : h.fields, tc)}
        {h.majors.length > 0 &&
          renderChips(t('assessment.result.recommendedMajors', 'Majors'), h.majors, colors.info)}
      </Animated.View>
    );
  };

  // ── Shared: Chips section ──────────────────────────────
  const renderChips = (label: string, items: string[], color: string) => (
    <View style={S.sec}>
      <Text style={[S.secLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={S.chips}>
        {items.map((item, i) => (
          <View key={i} style={[S.chip, { backgroundColor: color + '15' }]}>
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
          <TouchableOpacity onPress={goBack} style={S.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[S.rHeaderTitle, { color: colors.foreground }]}>
            {t('assessment.result.title', 'Your Result')}
          </Text>
          <View style={{ width: 32 }} />
        </View>
        {result.mbtiResult && renderMbti(result.mbtiResult)}
        {result.hollandResult && renderHolland(result.hollandResult)}
        {!result.mbtiResult && !result.hollandResult && (
          <View style={[S.hero, { backgroundColor: TYPE_COLORS[result.type] + '10' }]}>
            <Ionicons name={TYPE_ICONS[result.type]} size={48} color={TYPE_COLORS[result.type]} />
            <Text style={[S.heroTitle, { color: colors.foreground, marginTop: spacing.md }]}>
              {t('assessment.result.title', 'Assessment Complete')}
            </Text>
          </View>
        )}
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <AnimatedButton
            onPress={() => result?.type && handleSelectType(result.type)}
            variant="outline"
            size="lg"
            style={S.fullBtn}
            leftIcon={<Ionicons name="refresh-outline" size={20} color={colors.foreground} />}
          >
            {t('assessment.retake', 'Retake Assessment')}
          </AnimatedButton>
          <AnimatedButton onPress={goBack} variant="ghost" size="lg" style={S.fullBtn}>
            {t('assessment.selectType', 'Choose Another')}
          </AnimatedButton>
        </View>
      </View>
    );
  };

  // ── Render: History ────────────────────────────────────
  const renderHistory = () => {
    if (histLoading) return <Loading text={t('assessment.history.loading', 'Loading...')} />;
    if (!history || history.length === 0) {
      return (
        <EmptyState
          icon="time-outline"
          title={t('assessment.history.empty', 'No assessments yet')}
          description={t('assessment.history.emptyDesc', 'Complete an assessment to see it here.')}
          action={{ label: t('assessment.start', 'Start'), onPress: goBack }}
        />
      );
    }
    return (
      <Animated.View entering={FadeInUp.duration(400).springify()}>
        <View style={S.histHeader}>
          <TouchableOpacity onPress={goBack} style={S.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[S.title, { color: colors.foreground }]}>
            {t('assessment.history.title', 'History')}
          </Text>
          <View style={{ width: 32 }} />
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
              >
                <CardContent>
                  <View style={S.histRow}>
                    <View style={[S.histIcon, { backgroundColor: tc + '15' }]}>
                      <Ionicons name={TYPE_ICONS[item.type]} size={22} color={tc} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={S.histTop}>
                        <Badge variant={badgeVariant(item.type)}>{item.type}</Badge>
                        <Text style={[S.histSum, { color: tc }]}>{summary}</Text>
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
      <Stack.Screen options={{ title: t('assessment.title', 'Assessment') }} />
      <ScrollView
        style={[S.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
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
const S = StyleSheet.create({
  container: { flex: 1 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  // Selection
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginBottom: spacing.lg },
  typeCard: { marginBottom: spacing.md },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  typeIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeInfo: { flex: 1 },
  typeTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, marginBottom: spacing.xs },
  typeDesc: { fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  fullBtn: { width: '100%', marginTop: spacing.lg },
  // Quiz
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  progText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  qNum: { fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, marginBottom: spacing.sm },
  qText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    lineHeight: fontSize.lg * 1.5,
    marginBottom: spacing.xl,
  },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
  },
  optDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optText: { flex: 1, fontSize: fontSize.base, lineHeight: fontSize.base * 1.4 },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  // Result
  rHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  rHeaderTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  hero: {
    borderRadius: borderRadius.xl,
    padding: spacing['2xl'],
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  mbtiType: {
    fontSize: fontSize['4xl'] + 8,
    fontWeight: fontWeight.bold,
    letterSpacing: 6,
    marginBottom: spacing.sm,
  },
  hollandCode: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    letterSpacing: 4,
    marginBottom: spacing.md,
  },
  hollandTypes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  heroTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroDesc: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: fontSize.sm * 1.6 },
  // Dimensions
  sec: { marginBottom: spacing.xl },
  secLabel: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, marginBottom: spacing.md },
  dimLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  dimLbl: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  dimTrack: { height: 10, borderRadius: 5, flexDirection: 'row', overflow: 'hidden' },
  dimFill: { height: '100%' },
  // Holland bars
  hBar: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
  hKey: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  hKeyTxt: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  hScore: { width: 32, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'right' },
  // Chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  chipTxt: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  // List
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  listText: { flex: 1, fontSize: fontSize.sm, lineHeight: fontSize.sm * 1.5 },
  // History
  histHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  histCard: { marginBottom: spacing.md },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  histIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  histTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  histSum: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  histDate: { fontSize: fontSize.xs },
});
