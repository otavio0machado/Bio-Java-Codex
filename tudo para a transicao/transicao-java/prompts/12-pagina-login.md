# Prompt 12 — Página de Login

Cole este prompt inteiro no Claude:

---

Crie a página de Login do Biodiagnóstico 4.0 em React + TypeScript. O visual deve ser IDÊNTICO ao sistema atual.

## Layout atual (que deve ser replicado):

### Split layout: esquerda (hero) + direita (formulário)
- **Esquerda (60% da tela)**: fundo com gradiente verde escuro (#14532d → #166534), overlay glassmorphic branco/20, texto centralizado com nome do sistema e descrição
- **Direita (40%)**: fundo branco, formulário centralizado verticalmente

### Formulário:
- Título: "Acesse sua conta" (h2, bold)
- Subtítulo: "Sistema de Controle de Qualidade" (text-neutral-500)
- Campo: Email corporativo (type email, ícone de envelope)
- Campo: Senha (type password, ícone de cadeado, toggle mostrar/ocultar)
- Botão: "Entrar" (primary, full width, size xl)
- Link: "Esqueceu a senha?" → abre modal de recuperação
- Footer: "Acesso seguro e criptografado" com ícone de escudo

### Modal de Recuperação de Senha:
- Input de email
- Botão "Enviar link de recuperação"
- Mensagem de sucesso após envio

### Responsivo:
- Mobile: empilha verticalmente (hero some, só formulário)
- Tablet: hero com menos padding

## Comportamento:
1. Ao submeter: chamar `useAuth().login(email, password)`
2. Loading state no botão durante request
3. Exibir toast de erro se credenciais inválidas
4. Redirecionar para /dashboard se login bem-sucedido
5. Se já está autenticado ao acessar /login → redirecionar para /dashboard

## Arquivo: src/pages/LoginPage.tsx

## Componentes a usar:
- Button, Input, Modal, Card, LoadingSpinner do design system
- useAuth hook
- useToast hook
- Ícones: Mail, Lock, Eye, EyeOff, Shield do lucide-react

## Regras:
- Validação de formulário client-side antes de submeter
- Email precisa ser válido
- Senha precisa ter pelo menos 6 caracteres
- Gere o arquivo COMPLETO, sem placeholders
