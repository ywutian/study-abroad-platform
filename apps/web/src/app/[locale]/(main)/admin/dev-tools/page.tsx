'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Copy, Key, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthStore } from '@/stores';

/**
 * Admin developer tools page.
 *
 * Use cases:
 *   - Copy current JWT to call admin endpoints from terminal (curl / Claude Code)
 *   - Watch token countdown so you know when to refresh before it expires
 *
 * The access token lives in-memory in `useAuthStore` (Zustand) — there's no
 * persistent storage, so this page is the most convenient way to extract it
 * during admin operations work.
 */

interface DecodedJwt {
  sub?: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

function decodeJwt(token: string): DecodedJwt | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload as DecodedJwt;
  } catch {
    return null;
  }
}

function formatCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return 'EXPIRED';
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = Math.floor(secondsLeft % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function AdminDevToolsPage() {
  const t = useTranslations('admin.devTools');
  const accessToken = useAuthStore((s) => s.accessToken);
  const [now, setNow] = useState(() => Date.now());

  // Re-render every second so countdown ticks
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const decoded = accessToken ? decodeJwt(accessToken) : null;
  const expiresInSec = decoded?.exp ? Math.max(0, decoded.exp - Math.floor(now / 1000)) : null;

  const handleCopyToken = async () => {
    if (!accessToken) {
      toast.error(t('noTokenAvailable'));
      return;
    }
    try {
      await navigator.clipboard.writeText(accessToken);
      toast.success(t('tokenCopied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  const handleRefreshToken = async () => {
    try {
      // Hit the refresh endpoint via apiClient pattern (auth store handles refresh internally
      // via the silent-refresh interval, but we expose a manual trigger for ops)
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const newToken = data?.data?.accessToken ?? data?.accessToken;
      if (!newToken) throw new Error('no token in response');
      useAuthStore.getState().setAccessToken(newToken);
      toast.success(t('tokenRefreshed'));
    } catch (err) {
      toast.error(t('refreshFailed', { error: err instanceof Error ? err.message : String(err) }));
    }
  };

  return (
    <PageContainer>
      <PageHeader title={t('title')} description={t('description')} color="slate" icon={Key} />

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            {t('jwtSection.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!accessToken && <p className="text-sm text-muted-foreground">{t('noTokenAvailable')}</p>}

          {accessToken && (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t('jwtSection.email')}</p>
                  <p className="font-mono">{decoded?.email ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('jwtSection.role')}</p>
                  <p className="font-mono">{decoded?.role ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('jwtSection.expiresIn')}</p>
                  <p
                    className={cn(
                      'font-mono',
                      expiresInSec != null && expiresInSec < 60
                        ? 'text-rose-600'
                        : expiresInSec != null && expiresInSec < 180
                          ? 'text-amber-600'
                          : 'text-emerald-600'
                    )}
                  >
                    {expiresInSec != null ? formatCountdown(expiresInSec) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('jwtSection.userId')}</p>
                  <p className="font-mono text-xs truncate">{decoded?.sub ?? '—'}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-2xs text-muted-foreground mb-1">{t('jwtSection.tokenLabel')}</p>
                <p className="font-mono text-xs break-all text-muted-foreground">
                  {accessToken.slice(0, 40)}...{accessToken.slice(-20)}
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCopyToken} className="flex items-center gap-2">
                  <Copy className="h-4 w-4" />
                  {t('jwtSection.copyButton')}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRefreshToken}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t('jwtSection.refreshButton')}
                </Button>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                <p className="font-semibold text-amber-700 dark:text-amber-400 mb-1">
                  {t('jwtSection.usageHeading')}
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {t('jwtSection.usageBody')}
                </p>
                <pre className="mt-2 text-2xs font-mono bg-muted/50 p-2 rounded overflow-x-auto">
                  {`curl -H "Authorization: Bearer $TOKEN" \\
  https://api.example.com/api/v1/admin/...`}
                </pre>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}

function cn(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(' ');
}
