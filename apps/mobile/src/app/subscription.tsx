/**
 * Subscription Management Page
 *
 * Full subscription lifecycle management:
 * - Current plan banner with status
 * - Monthly/Yearly period toggle
 * - Three plan cards (Free / Pro / Premium) with staggered animation
 * - Billing history (expandable section)
 * - Cancel subscription with confirmation dialog
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  AnimatedButton,
  AnimatedCard,
  CardContent,
  Badge,
  Loading,
  Segment,
  ConfirmDialog,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { apiClient } from '@/lib/api/client';
import { useColors, spacing, fontSize, fontWeight, borderRadius } from '@/utils/theme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ============================================================
// Types
// ============================================================

interface PlanDetails {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: 'monthly' | 'yearly' | 'lifetime';
  features: string[];
}

interface UserSubscription {
  userId: string;
  plan: string;
  planDetails: PlanDetails;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  autoRenew: boolean;
}

interface BillingHistoryItem {
  id: string;
  transactionId: string;
  plan: string;
  period: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  description: string | null;
  failureReason: string | null;
  date: string;
  processedAt: string | null;
}

interface SubscribeDto {
  plan: 'free' | 'pro' | 'premium';
  period: 'monthly' | 'yearly';
}

// ============================================================
// Constants
// ============================================================

type PlanKey = 'free' | 'pro' | 'premium';

const PLAN_ICONS: Record<PlanKey, keyof typeof Ionicons.glyphMap> = {
  free: 'gift-outline',
  pro: 'flash-outline',
  premium: 'diamond-outline',
};

const PLAN_ACCENT_COLORS: Record<PlanKey, string> = {
  free: '#64748b',
  pro: '#6366f1',
  premium: '#f59e0b',
};

const YEARLY_DISCOUNT_MONTHS = 10; // pay 10 months, get 12

// ============================================================
// Query Key Factory
// ============================================================

const subscriptionKeys = {
  all: ['subscription'] as const,
  plans: () => [...subscriptionKeys.all, 'plans'] as const,
  current: () => [...subscriptionKeys.all, 'current'] as const,
  billing: () => [...subscriptionKeys.all, 'billing'] as const,
};

// ============================================================
// Helpers
// ============================================================

function getPlanKey(planId: string): PlanKey {
  const lower = planId.toLowerCase();
  if (lower === 'pro') return 'pro';
  if (lower === 'premium') return 'premium';
  return 'free';
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatAmount(amount: number, currency: string) {
  if (currency === 'CNY') return `\u00a5${amount}`;
  return `$${amount}`;
}

// ============================================================
// Main Component
// ============================================================

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const queryClient = useQueryClient();

  // State
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [billingExpanded, setBillingExpanded] = useState(false);
  const [cancelDialogVisible, setCancelDialogVisible] = useState(false);

  // ─── Queries ───────────────────────────────────────────

  const { data: plans, isLoading: plansLoading } = useQuery<PlanDetails[]>({
    queryKey: subscriptionKeys.plans(),
    queryFn: () => apiClient.get('/subscriptions/plans'),
    staleTime: 10 * 60_000,
  });

  const {
    data: currentSub,
    isLoading: subLoading,
    refetch: refetchSub,
  } = useQuery<UserSubscription>({
    queryKey: subscriptionKeys.current(),
    queryFn: () => apiClient.get('/subscriptions/me'),
    staleTime: 60_000,
  });

  const {
    data: billingHistory,
    isLoading: billingLoading,
    refetch: refetchBilling,
  } = useQuery<BillingHistoryItem[]>({
    queryKey: subscriptionKeys.billing(),
    queryFn: () => apiClient.get('/subscriptions/billing-history'),
    enabled: billingExpanded,
    staleTime: 5 * 60_000,
  });

  // ─── Mutations ─────────────────────────────────────────

  const subscribeMutation = useMutation({
    mutationFn: (dto: SubscribeDto) => apiClient.post('/subscriptions/subscribe', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.billing() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('subscription.subscribeSuccess', 'Subscription updated successfully!'));
    },
    onError: (error: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(error.message || t('subscription.subscribeFailed', 'Subscription failed'));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => apiClient.delete('/subscriptions/cancel'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.current() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.billing() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success(t('subscription.cancelSuccess', 'Subscription cancelled'));
      setCancelDialogVisible(false);
    },
    onError: (error: Error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error(error.message || t('subscription.cancelFailed', 'Cancellation failed'));
    },
  });

  // ─── Handlers ──────────────────────────────────────────

  const handleSubscribe = useCallback(
    (planKey: PlanKey) => {
      if (planKey === 'free') return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      subscribeMutation.mutate({ plan: planKey, period: billingPeriod });
    },
    [billingPeriod, subscribeMutation]
  );

  const handleCancelConfirm = useCallback(() => {
    cancelMutation.mutate();
  }, [cancelMutation]);

  const toggleBillingHistory = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setBillingExpanded((prev) => !prev);
  }, []);

  // ─── Refresh ───────────────────────────────────────────

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchSub(), billingExpanded ? refetchBilling() : Promise.resolve()]);
    setRefreshing(false);
  }, [refetchSub, refetchBilling, billingExpanded]);

  // ─── Derived ───────────────────────────────────────────

  const currentPlanKey = currentSub ? getPlanKey(currentSub.plan) : 'free';
  const isPaidPlan = currentPlanKey !== 'free';

  // ─── Price Calculation ────────────────────────────────

  const getDisplayPrice = useCallback(
    (plan: PlanDetails) => {
      if (plan.price === 0) return { price: 0, originalPrice: 0 };
      if (billingPeriod === 'yearly') {
        const yearlyPrice = plan.price * YEARLY_DISCOUNT_MONTHS;
        const monthlyEquivalent = Math.round(yearlyPrice / 12);
        return { price: monthlyEquivalent, originalPrice: plan.price, totalYearly: yearlyPrice };
      }
      return { price: plan.price, originalPrice: plan.price };
    },
    [billingPeriod]
  );

  // ─── Status Badge Helpers ────────────────────────────

  const getStatusBadge = () => {
    if (!currentSub) return null;
    if (currentSub.isActive) {
      return { label: t('subscription.active', 'Active'), variant: 'success' as const };
    }
    return { label: t('subscription.expired', 'Expired'), variant: 'error' as const };
  };

  const getBillingStatusVariant = (
    status: string
  ): 'success' | 'warning' | 'error' | 'secondary' => {
    switch (status.toUpperCase()) {
      case 'SUCCESS':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'FAILED':
        return 'error';
      case 'REFUNDED':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  // ============================================================
  // Render: Loading State
  // ============================================================

  if (plansLoading || subLoading) {
    return (
      <>
        <Stack.Screen options={{ title: t('subscription.title', 'Subscription') }} />
        <Loading fullScreen text={t('subscription.loading', 'Loading subscription...')} />
      </>
    );
  }

  // ============================================================
  // Render: Current Plan Banner
  // ============================================================

  const renderCurrentPlanBanner = () => {
    if (!currentSub) return null;

    const statusBadge = getStatusBadge();
    const accentColor = PLAN_ACCENT_COLORS[currentPlanKey];

    return (
      <Animated.View entering={FadeInDown.duration(400).springify()}>
        <LinearGradient
          colors={[accentColor + '18', accentColor + '08']}
          style={[styles.currentPlanBanner, { borderColor: accentColor + '40' }]}
        >
          <View style={styles.currentPlanHeader}>
            <View style={[styles.currentPlanIcon, { backgroundColor: accentColor + '20' }]}>
              <Ionicons name={PLAN_ICONS[currentPlanKey]} size={24} color={accentColor} />
            </View>
            <View style={styles.currentPlanInfo}>
              <Text style={[styles.currentPlanLabel, { color: colors.foregroundMuted }]}>
                {t('subscription.currentPlan', 'Current Plan')}
              </Text>
              <Text style={[styles.currentPlanName, { color: colors.foreground }]}>
                {currentSub.planDetails.name}
              </Text>
            </View>
            {statusBadge && <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>}
          </View>

          {currentSub.endDate && (
            <View style={styles.expiryRow}>
              <Ionicons name="calendar-outline" size={14} color={colors.foregroundMuted} />
              <Text style={[styles.expiryText, { color: colors.foregroundMuted }]}>
                {t('subscription.expiresOn', 'Expires on {{date}}', {
                  date: formatDate(currentSub.endDate),
                })}
              </Text>
            </View>
          )}

          {!isPaidPlan && (
            <View style={[styles.upgradeBanner, { backgroundColor: colors.primary + '10' }]}>
              <Ionicons name="sparkles" size={16} color={colors.primary} />
              <Text style={[styles.upgradeText, { color: colors.primary }]}>
                {t('subscription.upgradePrompt', 'Upgrade to unlock AI features and more!')}
              </Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>
    );
  };

  // ============================================================
  // Render: Plan Card
  // ============================================================

  const renderPlanCard = (plan: PlanDetails, index: number) => {
    const planKey = getPlanKey(plan.id);
    const accentColor = PLAN_ACCENT_COLORS[planKey];
    const isCurrentPlan = currentPlanKey === planKey;
    const isPro = planKey === 'pro';
    const isPremium = planKey === 'premium';
    const isFree = planKey === 'free';
    const { price, originalPrice, totalYearly } = getDisplayPrice(plan) as {
      price: number;
      originalPrice: number;
      totalYearly?: number;
    };

    const isUpgrade =
      !isCurrentPlan &&
      (currentPlanKey === 'free' || (currentPlanKey === 'pro' && planKey === 'premium'));

    const isDowngrade =
      !isCurrentPlan &&
      ((currentPlanKey === 'premium' && planKey === 'pro') ||
        (currentPlanKey !== 'free' && planKey === 'free'));

    const isSubscribing = subscribeMutation.isPending;

    return (
      <Animated.View
        key={plan.id}
        entering={FadeInUp.delay(200 + index * 100)
          .duration(400)
          .springify()}
      >
        <AnimatedCard
          style={[
            styles.planCard,
            isCurrentPlan && {
              borderColor: accentColor,
              borderWidth: 2,
            },
            !isCurrentPlan && {
              borderColor: colors.border,
              borderWidth: 1,
            },
          ]}
        >
          {/* Accent bar */}
          <View style={[styles.planAccentBar, { backgroundColor: accentColor }]} />

          <CardContent style={styles.planCardContent}>
            {/* Badge row */}
            {(isPro || isPremium) && (
              <View style={styles.planBadgeRow}>
                <Badge variant={isPro ? 'default' : 'warning'} style={styles.planBadge}>
                  {isPro
                    ? t('subscription.popular', 'Popular')
                    : t('subscription.bestValue', 'Best Value')}
                </Badge>
              </View>
            )}

            {/* Plan header */}
            <View style={styles.planHeader}>
              <View style={[styles.planIconCircle, { backgroundColor: accentColor + '15' }]}>
                <Ionicons name={PLAN_ICONS[planKey]} size={28} color={accentColor} />
              </View>
              <View style={styles.planTitleGroup}>
                <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
                <View style={styles.priceRow}>
                  {isFree ? (
                    <Text style={[styles.planPrice, { color: accentColor }]}>
                      {t('subscription.free', 'Free')}
                    </Text>
                  ) : (
                    <>
                      <Text style={[styles.planPrice, { color: accentColor }]}>
                        {formatAmount(price, plan.currency)}
                      </Text>
                      <Text style={[styles.planPeriod, { color: colors.foregroundMuted }]}>
                        /{t('subscription.month', 'mo')}
                      </Text>
                      {billingPeriod === 'yearly' && price < originalPrice && (
                        <Text style={[styles.planOriginalPrice, { color: colors.foregroundMuted }]}>
                          {formatAmount(originalPrice, plan.currency)}
                        </Text>
                      )}
                    </>
                  )}
                </View>
                {billingPeriod === 'yearly' && totalYearly != null && (
                  <Text style={[styles.yearlyTotal, { color: colors.foregroundMuted }]}>
                    {t('subscription.billedYearly', 'Billed {{amount}}/year', {
                      amount: formatAmount(totalYearly, plan.currency),
                    })}
                  </Text>
                )}
              </View>
            </View>

            {/* Features */}
            <View style={styles.featureList}>
              {plan.features.map((feature, fIndex) => (
                <View key={fIndex} style={styles.featureRow}>
                  <Ionicons name="checkmark-circle" size={18} color={accentColor} />
                  <Text style={[styles.featureText, { color: colors.foregroundSecondary }]}>
                    {feature}
                  </Text>
                </View>
              ))}
            </View>

            {/* Action button */}
            <View style={styles.planAction}>
              {isCurrentPlan ? (
                <AnimatedButton
                  variant="secondary"
                  size="lg"
                  disabled
                  style={styles.planButton}
                  leftIcon={
                    <Ionicons name="checkmark-circle" size={20} color={colors.foregroundMuted} />
                  }
                >
                  {t('subscription.currentPlanLabel', 'Current Plan')}
                </AnimatedButton>
              ) : isFree && isDowngrade ? (
                <AnimatedButton variant="outline" size="lg" disabled style={styles.planButton}>
                  {t('subscription.freePlan', 'Free Plan')}
                </AnimatedButton>
              ) : isUpgrade ? (
                <AnimatedButton
                  variant="default"
                  size="lg"
                  onPress={() => handleSubscribe(planKey)}
                  loading={isSubscribing}
                  style={[styles.planButton, { backgroundColor: accentColor }]}
                  leftIcon={<Ionicons name="arrow-up-circle-outline" size={20} color="#ffffff" />}
                >
                  {t('subscription.upgrade', 'Upgrade')}
                </AnimatedButton>
              ) : (
                <AnimatedButton
                  variant="outline"
                  size="lg"
                  onPress={() => handleSubscribe(planKey)}
                  loading={isSubscribing}
                  style={styles.planButton}
                >
                  {t('subscription.switchPlan', 'Switch Plan')}
                </AnimatedButton>
              )}
            </View>
          </CardContent>
        </AnimatedCard>
      </Animated.View>
    );
  };

  // ============================================================
  // Render: Billing History
  // ============================================================

  const renderBillingHistory = () => (
    <Animated.View entering={FadeInUp.delay(600).duration(400).springify()}>
      <TouchableOpacity
        onPress={toggleBillingHistory}
        activeOpacity={0.7}
        style={[styles.billingHeader, { borderColor: colors.border, backgroundColor: colors.card }]}
      >
        <View style={styles.billingHeaderLeft}>
          <View style={[styles.billingIconCircle, { backgroundColor: colors.success + '15' }]}>
            <Ionicons name="receipt-outline" size={20} color={colors.success} />
          </View>
          <View>
            <Text style={[styles.billingTitle, { color: colors.foreground }]}>
              {t('subscription.billingHistory', 'Billing History')}
            </Text>
            <Text style={[styles.billingSubtitle, { color: colors.foregroundMuted }]}>
              {t('subscription.billingHistoryDesc', 'View past transactions')}
            </Text>
          </View>
        </View>
        <Ionicons
          name={billingExpanded ? 'chevron-up' : 'chevron-down'}
          size={22}
          color={colors.foregroundMuted}
        />
      </TouchableOpacity>

      {billingExpanded && (
        <View
          style={[
            styles.billingContent,
            { borderColor: colors.border, backgroundColor: colors.card },
          ]}
        >
          {billingLoading ? (
            <Loading text={t('subscription.loadingBilling', 'Loading history...')} />
          ) : !billingHistory || billingHistory.length === 0 ? (
            <View style={styles.emptyBilling}>
              <Ionicons name="receipt-outline" size={40} color={colors.foregroundMuted} />
              <Text style={[styles.emptyBillingText, { color: colors.foregroundMuted }]}>
                {t('subscription.noInvoices', 'No billing history yet')}
              </Text>
            </View>
          ) : (
            billingHistory.map((item, index) => (
              <Animated.View key={item.id} entering={FadeInUp.delay(index * 60).springify()}>
                <View
                  style={[
                    styles.billingItem,
                    index < billingHistory.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.borderLight,
                    },
                  ]}
                >
                  <View style={styles.billingItemLeft}>
                    <Text style={[styles.billingItemDate, { color: colors.foreground }]}>
                      {formatDate(item.date)}
                    </Text>
                    <Text style={[styles.billingItemDesc, { color: colors.foregroundMuted }]}>
                      {item.description || item.plan}
                    </Text>
                  </View>
                  <View style={styles.billingItemRight}>
                    <Text style={[styles.billingItemAmount, { color: colors.foreground }]}>
                      {formatAmount(item.amount, item.currency)}
                    </Text>
                    <Badge variant={getBillingStatusVariant(item.status)}>{item.status}</Badge>
                  </View>
                </View>
              </Animated.View>
            ))
          )}
        </View>
      )}
    </Animated.View>
  );

  // ============================================================
  // Render: Cancel Subscription
  // ============================================================

  const renderCancelSection = () => {
    if (!isPaidPlan) return null;

    return (
      <Animated.View entering={FadeInUp.delay(700).duration(400).springify()}>
        <View style={styles.cancelSection}>
          <AnimatedButton
            variant="ghost"
            size="default"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setCancelDialogVisible(true);
            }}
            textStyle={{ color: colors.error }}
            leftIcon={<Ionicons name="close-circle-outline" size={20} color={colors.error} />}
          >
            {t('subscription.cancelSubscription', 'Cancel Subscription')}
          </AnimatedButton>
        </View>
      </Animated.View>
    );
  };

  // ============================================================
  // Render: Main
  // ============================================================

  return (
    <>
      <Stack.Screen
        options={{
          title: t('subscription.title', 'Subscription'),
          headerLargeTitle: false,
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing['3xl'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(500).springify()}>
          <LinearGradient
            colors={[colors.primary, colors.primary + 'cc']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroContent}>
              <View style={styles.heroIcon}>
                <Ionicons name="card" size={28} color="#fff" />
              </View>
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroTitle}>
                  {t('subscription.heroTitle', 'Subscription Plans')}
                </Text>
                <Text style={styles.heroSubtitle}>
                  {t('subscription.heroSubtitle', 'Choose the plan that fits your needs')}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <View style={styles.content}>
          {/* Current Plan Banner */}
          {renderCurrentPlanBanner()}

          {/* Period Toggle */}
          <Animated.View entering={FadeInUp.delay(100).duration(400).springify()}>
            <View style={styles.periodToggleContainer}>
              <Segment
                segments={[
                  {
                    key: 'monthly',
                    label: t('subscription.monthly', 'Monthly'),
                  },
                  {
                    key: 'yearly',
                    label: t('subscription.yearly', 'Yearly'),
                  },
                ]}
                value={billingPeriod}
                onChange={(key) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setBillingPeriod(key as 'monthly' | 'yearly');
                }}
              />
              {billingPeriod === 'yearly' && (
                <View style={[styles.discountBadge, { backgroundColor: colors.success + '15' }]}>
                  <Ionicons name="pricetag" size={12} color={colors.success} />
                  <Text style={[styles.discountText, { color: colors.success }]}>
                    {t('subscription.yearlyDiscount', 'Save ~17%')}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Plan Cards */}
          {plans && plans.map((plan, index) => renderPlanCard(plan, index))}

          {/* Billing History */}
          {renderBillingHistory()}

          {/* Cancel Subscription */}
          {renderCancelSection()}
        </View>
      </ScrollView>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        visible={cancelDialogVisible}
        onClose={() => setCancelDialogVisible(false)}
        onConfirm={handleCancelConfirm}
        title={t('subscription.cancelConfirmTitle', 'Cancel Subscription?')}
        message={t(
          'subscription.cancelConfirmMessage',
          'You will lose access to premium features. Your subscription will remain active until the end of the current billing period.'
        )}
        confirmText={t('subscription.confirmCancel', 'Cancel Subscription')}
        cancelText={t('subscription.keepPlan', 'Keep Plan')}
        variant="destructive"
        loading={cancelMutation.isPending}
        icon="warning"
      />
    </>
  );
}

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Hero
  hero: {
    padding: spacing.xl,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['2xl'],
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: fontSize.sm * 1.4,
  },

  // Content
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },

  // Current Plan Banner
  currentPlanBanner: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  currentPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  currentPlanIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentPlanInfo: {
    flex: 1,
  },
  currentPlanLabel: {
    fontSize: fontSize.xs,
    marginBottom: 2,
  },
  currentPlanName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  expiryText: {
    fontSize: fontSize.sm,
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  upgradeText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },

  // Period Toggle
  periodToggleContainer: {
    marginBottom: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  discountText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },

  // Plan Card
  planCard: {
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  planAccentBar: {
    height: 4,
  },
  planCardContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  planBadgeRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  planBadge: {
    alignSelf: 'flex-start',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  planIconCircle: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitleGroup: {
    flex: 1,
  },
  planName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  planPrice: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
  },
  planPeriod: {
    fontSize: fontSize.sm,
  },
  planOriginalPrice: {
    fontSize: fontSize.sm,
    textDecorationLine: 'line-through',
    marginLeft: spacing.sm,
  },
  yearlyTotal: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  // Features
  featureList: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  featureText: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },

  // Plan Action
  planAction: {
    marginTop: spacing.xs,
  },
  planButton: {
    width: '100%',
  },

  // Billing History
  billingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    marginBottom: 1,
  },
  billingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  billingIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  billingTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  billingSubtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  billingContent: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  emptyBilling: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.md,
  },
  emptyBillingText: {
    fontSize: fontSize.sm,
  },
  billingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  billingItemLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  billingItemDate: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  billingItemDesc: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  billingItemRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  billingItemAmount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },

  // Cancel Section
  cancelSection: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
});
