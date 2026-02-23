/**
 * Event definitions for Chat ↔ Notification decoupling.
 *
 * ChatGateway emits `chat.message.offline` when a message is sent to offline users.
 * NotificationService listens and creates the notification.
 *
 * NotificationService emits `notification.push` after creating a notification.
 * ChatGateway listens and pushes via WebSocket.
 */

import { NotificationType } from '../../modules/notification/notification.service';

export const CHAT_MESSAGE_OFFLINE = 'chat.message.offline';
export const NOTIFICATION_PUSH = 'notification.push';
export const USER_REGISTERED = 'user.registered';

export interface ChatMessageOfflinePayload {
  recipientId: string;
  senderId: string;
  conversationId: string;
}

export interface NotificationPushPayload {
  userId: string;
  event: string;
  data: unknown;
}

export interface UserRegisteredPayload {
  userId: string;
  email: string;
}
