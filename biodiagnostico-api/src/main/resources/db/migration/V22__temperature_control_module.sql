-- ============================================================================
-- V22__temperature_control_module.sql
-- Módulo de Controle de Temperatura e Termohigrometria Laboratorial
-- Em conformidade com ANVISA RDC 786/2023, ISO 15189, PNCQ e PALC
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. temperature_locations (Pontos de monitoramento térmico e ambientes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS temperature_locations (
    id                      UUID            NOT NULL,
    name                    VARCHAR(100)    NOT NULL,
    code                    VARCHAR(50)     NOT NULL,
    category                VARCHAR(50)     NOT NULL,
    area                    VARCHAR(50)     NOT NULL DEFAULT 'GERAL',
    min_temp_target         NUMERIC(5,2)    NOT NULL,
    max_temp_target         NUMERIC(5,2)    NOT NULL,
    min_humidity_target     NUMERIC(5,2),
    max_humidity_target     NUMERIC(5,2),
    thermometer_code        VARCHAR(100),
    calibration_cert_number VARCHAR(100),
    calibration_due_date    DATE,
    frequency               VARCHAR(50)     NOT NULL DEFAULT 'DIARIO_1X',
    active                  BOOLEAN         NOT NULL DEFAULT TRUE,
    notes                   TEXT,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_temperature_locations PRIMARY KEY (id),
    CONSTRAINT uk_temperature_locations_code UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_temperature_locations_active
    ON temperature_locations (active);

CREATE INDEX IF NOT EXISTS idx_temperature_locations_area
    ON temperature_locations (area);

-- ---------------------------------------------------------------------------
-- 2. temperature_records (Medições diárias e evidências de auditoria)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS temperature_records (
    id                      UUID            NOT NULL,
    location_id             UUID            NOT NULL,
    date                    DATE            NOT NULL,
    time                    TIME WITHOUT TIME ZONE NOT NULL,
    period                  VARCHAR(20)     NOT NULL DEFAULT 'UNICO',
    temp_current            NUMERIC(5,2),
    temp_max                NUMERIC(5,2)    NOT NULL,
    temp_min                NUMERIC(5,2)    NOT NULL,
    humidity                NUMERIC(5,2),
    status                  VARCHAR(30)     NOT NULL DEFAULT 'CONFORME',
    responsible             VARCHAR(100)    NOT NULL,
    responsible_id          UUID,
    action_taken            TEXT,
    notes                   TEXT,
    photo_url               TEXT,
    photo_filename          VARCHAR(255),
    ocr_raw_result          TEXT,
    ocr_applied             BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_temperature_records PRIMARY KEY (id),
    CONSTRAINT fk_temperature_records_location FOREIGN KEY (location_id)
        REFERENCES temperature_locations (id) ON DELETE CASCADE,
    CONSTRAINT fk_temperature_records_user FOREIGN KEY (responsible_id)
        REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_temperature_records_loc_date
    ON temperature_records (location_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_temperature_records_date
    ON temperature_records (date DESC);

CREATE INDEX IF NOT EXISTS idx_temperature_records_status
    ON temperature_records (status);

-- ---------------------------------------------------------------------------
-- 3. Seed inicial dos pontos de monitoramento padrão do laboratório
-- ---------------------------------------------------------------------------
INSERT INTO temperature_locations (
    id, name, code, category, area,
    min_temp_target, max_temp_target, min_humidity_target, max_humidity_target,
    thermometer_code, calibration_cert_number, frequency, active, created_at, updated_at
)
VALUES
    (
        'e0a10000-0000-4000-8000-000000000001',
        'Geladeira 1 - Reagentes Bioquímica',
        'GEL-01',
        'GELADEIRA',
        'BIOQUIMICA',
        2.0, 8.0, NULL, NULL,
        'TERM-01 (Incoterm Digital)',
        'CAL-2026/012',
        'DIARIO_1X',
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'e0a10000-0000-4000-8000-000000000002',
        'Geladeira 2 - Hematologia e Imunologia',
        'GEL-02',
        'GELADEIRA',
        'HEMATOLOGIA',
        2.0, 8.0, NULL, NULL,
        'TERM-02 (Jprolab SH-102)',
        'CAL-2026/013',
        'DIARIO_1X',
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'e0a10000-0000-4000-8000-000000000003',
        'Geladeira 3 - Amostras e Controles',
        'GEL-03',
        'GELADEIRA',
        'GERAL',
        2.0, 8.0, NULL, NULL,
        'TERM-03 (Incoterm Digital)',
        'CAL-2026/014',
        'DIARIO_1X',
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'e0a10000-0000-4000-8000-000000000004',
        'Freezer 1 - Soroteca e Alíquotas',
        'FRZ-01',
        'FREEZER',
        'GERAL',
        -25.0, -15.0, NULL, NULL,
        'TERM-04 (Digital Sonda Externa)',
        'CAL-2026/015',
        'DIARIO_1X',
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'e0a10000-0000-4000-8000-000000000005',
        'Estufa 1 - Microbiologia / Culturas',
        'EST-01',
        'ESTUFA',
        'MICROBIOLOGIA',
        35.0, 37.0, NULL, NULL,
        'TERM-05 (Digital Calibrado)',
        'CAL-2026/016',
        'DIARIO_1X',
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'e0a10000-0000-4000-8000-000000000006',
        'Banho-Maria 1 - Coagulação e Cinética',
        'BM-01',
        'BANHO_MARIA',
        'COAGULACAO',
        36.0, 38.0, NULL, NULL,
        'TERM-06 (Incoterm Alta Precisão)',
        'CAL-2026/017',
        'DIARIO_1X',
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'e0a10000-0000-4000-8000-000000000007',
        'Ambiente - Sala Técnica Central',
        'AMB-01',
        'AMBIENTE',
        'GERAL',
        15.0, 25.0, 30.0, 70.0,
        'TH-01 (Termohigrômetro Digital)',
        'CAL-2026/018',
        'DIARIO_1X',
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    )
ON CONFLICT (code) DO NOTHING;
