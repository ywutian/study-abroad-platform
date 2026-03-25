'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Users, LogOut, Trash2, Link2 } from 'lucide-react';
import { PageContainer } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { useLocale } from 'next-intl';
import { apiClient } from '@/lib/api';
import { teamRoutes } from '@study-abroad/shared';
import { useAuthStore } from '@/stores';
import { getSchoolName } from '@/lib/utils';
import { toast } from 'sonner';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface TeamDetail {
  id: string;
  name: string;
  description?: string | null;
  visibility: string;
  joinPolicy: string;
  maxMembers?: number | null;
  schoolId?: string | null;
  school?: { id: string; name: string; nameZh?: string | null } | null;
  tags?: string[] | null;
  creatorId: string;
  memberCount: number;
  isMember: boolean;
  myRole?: string | null;
  members: Array<{
    id: string;
    role: string;
    joinedAt: string;
    user: {
      id: string;
      email: string;
      profile?: { nickname?: string | null; avatarUrl?: string | null } | null;
    };
  }>;
}

export default function TeamDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const t = useTranslations('teams');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isLoggedIn = useAuthStore((s) => !!s.accessToken);

  const {
    data: team,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['teams', id],
    queryFn: () => apiClient.get<TeamDetail>(`/teams/${id}`),
    enabled: !!id,
  });

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [disbandOpen, setDisbandOpen] = useState(false);

  const leaveMutation = useMutation({
    mutationFn: () => apiClient.post(teamRoutes.leave(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success(t('toast.left'));
      setLeaveOpen(false);
      router.push('/teams?tab=my');
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message ?? t('toast.leaveFailed'));
    },
  });

  const disbandMutation = useMutation({
    mutationFn: () => apiClient.delete(teamRoutes.byId(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success(t('toast.disbanded'));
      setDisbandOpen(false);
      router.push('/teams');
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message ?? t('toast.disbandFailed'));
    },
  });

  const inviteLinkMutation = useMutation({
    mutationFn: () => apiClient.post<{ token: string }>(`/teams/${id}/invite`, {}),
    onSuccess: (data) => {
      const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/${locale}/teams/join?token=${data.token}`;
      void navigator.clipboard.writeText(url);
      toast.success(t('toast.linkCopied'));
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message ?? t('toast.linkFailed'));
    },
  });

  const handleJoin = async () => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=${encodeURIComponent(`/teams/${id}`)}`);
      return;
    }
    try {
      await apiClient.post(teamRoutes.join(id));
      toast.success(t('toast.joined'));
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { code?: string; message?: string } } } };
      const code = err.response?.data?.error?.code;
      const msg = err.response?.data?.error?.message;
      if (code === 'CONFLICT')
        toast.error(team?.isMember ? t('toast.alreadyMember') : t('errors.full'));
      else toast.error(msg ?? t('toast.joinFailed'));
    }
  };

  if (!id) return null;
  if (error) {
    const err = error as { response?: { data?: { error?: { code?: string } } } };
    const code = err.response?.data?.error?.code;
    const isNotFound = code === 'NOT_FOUND';
    return (
      <PageContainer maxWidth="6xl">
        <p className="text-destructive">
          {isNotFound ? t('errors.notFound') : t('errors.forbidden')}
        </p>
        <Link href="/teams">
          <Button variant="outline" className="mt-4">
            {t('goDiscover')}
          </Button>
        </Link>
      </PageContainer>
    );
  }

  if (isLoading || !team) {
    return (
      <PageContainer maxWidth="6xl">
        <Skeleton className="h-8 w-24 mb-4" />
        <Skeleton className="h-12 w-64 mb-4" />
        <Skeleton className="h-24 w-full" />
      </PageContainer>
    );
  }

  const schoolName = team.school ? getSchoolName(team.school, locale) : null;
  const countLabel =
    team.maxMembers != null
      ? t('memberCount', { current: team.memberCount, max: team.maxMembers })
      : `${team.memberCount}`;

  return (
    <PageContainer maxWidth="6xl">
      <Link href="/teams">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('back')}
        </Button>
      </Link>
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-title font-semibold">{team.name}</h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {schoolName && <Badge variant="secondary">{schoolName}</Badge>}
                  <Badge variant="outline">
                    {team.joinPolicy === 'OPEN' ? t('joinPolicy.open') : t('joinPolicy.inviteOnly')}
                  </Badge>
                  <span className="text-caption text-muted-foreground">{countLabel}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {team.isMember ? (
                  <Badge>{t('member')}</Badge>
                ) : team.joinPolicy === 'OPEN' ? (
                  <Button onClick={handleJoin}>{isLoggedIn ? t('join') : t('loginToJoin')}</Button>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    {t('joinPolicy.inviteOnly')}
                  </span>
                )}
                {team.isMember && (team.myRole === 'OWNER' || team.myRole === 'ADMIN') && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => inviteLinkMutation.mutate()}
                      disabled={inviteLinkMutation.isPending}
                    >
                      <Link2 className="h-4 w-4 mr-1" />
                      {t('copyLink')}
                    </Button>
                    <Link href={`/teams/${id}/settings`}>
                      <Button variant="outline">{t('settings')}</Button>
                    </Link>
                  </>
                )}
                {team.isMember && team.myRole === 'OWNER' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDisbandOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t('disband')}
                  </Button>
                )}
                {team.isMember && (
                  <Button variant="ghost" size="sm" onClick={() => setLeaveOpen(true)}>
                    <LogOut className="h-4 w-4 mr-1" />
                    {t('leave')}
                  </Button>
                )}
              </div>
            </div>
            {team.description && (
              <p className="mt-4 text-body-sm text-muted-foreground">{team.description}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('members')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {team.members.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('empty.noMembers')}</p>
            ) : (
              <ul className="space-y-2">
                {team.members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                  >
                    <span className="font-medium">{m.user.profile?.nickname || m.user.email}</span>
                    <Badge variant={m.role === 'OWNER' ? 'default' : 'secondary'}>{m.role}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        type="warning"
        title={t('leave')}
        description={t('confirm.leave')}
        confirmLabel={t('leave')}
        onConfirm={async () => {
          await leaveMutation.mutateAsync();
        }}
        loading={leaveMutation.isPending}
      />
      <ConfirmDialog
        open={disbandOpen}
        onOpenChange={setDisbandOpen}
        type="danger"
        title={t('disband')}
        description={t('confirm.disband')}
        confirmLabel={t('disband')}
        onConfirm={async () => {
          await disbandMutation.mutateAsync();
        }}
        loading={disbandMutation.isPending}
      />
    </PageContainer>
  );
}
