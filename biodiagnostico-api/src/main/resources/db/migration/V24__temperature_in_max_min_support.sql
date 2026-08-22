-- ==============================================================================
-- Migração V24: Suporte a Temperatura Máxima e Mínima do Sensor Interno (IN)
-- ==============================================================================

ALTER TABLE temperature_records
    ADD COLUMN IF NOT EXISTS temp_max_in NUMERIC(5, 2),
    ADD COLUMN IF NOT EXISTS temp_min_in NUMERIC(5, 2);

COMMENT ON COLUMN temperature_records.temp_max_in IS 'Temperatura máxima registrada pelo sensor interno/ambiente (IN)';
COMMENT ON COLUMN temperature_records.temp_min_in IS 'Temperatura mínima registrada pelo sensor interno/ambiente (IN)';
