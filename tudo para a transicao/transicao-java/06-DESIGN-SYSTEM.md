# 06 — Design System (Manter Visual Idêntico)

## Regra Absoluta

O cliente **NÃO PODE** perceber que a tecnologia mudou. Mesmas cores, mesmos botões, mesma navegação.

## Tokens de Design (extraídos do styles.py atual)

### Cores

```typescript
// tailwind.config.ts — estender com essas cores
const colors = {
  primary: {
    DEFAULT: '#166534',   // Verde principal (green-800)
    light: '#22c55e',     // Verde claro
    dark: '#14532d',      // Verde escuro
  },
  accent: {
    blue: '#1E88E5',
    orange: '#FF6F00',
  },
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
  status: {
    success: '#16a34a',    // Verde
    warning: '#ea580c',    // Laranja
    error: '#dc2626',      // Vermelho
    info: '#2563eb',       // Azul
  },
  surface: {
    DEFAULT: '#ffffff',
    muted: '#f8fafc',
    elevated: '#ffffff',
  }
}
```

### Tipografia

```typescript
// Fontes usadas no sistema atual
const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'monospace'],
  },
  fontSize: {
    // Headings
    h1: ['2rem', { lineHeight: '2.5rem', fontWeight: '700' }],      // 32px
    h2: ['1.5rem', { lineHeight: '2rem', fontWeight: '700' }],      // 24px
    h3: ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],  // 20px
    h4: ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600' }],  // 18px
    h5: ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],      // 16px
    // Body
    body: ['0.9375rem', { lineHeight: '1.5rem' }],     // 15px
    small: ['0.8125rem', { lineHeight: '1.25rem' }],    // 13px
    xs: ['0.75rem', { lineHeight: '1rem' }],             // 12px
  }
}
```

### Espaçamento

```typescript
const spacing = {
  xxs: '2px',
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
}
```

### Bordas e Sombras

```typescript
const design = {
  borderRadius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },
  boxShadow: {
    card: '0 1px 3px rgba(0,0,0,0.08)',
    elevated: '0 4px 12px rgba(0,0,0,0.1)',
    modal: '0 20px 60px rgba(0,0,0,0.15)',
  }
}
```

## Componentes React Necessários

Estes componentes devem replicar exatamente o comportamento da `components/ui.py` atual:

### 1. Button

```
Variantes: primary | secondary | ghost | danger
Tamanhos: sm | md | lg | xl
Estado: default | hover | disabled | loading
Primary: bg-primary text-white hover:bg-primary-dark
Secondary: bg-transparent border-neutral-300 hover:bg-neutral-50
Ghost: bg-transparent hover:bg-neutral-100
Danger: bg-red-600 text-white hover:bg-red-700
```

### 2. Card

```
Base: bg-white rounded-xl shadow-card p-6
Hover (se clicável): hover:shadow-elevated transition-shadow
Glass: bg-white/70 backdrop-blur-md border-white/20
```

### 3. Input / Select / TextArea

```
Base: w-full px-4 py-3 rounded-lg border-neutral-200
Focus: ring-2 ring-primary/20 border-primary
Error: border-red-500 ring-red-500/20
Label: text-sm font-medium text-neutral-700 mb-1
```

### 4. StatusBadge

```
APROVADO: bg-green-100 text-green-800
REPROVADO: bg-red-100 text-red-800
ALERTA: bg-amber-100 text-amber-800
ativo: bg-emerald-100 text-emerald-800
em_uso: bg-blue-100 text-blue-800
inativo: bg-neutral-100 text-neutral-600
vencido: bg-red-100 text-red-800
```

### 5. StatCard (KPI)

```
Container: card com ícone colorido + valor grande + label + trend indicator
Ícone: rounded-full p-3 com cor de fundo suave
Valor: text-3xl font-bold
Label: text-sm text-neutral-500
Trend: seta ↑/↓ com cor verde/vermelha
```

### 6. Navbar

```
Posição: fixed top-0 z-50 w-full
Estilo: bg-white/70 backdrop-blur-md border-b border-neutral-200
Logo: à esquerda
Links: centro (Dashboard, Controle de Qualidade)
Avatar: à direita com dropdown (Admin, Sair)
Mobile: hamburger menu com slide-in
Active link: indicador verde embaixo
```

### 7. EmptyState

```
Ícone grande cinza + título + descrição + botão de ação
Centralizado vertical e horizontalmente
```

### 8. Modal

```
Overlay: bg-black/50 backdrop-blur-sm
Container: bg-white rounded-2xl shadow-modal max-w-lg mx-auto
Header: título + botão fechar (X)
Footer: botões de ação
Animação: fade-in + scale-up
```

### 9. Toast

```
Posição: fixed bottom-right
Variantes: success (verde), error (vermelho), warning (amber), info (azul)
Auto-dismiss: 5 segundos
Animação: slide-in da direita
```

### 10. Skeleton

```
Animação: pulse com bg-neutral-200
Formas: block (retângulo), circle (avatar), line (texto)
Usar durante loading de dados
```

## Animações (manter do sistema atual)

```css
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
```

## Mapeamento de Páginas → Layout

```
Login:
  - Split layout: hero esquerda (imagem + glassmorphic overlay) + form direita
  - Fundo com gradiente verde

Dashboard:
  - Navbar no topo
  - Grid 4 colunas com KPI cards
  - Painel de alertas
  - Tabela de registros recentes
  - Cards de acesso rápido

ProIn (CQ):
  - Navbar no topo
  - Botões de área (Bioquímica, Hematologia, etc) como segmented control
  - Tabs de sub-navegação
  - Conteúdo da aba ativa
  - Modais flutuantes para ações
```
