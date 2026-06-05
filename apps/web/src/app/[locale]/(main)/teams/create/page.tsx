'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/lib/i18n/navigation';
import { PageContainer, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Users, GraduationCap, X } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { qk } from '@/lib/query';
import { teamRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import { useState, useCallback } from 'react';
import { SchoolSelector } from '@/components/features/school-selector';
import { getSchoolName } from '@/lib/utils';

const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 50;

interface School {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
}

export default function CreateTeamPage() {
  const t = useTranslations('teams');
  const locale = useLocale();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'UNLISTED' | 'PRIVATE'>('PUBLIC');
  const [joinPolicy, setJoinPolicy] = useState<'OPEN' | 'INVITE_ONLY'>('OPEN');
  const [school, setSchool] = useState<School | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [schoolSelectorOpen, setSchoolSelectorOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      visibility: string;
      joinPolicy: string;
      schoolId?: string;
      tags?: string[];
    }) => apiClient.post<{ id: string }>(teamRoutes.list(), body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: qk.teams.all });
      toast.success(t('toast.created'));
      router.push(`/teams/${data.id}`);
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message ?? t('toast.createFailed'));
    },
  });

  const addTag = useCallback(() => {
    const trimmed = tagInput.trim().slice(0, MAX_TAG_LENGTH);
    if (!trimmed || tags.includes(trimmed)) return;
    if (tags.length >= MAX_TAGS) {
      toast.error(t('validation.maxTags', { max: MAX_TAGS }));
      return;
    }
    setTags((prev) => [...prev, trimmed]);
    setTagInput('');
  }, [tagInput, tags, t]);

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nameTrimmed = name.trim();
    if (!nameTrimmed) {
      toast.error(t('validation.nameRequired'));
      return;
    }
    if (nameTrimmed.length < 1 || nameTrimmed.length > 100) {
      toast.error(t('validation.nameLengthError'));
      return;
    }
    if (description.length > 500) {
      toast.error(t('validation.descriptionLengthError'));
      return;
    }
    createMutation.mutate({
      name: nameTrimmed,
      description: description.trim() || undefined,
      visibility,
      joinPolicy,
      schoolId: school?.id,
      tags: tags.length ? tags : undefined,
    });
  };

  return (
    <PageContainer maxWidth="md">
      <PageHeader
        title={t('createTeam')}
        description={t('description')}
        icon={Users}
        color="amber"
      />
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
          <Label>{t('createForm.school')}</Label>
          <Button
            type="button"
            variant="outline"
            className="mt-1 w-full justify-start"
            onClick={() => setSchoolSelectorOpen(true)}
          >
            <GraduationCap className="mr-2 h-4 w-4 shrink-0" />
            {school ? getSchoolName(school, locale) : t('createForm.schoolPlaceholder')}
          </Button>
          {school && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 text-muted-foreground"
              onClick={() => setSchool(null)}
            >
              <X className="h-3 w-3 mr-1" />
              {t('form.clear')}
            </Button>
          )}
        </div>
        <div>
          <Label htmlFor="tags">{t('createForm.tags')}</Label>
          <Input
            id="tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder={t('createForm.tagsPlaceholder')}
            maxLength={MAX_TAG_LENGTH}
            className="mt-1"
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                  {tag}
                  <button
                    type="button"
                    aria-label={t('createForm.removeTag')}
                    className="rounded-full p-0.5 hover:bg-muted"
                    onClick={() => removeTag(tag)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <p className="text-caption text-muted-foreground mt-1">
            {t('createForm.tagsHint', { max: MAX_TAGS })}
          </p>
        </div>
        <SchoolSelector
          open={schoolSelectorOpen}
          onOpenChange={setSchoolSelectorOpen}
          selectedSchools={school ? [school] : []}
          onSelect={(schools) => setSchool(schools[0] ?? null)}
          maxSelection={1}
        />
        <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
          {createMutation.isPending ? t('form.creating') : t('create')}
        </Button>
      </form>
    </PageContainer>
  );
}
