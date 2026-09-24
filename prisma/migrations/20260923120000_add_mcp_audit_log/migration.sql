-- Bitácora del servidor MCP (Claude)
CREATE TABLE IF NOT EXISTS "McpAuditLog" (
    "id" UUID NOT NULL,
    "tool" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "args" JSONB,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "McpAuditLog_createdAt_idx" ON "McpAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "McpAuditLog_tool_createdAt_idx" ON "McpAuditLog"("tool", "createdAt");
