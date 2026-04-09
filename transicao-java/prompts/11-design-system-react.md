# Prompt 11 — Design System React (Componentes UI)

Cole este prompt inteiro no Claude:

---

Crie a biblioteca de componentes UI do Biodiagnóstico 4.0 em React + TypeScript + Tailwind CSS. Pasta: `src/components/ui/`.

Estes componentes devem replicar EXATAMENTE o visual do sistema atual (Python/Reflex) para que o cliente não perceba a mudança de tecnologia.

## Design Tokens do sistema atual:
- Cor primária: verde escuro #166534 (Tailwind: green-800)
- Bordas: rounded-lg (8px) a rounded-2xl (16px)
- Sombras: shadow-sm para cards, shadow-lg para modais
- Font: Inter, system-ui
- Inputs: py-3 px-4, borda neutral-200, focus ring verde

## Componentes necessários:

### 1. Button.tsx
```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}
```
- Primary: bg-green-800 text-white hover:bg-green-900
- Secondary: border border-neutral-300 hover:bg-neutral-50
- Ghost: hover:bg-neutral-100
- Danger: bg-red-600 text-white hover:bg-red-700
- Loading: spinner animado + texto "Carregando..."
- Ícone: à esquerda do texto com gap-2

### 2. Card.tsx
```tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  glass?: boolean; // glassmorphic variant
}
```
- Normal: bg-white rounded-xl shadow-sm p-6
- Glass: bg-white/70 backdrop-blur-md border border-white/20
- Se onClick: cursor-pointer hover:shadow-md transition-shadow

### 3. Input.tsx
```tsx
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}
```
- Label: text-sm font-medium text-neutral-700 mb-1
- Input: w-full px-4 py-3 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-green-800/20 focus:border-green-800
- Error: border-red-500 + mensagem em text-red-500 text-sm

### 4. Select.tsx
Mesmo padrão do Input mas com `<select>`.

### 5. TextArea.tsx
Mesmo padrão do Input mas com `<textarea>`, rows configurável.

### 6. Modal.tsx
```tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}
```
- Overlay: fixed inset-0 bg-black/50 backdrop-blur-sm z-50
- Container: bg-white rounded-2xl shadow-2xl mx-auto animate-slideUp
- Header: flex justify-between items-center p-6 border-b
- Botão fechar: X (lucide-react)
- Fechar ao clicar no overlay
- Trap focus dentro do modal

### 7. StatusBadge.tsx
```tsx
interface StatusBadgeProps {
  status: 'APROVADO' | 'REPROVADO' | 'ALERTA' | 'ativo' | 'em_uso' | 'inativo' | 'vencido';
}
```
Mapeamento de cores:
- APROVADO/ativo: bg-green-100 text-green-800
- REPROVADO/vencido: bg-red-100 text-red-800
- ALERTA: bg-amber-100 text-amber-800
- em_uso: bg-blue-100 text-blue-800
- inativo: bg-neutral-100 text-neutral-600

### 8. StatCard.tsx (para KPIs do Dashboard)
```tsx
interface StatCardProps {
  icon: React.ReactNode;
  iconColor: string; // classe Tailwind para bg do ícone
  value: string | number;
  label: string;
  trend?: { value: number; positive: boolean };
}
```
- Ícone em circle com bg colorido
- Valor grande: text-3xl font-bold
- Label: text-sm text-neutral-500
- Trend: seta ↑/↓ com verde/vermelho

### 9. Toast.tsx + useToast hook
```tsx
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}
```
- Provider com contexto
- Hook: `const { toast } = useToast()`
- `toast.success("Registro salvo!")`, `toast.error("Erro ao salvar")`
- Posição: fixed bottom-4 right-4
- Auto-dismiss: 5s
- Animação: slide da direita

### 10. Skeleton.tsx
```tsx
interface SkeletonProps {
  type?: 'block' | 'circle' | 'line';
  width?: string;
  height?: string;
  lines?: number; // para type='line'
}
```
- animate-pulse com bg-neutral-200

### 11. EmptyState.tsx
```tsx
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}
```

### 12. FormField.tsx
Wrapper: label + input + error message. Para simplificar formulários.

### 13. LoadingSpinner.tsx
SVG spinner animado. Tamanhos: sm (16px), md (24px), lg (40px).

### 14. index.ts
Exportar tudo com named exports.

## Regras:
- Todos os componentes com `React.forwardRef` onde fizer sentido (Input, Select, TextArea)
- Usar `cn()` helper (classnames merge) para combinar className do props com classes base
- Instalar: `npm install clsx tailwind-merge` → criar util `cn()`
- Acessibilidade: aria-labels, role, keyboard navigation no Modal
- Gere TODOS os 14 componentes completos
