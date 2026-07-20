'use client';

import { useEffect, Suspense } from 'react';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Lightbulb, TrendingUp, Users, Globe, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/stores/auth';
import { FadeInView } from '@/components/ui/motion';
import { LumniMark } from '@/components/ui/lumni-mark';

/**
 * Redirect authenticated users — isolated in its own component
 * so that useSearchParams() doesn't force the entire layout to
 * bail out of static rendering.
 */
function AuthRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, isInitialized } = useAuthStore();

  useEffect(() => {
    if (isInitialized && !isLoading && user) {
      const callbackUrl = searchParams.get('callbackUrl');
      const rawPath = callbackUrl?.replace(/^\/(zh|en)/, '') || '';
      // Strict validation: only allow internal relative paths
      const targetPath = rawPath && /^\/[\w\-/]*$/.test(rawPath) ? rawPath : '/dashboard';
      router.replace(targetPath);
    }
  }, [user, isLoading, isInitialized, router, searchParams]);

  // Show loading overlay while redirect is pending to prevent flash of login form
  if (isInitialized && !isLoading && user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return null;
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const { user } = useAuthStore();

  const features = [
    { icon: Lightbulb, key: 'ai' },
    { icon: TrendingUp, key: 'accuracy' },
    { icon: Users, key: 'cases' },
    { icon: Globe, key: 'schools' },
  ];

  return (
    <div className="app-shell relative flex min-h-screen overflow-hidden bg-background text-foreground">
      <Suspense fallback={null}>
        <AuthRedirect />
      </Suspense>
      <div className="app-shell-bg pointer-events-none fixed inset-0" />

      {/* Logo - 固定在左上角 */}
      <div className="absolute left-6 top-6 z-20 sm:left-8 sm:top-8">
        <Link
          href={user ? '/dashboard' : '/'}
          className="group flex items-center gap-2.5 text-xl font-bold text-foreground transition-opacity hover:opacity-80"
        >
          <LumniMark className="h-10 w-10 border-2" iconClassName="h-5 w-5" />
          <span className="font-bold">Lumni</span>
        </Link>
      </div>

      {/* 左侧装饰区 */}
      <div className="relative hidden flex-col items-center justify-center border-r border-border/70 p-12 lg:flex lg:w-[55%] xl:p-16">
        <div className="max-w-xl space-y-10">
          {/* 主标题 */}
          <div className="space-y-5">
            <h1 className="text-display max-w-[12ch] text-balance text-foreground">
              {t('auth.layout.heroTitle')}
              <span className="mt-2 block text-primary">{t('auth.layout.heroHighlight')}</span>
            </h1>
            <p className="max-w-md whitespace-pre-line text-lg leading-relaxed text-muted-foreground">
              {t('auth.layout.heroDesc')}
            </p>
          </div>

          {/* 特性列表 */}
          <div className="grid grid-cols-2 gap-3">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group flex items-center gap-3 rounded-[var(--theme-radius-card)] border border-border bg-[color:var(--theme-card-bg)] p-4 shadow-[var(--theme-card-shadow)] transition-colors hover:border-primary/30"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--theme-radius-button)] border border-primary/20 bg-primary/5 text-primary">
                  <feature.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                  {t(`auth.layout.features.${feature.key}`)}
                </span>
              </div>
            ))}
          </div>

          {/* 数据说明 */}
          <div className="border-t border-border pt-8">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--theme-radius-button)] border border-primary/20 bg-primary/5 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t('auth.layout.proof.title')}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {t('auth.layout.proof.body')}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{t('auth.layout.proof.meta')}</p>
          </div>
        </div>
      </div>

      {/* 右侧表单区 */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10 pt-24 sm:px-6 lg:p-8">
        <FadeInView direction="right" delay={0.1}>
          <div className="relative w-full max-w-[440px] rounded-[var(--theme-radius-card)] border border-border bg-[color:var(--theme-card-bg)] p-6 shadow-[var(--theme-card-shadow)] sm:p-8">
            <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            {children}
          </div>
        </FadeInView>
      </div>
    </div>
  );
}
