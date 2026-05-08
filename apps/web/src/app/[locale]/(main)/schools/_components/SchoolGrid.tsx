'use client';

import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { GraduationCap, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { SchoolCard } from './SchoolCard';
import { type School } from './schools-types';
import { SchoolPagination } from './SchoolPagination';

interface SchoolGridProps {
  schools: School[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  hasAuth: boolean;
  onToggleSelection: (school: School, checked: boolean) => void;
  isSchoolSelected: (schoolId: string) => boolean;
  addedSchools: Set<string>;
  onAddToList: (schoolId: string, round: string) => void;
  isAddingToList: boolean;
  hasFilters: boolean;
  onResetAllFilters: () => void;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  density?: 'comfortable' | 'compact';
}

export function SchoolGrid({
  schools,
  isLoading,
  isError,
  onRefetch,
  hasAuth,
  onToggleSelection,
  isSchoolSelected,
  addedSchools,
  onAddToList,
  isAddingToList,
  hasFilters,
  onResetAllFilters,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: SchoolGridProps) {
  const t = useTranslations('schools');
  const tc = useTranslations('common');

  return (
    <>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse overflow-hidden p-0">
              <div className="h-16 bg-muted/60" />
              <CardContent className="space-y-3 px-4 pb-4 pt-3">
                <Skeleton className="-mt-9 h-12 w-12 rounded-lg" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-8 w-full rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <Card className="overflow-hidden">
          <div className="h-1 bg-destructive" />
          <CardContent className="py-8">
            <EmptyState
              type="error"
              title={t('loadError')}
              description={t('loadErrorDesc')}
              action={{ label: tc('retry'), onClick: onRefetch }}
              size="lg"
            />
          </CardContent>
        </Card>
      ) : schools.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schools.map((school, index) => (
            <motion.div
              key={school.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3) }}
              className="h-full"
            >
              <SchoolCard
                school={school}
                viewMode="grid"
                hasAuth={hasAuth}
                isSelected={isSchoolSelected(school.id)}
                isAdded={addedSchools.has(school.id)}
                onToggleSelection={onToggleSelection}
                onAddToList={onAddToList}
                isAddingToList={isAddingToList}
              />
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="h-1 bg-blue-500/40" />
          <CardContent className="py-8">
            {hasFilters ? (
              <EmptyState
                type="no-results"
                title={t('noResults')}
                description={t('noResultsDesc')}
                action={{
                  label: t('resetFilters'),
                  onClick: onResetAllFilters,
                  variant: 'outline',
                  icon: <X className="h-4 w-4" />,
                }}
                size="lg"
              />
            ) : (
              <EmptyState
                type="schools"
                title={t('noResults')}
                description={t('noResultsDesc')}
                action={{
                  label: tc('retry'),
                  onClick: onRefetch,
                  icon: <GraduationCap className="h-4 w-4" />,
                }}
                size="lg"
              />
            )}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && schools.length > 0 && (
        <SchoolPagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </>
  );
}
