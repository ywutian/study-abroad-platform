'use client';

import { useState, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { School, Search, X, CheckCircle, Loader2, Target } from 'lucide-react';
import { cn, getSchoolName, formatAcceptanceRate } from '@/lib/utils';
import { useSchoolSearch } from '@/hooks/use-school-search';
import type { SchoolSearchItem } from './types';

interface SchoolSelectorCardProps {
  selectedSchools: SchoolSearchItem[];
  onAdd: (school: SchoolSearchItem) => void;
  onRemove: (schoolId: string) => void;
  onPredict: () => void;
  isPredicting: boolean;
}

export function SchoolSelectorCard({
  selectedSchools,
  onAdd,
  onRemove,
  onPredict,
  isPredicting,
}: SchoolSelectorCardProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: searchResults, isLoading: searchLoading } = useSchoolSearch(searchQuery);

  const disabledIds = new Set(selectedSchools.map((s) => s.id));

  const handleSelect = useCallback(
    (school: SchoolSearchItem) => {
      onAdd(school);
      setSearchQuery('');
    },
    [onAdd]
  );

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <School className="h-5 w-5" />
          {t('prediction.selectSchools')}
        </CardTitle>
        <CardDescription>{t('prediction.searchSchoolsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('prediction.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />

          {/* Search results dropdown */}
          {searchQuery.trim().length >= 1 && (
            <Card className="absolute top-full left-0 right-0 mt-1 z-50 shadow-lg">
              <ScrollArea className="max-h-60">
                {searchLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : searchResults?.items && searchResults.items.length > 0 ? (
                  <div className="p-1">
                    {searchResults.items.map((school) => {
                      const isSelected = disabledIds.has(school.id);
                      return (
                        <button
                          key={school.id}
                          onClick={() => handleSelect(school)}
                          disabled={isSelected}
                          className={cn(
                            'w-full flex items-center justify-between p-2 rounded-md text-left',
                            'hover:bg-muted transition-colors',
                            isSelected && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <div>
                            <p className="font-medium">{getSchoolName(school, locale)}</p>
                            <p className="text-xs text-muted-foreground">
                              {school.usNewsRank && `#${school.usNewsRank}`}
                              {school.acceptanceRate &&
                                ` · ${t('prediction.acceptanceRateLabel', { rate: formatAcceptanceRate(school.acceptanceRate).replace('%', '') })}`}
                            </p>
                          </div>
                          {isSelected && <CheckCircle className="h-4 w-4 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center py-4 text-muted-foreground">
                    {t('prediction.noSchoolsFound')}
                  </p>
                )}
              </ScrollArea>
            </Card>
          )}
        </div>

        {/* Selected school chips */}
        {selectedSchools.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t('prediction.selectedCount', { count: selectedSchools.length })}
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedSchools.map((school) => (
                <Badge
                  key={school.id}
                  variant="secondary"
                  className="flex items-center gap-1 py-1.5 px-3"
                >
                  {getSchoolName(school, locale)}
                  {school.usNewsRank && (
                    <span className="text-xs opacity-70">#{school.usNewsRank}</span>
                  )}
                  <button
                    onClick={() => onRemove(school.id)}
                    className="ml-1 hover:text-destructive"
                    aria-label={t('common.remove')}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={onPredict}
          disabled={isPredicting || selectedSchools.length === 0}
          className="w-full"
        >
          {isPredicting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('prediction.loading.analyzing')}
            </>
          ) : (
            <>
              <Target className="mr-2 h-4 w-4" />
              {t('prediction.runPrediction')}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
