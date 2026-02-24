'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@/lib/i18n/navigation';
import { apiClient } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/ui/loading-state';
import {
  FileText,
  Plus,
  MoreVertical,
  Copy,
  Trash2,
  GraduationCap,
  Briefcase,
  BookOpen,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { ResumeSummary } from '@study-abroad/shared';

const RESUME_TYPE_ICONS = {
  COLLEGE_APPLICATION: GraduationCap,
  INTERNSHIP: Briefcase,
  GRADUATE_CV: BookOpen,
} as const;

const STATUS_COLORS = {
  DRAFT: 'secondary',
  ACTIVE: 'default',
  ARCHIVED: 'outline',
} as const;

export default function ResumePage() {
  const t = useTranslations();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<string>('COLLEGE_APPLICATION');
  const [importFromProfile, setImportFromProfile] = useState(true);

  const { data: resumes, isLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => apiClient.get<ResumeSummary[]>('/resumes'),
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; type: string; importFromProfile: boolean }) =>
      apiClient.post('/resumes', data),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      setCreateOpen(false);
      setNewTitle('');
      toast.success(t('resume.toast.created'));
      router.push(`/resume/${data.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/resumes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      setDeleteId(null);
      toast.success(t('resume.toast.deleted'));
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/resumes/${id}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      toast.success(t('resume.toast.duplicated'));
    },
  });

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createMutation.mutate({
      title: newTitle.trim(),
      type: newType,
      importFromProfile,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <PageContainer>
      <PageHeader
        title={t('resume.title')}
        description={t('resume.description')}
        icon={FileText}
        color="blue"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('resume.new')}
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState variant="card" count={3} />
      ) : !resumes?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">{t('resume.empty.title')}</h3>
            <p className="mb-6 text-sm text-muted-foreground">{t('resume.empty.description')}</p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('resume.new')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resumes.map((resume) => {
            const TypeIcon =
              RESUME_TYPE_ICONS[resume.type as keyof typeof RESUME_TYPE_ICONS] ?? FileText;
            return (
              <Card
                key={resume.id}
                className="group cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => router.push(`/resume/${resume.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base">{resume.title}</CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateMutation.mutate(resume.id);
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          {t('resume.editor.duplicate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(resume.id);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('resume.delete.title')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <Badge
                      variant={
                        STATUS_COLORS[resume.status as keyof typeof STATUS_COLORS] ?? 'secondary'
                      }
                    >
                      {t(`resume.status.${resume.status}`)}
                    </Badge>
                    <span className="text-xs">{t(`resume.types.${resume.type}`)}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {resume._count.sections}{' '}
                      {resume._count.sections === 1 ? 'section' : 'sections'}
                    </span>
                    <span>{formatDate(resume.updatedAt)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('resume.create.title')}</DialogTitle>
            <DialogDescription>{t('resume.create.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('resume.create.titleLabel')}</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t('resume.create.titlePlaceholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('resume.create.typeLabel')}</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['COLLEGE_APPLICATION', 'INTERNSHIP', 'GRADUATE_CV'] as const).map((type) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex flex-col">
                        <span>{t(`resume.types.${type}`)}</span>
                        <span className="text-xs text-muted-foreground">
                          {t(`resume.typeDescriptions.${type}`)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>{t('resume.create.importProfile')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('resume.create.importProfileDesc')}
                </p>
              </div>
              <Switch checked={importFromProfile} onCheckedChange={setImportFromProfile} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newTitle.trim() || createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : t('resume.new')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('resume.delete.title')}</DialogTitle>
            <DialogDescription>{t('resume.delete.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
