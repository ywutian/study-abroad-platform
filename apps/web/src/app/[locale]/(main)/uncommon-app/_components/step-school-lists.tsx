'use client';

import { FileText, GraduationCap, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RankingBadge } from '@/components/ui/ranking-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, getSchoolName } from '@/lib/utils';
import { tierConfig } from './constants';
import type { SchoolListItem, TierKey } from './types';

interface StepSchoolListsProps {
  t: (key: string, values?: Record<string, string | number>) => string;
  locale: string;
  schoolList: SchoolListItem[] | undefined;
  listLoading: boolean;
  groupedSchools: Record<TierKey, SchoolListItem[]>;
  onDelete: (id: string) => void;
}

export function StepSchoolLists({
  t,
  locale,
  schoolList,
  listLoading,
  groupedSchools,
  onDelete,
}: StepSchoolListsProps) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            {t('mySchoolList')}
          </CardTitle>
          <Link href="/schools">
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              {t('addSchool')}
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {listLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : schoolList?.length ? (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {(['REACH', 'TARGET', 'SAFETY'] as const).map((tier) => {
                const schools = groupedSchools[tier];
                if (!schools.length) return null;
                const config = tierConfig[tier];

                return (
                  <div key={tier}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn('w-2 h-2 rounded-full', config.color)} />
                      <span className="text-sm font-medium">{t(`tier.${tier.toLowerCase()}`)}</span>
                      <Badge variant="secondary" className="text-xs">
                        {schools.length}
                      </Badge>
                    </div>
                    <div className="space-y-2 ml-4">
                      {schools.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 group"
                        >
                          <div className="flex items-center gap-2">
                            <RankingBadge
                              rankings={item.school.rankings}
                              usNewsRank={item.school.usNewsRank}
                              variant="plain"
                            />
                            <span className="text-sm">{getSchoolName(item.school, locale)}</span>
                            {item.isAIRecommended && (
                              <Badge variant="secondary" className="text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                AI
                              </Badge>
                            )}
                            {(item.essayPromptCount ?? 0) > 0 && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <FileText className="h-3 w-3" />
                                {item.essayPromptCount}
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                            onClick={() => onDelete(item.id)}
                            aria-label={`${t('removedFromList')} ${getSchoolName(item.school, locale)}`}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <EmptyState
            type="schools"
            title={t('emptyList')}
            description={t('emptyListDesc')}
            action={{
              label: t('startAdding'),
              onClick: () => router.push('/schools'),
            }}
            size="sm"
          />
        )}
      </CardContent>
    </Card>
  );
}
