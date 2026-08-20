-- V21: Catalogo canonico de exames para Controle de Qualidade (CQ) de Coagulacao.
-- Cadastra os exames fundamentais de hemostasia para permitir lancamento unificado
-- de corrida diaria (TP Atividade, TP INR, TTPa e Fibrinogenio).
-- As referencias (lotes, medias e desvios padrao) sao cadastradas dinamicamente
-- pelos farmaceuticos atraves da interface de bancada.

INSERT INTO qc_exams (id, name, area, unit, is_active, created_at, updated_at)
VALUES
    (
        'c0a60000-0000-4000-8000-000000000001',
        'TP - Atividade (%)',
        'coagulacao',
        '%',
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'c0a60000-0000-4000-8000-000000000002',
        'TP - INR',
        'coagulacao',
        'INR',
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'c0a60000-0000-4000-8000-000000000003',
        'TTPa - Tempo (s)',
        'coagulacao',
        's',
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'c0a60000-0000-4000-8000-000000000004',
        'Fibrinogênio (g/L)',
        'coagulacao',
        'g/L',
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    area = EXCLUDED.area,
    unit = EXCLUDED.unit,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;

-- Indice unico para evitar duplicacao de exames com mesmo nome na area de coagulacao
CREATE UNIQUE INDEX IF NOT EXISTS uq_qc_exams_coagulacao_name
ON qc_exams (LOWER(TRIM(name)))
WHERE LOWER(TRIM(area)) = 'coagulacao';
