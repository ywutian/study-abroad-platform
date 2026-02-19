import { renderHook, act } from '@testing-library/react-native';
import { useDebouncedSearch } from '@/hooks/api/useDebouncedSearch';

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns empty initial state', () => {
    const { result } = renderHook(() => useDebouncedSearch());

    expect(result.current.search).toBe('');
    expect(result.current.debouncedSearch).toBe('');
    expect(typeof result.current.handleSearchChange).toBe('function');
  });

  it('updates search immediately on handleSearchChange', () => {
    const { result } = renderHook(() => useDebouncedSearch());

    act(() => {
      result.current.handleSearchChange('hello');
    });

    expect(result.current.search).toBe('hello');
    // debouncedSearch should still be empty (debounce hasn't fired)
    expect(result.current.debouncedSearch).toBe('');
  });

  it('updates debouncedSearch after default delay (300ms)', () => {
    const { result } = renderHook(() => useDebouncedSearch());

    act(() => {
      result.current.handleSearchChange('hello');
    });

    // Not yet
    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current.debouncedSearch).toBe('');

    // Now
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.debouncedSearch).toBe('hello');
  });

  it('only fires debounced update for the last input on rapid typing', () => {
    const { result } = renderHook(() => useDebouncedSearch());

    act(() => {
      result.current.handleSearchChange('h');
    });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    act(() => {
      result.current.handleSearchChange('he');
    });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    act(() => {
      result.current.handleSearchChange('hel');
    });

    // search is always immediate
    expect(result.current.search).toBe('hel');
    // debouncedSearch hasn't fired yet
    expect(result.current.debouncedSearch).toBe('');

    // Wait for debounce
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Should be the last value only
    expect(result.current.debouncedSearch).toBe('hel');
  });

  it('respects custom delay parameter', () => {
    const { result } = renderHook(() => useDebouncedSearch(500));

    act(() => {
      result.current.handleSearchChange('test');
    });

    act(() => {
      jest.advanceTimersByTime(499);
    });
    expect(result.current.debouncedSearch).toBe('');

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.debouncedSearch).toBe('test');
  });

  it('cancels pending debounce on unmount', () => {
    const { result, unmount } = renderHook(() => useDebouncedSearch());

    act(() => {
      result.current.handleSearchChange('test');
    });

    // Unmount before debounce fires
    unmount();

    // Advancing timers should not cause errors (setState on unmounted)
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // No assertion needed — test passes if no warning/error is thrown
  });
});
