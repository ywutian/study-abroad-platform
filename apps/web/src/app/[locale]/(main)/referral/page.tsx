'use client';

import { useState, useCallback } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Gift,
  UserPlus,
  Share2,
  Copy,
  Check,
  Users,
  Trophy,
  Star,
  ArrowRight,
  Mail,
  MessageCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/stores';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ReferralData {
  referralCode: string;
  referralLink: string;
  referralCount: number;
  totalPointsEarned: number;
}

interface ReferralListData {
  referrals: Array<{
    id: string;
    email: string;
    joinedAt: string;
    pointsEarned: number;
  }>;
  total: number;
}

export default function ReferralPage() {
  const t = useTranslations('referral');
  const format = useFormatter();
  const { user } = useAuthStore();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  // Fetch referral data
  const { data: referralData, isLoading: isLoadingReferral } = useQuery({
    queryKey: ['referral'],
    queryFn: () => apiClient.get<ReferralData>('/users/me/referral'),
    enabled: !!user,
  });

  // Fetch referral list
  const { data: referralList, isLoading: isLoadingList } = useQuery({
    queryKey: ['referral-list'],
    queryFn: () => apiClient.get<ReferralListData>('/users/me/referrals'),
    enabled: !!user,
  });

  const handleCopy = useCallback(async (text: string, type: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    }
  }, []);

  const handleShareEmail = useCallback(() => {
    if (!referralData) return;
    const subject = encodeURIComponent(t('emailSubject'));
    const body = encodeURIComponent(
      t('emailBody', {
        code: referralData.referralCode,
        link: referralData.referralLink,
      })
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  }, [referralData, t]);

  if (!user) {
    return (
      <div className="container mx-auto max-w-4xl py-12 px-4">
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Gift className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{t('loginRequired')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = isLoadingReferral || isLoadingList;

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4 space-y-8">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-600 text-white">
            <Gift className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Referral Code Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="overflow-hidden border-border">
              <div className="h-1 bg-gradient-to-r from-primary to-violet-600" />
              <CardHeader>
                <CardTitle className="text-lg text-foreground">{t('yourCode')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Code display */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 rounded-lg bg-muted px-4 py-3 text-center">
                    <span className="text-2xl font-mono font-bold tracking-widest text-foreground">
                      {referralData?.referralCode || '--------'}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      'shrink-0 transition-colors',
                      copied === 'code' &&
                        'bg-green-500 text-white border-green-500 hover:bg-green-600 hover:text-white'
                    )}
                    onClick={() => referralData && handleCopy(referralData.referralCode, 'code')}
                  >
                    {copied === 'code' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Copy link button */}
                <Button
                  className={cn(
                    'w-full gap-2',
                    copied === 'link'
                      ? 'bg-green-500 hover:bg-green-600'
                      : 'bg-gradient-to-r from-primary to-violet-600 hover:opacity-90'
                  )}
                  onClick={() => referralData && handleCopy(referralData.referralLink, 'link')}
                >
                  {copied === 'link' ? (
                    <>
                      <Check className="h-4 w-4" />
                      {t('copied')}
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4" />
                      {t('copyLink')}
                    </>
                  )}
                </Button>

                {/* Share buttons */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">{t('shareTitle')}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={handleShareEmail}
                    >
                      <Mail className="h-4 w-4" />
                      {t('shareVia.email')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() =>
                        referralData &&
                        window.open(
                          `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                            `Join me! Use my referral code: ${referralData.referralCode} ${referralData.referralLink}`
                          )}`
                        )
                      }
                    >
                      <MessageCircle className="h-4 w-4" />
                      {t('shareVia.twitter')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            <Card className="border-border">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <UserPlus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {referralData?.referralCount ?? 0}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('stats.invited')}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10">
                  <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {referralData?.referralCount ?? 0}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('stats.signups')}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                  <Trophy className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {referralData?.totalPointsEarned ?? 0}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('stats.points')}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* How It Works */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-border">
              <div className="h-1 bg-gradient-to-r from-primary to-violet-600" />
              <CardHeader>
                <CardTitle className="text-lg text-foreground">{t('howItWorks')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    {
                      step: 1,
                      icon: Share2,
                      title: t('step1'),
                      desc: t('step1Desc'),
                      color: 'text-primary bg-primary/10',
                    },
                    {
                      step: 2,
                      icon: UserPlus,
                      title: t('step2'),
                      desc: t('step2Desc'),
                      color: 'text-violet-600 dark:text-violet-400 bg-violet-500/10',
                    },
                    {
                      step: 3,
                      icon: Star,
                      title: t('step3'),
                      desc: t('step3Desc'),
                      color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
                    },
                  ].map((item, idx) => (
                    <div
                      key={item.step}
                      className="flex flex-col items-center text-center space-y-3"
                    >
                      <div className="relative">
                        <div
                          className={cn(
                            'flex h-14 w-14 items-center justify-center rounded-full',
                            item.color
                          )}
                        >
                          <item.icon className="h-6 w-6" />
                        </div>
                        <Badge
                          variant="secondary"
                          className="absolute -top-1 -right-1 h-6 w-6 items-center justify-center rounded-full p-0 text-xs font-bold"
                        >
                          {item.step}
                        </Badge>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                      </div>
                      {idx < 2 && (
                        <ArrowRight className="hidden md:block h-5 w-5 text-muted-foreground absolute" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Referral History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg text-foreground">{t('history')}</CardTitle>
              </CardHeader>
              <CardContent>
                {referralList && referralList.referrals.length > 0 ? (
                  <div className="space-y-3">
                    {referralList.referrals.map((referral) => (
                      <div
                        key={referral.id}
                        className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <UserPlus className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{referral.email}</p>
                            <p className="text-xs text-muted-foreground">
                              {t('joinedOn', {
                                date: format.dateTime(new Date(referral.joinedAt), {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                }),
                              })}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-green-500/10 text-green-700 dark:text-green-400 border-0"
                        >
                          {t('pointsAwarded', { points: referral.pointsEarned })}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="rounded-full bg-muted p-4 mb-4">
                      <Gift className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground">{t('noReferrals')}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t('noReferralsDesc')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </div>
  );
}
