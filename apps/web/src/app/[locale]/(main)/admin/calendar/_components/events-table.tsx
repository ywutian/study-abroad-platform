/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useTranslations, useFormatter, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ListSkeleton } from '@/components/ui/loading-state';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginationControls } from '../../_components/pagination-controls';
import { Globe, Pencil, Trash2 } from 'lucide-react';

interface GlobalEvent {
  id: string;
  title: string;
  titleZh?: string;
  category: string;
  eventDate: string;
  registrationDeadline?: string;
  lateDeadline?: string;
  resultDate?: string;
  description?: string;
  descriptionZh?: string;
  url?: string;
  year: number;
  isRecurring: boolean;
  isActive: boolean;
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  TEST: 'bg-blue-500/10 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-500/20',
  COMPETITION:
    'bg-amber-500/10 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-500/20',
  SUMMER_PROGRAM:
    'bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  FINANCIAL_AID:
    'bg-violet-500/10 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border-violet-500/20',
  APPLICATION:
    'bg-pink-500/10 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 border-pink-500/20',
  OTHER:
    'bg-slate-500/10 dark:bg-slate-950/30 text-slate-600 dark:text-slate-400 border-slate-500/20',
};

interface EventsTableProps {
  events: GlobalEvent[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onEdit: (event: GlobalEvent) => void;
  onDelete: (id: string) => void;
}

export function EventsTable({
  events,
  isLoading,
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onEdit,
  onDelete,
}: EventsTableProps) {
  const t = useTranslations('admin');
  const fmt = useFormatter();
  const locale = useLocale();

  const getCategoryLabel = (cat: string) => {
    const key = `events.categories.${cat}` as any;
    return t.has(key) ? t(key) : cat;
  };

  const getTitle = (e: GlobalEvent) => (locale === 'zh' && e.titleZh ? e.titleZh : e.title);

  if (isLoading) return <ListSkeleton count={5} />;

  if (!events.length) {
    return (
      <EmptyState
        icon={<Globe className="h-12 w-12" />}
        title={t('events.empty')}
        description={t('events.emptyDesc')}
      />
    );
  }

  return (
    <>
      <Card>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('events.eventTitle')}</TableHead>
                <TableHead>{t('events.category')}</TableHead>
                <TableHead>{t('events.eventDate')}</TableHead>
                <TableHead>{t('events.regDeadline')}</TableHead>
                <TableHead>{t('events.active')}</TableHead>
                <TableHead className="w-[80px]">{t('deadlines.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{getTitle(event)}</div>
                      {locale === 'zh' && event.titleZh && event.title !== event.titleZh && (
                        <div className="text-xs text-muted-foreground">{event.title}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={CATEGORY_COLORS[event.category] || ''}>
                      {getCategoryLabel(event.category)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {fmt.dateTime(new Date(event.eventDate), 'medium')}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {event.registrationDeadline
                      ? fmt.dateTime(new Date(event.registrationDeadline), 'medium')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={event.isActive ? 'success' : 'secondary'}>
                      {event.isActive ? t('events.activeYes') : t('events.activeNo')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit(event)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => onDelete(event.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
      <PaginationControls
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </>
  );
}
