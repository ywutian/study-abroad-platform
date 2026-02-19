import { useState, useCallback, useEffect } from 'react';
import debounce from 'lodash.debounce';

interface DebouncedSearchReturn {
  search: string;
  debouncedSearch: string;
  handleSearchChange: (value: string) => void;
}

/**
 * Encapsulates the debounced search pattern used across list screens.
 * Returns the immediate search value (for the input), the debounced value
 * (for query keys), and a change handler.
 */
export function useDebouncedSearch(delay = 300): DebouncedSearchReturn {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetSearch = useCallback(
    debounce((value: string) => setDebouncedSearch(value), delay),
    []
  );

  // Cancel pending debounce on unmount to prevent state updates after unmount
  useEffect(() => {
    return () => {
      debouncedSetSearch.cancel();
    };
  }, [debouncedSetSearch]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      debouncedSetSearch(value);
    },
    [debouncedSetSearch]
  );

  return { search, debouncedSearch, handleSearchChange };
}
