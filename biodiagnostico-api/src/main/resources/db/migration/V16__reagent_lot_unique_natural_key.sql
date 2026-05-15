-- ============================================================================
-- V16__reagent_lot_unique_natural_key.sql
-- Hotfix reagentes (2026-05-15):
--   1) Remove a unicidade antiga baseada apenas em (lot_number, manufacturer).
--   2) Cria a unicidade operacional correta em (lot_number, manufacturer, name).
--
-- Contexto de dominio:
--   - `name` e a coluna historica do banco para a etiqueta exposta no contrato
--     HTTP/UI como `label`.
--   - Producao confirmou que fabricantes/etiquetas diferentes podem emitir o
--     mesmo numero de lote. Bloquear apenas por numero + fabricante interrompe
--     o workflow real de entrada de reagentes.
--   - A duplicata que deve ser bloqueada e somente a mesma etiqueta, mesmo
--     fabricante e mesmo numero de lote.
--
-- Compatibilidade:
--   - V13 ja promoveu manufacturer para NOT NULL e `name`/`lot_number` sempre
--     foram NOT NULL.
--   - A chave e normalizada com LOWER(TRIM(...)) para alinhar com a sanitizacao
--     defensiva do frontend/backend e evitar duplicatas por caixa/espaco.
-- ============================================================================

BEGIN;

DROP INDEX IF EXISTS idx_reagent_lot_manufacturer;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reagent_lot_natural_key
    ON reagent_lots (
        LOWER(TRIM(lot_number)),
        LOWER(TRIM(COALESCE(manufacturer, ''))),
        LOWER(TRIM(name))
    );

COMMENT ON INDEX idx_reagent_lot_natural_key IS
    'Unicidade operacional de reagente: numero de lote + fabricante + etiqueta(label/name).';

COMMIT;
