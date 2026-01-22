import { act } from '@testing-library/react-native';
import { useNotificationStore } from '@/stores/notification';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  useNotificationStore.setState({ unreadCount: 0 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Notification Store', () => {
  beforeEach(() => {
    resetStore();
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------

  it('has correct initial state with unreadCount = 0', () => {
    const state = useNotificationStore.getState();
    expect(state.unreadCount).toBe(0);
  });

  // -----------------------------------------------------------------------
  // incrementUnread
  // -----------------------------------------------------------------------

  it('incrementUnread increases count by 1', () => {
    act(() => {
      useNotificationStore.getState().incrementUnread();
    });

    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it('incrementUnread increases count multiple times', () => {
    act(() => {
      useNotificationStore.getState().incrementUnread();
      useNotificationStore.getState().incrementUnread();
      useNotificationStore.getState().incrementUnread();
    });

    expect(useNotificationStore.getState().unreadCount).toBe(3);
  });

  // -----------------------------------------------------------------------
  // decrementUnread
  // -----------------------------------------------------------------------

  it('decrementUnread decreases count by 1', () => {
    useNotificationStore.setState({ unreadCount: 5 });

    act(() => {
      useNotificationStore.getState().decrementUnread();
    });

    expect(useNotificationStore.getState().unreadCount).toBe(4);
  });

  it('decrementUnread never goes below 0', () => {
    useNotificationStore.setState({ unreadCount: 0 });

    act(() => {
      useNotificationStore.getState().decrementUnread();
    });

    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('decrementUnread clamps at 0 when count is 1', () => {
    useNotificationStore.setState({ unreadCount: 1 });

    act(() => {
      useNotificationStore.getState().decrementUnread();
    });

    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('decrementUnread multiple times does not go below 0', () => {
    useNotificationStore.setState({ unreadCount: 2 });

    act(() => {
      useNotificationStore.getState().decrementUnread();
      useNotificationStore.getState().decrementUnread();
      useNotificationStore.getState().decrementUnread();
    });

    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  // -----------------------------------------------------------------------
  // setUnreadCount
  // -----------------------------------------------------------------------

  it('setUnreadCount sets the exact value', () => {
    act(() => {
      useNotificationStore.getState().setUnreadCount(42);
    });

    expect(useNotificationStore.getState().unreadCount).toBe(42);
  });

  it('setUnreadCount clamps negative values to 0', () => {
    act(() => {
      useNotificationStore.getState().setUnreadCount(-5);
    });

    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('setUnreadCount handles 0 correctly', () => {
    useNotificationStore.setState({ unreadCount: 10 });

    act(() => {
      useNotificationStore.getState().setUnreadCount(0);
    });

    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('setUnreadCount accepts large numbers', () => {
    act(() => {
      useNotificationStore.getState().setUnreadCount(9999);
    });

    expect(useNotificationStore.getState().unreadCount).toBe(9999);
  });

  // -----------------------------------------------------------------------
  // resetUnread
  // -----------------------------------------------------------------------

  it('resetUnread resets count to 0', () => {
    useNotificationStore.setState({ unreadCount: 15 });

    act(() => {
      useNotificationStore.getState().resetUnread();
    });

    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it('resetUnread is a no-op when already 0', () => {
    act(() => {
      useNotificationStore.getState().resetUnread();
    });

    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Combined operations
  // -----------------------------------------------------------------------

  it('increment then decrement returns to original count', () => {
    useNotificationStore.setState({ unreadCount: 5 });

    act(() => {
      useNotificationStore.getState().incrementUnread();
      useNotificationStore.getState().decrementUnread();
    });

    expect(useNotificationStore.getState().unreadCount).toBe(5);
  });

  it('setUnreadCount followed by incrementUnread works correctly', () => {
    act(() => {
      useNotificationStore.getState().setUnreadCount(10);
    });

    act(() => {
      useNotificationStore.getState().incrementUnread();
    });

    expect(useNotificationStore.getState().unreadCount).toBe(11);
  });

  it('resetUnread after many increments returns to 0', () => {
    act(() => {
      useNotificationStore.getState().incrementUnread();
      useNotificationStore.getState().incrementUnread();
      useNotificationStore.getState().incrementUnread();
    });

    expect(useNotificationStore.getState().unreadCount).toBe(3);

    act(() => {
      useNotificationStore.getState().resetUnread();
    });

    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });
});
