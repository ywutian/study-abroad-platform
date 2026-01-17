'use client';

import { useEffect } from 'react';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { GraduationCap, Sparkles, TrendingUp, Users, Globe, Star } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, isInitialized } = useAuthStore();

  // 已登录用户重定向到 callbackUrl 或 dashboard
  useEffect(() => {
    if (isInitialized && !isLoading && user) {
      const callbackUrl = searchParams.get('callbackUrl');
      const targetPath = callbackUrl
        ? callbackUrl.replace(/^\/(zh|en)/, '') || '/dashboard'
        : '/dashboard';
      router.replace(targetPath);
    }
  }, [user, isLoading, isInitialized, router, searchParams]);

  const features = [
    { icon: Sparkles, key: 'ai' },
    { icon: TrendingUp, key: 'accuracy' },
    { icon: Users, key: 'cases' },
    { icon: Globe, key: 'schools' },
  ];

  const testimonials = [
    { key: '0', avatar: 'L' },
    { key: '1', avatar: 'W' },
    { key: '2', avatar: 'Z' },
  ];

  return (
    <div className="relative min-h-screen flex bg-background overflow-hidden">
      {/* 简洁网格背景 */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] bg-[size:80px_80px] opacity-30" />
      </div>

      {/* Logo - 固定在左上角 */}
      <div className="absolute left-6 top-6 z-20 sm:left-8 sm:top-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-xl font-bold text-foreground hover:opacity-80 transition-all"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-md border-2 border-primary/20 bg-primary">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold">StudyAbroad</span>
        </Link>
      </div>

      {/* 左侧装饰区 */}
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-center items-center p-12 xl:p-16 relative border-r border-border">
        <div className="max-w-xl space-y-10">
          {/* 主标题 */}
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-primary/20 bg-primary/5">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">{t('auth.layout.subtitle')}</span>
            </div>
            <h1 className="text-display text-foreground">
              {t('auth.layout.heroTitle')}
              <span className="block mt-2 text-primary">{t('auth.layout.heroHighlight')}</span>
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-md whitespace-pre-line">
              {t('auth.layout.heroDesc')}
            </p>
          </div>

          {/* 特性列表 */}
          <div className="grid grid-cols-2 gap-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-md border border-primary/20 bg-primary/5 text-primary">
                  <feature.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {t(`auth.layout.features.${feature.key}`)}
                </span>
              </div>
            ))}
          </div>

          {/* 用户评价 */}
          <div className="pt-8 border-t border-border">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex -space-x-2">
                {testimonials.map((item, i) => (
                  <div
                    key={i}
                    className="h-8 w-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold ring-2 ring-background"
                  >
                    {item.avatar}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">
                {t('auth.layout.testimonials.rating')}
              </span>
            </div>
            <blockquote className="text-muted-foreground italic text-sm leading-relaxed border-l-2 border-primary/30 pl-4">
              "{t(`auth.layout.testimonials.items.${testimonials[0].key}.quote`)}"
            </blockquote>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                {testimonials[0].avatar}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t(`auth.layout.testimonials.items.${testimonials[0].key}.name`)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(`auth.layout.testimonials.items.${testimonials[0].key}.school`)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧表单区 */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="relative w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}
