-- ============================================================================
-- V29__align_uroanalise_types.sql
-- Alinha tipos de uroanalise para DOUBLE PRECISION e VARCHAR compativeis com o
-- padrao do schema V1 (QcRecord, AreaQcMeasurement) e entidades JPA Hibernate.
-- ============================================================================

ALTER TABLE uro_strip_control_sets
    ALTER COLUMN expected_ph_min TYPE DOUBLE PRECISION,
    ALTER COLUMN expected_ph_max TYPE DOUBLE PRECISION,
    ALTER COLUMN expected_density_min TYPE DOUBLE PRECISION,
    ALTER COLUMN expected_density_max TYPE DOUBLE PRECISION,
    ALTER COLUMN expected_proteins TYPE VARCHAR(255),
    ALTER COLUMN expected_glucose TYPE VARCHAR(255),
    ALTER COLUMN expected_ketones TYPE VARCHAR(255),
    ALTER COLUMN expected_blood TYPE VARCHAR(255),
    ALTER COLUMN expected_urobilinogen TYPE VARCHAR(255),
    ALTER COLUMN expected_nitrite TYPE VARCHAR(255),
    ALTER COLUMN expected_bilirubin TYPE VARCHAR(255),
    ALTER COLUMN expected_leukocytes TYPE VARCHAR(255);

ALTER TABLE uro_strip_qc_runs
    ALTER COLUMN measured_ph TYPE DOUBLE PRECISION,
    ALTER COLUMN measured_density TYPE DOUBLE PRECISION,
    ALTER COLUMN status_ph TYPE VARCHAR(50),
    ALTER COLUMN status_density TYPE VARCHAR(50),
    ALTER COLUMN measured_proteins TYPE VARCHAR(255),
    ALTER COLUMN status_proteins TYPE VARCHAR(50),
    ALTER COLUMN measured_glucose TYPE VARCHAR(255),
    ALTER COLUMN status_glucose TYPE VARCHAR(50),
    ALTER COLUMN measured_ketones TYPE VARCHAR(255),
    ALTER COLUMN status_ketones TYPE VARCHAR(50),
    ALTER COLUMN measured_blood TYPE VARCHAR(255),
    ALTER COLUMN status_blood TYPE VARCHAR(50),
    ALTER COLUMN measured_urobilinogen TYPE VARCHAR(255),
    ALTER COLUMN status_urobilinogen TYPE VARCHAR(50),
    ALTER COLUMN measured_nitrite TYPE VARCHAR(255),
    ALTER COLUMN status_nitrite TYPE VARCHAR(50),
    ALTER COLUMN status_geral TYPE VARCHAR(50);

ALTER TABLE uro_sediment_qc_runs
    ALTER COLUMN leukocytes_a1 TYPE DOUBLE PRECISION,
    ALTER COLUMN leukocytes_a2 TYPE DOUBLE PRECISION,
    ALTER COLUMN leukocytes_cv TYPE DOUBLE PRECISION,
    ALTER COLUMN erythrocytes_a1 TYPE DOUBLE PRECISION,
    ALTER COLUMN erythrocytes_a2 TYPE DOUBLE PRECISION,
    ALTER COLUMN erythrocytes_cv TYPE DOUBLE PRECISION;
