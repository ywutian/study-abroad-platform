import { renderHook, act, waitFor } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mock socket
// ---------------------------------------------------------------------------

type SocketEventHandler = (...args: unknown[]) => void;

const mockSocketHandlers: Record<string, SocketEventHandler[]> = {};
const mockEmit = jest.fn();
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();

const mockSocket = {
  on: jest.fn((event: string, handler: SocketEventHandler) => {
    if (!mockSocketHandlers[event]) {
      mockSocketHandlers[event] = [];
    }
    mockSocketHandlers[event].push(handler);
    return mockSocket;
  }),
  emit: mockEmit,
  connect: mockConnect,
  disconnect: mockDisconnect,
  connected: false,
  disconnected: true,
};

function emitSocketEvent(event: string, ...args: unknown[]) {
  const handlers = mockSocketHandlers[event];
  if (handlers) {
    handlers.forEach((handler) => handler(...args));
  }
}

function resetMockSocket() {
  Object.keys(mockSocketHandlers).forEach((key) => {
    delete mockSocketHandlers[key];
  });
  mockSocket.on.mockClear();
  mockEmit.mockClear();
  mockConnect.mockClear();
  mockDisconnect.mockClear();
  mockSocket.connected = false;
  mockSocket.disconnected = true;
}

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

// ---------------------------------------------------------------------------
// Mock secure store
// ---------------------------------------------------------------------------

jest.mock('@/lib/storage/secure-store', () => ({
  getAccessToken: jest.fn(),
  saveTokens: jest.fn(),
  clearAuthData: jest.fn(),
  saveUser: jest.fn(),
  getUser: jest.fn(),
  getRefreshToken: jest.fn(),
  storage: {
    get: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
  },
}));

// Mock expo-secure-store (transitive dependency)
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock AppState
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  return {
    ...RN,
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    },
  };
});

import { io } from 'socket.io-client';
import { getAccessToken } from '@/lib/storage/secure-store';
import { useChatSocket } from '@/hooks/useChatSocket';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClientWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  return { queryClient, Wrapper };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useChatSocket Hook', () => {
  beforeEach(() => {
    resetMockSocket();
    jest.clearAllMocks();
    // Default: getAccessToken returns a token so the socket connects
    (getAccessToken as jest.Mock).mockResolvedValue('fake-access-token');
  });

  // -----------------------------------------------------------------------
  // Initial state
  // -----------------------------------------------------------------------

  it('starts with isConnected = false and empty onlineUsers', () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useChatSocket(), {
      wrapper: Wrapper,
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.onlineUsers.size).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Socket connection
  // -----------------------------------------------------------------------

  it('creates a socket connection with the correct URL and auth', async () => {
    const { Wrapper } = createQueryClientWrapper();

    renderHook(() => useChatSocket(), { wrapper: Wrapper });

    // Wait for the async connect() to resolve
    await waitFor(() => {
      expect(io).toHaveBeenCalledWith(
        expect.stringContaining('/chat'),
        expect.objectContaining({
          auth: { token: 'fake-access-token' },
          transports: ['websocket', 'polling'],
          reconnection: true,
        })
      );
    });
  });

  it('does not create socket when no access token is available', async () => {
    (getAccessToken as jest.Mock).mockResolvedValue(null);
    const { Wrapper } = createQueryClientWrapper();

    renderHook(() => useChatSocket(), { wrapper: Wrapper });

    // Give the async connect() time to resolve
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(io).not.toHaveBeenCalled();
  });

  it('sets isConnected to true when socket emits "connect"', async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useChatSocket(), {
      wrapper: Wrapper,
    });

    // Wait for socket to be created
    await waitFor(() => {
      expect(io).toHaveBeenCalled();
    });

    // Simulate the socket emitting 'connect'
    await act(async () => {
      emitSocketEvent('connect');
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('sets isConnected to false when socket emits "disconnect"', async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useChatSocket(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(io).toHaveBeenCalled();
    });

    // Connect then disconnect
    await act(async () => {
      emitSocketEvent('connect');
    });
    expect(result.current.isConnected).toBe(true);

    await act(async () => {
      emitSocketEvent('disconnect');
    });
    expect(result.current.isConnected).toBe(false);
  });

  // -----------------------------------------------------------------------
  // sendMessage
  // -----------------------------------------------------------------------

  it('sendMessage emits "sendMessage" to socket when connected', async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useChatSocket(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(io).toHaveBeenCalled();
    });

    // Mark socket as connected
    mockSocket.connected = true;

    // Mock the emit to call the callback with a success response
    mockEmit.mockImplementation(
      (
        event: string,
        _data: unknown,
        callback?: (resp: { success: boolean; message?: unknown }) => void
      ) => {
        if (event === 'sendMessage' && callback) {
          callback({
            success: true,
            message: {
              id: 'msg-1',
              conversationId: 'conv-1',
              senderId: 'user-1',
              content: 'Hello!',
              read: false,
              createdAt: '2026-01-01T00:00:00Z',
            },
          });
        }
      }
    );

    let message: unknown = null;
    await act(async () => {
      message = await result.current.sendMessage('conv-1', 'Hello!');
    });

    expect(mockEmit).toHaveBeenCalledWith(
      'sendMessage',
      { conversationId: 'conv-1', content: 'Hello!' },
      expect.any(Function)
    );
    expect(message).toEqual(expect.objectContaining({ id: 'msg-1', content: 'Hello!' }));
  });

  it('sendMessage returns null when socket is not connected', async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useChatSocket(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(io).toHaveBeenCalled();
    });

    // Socket remains disconnected (default)
    mockSocket.connected = false;

    let message: unknown = 'not-null';
    await act(async () => {
      message = await result.current.sendMessage('conv-1', 'Hello!');
    });

    expect(message).toBeNull();
    expect(mockEmit).not.toHaveBeenCalledWith('sendMessage', expect.anything(), expect.anything());
  });

  it('sendMessage returns null on error response from server', async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useChatSocket(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(io).toHaveBeenCalled();
    });

    mockSocket.connected = true;

    mockEmit.mockImplementation(
      (
        event: string,
        _data: unknown,
        callback?: (resp: { success: boolean; error?: string }) => void
      ) => {
        if (event === 'sendMessage' && callback) {
          callback({ success: false, error: 'Forbidden' });
        }
      }
    );

    let message: unknown = 'not-null';
    await act(async () => {
      message = await result.current.sendMessage('conv-1', 'Hello!');
    });

    expect(message).toBeNull();
  });

  // -----------------------------------------------------------------------
  // joinConversation
  // -----------------------------------------------------------------------

  it('joinConversation emits "joinConversation" to socket', async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useChatSocket(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(io).toHaveBeenCalled();
    });

    act(() => {
      result.current.joinConversation('conv-123');
    });

    expect(mockEmit).toHaveBeenCalledWith('joinConversation', {
      conversationId: 'conv-123',
    });
  });

  // -----------------------------------------------------------------------
  // sendTyping
  // -----------------------------------------------------------------------

  it('sendTyping emits "typing" to socket', async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useChatSocket(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(io).toHaveBeenCalled();
    });

    act(() => {
      result.current.sendTyping('conv-123', true);
    });

    expect(mockEmit).toHaveBeenCalledWith('typing', {
      conversationId: 'conv-123',
      isTyping: true,
    });
  });

  it('sendTyping can send isTyping = false', async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useChatSocket(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(io).toHaveBeenCalled();
    });

    act(() => {
      result.current.sendTyping('conv-123', false);
    });

    expect(mockEmit).toHaveBeenCalledWith('typing', {
      conversationId: 'conv-123',
      isTyping: false,
    });
  });

  // -----------------------------------------------------------------------
  // markRead
  // -----------------------------------------------------------------------

  it('markRead emits "markRead" to socket', async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useChatSocket(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(io).toHaveBeenCalled();
    });

    act(() => {
      result.current.markRead('conv-123');
    });

    expect(mockEmit).toHaveBeenCalledWith('markRead', {
      conversationId: 'conv-123',
    });
  });

  // -----------------------------------------------------------------------
  // Online users
  // -----------------------------------------------------------------------

  it('tracks online users when socket receives "userOnline"', async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useChatSocket(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(io).toHaveBeenCalled();
    });

    await act(async () => {
      emitSocketEvent('userOnline', 'user-abc');
    });

    expect(result.current.onlineUsers.has('user-abc')).toBe(true);
    expect(result.current.isUserOnline('user-abc')).toBe(true);
  });

  it('removes users from onlineUsers on "userOffline"', async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useChatSocket(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(io).toHaveBeenCalled();
    });

    // User comes online, then goes offline
    await act(async () => {
      emitSocketEvent('userOnline', 'user-abc');
    });
    expect(result.current.isUserOnline('user-abc')).toBe(true);

    await act(async () => {
      emitSocketEvent('userOffline', 'user-abc');
    });
    expect(result.current.isUserOnline('user-abc')).toBe(false);
  });

  it('isUserOnline returns false for unknown users', async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { result } = renderHook(() => useChatSocket(), {
      wrapper: Wrapper,
    });

    expect(result.current.isUserOnline('unknown-user')).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Disconnect on unmount
  // -----------------------------------------------------------------------

  it('disconnects socket on unmount', async () => {
    const { Wrapper } = createQueryClientWrapper();

    const { unmount } = renderHook(() => useChatSocket(), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(io).toHaveBeenCalled();
    });

    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // Callbacks
  // -----------------------------------------------------------------------

  it('calls onNewMessage callback when "newMessage" event fires', async () => {
    const onNewMessage = jest.fn();
    const { Wrapper } = createQueryClientWrapper();

    renderHook(() => useChatSocket({ onNewMessage }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(io).toHaveBeenCalled();
    });

    const mockMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: 'user-2',
      content: 'Hi there!',
      read: false,
      createdAt: '2026-01-01T00:00:00Z',
    };

    await act(async () => {
      emitSocketEvent('newMessage', {
        conversationId: 'conv-1',
        message: mockMessage,
      });
    });

    expect(onNewMessage).toHaveBeenCalledWith(mockMessage);
  });

  it('calls onError callback on "connect_error"', async () => {
    const onError = jest.fn();
    const { Wrapper } = createQueryClientWrapper();

    renderHook(() => useChatSocket({ onError }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(io).toHaveBeenCalled();
    });

    await act(async () => {
      emitSocketEvent('connect_error', new Error('Connection refused'));
    });

    expect(onError).toHaveBeenCalledWith('Connection refused');
  });
});
