-- CQ Uroanalise Especializado:
-- 1. Fita Reativa (Tiras de Urina): Controles internos e corridas com avaliacao instantanea e vinculo ao lote de reagente.
-- 2. Sedimento Urinario: Controle inter-observador (dupla leitura) com analise quantitativa (CV <= 20%) e concordancia categorica.

CREATE TABLE IF NOT EXISTS uro_strip_control_sets (
    id                    UUID         NOT NULL,
    control_lot_number    VARCHAR(255) NOT NULL,
    manufacturer          VARCHAR(255) NOT NULL,
    valid_until           DATE         NOT NULL,
    expected_ph_min       DOUBLE PRECISION,
    expected_ph_max       DOUBLE PRECISION,
    expected_density_min  DOUBLE PRECISION,
    expected_density_max  DOUBLE PRECISION,
    expected_proteins     VARCHAR(255) NOT NULL DEFAULT 'NEGATIVO',
    expected_glucose      VARCHAR(255) NOT NULL DEFAULT 'NEGATIVO',
    expected_ketones      VARCHAR(255) NOT NULL DEFAULT 'NEGATIVO',
    expected_blood        VARCHAR(255) NOT NULL DEFAULT 'NEGATIVO',
    expected_urobilinogen VARCHAR(255) NOT NULL DEFAULT 'NORMAL',
    expected_nitrite      VARCHAR(255) NOT NULL DEFAULT 'NEGATIVO',
    expected_bilirubin    VARCHAR(255) NOT NULL DEFAULT 'NEGATIVO',
    expected_leukocytes   VARCHAR(255) NOT NULL DEFAULT 'NEGATIVO',
    is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at            TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_uro_strip_control_sets PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS uro_strip_qc_runs (
    id                            UUID         NOT NULL,
    control_set_id                UUID         NOT NULL,
    data_medicao                  DATE         NOT NULL,
    control_lot_snapshot          VARCHAR(255) NOT NULL,
    control_valid_until_snapshot  DATE         NOT NULL,
    reagent_lot_id                UUID,
    reagent_label_snapshot        VARCHAR(255),
    reagent_manufacturer_snapshot VARCHAR(255),
    reagent_lot_number_snapshot   VARCHAR(255),
    reagent_valid_until_snapshot  DATE,
    measured_ph                   DOUBLE PRECISION,
    status_ph                     VARCHAR(50)  NOT NULL,
    measured_density              DOUBLE PRECISION,
    status_density                VARCHAR(50)  NOT NULL,
    measured_proteins             VARCHAR(255) NOT NULL,
    status_proteins               VARCHAR(50)  NOT NULL,
    measured_glucose              VARCHAR(255) NOT NULL,
    status_glucose                VARCHAR(50)  NOT NULL,
    measured_ketones              VARCHAR(255) NOT NULL,
    status_ketones                VARCHAR(50)  NOT NULL,
    measured_blood                VARCHAR(255) NOT NULL,
    status_blood                  VARCHAR(50)  NOT NULL,
    measured_urobilinogen         VARCHAR(255) NOT NULL,
    status_urobilinogen           VARCHAR(50)  NOT NULL,
    measured_nitrite              VARCHAR(255) NOT NULL,
    status_nitrite                VARCHAR(50)  NOT NULL,
    status_geral                  VARCHAR(50)  NOT NULL,
    corrective_action             TEXT,
    analyst                       VARCHAR(255),
    notes                         TEXT,
    created_at                    TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_uro_strip_qc_runs PRIMARY KEY (id),
    CONSTRAINT fk_uro_strip_runs_control FOREIGN KEY (control_set_id)
        REFERENCES uro_strip_control_sets (id),
    CONSTRAINT fk_uro_strip_runs_reagent FOREIGN KEY (reagent_lot_id)
        REFERENCES reagent_lots (id)
);

CREATE TABLE IF NOT EXISTS uro_sediment_qc_runs (
    id                      UUID         NOT NULL,
    data_medicao            DATE         NOT NULL,
    patient_code            VARCHAR(64)  NOT NULL,
    analyst1_id             UUID,
    analyst1_name           VARCHAR(255) NOT NULL,
    analyst2_id             UUID,
    analyst2_name           VARCHAR(255) NOT NULL,
    leukocytes_a1           DOUBLE PRECISION NOT NULL,
    leukocytes_a2           DOUBLE PRECISION NOT NULL,
    leukocytes_cv           DOUBLE PRECISION NOT NULL,
    status_leukocytes       VARCHAR(20)  NOT NULL,
    erythrocytes_a1         DOUBLE PRECISION NOT NULL,
    erythrocytes_a2         DOUBLE PRECISION NOT NULL,
    erythrocytes_cv         DOUBLE PRECISION NOT NULL,
    status_erythrocytes     VARCHAR(20)  NOT NULL,
    bacteria_a1             VARCHAR(50)  NOT NULL,
    bacteria_a2             VARCHAR(50)  NOT NULL,
    status_bacteria         VARCHAR(20)  NOT NULL,
    epithelial_cells_a1     VARCHAR(50)  NOT NULL,
    epithelial_cells_a2     VARCHAR(50)  NOT NULL,
    status_epithelial_cells VARCHAR(20)  NOT NULL,
    mucus_threads_a1        VARCHAR(50)  NOT NULL,
    mucus_threads_a2        VARCHAR(50)  NOT NULL,
    status_mucus_threads    VARCHAR(20)  NOT NULL,
    crystals_a1             VARCHAR(50)  NOT NULL,
    crystals_a2             VARCHAR(50)  NOT NULL,
    status_crystals         VARCHAR(20)  NOT NULL,
    others_a1               VARCHAR(50)  NOT NULL,
    others_a2               VARCHAR(50)  NOT NULL,
    status_others           VARCHAR(20)  NOT NULL,
    status_geral            VARCHAR(20)  NOT NULL,
    corrective_action       TEXT,
    notes                   TEXT,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_uro_sediment_qc_runs PRIMARY KEY (id),
    CONSTRAINT fk_uro_sediment_a1 FOREIGN KEY (analyst1_id)
        REFERENCES users (id),
    CONSTRAINT fk_uro_sediment_a2 FOREIGN KEY (analyst2_id)
        REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_uro_strip_control_sets_active
    ON uro_strip_control_sets (is_active);

CREATE INDEX IF NOT EXISTS idx_uro_strip_qc_runs_date
    ON uro_strip_qc_runs (data_medicao DESC);

CREATE INDEX IF NOT EXISTS idx_uro_strip_qc_runs_control
    ON uro_strip_qc_runs (control_set_id);

CREATE INDEX IF NOT EXISTS idx_uro_strip_qc_runs_reagent
    ON uro_strip_qc_runs (reagent_lot_id);

CREATE INDEX IF NOT EXISTS idx_uro_sediment_qc_runs_date
    ON uro_sediment_qc_runs (data_medicao DESC);

CREATE INDEX IF NOT EXISTS idx_uro_sediment_qc_runs_patient
    ON uro_sediment_qc_runs (patient_code);
