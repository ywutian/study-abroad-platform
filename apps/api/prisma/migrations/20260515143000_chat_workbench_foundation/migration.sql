-- Chat workbench foundation: per-user conversation preferences, message idempotency,
-- threaded references, and attachment metadata.

ALTER TABLE "ConversationParticipant"
  ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mutedUntil" TIMESTAMP(3);

ALTER TABLE "Message"
  ADD COLUMN "clientMessageId" TEXT,
  ADD COLUMN "replyToId" TEXT;

CREATE TABLE "MessageAttachment" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "size" INTEGER,
  "mimeType" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConversationParticipant_userId_isArchived_isPinned_idx"
  ON "ConversationParticipant"("userId", "isArchived", "isPinned");

CREATE INDEX "Message_conversationId_createdAt_idx"
  ON "Message"("conversationId", "createdAt");

CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");

CREATE UNIQUE INDEX "Message_senderId_clientMessageId_key"
  ON "Message"("senderId", "clientMessageId");

CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_replyToId_fkey"
  FOREIGN KEY ("replyToId") REFERENCES "Message"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MessageAttachment"
  ADD CONSTRAINT "MessageAttachment_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
