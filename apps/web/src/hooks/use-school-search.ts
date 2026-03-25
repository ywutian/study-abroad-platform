'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { schoolRoutes } from '@study-abroad/shared';
import { apiClient, STALE_TIME } from '@/lib/api';
import type { SchoolSearchItem } from '@/components/features/prediction/types';

export function useSchoolSearch(query: string, enabled = true) {
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  return useQuery<{ items: SchoolSearchItem[] }>({
    queryKey: ['schools-search', debouncedQuery],
    queryFn: () =>
      apiClient.get(schoolRoutes.list(), {
        params: { search: debouncedQuery, pageSize: '10' },
      }),
    enabled: enabled && debouncedQuery.length >= 1,
    staleTime: STALE_TIME.DYNAMIC,
  });
}
