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
import { Calendar, Pencil, Trash2 } from 'lucide-react';

export interface SchoolDeadline {
  id: string;
  schoolId: string;
  year: number;
  round: string;
  applicationDeadline: string;
  financialAidDeadline?: string;
  decisionDate?: string;
  essayCount?: number;
  interviewRequired: boolean;
  interviewFormat?: string;
  interviewDeadline?: string;
  applicationFee?: number;
  notes?: string;
  school: { id: string; name: string; nameZh?: string };
}

const ROUND_COLORS: Record<string, string> = {
  ED: 'bg-red-500/10 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-500/20',
  ED2: 'bg-red-500/10 dark:bg-red-950/30 text-red-600 dark:text-red-400 border-red-500/20',
  EA: 'bg-blue-500/10 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-500/20',
  REA: 'bg-violet-500/10 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 border-violet-500/20',
  RD: 'bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  Rolling:
    'bg-slate-500/10 dark:bg-slate-950/30 text-slate-600 dark:text-slate-400 border-slate-500/20',
};

interface DeadlinesTableProps {
  deadlines: SchoolDeadline[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onEdit: (deadline: SchoolDeadline) => void;
  onDelete: (id: string) => void;
}

export function DeadlinesTable({
  deadlines,
  isLoading,
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onEdit,
  onDelete,
}: DeadlinesTableProps) {
  const t = useTranslations('admin');
  const fmt = useFormatter();
  const locale = useLocale();

  const getSchoolDisplayName = (school: { name: string; nameZh?: string }) =>
    locale === 'zh' && school.nameZh ? school.nameZh : school.name;

  if (isLoading) {
    return <ListSkeleton count={5} />;
  }

  if (!deadlines || deadlines.length === 0) {
    return (
      <EmptyState
        icon={<Calendar className="h-12 w-12" />}
        title={t('deadlines.empty')}
        description={t('deadlines.emptyDesc')}
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
                <TableHead>{t('deadlines.school')}</TableHead>
                <TableHead>{t('deadlines.year')}</TableHead>
                <TableHead>{t('deadlines.round')}</TableHead>
                <TableHead>{t('deadlines.appDeadline')}</TableHead>
                <TableHead>{t('deadlines.aidDeadline')}</TableHead>
                <TableHead>{t('deadlines.decisionDate')}</TableHead>
                <TableHead>{t('deadlines.essays')}</TableHead>
                <TableHead className="w-[80px]">{t('deadlines.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deadlines.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{getSchoolDisplayName(d.school)}</TableCell>
                  <TableCell>{d.year}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={ROUND_COLORS[d.round] || ''}>
                      {d.round}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {fmt.dateTime(new Date(d.applicationDeadline), 'medium')}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.financialAidDeadline
                      ? fmt.dateTime(new Date(d.financialAidDeadline), 'medium')
                      : '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.decisionDate ? fmt.dateTime(new Date(d.decisionDate), 'medium') : '-'}
                  </TableCell>
                  <TableCell>{d.essayCount || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit(d)}
                        aria-label="Edit deadline"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => onDelete(d.id)}
                        aria-label="Delete deadline"
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
