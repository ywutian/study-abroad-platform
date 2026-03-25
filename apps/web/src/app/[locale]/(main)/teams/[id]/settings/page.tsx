'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Users, Trash2 } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { teamRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface TeamDetail {
  id: string;
  name: string;
  description?: string | null;
  visibility: string;
  joinPolicy: string;
  maxMembers?: number | null;
  isMember: boolean;
  myRole?: string | null;
}

export default function TeamSettingsPage() {
  const params = useParams();
  const id = params?.id as string;
  const t = useTranslations('teams');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'UNLISTED' | 'PRIVATE'>('PUBLIC');
  const [joinPolicy, setJoinPolicy] = useState<'OPEN' | 'INVITE_ONLY'>('OPEN');
  const [maxMembers, setMaxMembers] = useState<string>('');
  const [disbandOpen, setDisbandOpen] = useState(false);

  const {
    data: team,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['teams', id],
    queryFn: () => apiClient.get<TeamDetail>(`/teams/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (team) {
      setName(team.name);
      setDescription(team.description ?? '');
      setVisibility(team.visibility as 'PUBLIC' | 'UNLISTED' | 'PRIVATE');
      setJoinPolicy(team.joinPolicy as 'OPEN' | 'INVITE_ONLY');
      setMaxMembers(team.maxMembers != null ? String(team.maxMembers) : '');
    }
  }, [team]);

  const updateMutation = useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      visibility: string;
      joinPolicy: string;
      maxMembers?: number;
    }) => apiClient.patch(teamRoutes.byId(id), body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success(t('toast.settingsSaved'));
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message ?? t('toast.saveFailed'));
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

  const handleDisbandConfirm = async () => {
    await disbandMutation.mutateAsync();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t('validation.nameRequired'));
      return;
    }
    const max = maxMembers.trim() ? parseInt(maxMembers, 10) : undefined;
    if (max !== undefined && (isNaN(max) || max < 2 || max > 100)) {
      toast.error(t('validation.maxMembersError'));
      return;
    }
    updateMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      visibility,
      joinPolicy,
      maxMembers: max,
    });
  };

  if (!id) return null;
  if (error) {
    return (
      <PageContainer maxWidth="md">
        <p className="text-destructive">{t('errors.noAccess')}</p>
        <Link href={`/teams/${id}`}>
          <Button variant="outline" className="mt-4">
            {t('backToTeam')}
          </Button>
        </Link>
      </PageContainer>
    );
  }
  if (isLoading || !team) {
    return (
      <PageContainer maxWidth="md">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-24 w-full" />
      </PageContainer>
    );
  }
  if (!team.isMember || (team.myRole !== 'OWNER' && team.myRole !== 'ADMIN')) {
    return (
      <PageContainer maxWidth="md">
        <p className="text-destructive">{t('errors.ownerAdminOnly')}</p>
        <Link href={`/teams/${id}`}>
          <Button variant="outline" className="mt-4">
            {t('backToTeam')}
          </Button>
        </Link>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="md">
      <Link href={`/teams/${id}`}>
        <Button variant="ghost" size="sm" className="mb-4 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('back')}
        </Button>
      </Link>
      <PageHeader title={t('settings')} description={team.name} icon={Users} color="amber" />
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="name">{t('form.nameLabel')} *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('form.namePlaceholder')}
            maxLength={100}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="description">{t('form.descriptionLabel')}</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('form.descriptionPlaceholder')}
            maxLength={500}
            className="mt-1"
          />
        </div>
        <div>
          <Label>{t('form.visibilityLabel')}</Label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as 'PUBLIC' | 'UNLISTED' | 'PRIVATE')}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="PUBLIC">{t('visibility.public')}</option>
            <option value="UNLISTED">{t('visibility.unlisted')}</option>
            <option value="PRIVATE">{t('visibility.private')}</option>
          </select>
        </div>
        <div>
          <Label>{t('form.joinPolicyLabel')}</Label>
          <select
            value={joinPolicy}
            onChange={(e) => setJoinPolicy(e.target.value as 'OPEN' | 'INVITE_ONLY')}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="OPEN">{t('joinPolicy.open')}</option>
            <option value="INVITE_ONLY">{t('joinPolicy.inviteOnly')}</option>
          </select>
        </div>
        <div>
          <Label htmlFor="maxMembers">{t('form.maxMembersLabel')}</Label>
          <Input
            id="maxMembers"
            type="number"
            min={2}
            max={100}
            value={maxMembers}
            onChange={(e) => setMaxMembers(e.target.value)}
            placeholder={t('form.maxMembersPlaceholder')}
            className="mt-1"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={updateMutation.isPending || !name.trim()}>
            {updateMutation.isPending ? t('form.saving') : t('form.save')}
          </Button>
        </div>
      </form>

      {team.myRole === 'OWNER' && (
        <div className="mt-10 pt-6 border-t border-border">
          <h3 className="text-title font-medium text-destructive mb-2">{t('disband')}</h3>
          <p className="text-body-sm text-muted-foreground mb-4">{t('confirm.disband')}</p>
          <Button variant="destructive" onClick={() => setDisbandOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            {t('disband')}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={disbandOpen}
        onOpenChange={setDisbandOpen}
        type="danger"
        title={t('disband')}
        description={t('confirm.disband')}
        confirmLabel={t('disband')}
        onConfirm={handleDisbandConfirm}
        loading={disbandMutation.isPending}
      />
    </PageContainer>
  );
}
