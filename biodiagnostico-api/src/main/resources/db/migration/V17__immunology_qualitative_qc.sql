-- CQ Imunologia qualitativo:
-- controles cadastrados por analito/fabricante/lote/validade e rodadas com
-- snapshot do esperado/observado para auditoria.

CREATE TABLE IF NOT EXISTS immunology_control_sets (
    id             UUID         NOT NULL,
    analito        VARCHAR(255) NOT NULL,
    manufacturer   VARCHAR(255) NOT NULL,
    lot_number     VARCHAR(255) NOT NULL,
    valid_until    DATE         NOT NULL,
    is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_immunology_control_sets PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS immunology_control_items (
    id                UUID         NOT NULL,
    control_set_id    UUID         NOT NULL,
    name              VARCHAR(255) NOT NULL,
    expected_result   VARCHAR(50)  NOT NULL,
    display_order     INTEGER      NOT NULL,
    CONSTRAINT pk_immunology_control_items PRIMARY KEY (id),
    CONSTRAINT fk_immunology_control_items_set FOREIGN KEY (control_set_id)
        REFERENCES immunology_control_sets (id)
);

CREATE TABLE IF NOT EXISTS immunology_qc_runs (
    id                    UUID         NOT NULL,
    control_set_id        UUID         NOT NULL,
    data_medicao          DATE         NOT NULL,
    analito_snapshot      VARCHAR(255) NOT NULL,
    manufacturer_snapshot VARCHAR(255) NOT NULL,
    lot_number_snapshot   VARCHAR(255) NOT NULL,
    valid_until_snapshot  DATE         NOT NULL,
    status                VARCHAR(50)  NOT NULL,
    analyst               VARCHAR(255),
    notes                 TEXT,
    created_at            TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_immunology_qc_runs PRIMARY KEY (id),
    CONSTRAINT fk_immunology_qc_runs_set FOREIGN KEY (control_set_id)
        REFERENCES immunology_control_sets (id)
);

CREATE TABLE IF NOT EXISTS immunology_qc_run_results (
    id                       UUID         NOT NULL,
    run_id                   UUID         NOT NULL,
    control_item_id          UUID,
    control_name_snapshot    VARCHAR(255) NOT NULL,
    expected_result_snapshot VARCHAR(50)  NOT NULL,
    observed_result          VARCHAR(50)  NOT NULL,
    status                   VARCHAR(50)  NOT NULL,
    display_order            INTEGER      NOT NULL,
    CONSTRAINT pk_immunology_qc_run_results PRIMARY KEY (id),
    CONSTRAINT fk_immunology_qc_run_results_run FOREIGN KEY (run_id)
        REFERENCES immunology_qc_runs (id),
    CONSTRAINT fk_immunology_qc_run_results_item FOREIGN KEY (control_item_id)
        REFERENCES immunology_control_items (id)
);

CREATE INDEX IF NOT EXISTS idx_immunology_control_sets_active_analito
    ON immunology_control_sets (is_active, analito);

CREATE INDEX IF NOT EXISTS idx_immunology_qc_runs_date
    ON immunology_qc_runs (data_medicao DESC);

CREATE INDEX IF NOT EXISTS idx_immunology_qc_runs_set
    ON immunology_qc_runs (control_set_id);
