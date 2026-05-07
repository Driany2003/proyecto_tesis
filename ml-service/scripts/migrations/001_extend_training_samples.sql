-- Migración 001: extender training_samples para soportar habla conectada
-- (lectura, monólogo) además de la fonación sostenida que ya existía.
--
-- Justificación:
--   El sistema en producción graba RESPUESTAS DE PACIENTES (habla conectada),
--   no vocales sostenidas. Para evitar el "task mismatch" entre datos de
--   entrenamiento y datos de inferencia, necesitamos:
--     1) marcar el tipo de tarea de cada muestra (`task_type`)
--     2) almacenar features lingüísticas (NLP) de Whisper, no solo acústicas
--     3) guardar el `subject_id` original del corpus para hacer GroupKFold
--        (validación cruzada por SUJETO, no por grabación)
--
-- Ejecutar con:
--   psql -h $ML_DB_HOST -U $ML_DB_USER -d $ML_DB_NAME -f 001_extend_training_samples.sql

BEGIN;

-- 1) Tipo de tarea (sustained_vowel | reading | monologue | listen_repeat)
ALTER TABLE training_samples
  ADD COLUMN IF NOT EXISTS task_type VARCHAR(32);

-- 2) Identificador único por sujeto dentro del corpus original
--    (necesario para GroupKFold: dos grabaciones del mismo paciente NO pueden
--    quedar una en train y otra en test).
ALTER TABLE training_samples
  ADD COLUMN IF NOT EXISTS subject_id VARCHAR(64);

-- 3) Idioma del audio (es, it, en, cs, ...)
ALTER TABLE training_samples
  ADD COLUMN IF NOT EXISTS language VARCHAR(8);

-- 4) Features acústicas adicionales que ya extrae el pipeline pero no se
--    persistían en producción.
ALTER TABLE training_samples
  ADD COLUMN IF NOT EXISTS f0_min DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS f0_max DOUBLE PRECISION;

-- 5) Features NLP (solo aplicables a lectura / monólogo)
ALTER TABLE training_samples
  ADD COLUMN IF NOT EXISTS transcript        TEXT,
  ADD COLUMN IF NOT EXISTS duration_sec      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS word_count        INT,
  ADD COLUMN IF NOT EXISTS unique_words      INT,
  ADD COLUMN IF NOT EXISTS ttr               DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS words_per_min     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS avg_word_length   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS sentence_count    INT,
  ADD COLUMN IF NOT EXISTS filler_count      INT,
  ADD COLUMN IF NOT EXISTS pause_ratio       DOUBLE PRECISION;

-- 6) Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_training_samples_source     ON training_samples(source);
CREATE INDEX IF NOT EXISTS idx_training_samples_task_type  ON training_samples(task_type);
CREATE INDEX IF NOT EXISTS idx_training_samples_subject_id ON training_samples(subject_id);

-- 7) Etiqueta del task_type para registros legacy (si todos eran vocales /a/)
UPDATE training_samples
   SET task_type = 'sustained_vowel'
 WHERE task_type IS NULL;

COMMIT;

-- Verificación rápida (opcional):
-- SELECT source, task_type, language, COUNT(*)
--   FROM training_samples
--  GROUP BY source, task_type, language
--  ORDER BY source, task_type;
