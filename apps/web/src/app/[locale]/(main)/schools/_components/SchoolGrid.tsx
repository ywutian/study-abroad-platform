/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useTranslations, useLocale, useFormatter } from 'next-intl';
import { motion } from 'framer-motion';
import { MapPin, GraduationCap, ChevronRight, Plus, Check, Users, Award, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SchoolLogo } from '@/components/features';
import {
  getSchoolCommunityRatingSummary,
  getSchoolEnrollmentCount,
  getSchoolFieldSource,
  getTrustedValue,
  hasVerifiedFieldSource,
} from '@/components/features/schools/school-display-utils';
import { TrustBadge } from '@/components/features/schools/TrustBadge';
import { FloatingAddButton, SelectedSchool } from '@/components/features/schools/FloatingAddButton';
import { Link } from '@/lib/i18n/navigation';
import { RankingBadge } from '@/components/ui/ranking-badge';
import { cn, getSchoolName, getSchoolSubName, formatAcceptanceRate } from '@/lib/utils';
import { type School } from './schools-types';

interface SchoolGridProps {
  schools: School[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  hasAuth: boolean;
  selectedSchools: SelectedSchool[];
  onToggleSelection: (school: School, checked: boolean) => void;
  isSchoolSelected: (schoolId: string) => boolean;
  addedSchools: Set<string>;
  onAddToList: (schoolId: string, round: string) => void;
  isAddingToList: boolean;
  hasFilters: boolean;
  onResetAllFilters: () => void;
  onBatchAdd: (schoolIds: string[], tier: string, round: string) => void;
  onRemoveSelected: (id: string) => void;
  onClearSelected: () => void;
  isBatchAdding: boolean;
}

function CommunityMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium">
      <span className="text-muted-foreground">{label}</span>{' '}
      <span className="text-foreground">{value.toFixed(1)}</span>
    </div>
  );
}

export function SchoolGrid({
  schools,
  total,
  isLoading,
  isError,
  onRefetch,
  hasAuth,
  selectedSchools,
  onToggleSelection,
  isSchoolSelected,
  addedSchools,
  onAddToList,
  isAddingToList,
  hasFilters,
  onResetAllFilters,
  onBatchAdd,
  onRemoveSelected,
  onClearSelected,
  isBatchAdding,
}: SchoolGridProps) {
  const t = useTranslations('schools');
  const tc = useTranslations('common');
  const locale = useLocale();
  const format = useFormatter();

  return (
    <>
      {/* Results Count */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{t('resultsCount', { count: total })}</p>
          {schools.length > 0 && total > schools.length ? (
            <p className="text-xs text-muted-foreground">
              {t('showingTruncated', { shown: schools.length, total })}
            </p>
          ) : null}
        </div>
        {selectedSchools.length > 0 && (
          <Badge variant="secondary" className="gap-1">
            {t('selectedCount', { count: selectedSchools.length })}
          </Badge>
        )}
      </div>

      {/* Schools Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <div className="h-1 bg-primary/20" />
              <CardContent className="pt-4">
                <div className="flex items-start gap-3 mb-3">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-4 w-2/3 mb-3" />
                <Skeleton className="h-16 w-full rounded-lg" />
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
          {schools.map((school, index) => {
            const isSelected = isSchoolSelected(school.id);
            const isAdded = addedSchools.has(school.id);
            const communityRatingSummary = getSchoolCommunityRatingSummary(school);
            const enrollmentSource = getSchoolFieldSource(
              school,
              'totalEnrollment',
              'studentCount'
            );
            const acceptanceSource = getSchoolFieldSource(school, 'acceptanceRate');
            const enrollmentCount = hasVerifiedFieldSource(
              school,
              'totalEnrollment',
              'studentCount'
            )
              ? getSchoolEnrollmentCount(school)
              : undefined;
            const trustedEnrollmentCount = getTrustedValue(
              school,
              enrollmentCount,
              'totalEnrollment',
              'studentCount'
            );
            const trustedAcceptanceRate = getTrustedValue(
              school,
              school.acceptanceRate,
              'acceptanceRate'
            );
            const hasSupplementalRanking = Boolean(
              school.usNewsRank || school.qsRank || school.rankings?.length
            );

            return (
              <motion.div
                key={school.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
              >
                <Card
                  className={cn(
                    'h-full hover:shadow-lg transition-all duration-300 hover:border-primary/50 cursor-pointer group overflow-hidden',
                    isSelected && 'ring-2 ring-primary/50 bg-primary/5'
                  )}
                >
                  <div className="h-1 bg-primary group-hover:h-1.5 transition-all" />
                  <CardContent className="pt-4">
                    {/* Batch selection checkbox */}
                    {hasAuth && (
                      <div className="flex items-center justify-end mb-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            onToggleSelection(school, checked as boolean)
                          }
                          disabled={isAdded}
                          className="shrink-0"
                        />
                      </div>
                    )}

                    <Link href={`/schools/${school.id}`}>
                      <div className="flex items-start gap-3 mb-3">
                        <SchoolLogo
                          logoUrl={school.logoUrl}
                          website={school.website}
                          name={getSchoolName(school, locale)}
                          size="md"
                          className="border-violet-500/20 group-hover:border-violet-500/40 group-hover:scale-105 transition-all"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                {getSchoolName(school, locale)}
                              </h3>
                              {hasSupplementalRanking && (
                                <Badge variant="secondary" className="mt-1 text-[10px]">
                                  {t('supplementalRanking')}
                                </Badge>
                              )}
                            </div>
                            <RankingBadge
                              rankings={school.rankings}
                              usNewsRank={school.usNewsRank}
                              variant="amber"
                            />
                          </div>
                          {getSchoolSubName(school, locale) && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {getSchoolSubName(school, locale)}
                            </p>
                          )}
                        </div>
                      </div>

                      {(school.testOptional || school.hasEarlyDecision) && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {school.testOptional && (
                            <Badge variant="outline" className="text-xs">
                              {t('specialConditions.testOptional')}
                            </Badge>
                          )}
                          {school.hasEarlyDecision && (
                            <Badge variant="outline" className="text-xs">
                              ED
                            </Badge>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                        <span className="truncate">
                          {school.city && `${school.city}, `}
                          {school.state && `${school.state}, `}
                          {school.country}
                        </span>
                      </div>

                      {/* Data metrics */}
                      <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-muted/50 group-hover:bg-muted/70 transition-colors">
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                            <Award className="h-3 w-3" />
                            {t('acceptanceRate')}
                          </div>
                          <div
                            className={cn(
                              'font-semibold text-sm',
                              trustedAcceptanceRate && trustedAcceptanceRate < 15
                                ? 'text-rose-500'
                                : trustedAcceptanceRate && trustedAcceptanceRate < 30
                                  ? 'text-amber-500'
                                  : ''
                            )}
                          >
                            {trustedAcceptanceRate != null
                              ? formatAcceptanceRate(trustedAcceptanceRate)
                              : tc('notAvailable')}
                          </div>
                          <div className="mt-1 flex justify-center">
                            <TrustBadge source={acceptanceSource} />
                          </div>
                        </div>
                        <div className="text-center border-l border-border">
                          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                            <Users className="h-3 w-3" />
                            {t('students')}
                          </div>
                          <div className="font-semibold text-sm">
                            {trustedEnrollmentCount
                              ? format.number(trustedEnrollmentCount, 'standard')
                              : tc('notAvailable')}
                          </div>
                          <div className="mt-1 flex justify-center">
                            <TrustBadge source={enrollmentSource} />
                          </div>
                        </div>
                      </div>
                    </Link>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {communityRatingSummary.isPublic ? (
                          <div className="flex flex-wrap items-center gap-2">
                            {communityRatingSummary.safetyAvg != null && (
                              <CommunityMetric
                                label={t('community.safetyShort')}
                                value={communityRatingSummary.safetyAvg}
                              />
                            )}
                            {communityRatingSummary.lifeAvg != null && (
                              <CommunityMetric
                                label={t('community.lifeShort')}
                                value={communityRatingSummary.lifeAvg}
                              />
                            )}
                            {communityRatingSummary.foodAvg != null && (
                              <CommunityMetric
                                label={t('community.foodShort')}
                                value={communityRatingSummary.foodAvg}
                              />
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              {t('community.count', { count: communityRatingSummary.count })}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            {communityRatingSummary.count > 0
                              ? t('community.pendingCard', {
                                  count: communityRatingSummary.count,
                                  minCount: 5,
                                })
                              : t('community.noneCard')}
                          </p>
                        )}
                      </div>
                      {hasAuth ? (
                        isAdded ? (
                          <Button variant="secondary" size="sm" disabled>
                            <Check className="h-4 w-4 mr-1" />
                            {t('added')}
                          </Button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" disabled={isAddingToList}>
                                <Plus className="h-4 w-4 mr-1" />
                                {t('addToList')}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
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
                        <div className="flex items-center text-sm text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          {t('viewDetails')}
                          <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="h-1 bg-primary/40" />
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

      {/* Bottom spacer for floating bar */}
      {selectedSchools.length > 0 && <div className="h-16" />}

      {/* Floating batch add bar */}
      <FloatingAddButton
        selectedSchools={selectedSchools}
        onAdd={onBatchAdd}
        onRemove={onRemoveSelected}
        onClear={onClearSelected}
        isAdding={isBatchAdding}
      />
    </>
  );
}
