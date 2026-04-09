# Prompt 18 — Navbar (Barra de Navegação)

Cole este prompt inteiro no Claude:

---

Crie a Navbar do Biodiagnóstico 4.0 em React + TypeScript. Deve ser IDÊNTICA à navbar atual.

## Layout atual:

### Desktop:
- Fixed no topo, z-50, full width
- Fundo: bg-white/70 backdrop-blur-md border-b border-neutral-200
- Esquerda: Logo/nome "Biodiagnóstico" (text-lg font-bold text-green-800)
- Centro: Links de navegação
  - "Dashboard" → /dashboard
  - "Controle de Qualidade" → /qc
  - Link ativo: text-green-800 com indicador verde embaixo (border-b-2 border-green-800)
  - Link inativo: text-neutral-500 hover:text-neutral-700
- Direita: Avatar do usuário (circle com iniciais) + dropdown
  - Dropdown: nome, email, separador, "Sair" (vermelho)

### Mobile:
- Hamburger menu (3 linhas) à direita
- Ao clicar: slide-in menu pela direita com links + info do usuário
- Overlay escuro ao abrir
- Botão X para fechar

## Arquivo: src/components/layout/Navbar.tsx

## Componentes:
- Ícones: Menu, X, LayoutDashboard, Beaker, User, LogOut do lucide-react
- useAuth() para dados do usuário e logout
- useLocation() do react-router para saber qual link está ativo
- useNavigate() para navegação

## Comportamento:
- Dropdown fecha ao clicar fora
- Menu mobile fecha ao navegar
- Transição suave ao abrir/fechar menu e dropdown

## AppLayout.tsx (src/components/layout/AppLayout.tsx):
- Navbar no topo
- `<Outlet />` com padding-top (pt-16) para compensar navbar fixed
- min-height: 100vh
- Background: bg-neutral-50

Gere ambos os arquivos completos.
