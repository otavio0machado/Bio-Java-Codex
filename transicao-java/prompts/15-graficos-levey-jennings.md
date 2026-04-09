# Prompt 15 — Gráficos de Levey-Jennings

Cole este prompt inteiro no Claude:

---

Crie o componente de gráfico de Levey-Jennings para o Biodiagnóstico 4.0 usando React + TypeScript + Recharts. Este é o gráfico mais importante do sistema de controle de qualidade.

## O que é um gráfico de Levey-Jennings:
Gráfico de controle que mostra valores de CQ ao longo do tempo, com linhas de referência para a média e os limites de ±1SD, ±2SD e ±3SD. Permite visualizar tendências e erros sistemáticos.

## Dados da API:
```
GET /api/qc/levey-jennings?examName=Glicose&level=Normal&area=bioquimica
```
Retorna:
```typescript
interface LeveyJenningsPoint {
  date: string;          // "2026-04-01"
  value: number;         // valor medido
  target: number;        // valor alvo (média)
  sd: number;            // desvio padrão
  cv: number;
  status: string;        // APROVADO, REPROVADO, ALERTA
  zScore: number;
  upper2sd: number;      // target + 2*sd
  lower2sd: number;      // target - 2*sd
  upper3sd: number;      // target + 3*sd
  lower3sd: number;      // target - 3*sd
}
```

## Componente: src/components/charts/LeveyJenningsChart.tsx

```tsx
interface LeveyJenningsChartProps {
  examName: string;
  level: string;
  area: string;
}
```

### Elementos do gráfico:
1. **Linha principal (azul)**: conecta os valores medidos ao longo do tempo
2. **Pontos coloridos**: cada medição como dot
   - Verde: APROVADO
   - Laranja: ALERTA
   - Vermelho: REPROVADO
3. **Linha média (verde tracejada)**: linha horizontal no target value
4. **Linhas ±2SD (amarelo tracejado)**: limites de alerta
5. **Linhas ±3SD (vermelho tracejado)**: limites de rejeição
6. **Áreas sombreadas**:
   - Verde claro: entre -1SD e +1SD
   - Amarelo claro: entre ±1SD e ±2SD
   - Vermelho claro: entre ±2SD e ±3SD

### Interatividade:
- Tooltip ao hover: mostra data, valor, alvo, z-score, status, violações
- Zoom: permitir scroll horizontal se muitos pontos
- Responsivo: adaptar ao container

### Controles acima do gráfico:
- Select: escolher exame
- Select: escolher nível (Normal, Patológico)
- Select: período (30 dias, 60 dias, 90 dias)
- Botão: atualizar

### Recharts components a usar:
```tsx
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Dot
} from 'recharts';
```

### Lógica de renderização:
```tsx
<ResponsiveContainer width="100%" height={400}>
  <ComposedChart data={data}>
    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />

    {/* Áreas sombreadas (de fora para dentro) */}
    <Area dataKey="upper3sd" fill="#fee2e2" stroke="none" /> {/* vermelho claro acima */}
    <Area dataKey="upper2sd" fill="#fef3c7" stroke="none" /> {/* amarelo claro */}
    <Area dataKey="upper1sd" fill="#dcfce7" stroke="none" /> {/* verde claro */}

    {/* Linhas de referência */}
    <ReferenceLine y={target} stroke="#16a34a" strokeDasharray="5 5" label="Média" />
    <ReferenceLine y={upper2sd} stroke="#eab308" strokeDasharray="5 5" label="+2SD" />
    <ReferenceLine y={lower2sd} stroke="#eab308" strokeDasharray="5 5" label="-2SD" />
    <ReferenceLine y={upper3sd} stroke="#dc2626" strokeDasharray="5 5" label="+3SD" />
    <ReferenceLine y={lower3sd} stroke="#dc2626" strokeDasharray="5 5" label="-3SD" />

    {/* Linha de valores */}
    <Line
      type="monotone"
      dataKey="value"
      stroke="#2563eb"
      strokeWidth={2}
      dot={<CustomDot />}  {/* cor baseada no status */}
    />

    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
    <YAxis domain={['auto', 'auto']} />
    <Tooltip content={<CustomTooltip />} />
  </ComposedChart>
</ResponsiveContainer>
```

### CustomDot: renderizar ponto com cor do status
### CustomTooltip: card com data, valor, alvo, z-score, status, violations

## Também criar:

### Modal LeveyJenningsModal.tsx
Modal que abre sobre a página ProIn para ver o gráfico em tela cheia.
- Seletores de exame, nível, período no topo
- Gráfico ocupando todo o espaço
- Botão fechar

### Hook: useLeveyJennings(examName, level, area)
```typescript
export function useLeveyJennings(examName: string, level: string, area: string) {
  return useQuery({
    queryKey: ['levey-jennings', examName, level, area],
    queryFn: () => qcService.getLeveyJenningsData(examName, level, area),
    enabled: !!examName && !!level,
  });
}
```

## Regras:
- O gráfico precisa ser bonito e profissional — é o que os clientes mais veem
- Cores consistentes com o sistema de design
- Responsivo
- Loading state com skeleton enquanto dados carregam
- Empty state se não há dados para o exame/nível selecionado
- Gere TODOS os arquivos completos
