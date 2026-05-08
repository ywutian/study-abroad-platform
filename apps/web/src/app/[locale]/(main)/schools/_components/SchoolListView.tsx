'use client';

import { useTranslations, useLocale, useFormatter } from 'next-intl';
import { ArrowUp, ArrowDown, ArrowUpDown, Plus, Check, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SchoolLogo } from '@/components/features';
import { TrustBadge } from '@/components/features/schools/TrustBadge';
import {
  getSchoolEnrollmentCount,
  getSchoolFieldSource,
  getTrustedValue,
  hasVerifiedFieldSource,
} from '@/components/features/schools/school-display-utils';
import { Link } from '@/lib/i18n/navigation';
import { cn, formatAcceptanceRate, getSchoolName, getSchoolSubName } from '@/lib/utils';
import { type SchoolSortBy } from '@/components/features/schools/school-filters';
import { type School } from './schools-types';

interface SchoolListViewProps {
  schools: School[];
  hasAuth: boolean;
  onToggleSelection: (school: School, checked: boolean) => void;
  isSchoolSelected: (id: string) => boolean;
  addedSchools: Set<string>;
  onAddToList: (id: string, round: string) => void;
  isAddingToList: boolean;
  sortBy: SchoolSortBy;
  onSortByChange: (s: SchoolSortBy) => void;
  density: 'comfortable' | 'compact';
}

const SORTABLE_COLUMNS: Array<{ key: SchoolSortBy; labelKey: string }> = [
  { key: 'rank', labelKey: 'list.colRank' },
  { key: 'name', labelKey: 'list.colSchool' },
  { key: 'acceptance', labelKey: 'list.colAcceptance' },
  { key: 'salary', labelKey: 'list.colSalary' },
];

export function SchoolListView({
  schools,
  hasAuth,
  onToggleSelection,
  isSchoolSelected,
  addedSchools,
  onAddToList,
  isAddingToList,
  sortBy,
  onSortByChange,
  density,
}: SchoolListViewProps) {
  const t = useTranslations('schools');
  const tc = useTranslations('common');
  const locale = useLocale();
  const format = useFormatter();

  const renderSortIcon = (col: SchoolSortBy) => {
    if (sortBy !== col) {
      return <ArrowUpDown className="h-3 w-3 opacity-50" />;
    }
    return <ArrowUp className="h-3 w-3" />;
  };

  const isColumnSortable = (col: SchoolSortBy): boolean =>
    SORTABLE_COLUMNS.some((c) => c.key === col);

  const sortableHeaderClass = (col: SchoolSortBy) =>
    cn('select-none', isColumnSortable(col) && 'cursor-pointer hover:text-foreground');

  const rowHeight = density === 'compact' ? 'h-12' : 'h-16';
  const cellPadding = density === 'compact' ? 'py-1.5' : 'py-2.5';

  return (
    <div className="overflow-hidden rounded-[var(--theme-radius-card)] border border-border/60 bg-card/40">
      <Table>
        <TableHeader className="bg-muted/40 [&_tr]:border-b-border/60">
          <TableRow>
            {hasAuth && <TableHead className="w-10" />}
            <TableHead
              className={cn('w-16 text-xs uppercase tracking-wide', sortableHeaderClass('rank'))}
              onClick={() => onSortByChange('rank')}
            >
              <span className="inline-flex items-center gap-1">
                {t('list.colRank')}
                {renderSortIcon('rank')}
              </span>
            </TableHead>
            <TableHead
              className={cn('text-xs uppercase tracking-wide', sortableHeaderClass('name'))}
              onClick={() => onSortByChange('name')}
            >
              <span className="inline-flex items-center gap-1">
                {t('list.colSchool')}
                {renderSortIcon('name')}
              </span>
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wide hidden md:table-cell">
              {t('list.colLocation')}
            </TableHead>
            <TableHead
              className={cn(
                'text-xs uppercase tracking-wide hidden sm:table-cell',
                sortableHeaderClass('acceptance')
              )}
              onClick={() => onSortByChange('acceptance')}
            >
              <span className="inline-flex items-center gap-1">
                {t('list.colAcceptance')}
                {renderSortIcon('acceptance')}
              </span>
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wide hidden lg:table-cell">
              {t('list.colStudents')}
            </TableHead>
            <TableHead
              className={cn(
                'text-xs uppercase tracking-wide hidden lg:table-cell',
                sortableHeaderClass('salary')
              )}
              onClick={() => onSortByChange('salary')}
            >
              <span className="inline-flex items-center gap-1">
                {t('list.colSalary')}
                {renderSortIcon('salary')}
              </span>
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wide hidden xl:table-cell">
              {t('list.colTags')}
            </TableHead>
            <TableHead className="text-xs uppercase tracking-wide text-right">
              {t('list.colActions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schools.map((school) => {
            const isSelected = isSchoolSelected(school.id);
            const isAdded = addedSchools.has(school.id);
            const acceptanceSource = getSchoolFieldSource(school, 'acceptanceRate');
            const enrollmentSource = getSchoolFieldSource(
              school,
              'totalEnrollment',
              'studentCount'
            );
            const enrollmentCount = hasVerifiedFieldSource(
              school,
              'totalEnrollment',
              'studentCount'
            )
              ? getSchoolEnrollmentCount(school)
              : undefined;
            const trustedEnrollment = getTrustedValue(
              school,
              enrollmentCount,
              'totalEnrollment',
              'studentCount'
            );
            const trustedAcceptance = getTrustedValue(
              school,
              school.acceptanceRate,
              'acceptanceRate'
            );

            return (
              <TableRow
                key={school.id}
                className={cn(
                  rowHeight,
                  'group transition-colors hover:bg-muted/40',
                  isSelected && 'bg-primary/5'
                )}
              >
                {hasAuth && (
                  <TableCell className={cellPadding}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(c) => onToggleSelection(school, c as boolean)}
                      disabled={isAdded}
                      aria-label={getSchoolName(school, locale)}
                    />
                  </TableCell>
                )}
                <TableCell className={cn(cellPadding, 'font-mono text-xs text-muted-foreground')}>
                  {school.usNewsRank ? `#${school.usNewsRank}` : '—'}
                </TableCell>
                <TableCell className={cellPadding}>
                  <Link
                    href={`/schools/${school.id}`}
                    className="flex items-center gap-2.5 hover:text-primary"
                  >
                    <SchoolLogo
                      logoUrl={school.logoUrl}
                      website={school.website}
                      name={getSchoolName(school, locale)}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{getSchoolName(school, locale)}</div>
                      {getSchoolSubName(school, locale) && (
                        <div className="truncate text-xs text-muted-foreground">
                          {getSchoolSubName(school, locale)}
                        </div>
                      )}
                    </div>
                  </Link>
                </TableCell>
                <TableCell
                  className={cn(cellPadding, 'hidden text-sm text-muted-foreground md:table-cell')}
                >
                  <span className="truncate">
                    {school.city && `${school.city}, `}
                    {school.state && `${school.state}, `}
                    {school.country}
                  </span>
                </TableCell>
                <TableCell className={cn(cellPadding, 'hidden sm:table-cell')}>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'tabular-nums font-medium',
                        trustedAcceptance && trustedAcceptance < 15
                          ? 'text-rose-500'
                          : trustedAcceptance && trustedAcceptance < 30
                            ? 'text-amber-500'
                            : ''
                      )}
                    >
                      {trustedAcceptance != null
                        ? formatAcceptanceRate(trustedAcceptance)
                        : tc('notAvailable')}
                    </span>
                    <TrustBadge source={acceptanceSource} />
                  </div>
                </TableCell>
                <TableCell className={cn(cellPadding, 'hidden tabular-nums lg:table-cell')}>
                  <div className="flex items-center gap-1.5">
                    <span>
                      {trustedEnrollment
                        ? format.number(trustedEnrollment, 'standard')
                        : tc('notAvailable')}
                    </span>
                    <TrustBadge source={enrollmentSource} />
                  </div>
                </TableCell>
                <TableCell className={cn(cellPadding, 'hidden tabular-nums lg:table-cell')}>
                  {school.avgSalary
                    ? `$${format.number(Math.round(school.avgSalary / 1000), 'standard')}K`
                    : tc('notAvailable')}
                </TableCell>
                <TableCell className={cn(cellPadding, 'hidden xl:table-cell')}>
                  <div className="flex flex-wrap gap-1">
                    {school.hasEarlyDecision && (
                      <Badge variant="outline" className="text-2xs">
                        ED
                      </Badge>
                    )}
                    {school.testOptional && (
                      <Badge variant="outline" className="text-2xs">
                        {t('list.testOptional')}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className={cn(cellPadding, 'text-right')}>
                  {hasAuth ? (
                    isAdded ? (
                      <Button variant="ghost" size="sm" disabled className="h-7">
                        <Check className="mr-1 h-3.5 w-3.5" />
                        {t('added')}
                      </Button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            disabled={isAddingToList}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            {t('addToList')}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {(['ED', 'ED2', 'EA', 'REA', 'RD', 'ROLLING'] as const).map((r) => (
                            <DropdownMenuItem
                              key={r}
                              onClick={() => onAddToList(school.id, r)}
                              disabled={isAddingToList}
                            >
                              {t('rounds.' + r)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  ) : (
                    <Link
                      href={`/schools/${school.id}`}
                      className="inline-flex items-center text-sm text-primary opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      {t('viewDetails')}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
