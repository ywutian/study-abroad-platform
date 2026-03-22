'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PaginationControls } from '../../_components/pagination-controls';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { Search, Plus, Pencil, Loader2 } from 'lucide-react';
import { SchoolEditDialog, type HighSchool } from './school-edit-dialog';

const PAGE_SIZE = 20;
const COUNTRIES = ['US', 'CN', 'UK', 'CA', 'AU', 'SG', 'HK', 'KR', 'JP'];
const TYPES = [
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
const TIERS = [5, 4, 3, 2, 1];

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

export function SchoolListTab() {
  const t = useTranslations('admin.highSchools');
  const tc = useTranslations('admin.common');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [type, setType] = useState('');
  const [tier, setTier] = useState('');
  const [page, setPage] = useState(1);
  const [editOpen, setEditOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<HighSchool | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['adminHighSchools', search, country, type, tier, page],
    queryFn: () =>
      apiClient.get<{ data: HighSchool[]; total: number }>('/admin/high-schools', {
        params: {
          search: search || undefined,
          country: country || undefined,
          type: type || undefined,
          tier: tier || undefined,
          page: String(page),
          limit: String(PAGE_SIZE),
        },
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: body }: { id: string; data: Record<string, unknown> }) =>
      apiClient.put(`/admin/high-schools/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminHighSchools'] });
      queryClient.invalidateQueries({ queryKey: ['adminHsReviewNeeded'] });
      setEditOpen(false);
      setEditingSchool(null);
      toast.success(t('messages.schoolUpdated'));
    },
  });

  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const openEdit = (school: HighSchool) => {
    setEditingSchool(school);
    setEditOpen(true);
  };

  const resetFilters = () => {
    setSearch('');
    setCountry('');
    setType('');
    setTier('');
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('filters.searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={country}
          onValueChange={(v) => {
            setCountry(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder={t('filters.country')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allCountries')}</SelectItem>
            {COUNTRIES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`countries.${c}` as any)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('filters.type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allTypes')}</SelectItem>
            {TYPES.map((tp) => (
              <SelectItem key={tp} value={tp}>
                {t(`schoolTypes.${tp}` as any)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={tier}
          onValueChange={(v) => {
            setTier(v === 'all' ? '' : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[110px]">
            <SelectValue placeholder={t('filters.tier')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allTiers')}</SelectItem>
            {TIERS.map((tierVal) => (
              <SelectItem key={tierVal} value={String(tierVal)}>
                {t('filters.tierN', { n: tierVal })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(search || country || type || tier) && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            {t('filters.clear')}
          </Button>
        )}
        <div className="ml-auto">
          <Button
            onClick={() => {
              setEditingSchool({
                id: '',
                name: '',
                country: '',
              });
              setEditOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('messages.addSchool')}
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">
            {t('messages.schoolsFound', { count: total })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.name')}</TableHead>
                <TableHead>{t('table.chineseName')}</TableHead>
                <TableHead>{t('table.country')}</TableHead>
                <TableHead>{t('table.type')}</TableHead>
                <TableHead>{t('table.tier')}</TableHead>
                <TableHead className="text-center">{t('table.recognition')}</TableHead>
                <TableHead className="text-center">{t('table.rigor')}</TableHead>
                <TableHead>{t('table.evaluated')}</TableHead>
                <TableHead className="w-[70px]">{t('table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {t('messages.noSchoolsFound')}
                  </TableCell>
                </TableRow>
              ) : (
                items.map((school) => (
                  <TableRow key={school.id}>
                    <TableCell className="font-medium">{school.name}</TableCell>
                    <TableCell className="text-muted-foreground">{school.nameZh || '-'}</TableCell>
                    <TableCell>{school.country}</TableCell>
                    <TableCell className="capitalize">{school.type || '-'}</TableCell>
                    <TableCell>
                      {school.tier ? (
                        <Badge variant={TIER_VARIANT[Number(school.tier)] ?? 'secondary'}>
                          {school.tier}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{school.recognition ?? '-'}</TableCell>
                    <TableCell className="text-center">{school.academicRigor ?? '-'}</TableCell>
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

          <PaginationControls
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
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
