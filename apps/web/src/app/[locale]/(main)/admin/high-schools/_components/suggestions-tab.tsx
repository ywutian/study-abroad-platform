'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';
import { adminRoutes } from '@study-abroad/shared';
import { toast } from 'sonner';
import { Check, X, Loader2 } from 'lucide-react';

interface Suggestion {
  id: string;
  name: string;
  country: string;
  submittedByCount: number;
  createdAt: string;
}

const SCHOOL_TYPES = [
  'PUBLIC_US',
  'PRIVATE_US',
  'BOARDING_US',
  'INTL_CN',
  'PUBLIC_CN',
  'PRIVATE_CN',
  'INTL_OTHER',
  'PUBLIC_OTHER',
  'PRIVATE_OTHER',
];

export function SuggestionsTab() {
  const t = useTranslations('admin.highSchools');
  const tc = useTranslations('admin.common');
  const queryClient = useQueryClient();
  const [approveTarget, setApproveTarget] = useState<Suggestion | null>(null);
  const [selectedType, setSelectedType] = useState('private');

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['adminHsSuggestions'],
    queryFn: () => apiClient.get<Suggestion[]>(adminRoutes.highSchoolsSuggestions()),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, type }: { id: string; type: string }) =>
      apiClient.post(adminRoutes.highSchoolsSuggestionApprove(id), { type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminHsSuggestions'] });
      queryClient.invalidateQueries({ queryKey: ['adminHighSchools'] });
      setApproveTarget(null);
      toast.success(t('suggestions.approveSuccess'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(adminRoutes.highSchoolsSuggestionReject(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminHsSuggestions'] });
      toast.success(t('suggestions.rejectSuccess'));
    },
  });

  const items = suggestions ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            {t('suggestions.pendingCount', { count: items.length })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.schoolName')}</TableHead>
                <TableHead>{t('table.country')}</TableHead>
                <TableHead className="text-center">{t('table.submittedBy')}</TableHead>
                <TableHead>{t('table.created')}</TableHead>
                <TableHead className="w-[140px]">{t('table.actions')}</TableHead>
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
                    {t('suggestions.noPending')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((suggestion) => (
                  <TableRow key={suggestion.id}>
                    <TableCell className="font-medium">{suggestion.name}</TableCell>
                    <TableCell>{suggestion.country}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{suggestion.submittedByCount}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(suggestion.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-success hover:text-success md:h-8 md:w-8"
                          onClick={() => {
                            setApproveTarget(suggestion);
                            setSelectedType('private');
                          }}
                          disabled={approveMutation.isPending}
                          aria-label={t('suggestions.approveAriaLabel', { name: suggestion.name })}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10 text-destructive hover:text-destructive md:h-8 md:w-8"
                          onClick={() => rejectMutation.mutate(suggestion.id)}
                          disabled={rejectMutation.isPending}
                          aria-label={t('suggestions.rejectAriaLabel', { name: suggestion.name })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={!!approveTarget} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('suggestions.approveTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t.rich('suggestions.approveDescription', {
                name: approveTarget?.name ?? '',
              })}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('suggestions.schoolType')}</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHOOL_TYPES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {t(`schoolTypes.${st}` as any)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>
              {tc('cancel')}
            </Button>
            <Button
              onClick={() => {
                if (approveTarget) {
                  approveMutation.mutate({ id: approveTarget.id, type: selectedType });
                }
              }}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('suggestions.approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
