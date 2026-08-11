-- Rollback operacional do catalogo de CQ de coagulacao introduzido pela V19.
-- A V19 deve permanecer imutavel para que ambientes onde ela ja foi aplicada
-- continuem passando pela validacao do Flyway.
--
-- Nenhum registro ou referencia e excluido: o historico laboratorial e as
-- chaves estrangeiras permanecem preservados para auditoria.

UPDATE qc_reference_values
SET is_active = FALSE,
    updated_at = CURRENT_TIMESTAMP
WHERE is_active = TRUE
  AND exam_id IN (
    SELECT id
    FROM qc_exams
    WHERE id IN (
        CAST('c0a60000-0000-4000-8000-000000000001' AS UUID),
        CAST('c0a60000-0000-4000-8000-000000000002' AS UUID),
        CAST('c0a60000-0000-4000-8000-000000000003' AS UUID)
    )
      AND LOWER(TRIM(area)) = 'coagulacao'
);

UPDATE qc_exams
SET is_active = FALSE,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (
    CAST('c0a60000-0000-4000-8000-000000000001' AS UUID),
    CAST('c0a60000-0000-4000-8000-000000000002' AS UUID),
    CAST('c0a60000-0000-4000-8000-000000000003' AS UUID)
)
  AND LOWER(TRIM(area)) = 'coagulacao';

DROP INDEX IF EXISTS uq_qc_exams_coagulacao_name;
