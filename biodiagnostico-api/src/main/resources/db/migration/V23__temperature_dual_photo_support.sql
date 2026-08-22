-- ==============================================================================
-- V23: Suporte a Captura Dupla de Fotos no Controle de Temperatura
-- Permite armazenar a evidência fotográfica da Máxima (photo_url) e da Mínima (photo_min_url)
-- ==============================================================================

ALTER TABLE temperature_records
  ADD COLUMN IF NOT EXISTS photo_min_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_min_filename VARCHAR(255);

COMMENT ON COLUMN temperature_records.photo_url IS 'URL ou base64 da foto do visor em modo Máxima ou foto geral';
COMMENT ON COLUMN temperature_records.photo_min_url IS 'URL ou base64 da foto do visor em modo Mínima';
