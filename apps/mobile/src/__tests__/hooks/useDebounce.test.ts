import { renderHook, act } from '@testing-library/react-native';
import { useDebounce } from '@/hooks/useDebounce';

describe('useDebounce Hook', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('debounces value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    expect(result.current).toBe('initial');

    // Change the value
    rerender({ value: 'changed' });
    
    // Value should still be initial
    expect(result.current).toBe('initial');

    // Fast forward time
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Now it should be updated
    expect(result.current).toBe('changed');
  });

  it('cancels previous timeout on new value', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'first' });
    
    // Advance partially
    act(() => {
      jest.advanceTimersByTime(300);
    });
    
    // Change again
    rerender({ value: 'second' });
    
    // Advance past first timeout
    act(() => {
      jest.advanceTimersByTime(300);
    });
    
    // Should still be initial (first was cancelled, second not yet fired)
    expect(result.current).toBe('initial');
    
    // Advance past second timeout
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    // Now should be second
    expect(result.current).toBe('second');
  });

  it('uses default delay of 300ms', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'changed' });
    
    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe('initial');
    
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe('changed');
  });
});









