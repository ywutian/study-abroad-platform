'use client';

import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { highSchoolRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api';
import { cachePolicy } from '@/lib/query';

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
    // See use-school-search: the key changes per debounced keystroke, so
    // without this the dropdown blanks between every letter.
    placeholderData: keepPreviousData,
    ...cachePolicy.reference,
  });
}
