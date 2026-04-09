# Prompt 10 — Criar Projeto React + TypeScript + Vite

Cole este prompt inteiro no Claude:

---

Crie o projeto frontend do Biodiagnóstico 4.0 usando React 18 + TypeScript + Vite + Tailwind CSS 4.

## Setup do projeto:

```bash
npm create vite@latest biodiagnostico-web -- --template react-ts
```

## Dependências:
```bash
npm install axios react-router-dom@6 recharts lucide-react
npm install @tanstack/react-query
npm install -D tailwindcss @tailwindcss/vite
```

## Arquivos que preciso:

### 1. vite.config.ts
Com Tailwind CSS plugin e proxy para dev (redirecionar /api para localhost:8080).

### 2. tailwind.config.ts
Estender com as cores do Biodiagnóstico:
- primary: #166534 (verde escuro), light: #22c55e, dark: #14532d
- status: success #16a34a, warning #ea580c, error #dc2626, info #2563eb
- Font family: Inter, system-ui

### 3. src/styles/globals.css
```css
@import "tailwindcss";

/* Animações customizadas */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes voicePulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.8; }
}

.animate-fadeIn { animation: fadeIn 0.3s ease-out; }
.animate-slideUp { animation: slideUp 0.4s ease-out; }
.animate-voicePulse { animation: voicePulse 1.5s ease-in-out infinite; }
```

### 4. src/services/api.ts
Axios instance com:
- baseURL: `import.meta.env.VITE_API_URL || 'http://localhost:8080/api'`
- Request interceptor: adicionar Bearer token do sessionStorage
- Response interceptor: se 401 → tentar refresh → se falhar → redirecionar para /login

### 5. src/types/index.ts
Exportar TODOS os types TypeScript que mapeiam as responses da API:

```typescript
// Auth
export interface User { id: string; email: string; name: string; role: string; }
export interface AuthResponse { accessToken: string; refreshToken: string; user: User; }

// QC
export interface QcRecord { ... } // todos os campos
export interface WestgardViolation { id: string; rule: string; description: string; severity: 'WARNING' | 'REJECTION'; }
export interface QcReferenceValue { ... }
export interface QcExam { id: string; name: string; area: string; unit: string; }
export interface LeveyJenningsPoint { date: string; value: number; target: number; sd: number; upper2sd: number; lower2sd: number; upper3sd: number; lower3sd: number; }

// Reagentes
export interface ReagentLot { ... } // todos os campos + daysLeft, stockPct, daysToRupture
export interface StockMovement { ... }
export interface ReagentTagSummary { ... }

// Manutenção
export interface MaintenanceRecord { ... }

// Hematologia
export interface HematologyQcParameter { ... }
export interface HematologyQcMeasurement { ... }
export interface HematologyBioRecord { ... }

// Dashboard
export interface DashboardKpi { totalToday: number; totalMonth: number; approvalRate: number; hasAlerts: boolean; alertsCount: number; }
export interface DashboardAlerts { expiringReagents: { count: number; items: ReagentLot[] }; pendingMaintenances: { count: number; items: MaintenanceRecord[] }; westgardViolations: { count: number; items: QcRecord[] }; }
```

### 6. src/main.tsx
Com QueryClientProvider (React Query) e BrowserRouter.

### 7. src/App.tsx
Roteamento:
```tsx
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
```

### 8. src/hooks/useAuth.ts
Custom hook que gerencia autenticação:
- Estado: user, isAuthenticated, isLoading
- login(email, password): POST /api/auth/login → salvar tokens em sessionStorage
- logout(): limpar tokens → navigate('/login')
- refreshToken(): POST /api/auth/refresh
- restoreSession(): ao montar, verificar se tem token e se é válido

### 9. src/components/layout/PrivateRoute.tsx
Se não autenticado → Navigate to /login.
Se autenticado → Outlet.

### 10. src/components/layout/AppLayout.tsx
Navbar no topo + Outlet para conteúdo. Padding-top para compensar navbar fixed.

### 11. .env.example
```
VITE_API_URL=http://localhost:8080/api
```

### 12. railway.toml
```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
restartPolicyType = "on_failure"
```

## Regras:
- Tudo em TypeScript strict
- Nenhum `any` — tipar tudo
- Gere TODOS os arquivos completos e funcionais
