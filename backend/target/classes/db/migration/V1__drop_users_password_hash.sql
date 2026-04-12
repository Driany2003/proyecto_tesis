-- Alinear esquema T_users al modelo actual (Authority + Role por FK).
-- Eliminar columnas obsoletas si existen.
ALTER TABLE T_users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE T_users DROP COLUMN IF EXISTS role;
