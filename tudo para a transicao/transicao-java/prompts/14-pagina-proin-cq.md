# Prompt 14 — Página ProIn (Controle de Qualidade)

Cole este prompt inteiro no Claude:

---

Crie a página principal de Controle de Qualidade (ProIn) do Biodiagnóstico 4.0 em React + TypeScript. Esta é a página mais complexa do sistema.

## Estrutura da página:

### Barra de Áreas (topo)
Botões segmentados para selecionar a área do laboratório:
- **Bioquímica** (padrão)
- Hematologia
- Imunologia
- Parasitologia
- Microbiologia
- Uroanálise

Estilo: botões pill com hover, o ativo tem bg-green-800 text-white, os demais bg-neutral-100.

### Sub-tabs (abaixo da barra de áreas, SÓ para Bioquímica)
Tabs horizontais:
- Dashboard CQ
- Registro CQ
- Referências
- Reagentes
- Manutenção
- Relatórios
- Importar

Estilo: text com indicador verde embaixo quando ativo.

### Conteúdo de cada aba:

#### 1. Dashboard CQ (DashboardTab)
- Grid de KPIs (CQ Hoje, CQ Mês, Taxa Aprovação, Alertas)
- Botão "Atualizar dados"
- Usa mesmo padrão do dashboard principal mas filtrado pela área

#### 2. Registro CQ (RegistroTab)
Formulário de lançamento:
- Select: Exame (dropdown populado da API /api/qc/exams)
- Select: Nível (Normal, Patológico, Alto, Baixo)
- Input: Data (date picker, default hoje)
- Input: Valor medido (number)
- Input: Valor alvo (auto-preenchido se referência existe)
- Input: Desvio Padrão alvo (auto-preenchido)
- Input: CV Limite % (default 10)
- Input: Equipamento
- Input: Analista
- Input: Lote
- Botão: "Salvar Registro" (primary)

Ao salvar: POST /api/qc/records → mostrar resultado Westgard:
- Se APROVADO: toast success
- Se ALERTA: toast warning com violations
- Se REPROVADO: toast error com violations + modal sugerindo pós-calibração

#### 3. Referências (ReferenciasTab)
- Cards de referências ativas
- Cada card: nome do exame, nível, alvo ± SD, CV max, validade
- StatusBadge: Ativa/Inativa
- Botões: Editar, Excluir
- Botão "Nova Referência" → abre modal com formulário
- Modal com: examId (select), name, level, lotNumber, manufacturer, targetValue, targetSd, cvMaxThreshold, validFrom, validUntil, notes

#### 4. Reagentes (ReagentesTab)
- Filtros por categoria e status
- Cards/tabela de lotes
- Cada lote: nome, nº lote, fabricante, validade, estoque atual, status
- Indicador visual de estoque (barra de progresso)
- Dias para vencimento com cor: verde (>30), laranja (7-30), vermelho (<7)
- Botão "Novo Lote" → modal de criação
- Expandir lote → ver movimentações de estoque
- Botão "Nova Movimentação" (Entrada/Saída/Ajuste)

#### 5. Manutenção (ManutencaoTab)
- Tabela/cards de registros de manutenção
- Campos: equipamento, tipo (Preventiva/Corretiva/Calibração), data, próxima data, técnico, notas
- Badge visual para manutenções vencidas (nextDate < hoje)
- Botão "Nova Manutenção" → modal

#### 6. Relatórios (RelatoriosTab)
- Seletor de período: Mês atual, Mês específico, Ano
- Botão "Gerar PDF" → GET /api/reports/qc-pdf → baixar blob como PDF
- Botão "Gerar Gráfico Levey-Jennings" → abre modal com seletor de exame/nível

#### 7. Importar (ImportarTab)
- Área de drag-and-drop para arquivo Excel (.xlsx, .xls)
- Preview dos dados antes de importar
- Botão "Importar" → POST /api/qc/records/batch
- Progress bar durante importação

## State management:
```typescript
// Estado local da página
const [currentArea, setCurrentArea] = useState('bioquimica');
const [currentTab, setCurrentTab] = useState('dashboard');
```

## Hooks necessários (cada aba usa seus hooks):
- useQcRecords(area, filters) → GET /api/qc/records
- useCreateQcRecord() → POST /api/qc/records
- useQcExams(area) → GET /api/qc/exams
- useQcReferences() → GET /api/qc/references
- useReagentLots(category, status) → GET /api/reagents
- useMaintenanceRecords() → GET /api/maintenance

## Arquivos a criar:
- src/pages/ProinPage.tsx (página principal com área + tabs)
- src/components/proin/DashboardTab.tsx
- src/components/proin/RegistroTab.tsx
- src/components/proin/ReferenciasTab.tsx
- src/components/proin/ReagentesTab.tsx
- src/components/proin/ManutencaoTab.tsx
- src/components/proin/RelatoriosTab.tsx
- src/components/proin/ImportarTab.tsx
- src/components/proin/PostCalibrationModal.tsx
- src/hooks/useQcRecords.ts
- src/hooks/useReagents.ts
- src/hooks/useMaintenance.ts
- src/services/qcService.ts
- src/services/reagentService.ts
- src/services/maintenanceService.ts

## Regras:
- Cada aba é um componente separado em src/components/proin/
- Use React Query para cache e sincronização
- Ao mudar de área, resetar tab para 'dashboard'
- Loading states com Skeleton em cada aba
- Modais para criação/edição de todos os recursos
- Validação de formulário antes de submeter
- Toast de sucesso/erro após cada operação
- Gere TODOS os arquivos completos — esta é a página mais importante do sistema
