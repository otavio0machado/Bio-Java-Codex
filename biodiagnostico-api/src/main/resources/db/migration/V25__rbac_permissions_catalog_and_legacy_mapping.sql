-- ============================================================================
-- V25__rbac_permissions_catalog_and_legacy_mapping.sql
-- Mapeamento seguro e idempotente do catálogo de permissões RBAC para o novo padrão.
-- Mapeia permissões legadas para os novos códigos e garante que usuários
-- existentes recebam as permissões de visualização associadas (WRITE => VIEW).
-- ============================================================================

-- 1. Cria tabela temporária para transição idempotente
CREATE TABLE IF NOT EXISTS temp_user_permissions_migration (
    user_id UUID NOT NULL,
    permission VARCHAR(255) NOT NULL
);

TRUNCATE TABLE temp_user_permissions_migration;

-- 2. Copia permissões existentes mapeando as legadas
-- QC_WRITE -> QC_WRITE + QC_VIEW + DASHBOARD_VIEW
INSERT INTO temp_user_permissions_migration (user_id, permission)
SELECT user_id, 'QC_WRITE' FROM user_permissions WHERE permission = 'QC_WRITE';

INSERT INTO temp_user_permissions_migration (user_id, permission)
SELECT user_id, 'QC_AREAS_WRITE' FROM user_permissions WHERE permission = 'QC_WRITE';

INSERT INTO temp_user_permissions_migration (user_id, permission)
SELECT user_id, 'QC_VIEW' FROM user_permissions WHERE permission IN ('QC_WRITE', 'IMPORT');

-- REAGENT_WRITE -> REAGENTS_WRITE + REAGENTS_VIEW + DASHBOARD_VIEW
INSERT INTO temp_user_permissions_migration (user_id, permission)
SELECT user_id, 'REAGENTS_WRITE' FROM user_permissions WHERE permission = 'REAGENT_WRITE';

INSERT INTO temp_user_permissions_migration (user_id, permission)
SELECT user_id, 'REAGENTS_VIEW' FROM user_permissions WHERE permission = 'REAGENT_WRITE';

-- MAINTENANCE_WRITE -> MAINTENANCE_WRITE + MAINTENANCE_VIEW + DASHBOARD_VIEW
INSERT INTO temp_user_permissions_migration (user_id, permission)
SELECT user_id, 'MAINTENANCE_WRITE' FROM user_permissions WHERE permission = 'MAINTENANCE_WRITE';

INSERT INTO temp_user_permissions_migration (user_id, permission)
SELECT user_id, 'MAINTENANCE_VIEW' FROM user_permissions WHERE permission = 'MAINTENANCE_WRITE';

-- TEMPERATURE_WRITE -> TEMPERATURE_WRITE + TEMPERATURE_VIEW + DASHBOARD_VIEW
INSERT INTO temp_user_permissions_migration (user_id, permission)
SELECT user_id, 'TEMPERATURE_WRITE' FROM user_permissions WHERE permission = 'TEMPERATURE_WRITE';

INSERT INTO temp_user_permissions_migration (user_id, permission)
SELECT user_id, 'TEMPERATURE_VIEW' FROM user_permissions WHERE permission = 'TEMPERATURE_WRITE';

-- DOWNLOAD -> REPORTS_DOWNLOAD + REPORTS_VIEW + DASHBOARD_VIEW
INSERT INTO temp_user_permissions_migration (user_id, permission)
SELECT user_id, 'REPORTS_DOWNLOAD' FROM user_permissions WHERE permission = 'DOWNLOAD';

INSERT INTO temp_user_permissions_migration (user_id, permission)
SELECT user_id, 'REPORTS_VIEW' FROM user_permissions WHERE permission = 'DOWNLOAD';

-- IMPORT -> QC_IMPORT + QC_VIEW + DASHBOARD_VIEW
INSERT INTO temp_user_permissions_migration (user_id, permission)
SELECT user_id, 'QC_IMPORT' FROM user_permissions WHERE permission = 'IMPORT';

-- DASHBOARD_VIEW para todos que tinham qualquer permissão ativa
INSERT INTO temp_user_permissions_migration (user_id, permission)
SELECT DISTINCT user_id, 'DASHBOARD_VIEW' FROM user_permissions;

-- Preserva quaisquer permissões que já estejam no novo padrão
INSERT INTO temp_user_permissions_migration (user_id, permission)
SELECT user_id, permission FROM user_permissions
WHERE permission IN (
    'DASHBOARD_VIEW', 'QC_VIEW', 'QC_WRITE', 'QC_AREAS_WRITE', 'QC_IMPORT', 'QC_EXPORT',
    'REAGENTS_VIEW', 'REAGENTS_WRITE', 'REAGENTS_DELETE',
    'MAINTENANCE_VIEW', 'MAINTENANCE_WRITE',
    'TEMPERATURE_VIEW', 'TEMPERATURE_WRITE',
    'REPORTS_VIEW', 'REPORTS_GENERATE', 'REPORTS_DOWNLOAD'
);

-- 3. Substitui os registros na tabela oficial de forma idempotente sem duplicatas
DELETE FROM user_permissions;

INSERT INTO user_permissions (user_id, permission)
SELECT DISTINCT user_id, permission FROM temp_user_permissions_migration;

DROP TABLE temp_user_permissions_migration;

-- 4. Garante que usuários não-FUNCIONARIO (ADMIN, VIGILANCIA, VISUALIZADOR) não tenham permissões fantasmas
DELETE FROM user_permissions
WHERE user_id IN (
    SELECT id FROM users WHERE role <> 'FUNCIONARIO'
);
