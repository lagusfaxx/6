-- CreateTable
CREATE TABLE "PageView" (
    "id" UUID NOT NULL,
    "path" TEXT NOT NULL,
    "userId" UUID,
    "sessionId" TEXT,
    "referrer" TEXT,
    "userAgent" TEXT,
    "city" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAction" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "userId" UUID,
    "targetId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageView_createdAt_idx" ON "PageView"("createdAt");

-- CreateIndex
CREATE INDEX "PageView_path_createdAt_idx" ON "PageView"("path", "createdAt");

-- CreateIndex
CREATE INDEX "UserAction_action_createdAt_idx" ON "UserAction"("action", "createdAt");

-- CreateIndex
CREATE INDEX "UserAction_createdAt_idx" ON "UserAction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderLog_userId_type_key" ON "ReminderLog"("userId", "type");

-- CreateIndex
CREATE INDEX "ReminderLog_type_createdAt_idx" ON "ReminderLog"("type", "createdAt");
