-- Migración 002: limpiar columnas obsoletas y añadir features avanzadas
-- (Camino A: MFCC + complejidad no lineal + prosodia adicional)
--
-- Resumen:
--   1) DELETE filas uci_dataset (sin audio fuente, no podemos enriquecer)
--   2) DROP columnas no usadas (extra_features, minio_cleaned_path, age, sex)
--   3) ADD columnas para features extendidas (cepstrales, no-lineales, prosodia)
--
-- Idempotente: usa IF EXISTS / IF NOT EXISTS donde aplica.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Limpieza de filas obsoletas
-- ---------------------------------------------------------------------------

-- uci_dataset: 195 filas tabulares sin audio fuente. No podemos extraer
-- MFCC ni complejidad no lineal sin la señal original. Además son
-- sustained_vowel y train_v2.py ya las filtra por task_type.
DELETE FROM training_samples WHERE source = 'uci_dataset';

-- ---------------------------------------------------------------------------
-- 2) Drop de columnas obsoletas
-- ---------------------------------------------------------------------------

-- jsonb que siempre estuvo vacío ({}). 0 referencias en el código.
ALTER TABLE training_samples DROP COLUMN IF EXISTS extra_features;

-- nunca se llenó en los datasets nuevos; siempre NULL.
ALTER TABLE training_samples DROP COLUMN IF EXISTS minio_cleaned_path;

-- solo aplicaba a uci_dataset (que acabamos de borrar). Producción no las captura.
ALTER TABLE training_samples DROP COLUMN IF EXISTS age;
ALTER TABLE training_samples DROP COLUMN IF EXISTS sex;

-- ---------------------------------------------------------------------------
-- 3) Nuevas columnas (Camino A: ~10 features clínicamente validadas)
-- ---------------------------------------------------------------------------

-- Cepstrales: MFCC 13 coeficientes -> media y desviación por audio.
-- Guardamos como jsonb (lista de 13 floats) para no inflar el schema con
-- 26 columnas planas. train_v2.py los desempaqueta a columnas dinámicas.
ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS mfcc_means jsonb;
ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS mfcc_stds  jsonb;

-- Complejidad no lineal (literatura PD: Tsanas, Little 2009/2011)
ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS dfa             double precision;  -- Detrended Fluctuation Analysis
ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS rpde            double precision;  -- Recurrence Period Density Entropy
ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS ppe             double precision;  -- Pitch Period Entropy
ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS sample_entropy  double precision;  -- Sample Entropy (sobre F0)

-- Modulación / prosodia adicionales
ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS cpp_mean        double precision;  -- Cepstral Peak Prominence
ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS intensity_mean  double precision;  -- Praat intensity (dB)
ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS intensity_std   double precision;

-- Marca para saber qué filas ya fueron procesadas con el nuevo extractor
ALTER TABLE training_samples ADD COLUMN IF NOT EXISTS extended_features_version smallint;

COMMIT;
