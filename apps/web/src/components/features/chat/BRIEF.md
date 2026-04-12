# Feature: Chat (Peer Messaging)

## Purpose

Real-time peer-to-peer chat UI components for direct messaging between users.

## Components

- MessageInput — text input with emoji picker and send button
- EmojiPicker — emoji selection overlay
- TypingIndicator — shows when other user is typing
- UserProfileCard — inline user profile preview in chat context

## Data Flow

- WebSocket-based real-time messaging
- Separate from agent-chat (this is user-to-user, not AI)

## Patterns

- Barrel export via index.ts
- Lightweight UI primitives — chat page logic lives in the page component
- Typing indicator uses WebSocket presence events
