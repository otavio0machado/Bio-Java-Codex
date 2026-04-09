# 01 — Schema SQL Novo (PostgreSQL / Supabase)

## Instruções

1. Crie um **novo projeto** no Supabase (não reutilize o antigo)
2. Vá em **SQL Editor** no painel do Supabase
3. Cole e execute o SQL abaixo em ordem

## Schema Completo

```sql
-- ============================================================
-- BIODIAGNÓSTICO 4.0 — SCHEMA POSTGRESQL
-- Banco novo, limpo, normalizado
-- ============================================================

-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA: users (autenticação própria, não usa Supabase Auth)
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'ANALYST',  -- ADMIN, ANALYST, VIEWER
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- TABELA: qc_exams (cadastro de exames)
-- ============================================================
CREATE TABLE qc_exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    area VARCHAR(100) NOT NULL DEFAULT 'bioquimica',  -- bioquimica, hematologia, imunologia, etc
    unit VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qc_exams_area ON qc_exams(area);

-- ============================================================
-- TABELA: qc_reference_values (valores alvo por exame/lote/nível)
-- ============================================================
CREATE TABLE qc_reference_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES qc_exams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    level VARCHAR(50) NOT NULL DEFAULT 'Normal',  -- Normal, Patológico, Alto, Baixo
    lot_number VARCHAR(100),
    manufacturer VARCHAR(255),
    target_value DOUBLE PRECISION NOT NULL DEFAULT 0,
    target_sd DOUBLE PRECISION NOT NULL DEFAULT 0,
    cv_max_threshold DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    valid_from DATE,
    valid_until DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qc_ref_exam ON qc_reference_values(exam_id);
CREATE INDEX idx_qc_ref_active ON qc_reference_values(is_active);

-- ============================================================
-- TABELA: qc_records (registros de controle de qualidade)
-- ============================================================
CREATE TABLE qc_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_id UUID REFERENCES qc_reference_values(id) ON DELETE SET NULL,
    exam_name VARCHAR(255) NOT NULL,
    area VARCHAR(100) NOT NULL DEFAULT 'bioquimica',
    date DATE NOT NULL,
    level VARCHAR(50),
    lot_number VARCHAR(100),
    value DOUBLE PRECISION NOT NULL,
    target_value DOUBLE PRECISION NOT NULL DEFAULT 0,
    target_sd DOUBLE PRECISION NOT NULL DEFAULT 0,
    cv DOUBLE PRECISION DEFAULT 0,
    cv_limit DOUBLE PRECISION DEFAULT 10.0,
    z_score DOUBLE PRECISION DEFAULT 0,
    equipment VARCHAR(255),
    analyst VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'APROVADO',  -- APROVADO, REPROVADO, ALERTA
    needs_calibration BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qc_records_exam ON qc_records(exam_name);
CREATE INDEX idx_qc_records_date ON qc_records(date);
CREATE INDEX idx_qc_records_area ON qc_records(area);
CREATE INDEX idx_qc_records_status ON qc_records(status);

-- ============================================================
-- TABELA: westgard_violations (violações de regras por registro)
-- ============================================================
CREATE TABLE westgard_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qc_record_id UUID NOT NULL REFERENCES qc_records(id) ON DELETE CASCADE,
    rule VARCHAR(20) NOT NULL,           -- 1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10x
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,       -- WARNING, REJECTION
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_violations_record ON westgard_violations(qc_record_id);

-- ============================================================
-- TABELA: post_calibration_records (medições pós-calibração)
-- ============================================================
CREATE TABLE post_calibration_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    qc_record_id UUID NOT NULL REFERENCES qc_records(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    exam_name VARCHAR(255) NOT NULL,
    original_value DOUBLE PRECISION NOT NULL,
    original_cv DOUBLE PRECISION DEFAULT 0,
    post_calibration_value DOUBLE PRECISION NOT NULL,
    post_calibration_cv DOUBLE PRECISION DEFAULT 0,
    target_value DOUBLE PRECISION DEFAULT 0,
    analyst VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: reagent_lots (lotes de reagentes)
-- ============================================================
CREATE TABLE reagent_lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,              -- etiqueta/tag de agrupamento
    lot_number VARCHAR(100) NOT NULL,
    manufacturer VARCHAR(255),
    category VARCHAR(100),                   -- Bioquímica, Hematologia, etc
    expiry_date DATE,
    quantity_value DOUBLE PRECISION DEFAULT 0,
    stock_unit VARCHAR(50) DEFAULT 'unidades',
    current_stock DOUBLE PRECISION DEFAULT 0,
    estimated_consumption DOUBLE PRECISION DEFAULT 0,
    storage_temp VARCHAR(50),
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ativo',  -- ativo, em_uso, inativo, vencido
    alert_threshold_days INTEGER DEFAULT 7,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reagent_lots_status ON reagent_lots(status);
CREATE INDEX idx_reagent_lots_category ON reagent_lots(category);

-- ============================================================
-- TABELA: stock_movements (movimentações de estoque)
-- ============================================================
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reagent_lot_id UUID NOT NULL REFERENCES reagent_lots(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,          -- ENTRADA, SAIDA, AJUSTE
    quantity DOUBLE PRECISION NOT NULL,
    responsible VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_lot ON stock_movements(reagent_lot_id);

-- ============================================================
-- TABELA: maintenance_records (manutenção de equipamentos)
-- ============================================================
CREATE TABLE maintenance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    equipment VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,         -- PREVENTIVA, CORRETIVA, CALIBRACAO
    date DATE NOT NULL,
    next_date DATE,
    technician VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_maintenance_equipment ON maintenance_records(equipment);
CREATE INDEX idx_maintenance_date ON maintenance_records(date);

-- ============================================================
-- TABELA: hematology_qc_parameters (parâmetros CQ hematologia)
-- ============================================================
CREATE TABLE hematology_qc_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analito VARCHAR(100) NOT NULL,          -- Hemácias, Hematócrito, etc
    equipamento VARCHAR(255),
    lote_controle VARCHAR(100),
    nivel_controle VARCHAR(50),
    modo VARCHAR(20) NOT NULL DEFAULT 'INTERVALO',  -- INTERVALO, PERCENTUAL
    alvo_valor DOUBLE PRECISION DEFAULT 0,
    min_valor DOUBLE PRECISION DEFAULT 0,
    max_valor DOUBLE PRECISION DEFAULT 0,
    tolerancia_percentual DOUBLE PRECISION DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: hematology_qc_measurements (medições CQ hematologia)
-- ============================================================
CREATE TABLE hematology_qc_measurements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parameter_id UUID NOT NULL REFERENCES hematology_qc_parameters(id) ON DELETE CASCADE,
    data_medicao DATE NOT NULL,
    analito VARCHAR(100) NOT NULL,
    valor_medido DOUBLE PRECISION NOT NULL,
    modo_usado VARCHAR(20),
    min_aplicado DOUBLE PRECISION DEFAULT 0,
    max_aplicado DOUBLE PRECISION DEFAULT 0,
    status VARCHAR(20) NOT NULL,        -- APROVADO, REPROVADO
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: hematology_bio_records (Bio x Controle Interno)
-- ============================================================
CREATE TABLE hematology_bio_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_bio DATE NOT NULL,
    data_pad DATE,
    registro_bio VARCHAR(100),
    registro_pad VARCHAR(100),
    modo_ci VARCHAR(20) DEFAULT 'bio',   -- bio, intervalo, porcentagem

    -- Valores Bio
    bio_hemacias DOUBLE PRECISION DEFAULT 0,
    bio_hematocrito DOUBLE PRECISION DEFAULT 0,
    bio_hemoglobina DOUBLE PRECISION DEFAULT 0,
    bio_leucocitos DOUBLE PRECISION DEFAULT 0,
    bio_plaquetas DOUBLE PRECISION DEFAULT 0,
    bio_rdw DOUBLE PRECISION DEFAULT 0,
    bio_vpm DOUBLE PRECISION DEFAULT 0,

    -- Valores Padrão
    pad_hemacias DOUBLE PRECISION DEFAULT 0,
    pad_hematocrito DOUBLE PRECISION DEFAULT 0,
    pad_hemoglobina DOUBLE PRECISION DEFAULT 0,
    pad_leucocitos DOUBLE PRECISION DEFAULT 0,
    pad_plaquetas DOUBLE PRECISION DEFAULT 0,
    pad_rdw DOUBLE PRECISION DEFAULT 0,
    pad_vpm DOUBLE PRECISION DEFAULT 0,

    -- Controle Interno - Min/Max
    ci_min_hemacias DOUBLE PRECISION DEFAULT 0,
    ci_max_hemacias DOUBLE PRECISION DEFAULT 0,
    ci_min_hematocrito DOUBLE PRECISION DEFAULT 0,
    ci_max_hematocrito DOUBLE PRECISION DEFAULT 0,
    ci_min_hemoglobina DOUBLE PRECISION DEFAULT 0,
    ci_max_hemoglobina DOUBLE PRECISION DEFAULT 0,
    ci_min_leucocitos DOUBLE PRECISION DEFAULT 0,
    ci_max_leucocitos DOUBLE PRECISION DEFAULT 0,
    ci_min_plaquetas DOUBLE PRECISION DEFAULT 0,
    ci_max_plaquetas DOUBLE PRECISION DEFAULT 0,
    ci_min_rdw DOUBLE PRECISION DEFAULT 0,
    ci_max_rdw DOUBLE PRECISION DEFAULT 0,
    ci_min_vpm DOUBLE PRECISION DEFAULT 0,
    ci_max_vpm DOUBLE PRECISION DEFAULT 0,

    -- Controle Interno - Percentuais
    ci_pct_hemacias DOUBLE PRECISION DEFAULT 0,
    ci_pct_hematocrito DOUBLE PRECISION DEFAULT 0,
    ci_pct_hemoglobina DOUBLE PRECISION DEFAULT 0,
    ci_pct_leucocitos DOUBLE PRECISION DEFAULT 0,
    ci_pct_plaquetas DOUBLE PRECISION DEFAULT 0,
    ci_pct_rdw DOUBLE PRECISION DEFAULT 0,
    ci_pct_vpm DOUBLE PRECISION DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABELA: imunologia_records (CQ imunologia)
-- ============================================================
CREATE TABLE imunologia_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    controle VARCHAR(255),
    fabricante VARCHAR(255),
    lote VARCHAR(100),
    data DATE NOT NULL,
    resultado VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VIEW: levey_jennings_data (dados prontos para gráfico)
-- ============================================================
CREATE OR REPLACE VIEW levey_jennings_data AS
SELECT
    qr.id,
    qr.date,
    qr.exam_name,
    qr.level,
    qr.value,
    qr.target_value AS target,
    qr.target_sd AS sd,
    qr.cv,
    qr.status,
    qr.z_score,
    qr.target_value + (2 * qr.target_sd) AS upper_2sd,
    qr.target_value - (2 * qr.target_sd) AS lower_2sd,
    qr.target_value + (3 * qr.target_sd) AS upper_3sd,
    qr.target_value - (3 * qr.target_sd) AS lower_3sd
FROM qc_records qr
ORDER BY qr.date DESC;

-- ============================================================
-- TABELA: audit_log (auditoria de alterações)
-- ============================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,         -- CREATE, UPDATE, DELETE
    entity_type VARCHAR(100) NOT NULL,   -- qc_records, reagent_lots, etc
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

-- ============================================================
-- FUNÇÃO: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de auto-update
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_qc_exams_updated_at BEFORE UPDATE ON qc_exams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_qc_ref_updated_at BEFORE UPDATE ON qc_reference_values FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_qc_records_updated_at BEFORE UPDATE ON qc_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_reagent_lots_updated_at BEFORE UPDATE ON reagent_lots FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_hemato_params_updated_at BEFORE UPDATE ON hematology_qc_parameters FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED: Usuário admin inicial
-- ============================================================
-- A senha será hasheada pelo Spring Boot na primeira execução.
-- Este insert é apenas referência. Use o endpoint /api/auth/register.
-- INSERT INTO users (email, password_hash, name, role)
-- VALUES ('admin@biodiagnostico.com', '<bcrypt_hash>', 'Admin', 'ADMIN');
```

## Novidades em relação ao banco antigo

1. **Tabela `users`** — Autenticação própria (não depende mais do Supabase Auth)
2. **Tabela `westgard_violations`** — Normalizada (antes era JSON dentro de qc_records)
3. **Tabela `qc_exams`** — Cadastro separado de exames (antes estava solto)
4. **Tabela `audit_log`** — Rastreabilidade completa de quem fez o quê
5. **View `levey_jennings_data`** — Dados prontos para o gráfico com limites 2SD/3SD calculados
6. **Triggers `updated_at`** — Atualização automática de timestamps
7. **Índices otimizados** — Busca rápida por exame, data, status e área

## Depois de executar

Verifique que todas as tabelas foram criadas:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Deve retornar 12 tabelas + 1 view.
