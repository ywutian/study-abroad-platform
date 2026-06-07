'use client';

import { useTranslations, useFormatter } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  CreditCard,
  Check,
  Zap,
  Crown,
  ArrowRight,
  Gift,
  Calendar,
  ReceiptText,
  Loader2,
  Star,
} from 'lucide-react';
import { SUBSCRIPTION_PLAN_LIST } from '@study-abroad/shared';

import { PageContainer, PageHeader } from '@/components/layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { useAuthReady } from '@/hooks/use-auth-gated-query';
import { API_ROUTES, subscriptionRoutes } from '@study-abroad/shared';

// UI-specific props (icon, color, gradient) stay in frontend
const PLAN_UI: Record<string, { icon: typeof Gift; color: string; gradient: string }> = {
  free: { icon: Gift, color: 'slate', gradient: 'from-slate-500 to-gray-500' },
  pro: { icon: Zap, color: 'blue', gradient: 'bg-primary' },
  premium: { icon: Crown, color: 'amber', gradient: 'bg-warning' },
};

// Merge shared plan data + frontend UI props
const planConfigs = SUBSCRIPTION_PLAN_LIST.map((plan) => ({
  ...plan,
  ...PLAN_UI[plan.key],
}));

interface SubscriptionData {
  plan: string;
  planDetails: { name: string };
  startDate: string;
  endDate: string | null;
  isActive: boolean;
}

interface BillingHistoryItem {
  id: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  createdAt: string;
}

export default function SubscriptionPage() {
  const t = useTranslations('subscription');
  const tCommon = useTranslations('common');
  const format = useFormatter();
  const authReady = useAuthReady();

  const { data: subscription } = useQuery<SubscriptionData>({
    queryKey: ['subscription-me'],
    queryFn: () => apiClient.get(`${API_ROUTES.SUBSCRIPTIONS}/me`),
    enabled: authReady,
  });

  const { data: billingHistory = [] } = useQuery<BillingHistoryItem[]>({
    queryKey: ['billing-history'],
    queryFn: () => apiClient.get(`${API_ROUTES.SUBSCRIPTIONS}/billing-history`),
    enabled: authReady,
  });

  const currentPlan = subscription?.plan?.toLowerCase() ?? 'free';

  const upgradeMutation = useMutation({
    mutationFn: (plan: string) => apiClient.post(subscriptionRoutes.subscribe(), { plan }),
    onSuccess: () => {
      toast.success(t('upgradeSuccess'));
    },
  });

  const handleUpgrade = (planKey: string) => {
    upgradeMutation.mutate(planKey.toUpperCase());
  };

  const isUpgrading = upgradeMutation.isPending;

  return (
    <PageContainer maxWidth="5xl">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={CreditCard}
        color="violet"
      />

      {/* Current Plan */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="mb-8 overflow-hidden">
          {(() => {
            const ui = PLAN_UI[currentPlan] ?? PLAN_UI.free;
            return <div className={cn('h-1.5 bg-gradient-to-r', ui.gradient)} />;
          })()}
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-4">
              {(() => {
                const ui = PLAN_UI[currentPlan] ?? PLAN_UI.free;
                const CurrentIcon = ui.icon;
                return (
                  <div
                    className={cn(
                      'flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg',
                      ui.gradient
                    )}
                  >
                    <CurrentIcon className="h-7 w-7 text-white" />
                  </div>
                );
              })()}
              <div>
                <p className="text-sm text-muted-foreground">{t('currentPlan')}</p>
                <h3 className="text-xl font-bold">{t(`plans.${currentPlan}.name`)}</h3>
              </div>
            </div>
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {subscription?.endDate
                ? format.dateTime(new Date(subscription.endDate), { dateStyle: 'medium' })
                : t('validForever')}
            </Badge>
          </CardContent>
        </Card>
      </motion.div>

      {/* Plans */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        {planConfigs.map((plan, index) => {
          const Icon = plan.icon;
          const isCurrentPlan = currentPlan === plan.key;
          const planKey = plan.key;
          const planName = t(`plans.${planKey}.name`);
          const planDesc = t(`plans.${planKey}.description`);
          const planPeriod = t(`plans.${planKey}.period`);
          const planFeatures = t.raw(`plans.${planKey}.features`) as string[];

          return (
            <motion.div
              key={plan.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={cn(
                  'relative h-full flex flex-col overflow-hidden transition-all duration-300',
                  plan.popular && 'border-blue-500/50 border-primary',
                  isCurrentPlan && 'ring-2 ring-primary',
                  'hover:shadow-lg'
                )}
              >
                <div className={cn('h-1.5 bg-gradient-to-r', plan.gradient)} />

                {plan.popular && (
                  <div className="absolute -top-0 right-4">
                    <Badge className="rounded-t-none bg-primary text-primary-foreground shadow-md">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      {t('mostPopular')}
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2 pt-6">
                  <div
                    className={cn(
                      'mx-auto flex h-14 w-14 items-center justify-center rounded-xl mb-3 shadow-lg',
                      `bg-gradient-to-br ${plan.gradient}`
                    )}
                  >
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-xl">{planName}</CardTitle>
                  <CardDescription>{planDesc}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="text-center mb-6">
                    <span
                      className={cn(
                        'text-4xl font-bold',
                        plan.color === 'blue' && 'text-blue-600',
                        plan.color === 'amber' && 'text-amber-600',
                        plan.color === 'slate' && 'text-foreground'
                      )}
                    >
                      ¥{plan.price}
                    </span>
                    <span className="text-muted-foreground">/{planPeriod}</span>
                  </div>

                  <ul className="space-y-3">
                    {planFeatures.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <div
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5',
                            plan.color === 'blue' && 'bg-blue-500/10 text-blue-500',
                            plan.color === 'amber' && 'bg-amber-500/10 text-amber-500',
                            plan.color === 'slate' && 'bg-emerald-500/10 text-emerald-500'
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </div>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="pt-4">
                  <Button
                    className={cn(
                      'w-full gap-2',
                      plan.popular && 'bg-primary hover:opacity-90 text-primary-foreground '
                    )}
                    variant={plan.popular ? 'default' : 'outline'}
                    disabled={isCurrentPlan || isUpgrading}
                    onClick={() => handleUpgrade(plan.key)}
                  >
                    {isUpgrading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {tCommon('processing')}
                      </>
                    ) : isCurrentPlan ? (
                      t('currentPlanLabel')
                    ) : (
                      <>
                        {plan.price === 0 ? t('getStarted') : t('upgrade')}
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Payment History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="overflow-hidden">
          <div className="h-1 bg-success" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <ReceiptText className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle>{t('paymentHistory')}</CardTitle>
                <CardDescription>{t('paymentHistoryDesc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {billingHistory.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                  <ReceiptText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">{t('noInvoices')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {billingHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium text-sm">{item.description ?? item.plan}</p>
                      <p className="text-xs text-muted-foreground">
                        {format.dateTime(new Date(item.createdAt), { dateStyle: 'medium' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">
                        {item.currency === 'CNY' ? '¥' : '$'}
                        {item.amount / 100}
                      </p>
                      <Badge
                        variant={item.status === 'SUCCESS' ? 'success' : 'secondary'}
                        className="text-xs"
                      >
                        {item.status === 'SUCCESS' ? tCommon('success') : item.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </PageContainer>
  );
}
