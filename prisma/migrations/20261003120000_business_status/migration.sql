-- Locales y tiendas: estado "abierto ahora" y "publicado" que maneja el dueño
-- desde su panel. Antes el panel del motel mostraba estos interruptores pero
-- la API no los guardaba.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "businessOpen" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "businessPublished" BOOLEAN NOT NULL DEFAULT true;
