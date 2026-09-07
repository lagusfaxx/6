-- Rol de equipo con acceso de sólo lectura al panel.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'MODERATOR';
