'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { resumeRoutes } from '@study-abroad/shared';
import { PageContainer, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText,
  Plus,
  MoreVertical,
  Copy,
  Trash2,
  GraduationCap,
  Briefcase,
  BookOpen,
  Clock,
  Layers,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type ResumeType = 'COLLEGE_APPLICATION' | 'INTERNSHIP' | 'GRADUATE_CV' | 'FULL_TIME_JOB';
type ResumeStatus = 'DRAFT' | 'ACTIVE' | 'REVIEWED' | 'APPROVED' | 'EXPORTED' | 'ARCHIVED';

interface ResumeItem {
  id: string;
  title: string;
  status: ResumeStatus;
  type: ResumeType;
  templateId: string;
  language: string;
  version: number;
  updatedAt: string;
  createdAt: string;
  _count: { sections: number };
}

const TYPE_ICONS: Record<ResumeType, React.ElementType> = {
  COLLEGE_APPLICATION: GraduationCap,
  INTERNSHIP: Briefcase,
  GRADUATE_CV: BookOpen,
  FULL_TIME_JOB: Building2,
};

const STATUS_VARIANTS: Record<ResumeStatus, 'default' | 'secondary' | 'outline'> = {
  DRAFT: 'secondary',
  ACTIVE: 'default',
  REVIEWED: 'secondary',
  APPROVED: 'default',
  EXPORTED: 'outline',
  ARCHIVED: 'outline',
};

export default function ResumePage() {
  const t = useTranslations('resume');
  const tc = useTranslations('common');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<ResumeType>('COLLEGE_APPLICATION');
  const [importProfile, setImportProfile] = useState(true);

  const { data: resumes, isLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => apiClient.get<ResumeItem[]>(resumeRoutes.list()),
  });
  const resumeItems = Array.isArray(resumes) ? resumes : [];

  const createMutation = useMutation({
    mutationFn: (dto: { title: string; type: ResumeType; importFromProfile: boolean }) =>
      apiClient.post<ResumeItem>(resumeRoutes.list(), dto),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      setCreateOpen(false);
      router.push(`/resume/${data.id}`);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => apiClient.post<ResumeItem>(resumeRoutes.duplicate(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      toast.success(tc('success'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(resumeRoutes.byId(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      toast.success(tc('success'));
    },
  });

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createMutation.mutate({
      title: newTitle.trim(),
      type: newType,
      importFromProfile: importProfile,
    });
  };

  const resumeTypes: ResumeType[] = [
    'COLLEGE_APPLICATION',
    'GRADUATE_CV',
    'INTERNSHIP',
    'FULL_TIME_JOB',
  ];

  return (
    <PageContainer maxWidth="default" className="space-y-6 py-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        icon={FileText}
        color="indigo"
        actions={
          <Button
            onClick={() => {
              setNewTitle('');
              setCreateOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {t('new')}
          </Button>
        }
        stats={
          resumes ? [{ label: tc('total'), value: resumeItems.length, icon: Layers }] : undefined
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : resumeItems.length === 0 ? (
        <EmptyState
          type="first-time"
          title={t('title')}
          description={t('description')}
          action={{
            label: t('new'),
            onClick: () => {
              setNewTitle('');
              setCreateOpen(true);
            },
          }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resumeItems.map((resume) => {
            const resumeType = resume.type ?? 'COLLEGE_APPLICATION';
            const TypeIcon = TYPE_ICONS[resumeType];
            return (
              <Card
                key={resume.id}
                className="group cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => router.push(`/resume/${resume.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 dark:bg-indigo-400/10">
                        <TypeIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium truncate">
                          {resume.title || t('untitled')}
                        </h3>
                        <p className="text-xs text-muted-foreground">{t(`types.${resumeType}`)}</p>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={tc('aria.moreOptions')}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => duplicateMutation.mutate(resume.id)}>
                          <Copy className="mr-2 h-4 w-4" />
                          {t('editor.duplicate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => deleteMutation.mutate(resume.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {tc('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <Badge variant={STATUS_VARIANTS[resume.status]}>
                      {t(`status.${resume.status}`)}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {resume._count.sections}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(resume.updatedAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Resume Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('create.title')}</DialogTitle>
            <DialogDescription>{t('create.description')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('create.titleLabel')}</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t('create.titlePlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('create.typeLabel')}</Label>
              <div className="grid gap-2">
                {resumeTypes.map((type) => {
                  const Icon = TYPE_ICONS[type];
                  const selected = newType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewType(type)}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                        selected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40'
                      )}
                    >
                      <Icon
                        className={cn(
                          'h-5 w-5 mt-0.5 shrink-0',
                          selected ? 'text-primary' : 'text-muted-foreground'
                        )}
                      />
                      <div>
                        <div className={cn('text-sm font-medium', selected && 'text-primary')}>
                          {t(`types.${type}`)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t(`typeDescriptions.${type}`)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="import-profile"
                checked={importProfile}
                onCheckedChange={(v) => setImportProfile(!!v)}
              />
              <div>
                <Label htmlFor="import-profile" className="text-sm cursor-pointer">
                  {t('create.importProfile')}
                </Label>
                <p className="text-xs text-muted-foreground">{t('create.importProfileDesc')}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={!newTitle.trim() || createMutation.isPending}>
              {createMutation.isPending ? tc('loading') : tc('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
