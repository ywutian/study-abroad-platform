'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/lib/i18n/navigation';
import { PageContainer } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { useEffect, useRef } from 'react';
import { Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface JoinResult {
  id: string;
}

export function TeamJoinPageClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const t = useTranslations('teams');
  const router = useRouter();
  const queryClient = useQueryClient();
  const isLoggedIn = useAuthStore((s) => !!s.accessToken);
  const joinStarted = useRef(false);

  const joinMutation = useMutation({
    mutationFn: (tkn: string) => apiClient.post<JoinResult>('/teams/join', { token: tkn }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      router.push(`/teams/${data.id}`);
    },
    onError: () => {
      // Error message shown below
    },
  });

  useEffect(() => {
    if (!token || token === null) return;
    if (!isLoggedIn) {
      const callbackUrl = `/teams/join?token=${encodeURIComponent(token)}`;
      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
      return;
    }
    if (joinStarted.current) return;
    joinStarted.current = true;
    joinMutation.mutate(token);
  }, [isLoggedIn, token]);

  if (!token) {
    return (
      <PageContainer maxWidth="md">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t('errors.inviteExpired')}</p>
          <Link href="/teams">
            <Button variant="outline" className="mt-4">
              {t('goDiscover')}
            </Button>
          </Link>
        </div>
      </PageContainer>
    );
  }

  if (!isLoggedIn) {
    return (
      <PageContainer maxWidth="md">
        <Skeleton className="h-12 w-48 mx-auto mt-12" />
        <Skeleton className="h-6 w-64 mx-auto mt-4" />
      </PageContainer>
    );
  }

  if (joinMutation.isPending || joinMutation.isIdle) {
    return (
      <PageContainer maxWidth="md">
        <div className="flex flex-col items-center justify-center py-12">
          <Skeleton className="h-12 w-12 rounded-full mb-4" />
          <p className="text-muted-foreground">
            {joinMutation.isPending ? 'Joining team...' : 'Loading...'}
          </p>
        </div>
      </PageContainer>
    );
  }

  if (joinMutation.isError) {
    return (
      <PageContainer maxWidth="md">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-destructive">{t('errors.inviteExpired')}</p>
          <Link href="/teams">
            <Button variant="outline" className="mt-4">
              {t('goDiscover')}
            </Button>
          </Link>
        </div>
      </PageContainer>
    );
  }

  return null;
}
