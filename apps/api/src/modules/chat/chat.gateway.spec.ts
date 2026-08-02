import { ChatGateway } from './chat.gateway';

/**
 * Room-scoping on the socket surface.
 *
 * `client.to(room)` reaches that room's members regardless of whether the
 * sender belongs to it, and every handler takes `conversationId` straight off
 * the wire — so the guard has to be in the handler. handleJoinConversation
 * checks ConversationParticipant before letting a socket into
 * `conversation:*`, which makes room membership itself the proof of
 * participation for everything after it.
 */
describe('ChatGateway — conversation room scoping', () => {
  /** Minimal socket double: `rooms` is the Set socket.io keeps per client. */
  const socket = (userId: string | undefined, rooms: string[]) => {
    const emit = jest.fn();
    return {
      client: {
        userId,
        rooms: new Set(rooms),
        to: jest.fn(() => ({ emit })),
      } as never,
      emit,
    };
  };

  const gateway = () =>
    new ChatGateway(
      {} as never, // ChatService — handleTyping never touches it
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {},
    );

  it('broadcasts a typing event into a conversation the sender joined', () => {
    const { client, emit } = socket('user-1', ['conversation:conv-1']);

    gateway().handleTyping(client, {
      conversationId: 'conv-1',
      isTyping: true,
    });

    expect(emit).toHaveBeenCalledWith(
      'userTyping',
      expect.objectContaining({ conversationId: 'conv-1', userId: 'user-1' }),
    );
  });

  it('refuses to broadcast into a conversation the sender never joined', () => {
    // The attacker is authenticated and knows a conversationId — that used to
    // be enough to push "user-9 is typing" into someone else's private chat.
    const { client, emit } = socket('user-9', []);

    gateway().handleTyping(client, {
      conversationId: 'someone-elses',
      isTyping: true,
    });

    expect(emit).not.toHaveBeenCalled();
  });

  it('refuses an unauthenticated socket', () => {
    const { client, emit } = socket(undefined, ['conversation:conv-1']);

    gateway().handleTyping(client, {
      conversationId: 'conv-1',
      isTyping: true,
    });

    expect(emit).not.toHaveBeenCalled();
  });
});
