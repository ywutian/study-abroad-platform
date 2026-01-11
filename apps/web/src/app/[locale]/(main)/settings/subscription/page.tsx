'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  CreditCard,
  Check,
  Sparkles,
  Zap,
  Crown,
  ArrowRight,
  Gift,
  Calendar,
  ReceiptText,
  Loader2,
  Star,
} from 'lucide-react';

import { PageContainer, PageHeader } from '@/components/layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores/auth';
import { cn } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  gradient: string;
}

const plans: Plan[] = [
  {
    id: 'free',
    name: '免费版',
    price: 0,
    period: '永久',
    description: '基础功能，适合初次体验',
    features: ['浏览学校信息', '查看公开案例', '基础 AI 对话 (每日5次)', '档案管理'],
    icon: Gift,
    color: 'slate',
    gradient: 'from-slate-500 to-gray-500',
  },
  {
    id: 'pro',
    name: '专业版',
    price: 99,
    period: '月',
    description: '解锁全部功能，高效申请',
    features: ['免费版所有功能', '无限 AI 对话', '录取概率预测', '文书评估与润色', '详细案例数据', '优先客服支持'],
    popular: true,
    icon: Zap,
    color: 'blue',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'premium',
    name: '尊享版',
    price: 299,
    period: '月',
    description: '一对一服务，全程陪伴',
    features: ['专业版所有功能', '专属留学顾问', '申请策略规划', '文书深度修改', '模拟面试指导', 'VIP 专属社群'],
    icon: Crown,
    color: 'amber',
    gradient: 'from-amber-500 to-yellow-500',
  },
];

interface Invoice {
  id: string;
  date: string;
  amount: string;
  status: 'paid' | 'pending';
}

const mockInvoices: Invoice[] = [
  { id: 'INV-001', date: '2026-01-15', amount: '¥99.00', status: 'paid' },
  { id: 'INV-002', date: '2025-12-15', amount: '¥99.00', status: 'paid' },
  { id: 'INV-003', date: '2025-11-15', amount: '¥99.00', status: 'paid' },
];

export default function SubscriptionPage() {
  const t = useTranslations('subscription');
  const tCommon = useTranslations('common');
  const { user } = useAuthStore();
  const [currentPlan] = useState('free');
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null);

  const handleUpgrade = async (planId: string) => {
    setIsUpgrading(planId);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      toast.success(t('upgradeSuccess'));
    } catch (error) {
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="mb-8 overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-slate-500 to-gray-500" />
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                <Gift className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('currentPlan')}</p>
                <h3 className="text-xl font-bold">免费版</h3>
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
        {plans.map((plan, index) => {
          const Icon = plan.icon;
          const isCurrentPlan = currentPlan === plan.id;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                className={cn(
                  'relative h-full flex flex-col overflow-hidden transition-all duration-300',
                  plan.popular && 'border-blue-500/50 shadow-lg shadow-blue-500/10',
                  isCurrentPlan && 'ring-2 ring-primary',
                  'hover:shadow-lg'
                )}
              >
                <div className={cn('h-1.5 bg-gradient-to-r', plan.gradient)} />
                
                {plan.popular && (
                  <div className="absolute -top-0 right-4">
                    <Badge className="rounded-t-none bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      {t('mostPopular')}
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2 pt-6">
                  <div className={cn(
                    'mx-auto flex h-14 w-14 items-center justify-center rounded-xl mb-3 shadow-lg',
                    `bg-gradient-to-br ${plan.gradient}`
                  )}>
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                  <div className="text-center mb-6">
                    <span className={cn(
                      'text-4xl font-bold',
                      plan.color === 'blue' && 'text-blue-600',
                      plan.color === 'amber' && 'text-amber-600',
                      plan.color === 'slate' && 'text-foreground'
                    )}>¥{plan.price}</span>
                    <span className="text-muted-foreground">/{plan.period}</span>
                  </div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <div className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full mt-0.5',
                          plan.color === 'blue' && 'bg-blue-500/10 text-blue-500',
                          plan.color === 'amber' && 'bg-amber-500/10 text-amber-500',
                          plan.color === 'slate' && 'bg-emerald-500/10 text-emerald-500'
                        )}>
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
                      plan.popular && 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white shadow-md shadow-blue-500/25'
                    )}
                    variant={plan.popular ? 'default' : 'outline'}
                    disabled={isCurrentPlan || isUpgrading === plan.id}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {isUpgrading === plan.id ? (
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
          <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
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
            {mockInvoices.length > 0 ? (
              <div className="space-y-3">
                {mockInvoices.map((invoice, index) => (
                  <motion.div
                    key={invoice.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{invoice.id}</p>
                        <p className="text-xs text-muted-foreground">{invoice.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold">{invoice.amount}</span>
                      <Badge variant={invoice.status === 'paid' ? 'success' : 'warning'}>
                        {invoice.status === 'paid' ? t('paid') : t('pending')}
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                  <ReceiptText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">{t('noInvoices')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </PageContainer>
  );
}
