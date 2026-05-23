-- User-level notification preferences for readiness delivery gates.
-- Defaults keep live notification channels disabled until policy and UI opt-in
-- are explicitly enabled.
CREATE TABLE "user_notification_preferences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readinessInAppSurface" BOOLEAN NOT NULL DEFAULT true,
  "readinessRedisNotificationFeed" BOOLEAN NOT NULL DEFAULT false,
  "readinessRemotePush" BOOLEAN NOT NULL DEFAULT false,
  "readinessEmail" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_notification_preferences_userId_key"
  ON "user_notification_preferences"("userId");

CREATE INDEX "user_notification_preferences_userId_idx"
  ON "user_notification_preferences"("userId");

ALTER TABLE "user_notification_preferences"
  ADD CONSTRAINT "user_notification_preferences_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
