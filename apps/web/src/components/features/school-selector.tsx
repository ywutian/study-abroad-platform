'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api';
import { Search, GraduationCap, X, Loader2 } from 'lucide-react';

interface School {
  id: string;
  name: string;
  nameZh?: string;
  country: string;
  state?: string;
  usNewsRank?: number;
  acceptanceRate?: number;
}

interface SchoolSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSchools: School[];
  onSelect: (schools: School[]) => void;
  maxSelection?: number;
  title?: string;
}

export function SchoolSelector({
  open,
  onOpenChange,
  selectedSchools,
  onSelect,
  maxSelection = 20,
  title,
}: SchoolSelectorProps) {
  const t = useTranslations('schoolSelector');
  const tCommon = useTranslations('common');
  const [search, setSearch] = useState('');
  const finalTitle = title ?? t('title');
  const [tempSelected, setTempSelected] = useState<School[]>(selectedSchools);

  // Fetch schools
  const { data: schoolsResponse, isLoading } = useQuery({
    queryKey: ['schools', search],
    queryFn: () =>
      apiClient.get<{ success: boolean; data: { items: School[]; total: number } }>('/schools', {
        params: { search, pageSize: '100' },
      }),
    enabled: open,
  });

  const schools = schoolsResponse?.data?.items || [];

  // Filter and sort schools
  const filteredSchools = useMemo(() => {
    let result = schools;

    // Sort by US News rank
    result = [...result].sort((a, b) => {
      if (!a.usNewsRank) return 1;
      if (!b.usNewsRank) return -1;
      return a.usNewsRank - b.usNewsRank;
    });

    return result;
  }, [schools]);

  const isSelected = (school: School) => tempSelected.some((s) => s.id === school.id);

  const toggleSchool = (school: School) => {
    if (isSelected(school)) {
      setTempSelected(tempSelected.filter((s) => s.id !== school.id));
    } else if (tempSelected.length < maxSelection) {
      setTempSelected([...tempSelected, school]);
    }
  };

  const handleConfirm = () => {
    onSelect(tempSelected);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setTempSelected(selectedSchools);
    onOpenChange(false);
  };

  // Reset temp selection when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setTempSelected(selectedSchools);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            {finalTitle}
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Selected schools */}
        {tempSelected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tempSelected.map((school) => (
              <Badge key={school.id} variant="secondary" className="gap-1 pr-1">
                {school.nameZh || school.name}
                <button
                  onClick={() => toggleSchool(school)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* School list */}
        <ScrollArea className="h-[400px] rounded-md border">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSchools.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <GraduationCap className="mb-2 h-12 w-12 opacity-50" />
              <p>{t('noResults')}</p>
              <p className="text-sm">{t('noResultsHint')}</p>
            </div>
          ) : (
            <div className="p-2">
              {filteredSchools.map((school) => (
                <div
                  key={school.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors hover:bg-muted/50 ${
                    isSelected(school) ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => toggleSchool(school)}
                >
                  <Checkbox
                    checked={isSelected(school)}
                    disabled={!isSelected(school) && tempSelected.length >= maxSelection}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{school.nameZh || school.name}</p>
                      {school.usNewsRank && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          #{school.usNewsRank}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {school.name}
                      {school.state && ` · ${school.state}`}
                    </p>
                  </div>
                  {school.acceptanceRate && (
                    <div className="text-right text-sm text-muted-foreground shrink-0">
                      <p>{t('acceptanceRate')}</p>
                      <p className="font-medium">{school.acceptanceRate}%</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            {t('selectedCount', { count: tempSelected.length, max: maxSelection })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleConfirm}>{t('confirmSelection')}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}




