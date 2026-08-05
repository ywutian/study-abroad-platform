'use client';

import { useState, useEffect } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { schoolRoutes } from '@study-abroad/shared';
import { apiClient } from '@/lib/api';
import { cachePolicy } from '@/lib/query';
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
    // The query key changes on every debounced keystroke. Without this the
    // previous results unmount and the box drops to a skeleton between every
    // letter — the type-ahead flickers the whole time you are typing.
    placeholderData: keepPreviousData,
    // The school catalog does not change mid-session, so DYNAMIC (1 min) only
    // bought refetch thrash on a list the user is scrubbing through.
    ...cachePolicy.reference,
  });
}
