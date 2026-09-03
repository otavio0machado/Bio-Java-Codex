-- ============================================================================
-- V26__align_user_permissions_table_schema.sql
-- Alinha o esquema da tabela user_permissions com a entidade JPA User.java.
-- Remove coluna legada 'permissions' (plural), remove check constraint restritiva
-- legada e define a chave primária correta (user_id, permission).
-- ============================================================================

-- 1. Remove a check constraint legada que limitava as permissões aos 5 tipos antigos
ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_permission_check;

-- 2. Remove a chave primária antiga baseada na coluna legada 'permissions'
ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_pkey;

-- 3. Caso existam registros com a coluna legada preenchida e a nova nula, sincroniza
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_permissions' AND column_name = 'permissions'
    ) THEN
        UPDATE user_permissions
        SET permission = permissions
        WHERE permission IS NULL AND permissions IS NOT NULL;
        
        -- Remove a coluna legada
        ALTER TABLE user_permissions DROP COLUMN permissions;
    END IF;
END $$;

-- 4. Garante que qualquer registro inconsistente seja limpo antes de setar NOT NULL
DELETE FROM user_permissions WHERE permission IS NULL;

-- 5. Deduplica registros redundantes caso existam antes de criar a chave primária
DELETE FROM user_permissions a USING user_permissions b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.permission = b.permission;

-- 6. Define a coluna 'permission' como NOT NULL
ALTER TABLE user_permissions ALTER COLUMN permission SET NOT NULL;

-- 7. Define a chave primária oficial (user_id, permission) de forma idempotente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_permissions_pkey'
    ) THEN
        ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (user_id, permission);
    END IF;
END $$;

