'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { highSchoolRoutes } from '@study-abroad/shared';
import { apiClient, STALE_TIME } from '@/lib/api';

export interface HighSchoolSearchItem {
  id: string;
  name: string;
  nameZh?: string | null;
  country: string;
  state?: string | null;
  city?: string | null;
  type: string;
  tier?: number | null;
}

export function useHighSchoolSearch(query: string, enabled = true) {
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  return useQuery<HighSchoolSearchItem[]>({
    queryKey: ['high-schools-search', debouncedQuery],
    queryFn: () =>
      apiClient.get(highSchoolRoutes.list(), {
        params: { search: debouncedQuery, pageSize: '15' },
      }),
    enabled: enabled && debouncedQuery.length >= 1,
    staleTime: STALE_TIME.DYNAMIC,
  });
}
