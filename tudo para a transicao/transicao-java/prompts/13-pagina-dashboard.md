# Prompt 13 — Página de Dashboard

Cole este prompt inteiro no Claude:

---

Crie a página de Dashboard do Biodiagnóstico 4.0 em React + TypeScript. O visual deve ser IDÊNTICO ao sistema atual.

## Layout atual (replicar exatamente):

### Topo: Hero card de aprovação
- Card grande (full width) com gradiente verde
- Texto: "Taxa de Aprovação"
- Valor: XX% (text-5xl, bold, branco)
- Indicador de tendência (↑ ou ↓ comparado ao mês anterior)
- Período: "Mês atual"

### Grid de KPIs (4 colunas, responsivo)
1. **CQ Hoje**: ícone azul, total de registros do dia
2. **CQ Mês**: ícone verde, total do mês
3. **Taxa de Aprovação**: ícone esmeralda, percentual
4. **Alertas**: ícone vermelho/laranja, contagem de alertas ativos

### Painel de Alertas
- Card com header "Alertas Ativos"
- Lista de alertas agrupados:
  - Reagentes vencendo (ícone laranja, "X lotes vencem nos próximos 30 dias")
  - Manutenções pendentes (ícone vermelho, "X manutenções vencidas")
  - Violações Westgard (ícone vermelho, "X registros com violações este mês")
- Se não há alertas: ícone check verde + "Tudo em ordem!"

### Tabela de Registros Recentes
- Card com header "Registros Recentes" + link "Ver todos →"
- Tabela com colunas: Data, Exame, Nível, Valor, CV%, Status
- Status como StatusBadge (APROVADO/REPROVADO/ALERTA)
- Últimos 10 registros
- Loading: skeleton table

### Cards de Acesso Rápido (3 colunas)
1. "Registrar CQ" → navega para /qc
2. "Reagentes" → navega para /qc (aba reagentes)
3. "Relatórios" → navega para /qc (aba relatórios)

## Dados:
Usar React Query hooks:
- `useDashboard()` → GET /api/dashboard/kpis
- `useDashboardAlerts()` → GET /api/dashboard/alerts
- `useRecentRecords()` → GET /api/dashboard/recent-records?limit=10

## Hooks necessários (src/hooks/useDashboard.ts):
```typescript
export function useDashboardKpis() {
  return useQuery({ queryKey: ['dashboard', 'kpis'], queryFn: () => dashboardService.getKpis() });
}
export function useDashboardAlerts() {
  return useQuery({ queryKey: ['dashboard', 'alerts'], queryFn: () => dashboardService.getAlerts() });
}
export function useRecentRecords(limit = 10) {
  return useQuery({ queryKey: ['dashboard', 'recent', limit], queryFn: () => dashboardService.getRecentRecords(limit) });
}
```

## Service (src/services/dashboardService.ts):
```typescript
export const dashboardService = {
  getKpis: () => api.get<DashboardKpi>('/dashboard/kpis').then(r => r.data),
  getAlerts: () => api.get<DashboardAlerts>('/dashboard/alerts').then(r => r.data),
  getRecentRecords: (limit: number) => api.get<QcRecord[]>(`/dashboard/recent-records?limit=${limit}`).then(r => r.data),
};
```

## Arquivo: src/pages/DashboardPage.tsx

## Componentes a usar:
- StatCard, Card, StatusBadge, Skeleton, EmptyState do design system
- Ícones: Activity, Beaker, TrendingUp, AlertTriangle, ChevronRight, CheckCircle, Clock, Package do lucide-react

## Responsivo:
- Desktop: grid 4 colunas para KPIs, 2 colunas para alertas+tabela
- Tablet: 2 colunas para KPIs
- Mobile: 1 coluna empilhada

## Regras:
- Loading state com Skeleton enquanto dados carregam
- Atualizar automaticamente a cada 60 segundos (React Query refetchInterval)
- Animar entrada dos cards com animate-fadeIn
- Gere o arquivo COMPLETO + hook + service
