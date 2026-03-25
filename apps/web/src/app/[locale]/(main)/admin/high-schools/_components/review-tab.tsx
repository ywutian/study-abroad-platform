'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';
import { API_ROUTES } from '@study-abroad/shared';
import { toast } from 'sonner';
import { Pencil, Loader2 } from 'lucide-react';
import { SchoolEditDialog, type HighSchool } from './school-edit-dialog';

const TIER_VARIANT: Record<
  number,
  'default' | 'success' | 'warning' | 'destructive' | 'secondary'
> = {
  5: 'success',
  4: 'default',
  3: 'secondary',
  2: 'warning',
  1: 'destructive',
};

export function ReviewTab() {
  const t = useTranslations('admin.highSchools');
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<HighSchool | null>(null);

  const { data: schools, isLoading } = useQuery({
    queryKey: ['adminHsReviewNeeded'],
    queryFn: () => apiClient.get<HighSchool[]>('/admin/high-schools/review-needed'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: body }: { id: string; data: Record<string, unknown> }) =>
      apiClient.put(`${API_ROUTES.ADMIN}/high-schools/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminHsReviewNeeded'] });
      queryClient.invalidateQueries({ queryKey: ['adminHighSchools'] });
      setEditOpen(false);
      setEditingSchool(null);
      toast.success(t('messages.schoolUpdated'));
    },
  });

  const items = schools ?? [];

  const openEdit = (school: HighSchool) => {
    setEditingSchool(school);
    setEditOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            {t('review.needsReEvaluation', { count: items.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.name')}</TableHead>
                <TableHead>{t('table.country')}</TableHead>
                <TableHead>{t('table.tier')}</TableHead>
                <TableHead>{t('table.lastEvaluated')}</TableHead>
                <TableHead className="w-[70px]">{t('table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {t('review.allUpToDate')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">{school.name}</TableCell>
                    <TableCell>{school.country}</TableCell>
                    <TableCell>
                      {school.tier ? (
                        <Badge variant={TIER_VARIANT[Number(school.tier)] ?? 'secondary'}>
                          {school.tier}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {school.evaluatedAt
                        ? new Date(school.evaluatedAt).toLocaleDateString()
                        : t('messages.never')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(school)}
                        aria-label={t('tierOverview.editAriaLabel', { name: school.name })}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SchoolEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        school={editingSchool}
        onSave={(id, body) => updateMutation.mutate({ id, data: body })}
        isSaving={updateMutation.isPending}
      />
    </div>
  );
}
