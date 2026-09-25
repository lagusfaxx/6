-- "Eliminar chat" por usuario: fecha desde la que cada quien deja de ver una
-- conversación. Los mensajes no se borran.
CREATE TABLE IF NOT EXISTS "ChatClear" (
    "userId" UUID NOT NULL,
    "otherId" UUID NOT NULL,
    "clearedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatClear_pkey" PRIMARY KEY ("userId", "otherId")
);

DO $$ BEGIN
  ALTER TABLE "ChatClear" ADD CONSTRAINT "ChatClear_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
