'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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

export default function SubscriptionPage() {
  const t = useTranslations('subscription');
  const tCommon = useTranslations('common');
  const [currentPlan] = useState('free');
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    setIsUpgrading(planId);
    try {
      // TODO: 替换为真实支付 API 调用
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success(t('upgradeSuccess'));
    } catch (_error) {
      toast.error(tCommon('error'));
    } finally {
      setIsUpgrading(null);
    }
  };

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
          <div className="h-1.5 bg-slate-500" />
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                <Gift className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('currentPlan')}</p>
                <h3 className="text-xl font-bold">{t('plans.free.name')}</h3>
              </div>
            </div>
            <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {t('validForever')}
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
                    <Badge className="rounded-t-none bg-primary text-white shadow-md">
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
                      plan.popular && 'bg-primary hover:opacity-90 text-white '
                    )}
                    variant={plan.popular ? 'default' : 'outline'}
                    disabled={isCurrentPlan || isUpgrading === plan.key}
                    onClick={() => handleUpgrade(plan.key)}
                  >
                    {isUpgrading === plan.key ? (
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
            {/* TODO: fetch from GET /subscriptions/billing-history */}
            <div className="text-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <ReceiptText className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">{t('noInvoices')}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </PageContainer>
  );
}
