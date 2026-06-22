'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { authRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth';
import { apiClient } from '@/lib/api';

/**
 * Soft nudge to verify email — NOT a wall (register auto-logins on purpose).
 * ponytail: dismiss is per-session (sessionStorage); it reappears next session
 * until the email is actually verified. No persistence layer needed.
 */
export function EmailVerifyBanner() {
  const t = useTranslations('auth.verifyEmail');
  const user = useAuthStore((s) => s.user);
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem('verifyBannerDismissed') === '1'
  );
  const [sending, setSending] = useState(false);

  if (!user || user.emailVerified || dismissed) return null;

  const resend = async () => {
    setSending(true);
    try {
      await apiClient.post(authRoutes.resendVerification(), { email: user.email });
      toast.success(t('resendSuccess'));
    } catch {
      toast.error(t('resendError'));
    } finally {
      setSending(false);
    }
  };

  const dismiss = () => {
    sessionStorage.setItem('verifyBannerDismissed', '1');
    setDismissed(true);
  };

  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
      <span className="min-w-0 flex-1 truncate">{t('bannerText')}</span>
      <button
        type="button"
        onClick={resend}
        disabled={sending}
        className="shrink-0 font-medium underline underline-offset-2 disabled:opacity-50"
      >
        {sending ? t('resending') : t('resend')}
      </button>
      <button type="button" onClick={dismiss} aria-label={t('dismiss')} className="shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
