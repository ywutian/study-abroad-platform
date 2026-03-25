'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { SchoolLogo } from '@/components/features';
import { getSchoolName, getSchoolSubName, formatAcceptanceRate } from '@/lib/utils';
import { GraduationCap, Search, Pencil } from 'lucide-react';

interface School {
  id: string;
  name: string;
  nameZh?: string;
  usNewsRank?: number;
  state?: string;
  acceptanceRate?: number;
  logoUrl?: string;
  metadata?: {
    deadlines?: Record<string, string>;
    applicationType?: string;
  };
}

interface SchoolsListProps {
  schools: School[];
  total: number;
  isLoading: boolean;
  page: number;
  totalPages: number;
  pageSize: number;
  search: string;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  onEdit: (school: School) => void;
}

export function SchoolsList({
  schools,
  total,
  isLoading,
  page,
  totalPages,
  pageSize,
  search,
  onSearchChange,
  onPageChange,
  onEdit,
}: SchoolsListProps) {
  const t = useTranslations('admin');
  const locale = useLocale();

  return (
    <>
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('data.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Schools Table */}
      {isLoading ? (
        <ListSkeleton count={5} />
      ) : schools.length > 0 ? (
        <>
          <Card>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">{t('data.logo')}</TableHead>
                    <TableHead className="w-[60px]">{t('data.rank')}</TableHead>
                    <TableHead>{t('data.schoolName')}</TableHead>
                    <TableHead>{t('data.state')}</TableHead>
                    <TableHead>{t('data.applicationType')}</TableHead>
                    <TableHead>{t('data.deadline')}</TableHead>
                    <TableHead>{t('data.acceptanceRate')}</TableHead>
                    <TableHead className="w-[80px]">{t('data.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schools.map((school) => (
                    <TableRow key={school.id}>
                      <TableCell>
                        <SchoolLogo
                          logoUrl={school.logoUrl}
                          name={getSchoolName(school, locale)}
                          size="sm"
                          className="rounded-md"
                        />
                      </TableCell>
                      <TableCell>
                        {school.usNewsRank ? (
                          <Badge variant="outline">US News #{school.usNewsRank}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{getSchoolName(school, locale)}</div>
                          {getSchoolSubName(school, locale) && (
                            <div className="text-xs text-muted-foreground">
                              {getSchoolSubName(school, locale)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{school.state || '-'}</TableCell>
                      <TableCell>
                        {school.metadata?.applicationType ? (
                          <Badge variant="secondary">
                            {school.metadata.applicationType.toUpperCase()}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {school.metadata?.deadlines ? (
                          <div className="text-xs">
                            {school.metadata.deadlines.rea && (
                              <div>REA: {school.metadata.deadlines.rea}</div>
                            )}
                            {school.metadata.deadlines.ea && (
                              <div>EA: {school.metadata.deadlines.ea}</div>
                            )}
                            {school.metadata.deadlines.ed && (
                              <div>ED: {school.metadata.deadlines.ed}</div>
                            )}
                            {school.metadata.deadlines.rd && (
                              <div>RD: {school.metadata.deadlines.rd}</div>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{formatAcceptanceRate(school.acceptanceRate)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => onEdit(school)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t('common.edit')}
                        </Button>
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
      ) : (
        <EmptyState
          icon={<GraduationCap className="h-12 w-12" />}
          title={t('schools.notFound')}
          description={t('schools.tryOther')}
        />
      )}
    </>
  );
}
