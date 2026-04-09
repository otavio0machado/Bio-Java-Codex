# 03 — Frontend React + TypeScript

## Criar o Projeto

```bash
npm create vite@latest biodiagnostico-web -- --template react-ts
cd biodiagnostico-web
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install axios react-router-dom recharts lucide-react
npm install @tanstack/react-query
```

## Estrutura de Pastas

```
src/
├── assets/                  # Imagens, logo
├── components/
│   ├── ui/                  # Design system base
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Modal.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── StatCard.tsx
│   │   ├── Toast.tsx
│   │   ├── Skeleton.tsx
│   │   ├── EmptyState.tsx
│   │   └── index.ts
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── PrivateRoute.tsx
│   │   └── AppLayout.tsx
│   ├── charts/
│   │   └── LeveyJenningsChart.tsx
│   └── proin/               # Componentes específicos do CQ
│       ├── DashboardTab.tsx
│       ├── RegistroTab.tsx
│       ├── ReferenciasTab.tsx
│       ├── ReagentesTab.tsx
│       ├── ManutencaoTab.tsx
│       ├── RelatoriosTab.tsx
│       ├── ImportarTab.tsx
│       ├── HematologiaArea.tsx
│       ├── ImunologiaArea.tsx
│       └── PostCalibrationModal.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useQcRecords.ts
│   ├── useReagents.ts
│   ├── useMaintenance.ts
│   ├── useDashboard.ts
│   ├── useHematology.ts
│   └── useAiAnalysis.ts
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   └── ProinPage.tsx
├── services/
│   ├── api.ts               # Axios instance com interceptors JWT
│   ├── authService.ts
│   ├── qcService.ts
│   ├── reagentService.ts
│   ├── maintenanceService.ts
│   ├── hematologyService.ts
│   ├── dashboardService.ts
│   └── aiService.ts
├── types/
│   ├── auth.ts
│   ├── qc.ts
│   ├── reagent.ts
│   ├── maintenance.ts
│   ├── hematology.ts
│   └── dashboard.ts
├── styles/
│   ├── globals.css           # Tailwind imports + animações
│   └── tokens.ts             # Design tokens exportados
├── App.tsx
├── main.tsx
└── vite-env.d.ts
```

## Roteamento

```tsx
// App.tsx
<BrowserRouter>
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<PrivateRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/qc" element={<ProinPage />} />
      </Route>
    </Route>
  </Routes>
</BrowserRouter>
```

## API Client (Axios)

```typescript
// services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api',
});

// Interceptor: adiciona JWT em toda request
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: refresh automático quando 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Tentar refresh, se falhar redirecionar para login
    }
    return Promise.reject(error);
  }
);

export default api;
```

## Types (Mapeamento dos Models Python → TypeScript)

```typescript
// types/qc.ts
export interface QcRecord {
  id: string;
  examName: string;
  area: string;
  date: string;
  level: string;
  lotNumber: string;
  value: number;
  targetValue: number;
  targetSd: number;
  cv: number;
  cvLimit: number;
  zScore: number;
  equipment: string;
  analyst: string;
  status: 'APROVADO' | 'REPROVADO' | 'ALERTA';
  needsCalibration: boolean;
  violations: WestgardViolation[];
}

export interface WestgardViolation {
  id: string;
  rule: string;
  description: string;
  severity: 'WARNING' | 'REJECTION';
}

export interface QcReferenceValue {
  id: string;
  examId: string;
  name: string;
  level: string;
  lotNumber: string;
  manufacturer: string;
  targetValue: number;
  targetSd: number;
  cvMaxThreshold: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  notes: string;
}

export interface LeveyJenningsPoint {
  date: string;
  value: number;
  target: number;
  sd: number;
  cv: number;
  status: string;
  zScore: number;
  upper2sd: number;
  lower2sd: number;
  upper3sd: number;
  lower3sd: number;
}
```

## Hooks (React Query)

```typescript
// hooks/useQcRecords.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qcService } from '../services/qcService';

export function useQcRecords(filters?: { exam?: string; date?: string; area?: string }) {
  return useQuery({
    queryKey: ['qc-records', filters],
    queryFn: () => qcService.getRecords(filters),
  });
}

export function useCreateQcRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: qcService.createRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qc-records'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
```

## Ordem de Implementação (Prompts)

1. **`10-projeto-react.md`** → Projeto base com configs
2. **`11-design-system-react.md`** → Componentes UI (Button, Card, Input, etc)
3. **`12-pagina-login.md`** → Login idêntico ao atual
4. **`13-pagina-dashboard.md`** → Dashboard com KPIs
5. **`14-pagina-proin-cq.md`** → Página de CQ (todas as abas)
6. **`15-graficos-levey-jennings.md`** → Gráficos interativos
7. **`16-integracao-gemini.md`** → IA assistente
