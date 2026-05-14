'use client';

import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SCHOOL_BROWSE_PAGE_SIZE_OPTIONS } from '@/components/features/schools/school-filters';

interface SchoolPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function SchoolPagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: SchoolPaginationProps) {
  const t = useTranslations('schools.pagination');

  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
      <div className="text-sm text-muted-foreground">{t('showing', { from, to, total })}</div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('perPage')}</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-10 w-[80px]" aria-label={t('perPage')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHOOL_BROWSE_PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label={t('previous')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[88px] text-center text-sm font-medium">
            {t('page', { current: page, total: Math.max(1, totalPages) })}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label={t('next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
