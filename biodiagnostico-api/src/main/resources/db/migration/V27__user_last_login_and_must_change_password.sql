-- ============================================================================
-- V27__user_last_login_and_must_change_password.sql
-- Adiciona rastreamento de último login e flag para forçar troca de senha.
-- ============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
