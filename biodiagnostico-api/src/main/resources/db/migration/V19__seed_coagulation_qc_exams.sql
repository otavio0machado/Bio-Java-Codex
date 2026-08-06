-- Catalogo canonico de CQ da area de coagulacao.
-- Valores observados em material visual nao sao referencias e nao sao semeados.
-- A ordem preserva todas as referencias antes de remover duplicatas legadas.

-- 1. Garante deterministicamente os tres IDs canonicos.
INSERT INTO qc_exams (id, name, area, unit, is_active, created_at, updated_at)
VALUES (CAST('c0a60000-0000-4000-8000-000000000001' AS UUID),
        'Atividade (%)', 'coagulacao', '%', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO qc_exams (id, name, area, unit, is_active, created_at, updated_at)
VALUES (CAST('c0a60000-0000-4000-8000-000000000002' AS UUID),
        'INR', 'coagulacao', NULL, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO qc_exams (id, name, area, unit, is_active, created_at, updated_at)
VALUES (CAST('c0a60000-0000-4000-8000-000000000003' AS UUID),
        'TTPA', 'coagulacao', 's', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- 2. Reaponta referencias das duplicatas semanticas para os IDs canonicos.
UPDATE qc_reference_values
SET exam_id = CAST('c0a60000-0000-4000-8000-000000000001' AS UUID)
WHERE exam_id IN (
    SELECT id FROM qc_exams
    WHERE LOWER(TRIM(area)) = 'coagulacao'
      AND LOWER(TRIM(name)) = LOWER('Atividade (%)')
      AND id <> CAST('c0a60000-0000-4000-8000-000000000001' AS UUID)
);

UPDATE qc_reference_values
SET exam_id = CAST('c0a60000-0000-4000-8000-000000000002' AS UUID)
WHERE exam_id IN (
    SELECT id FROM qc_exams
    WHERE LOWER(TRIM(area)) = 'coagulacao'
      AND LOWER(TRIM(name)) = LOWER('INR')
      AND id <> CAST('c0a60000-0000-4000-8000-000000000002' AS UUID)
);

UPDATE qc_reference_values
SET exam_id = CAST('c0a60000-0000-4000-8000-000000000003' AS UUID)
WHERE exam_id IN (
    SELECT id FROM qc_exams
    WHERE LOWER(TRIM(area)) = 'coagulacao'
      AND LOWER(TRIM(name)) = LOWER('TTPA')
      AND id <> CAST('c0a60000-0000-4000-8000-000000000003' AS UUID)
);

-- 3. Remove somente as linhas duplicadas ja sem referencias.
DELETE FROM qc_exams
WHERE LOWER(TRIM(area)) = 'coagulacao'
  AND LOWER(TRIM(name)) = LOWER('Atividade (%)')
  AND id <> CAST('c0a60000-0000-4000-8000-000000000001' AS UUID);

DELETE FROM qc_exams
WHERE LOWER(TRIM(area)) = 'coagulacao'
  AND LOWER(TRIM(name)) = LOWER('INR')
  AND id <> CAST('c0a60000-0000-4000-8000-000000000002' AS UUID);

DELETE FROM qc_exams
WHERE LOWER(TRIM(area)) = 'coagulacao'
  AND LOWER(TRIM(name)) = LOWER('TTPA')
  AND id <> CAST('c0a60000-0000-4000-8000-000000000003' AS UUID);

-- 4. Normaliza os registros canonicos, inclusive legados inativos/unidade divergente.
UPDATE qc_exams
SET name = 'Atividade (%)', area = 'coagulacao', unit = '%', is_active = TRUE, updated_at = CURRENT_TIMESTAMP
WHERE id = CAST('c0a60000-0000-4000-8000-000000000001' AS UUID);

UPDATE qc_exams
SET name = 'INR', area = 'coagulacao', unit = NULL, is_active = TRUE, updated_at = CURRENT_TIMESTAMP
WHERE id = CAST('c0a60000-0000-4000-8000-000000000002' AS UUID);

UPDATE qc_exams
SET name = 'TTPA', area = 'coagulacao', unit = 's', is_active = TRUE, updated_at = CURRENT_TIMESTAMP
WHERE id = CAST('c0a60000-0000-4000-8000-000000000003' AS UUID);

-- 5. Impede novas duplicatas semanticas em toda a area de coagulacao.
CREATE UNIQUE INDEX IF NOT EXISTS uq_qc_exams_coagulacao_name
    ON qc_exams (LOWER(TRIM(name)))
    WHERE LOWER(TRIM(area)) = 'coagulacao';
