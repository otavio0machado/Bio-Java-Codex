-- Vinculo entre a rodada qualitativa de Imunologia e o lote de reagente usado.
-- Colunas nullable preservam historico antigo sem reagente vinculado.

ALTER TABLE immunology_qc_runs ADD COLUMN IF NOT EXISTS reagent_lot_id UUID;
ALTER TABLE immunology_qc_runs ADD COLUMN IF NOT EXISTS reagent_label_snapshot VARCHAR(255);
ALTER TABLE immunology_qc_runs ADD COLUMN IF NOT EXISTS reagent_manufacturer_snapshot VARCHAR(255);
ALTER TABLE immunology_qc_runs ADD COLUMN IF NOT EXISTS reagent_lot_number_snapshot VARCHAR(255);
ALTER TABLE immunology_qc_runs ADD COLUMN IF NOT EXISTS reagent_valid_until_snapshot DATE;
ALTER TABLE immunology_qc_runs ADD COLUMN IF NOT EXISTS reagent_status_snapshot VARCHAR(50);
ALTER TABLE immunology_qc_runs ADD COLUMN IF NOT EXISTS reagent_units_in_stock_snapshot INTEGER;
ALTER TABLE immunology_qc_runs ADD COLUMN IF NOT EXISTS reagent_units_in_use_snapshot INTEGER;
ALTER TABLE immunology_qc_runs ADD COLUMN IF NOT EXISTS reagent_storage_temp_snapshot VARCHAR(255);
ALTER TABLE immunology_qc_runs ADD COLUMN IF NOT EXISTS reagent_location_snapshot VARCHAR(128);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_immunology_qc_runs_reagent_lot'
    ) THEN
        ALTER TABLE immunology_qc_runs
            ADD CONSTRAINT fk_immunology_qc_runs_reagent_lot FOREIGN KEY (reagent_lot_id)
                REFERENCES reagent_lots (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_immunology_qc_runs_reagent_lot
    ON immunology_qc_runs (reagent_lot_id);
