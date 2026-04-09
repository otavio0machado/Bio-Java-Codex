import { Eye, EyeOff, Lock, Mail, Shield } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Button, Card, Input, Modal, useToast } from '../components/ui'
import { authService } from '../services/authService'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false)
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoverySent, setRecoverySent] = useState(false)
  const [recoveryLink, setRecoveryLink] = useState('')
  const [isRecoverySubmitting, setIsRecoverySubmitting] = useState(false)

  const errors = useMemo(() => {
    return {
      email:
        email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          ? 'Informe um email válido.'
          : '',
      password: password && password.length < 6 ? 'A senha deve ter pelo menos 6 caracteres.' : '',
    }
  }, [email, password])

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email || !password) {
      toast.error('Preencha email e senha para continuar.')
      return
    }
    if (errors.email || errors.password) {
      toast.error('Corrija os campos destacados antes de continuar.')
      return
    }

    try {
      setIsSubmitting(true)
      await login(email, password)
    } catch {
      toast.error('Credenciais inválidas. Confira seu email e senha.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRecovery = async () => {
    if (!recoveryEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryEmail)) {
      toast.warning('Informe um email válido para recuperação.')
      return
    }

    try {
      setIsRecoverySubmitting(true)
      const response = await authService.requestPasswordReset({ email: recoveryEmail })
      setRecoveryLink(response.resetUrl ?? '')
      setRecoverySent(true)
      toast.success(response.message)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível iniciar a recuperação.'
      toast.error(message)
    } finally {
      setIsRecoverySubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="grid min-h-screen lg:grid-cols-[1.2fr_0.8fr]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-green-900 via-green-800 to-green-700 px-10 py-12 text-white lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.18),_transparent_30%)]" />
          <div className="relative flex h-full w-full items-center">
            <div className="max-w-2xl space-y-8">
              <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur-md">
                Biodiagnóstico 4.0
              </div>
              <div className="space-y-5">
                <h1 className="max-w-xl text-5xl font-bold leading-tight">
                  Controle de qualidade laboratorial com confiança operacional.
                </h1>
                <p className="max-w-lg text-lg text-green-50/85">
                  Plataforma unificada para monitorar CQ, reagentes, manutenção e análises assistidas.
                </p>
              </div>
              <Card glass className="max-w-xl text-white">
                <p className="text-sm leading-6 text-green-50/90">
                  Mantenha os indicadores críticos visíveis, aplique regras de Westgard em tempo real e
                  acompanhe tendências antes que virem problema.
                </p>
              </Card>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-md space-y-8">
            <div className="space-y-2">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-green-800">Biodiagnóstico</div>
              <h2 className="text-3xl font-bold text-neutral-900">Acesse sua conta</h2>
              <p className="text-neutral-500">Sistema de Controle de Qualidade</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <Input
                label="Email corporativo"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@empresa.com"
                icon={<Mail className="h-4 w-4" />}
                error={errors.email}
              />

              <div className="relative">
                <Input
                  label="Senha"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Digite sua senha"
                  icon={<Lock className="h-4 w-4" />}
                  error={errors.password}
                />
                <button
                  type="button"
                  className="absolute right-3 top-[2.65rem] rounded-full p-1 text-neutral-400 transition hover:text-neutral-700"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm font-medium text-green-800 transition hover:text-green-900"
                  onClick={() => {
                    setRecoveryEmail(email)
                    setRecoverySent(false)
                    setRecoveryLink('')
                    setIsRecoveryOpen(true)
                  }}
                >
                  Esqueceu a senha?
                </button>
              </div>

              <Button type="submit" size="xl" className="w-full" loading={isSubmitting}>
                Entrar
              </Button>
            </form>

            <div className="flex items-center gap-3 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-900">
              <Shield className="h-5 w-5" />
              <span>Acesso seguro e criptografado</span>
            </div>
          </div>
        </section>
      </div>

      <Modal
        isOpen={isRecoveryOpen}
        onClose={() => setIsRecoveryOpen(false)}
        title="Recuperar acesso"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsRecoveryOpen(false)}>
              Fechar
            </Button>
            {!recoverySent ? (
              <Button onClick={() => void handleRecovery()} loading={isRecoverySubmitting}>
                Enviar link de recuperação
              </Button>
            ) : null}
          </div>
        }
      >
        {!recoverySent ? (
          <Input
            label="Email"
            type="email"
            value={recoveryEmail}
            onChange={(event) => setRecoveryEmail(event.target.value)}
            placeholder="voce@empresa.com"
          />
        ) : (
          <div className="space-y-3">
            <Card className="border border-green-100 bg-green-50 text-green-900">
              Um link de recuperação foi enviado para <strong>{recoveryEmail}</strong>.
            </Card>
            {recoveryLink ? (
              <Card className="border border-amber-100 bg-amber-50 text-amber-900">
                <div className="space-y-2 text-sm">
                  <p>Modo local detectado: o link direto também foi liberado para teste.</p>
                  <a className="font-semibold underline" href={recoveryLink}>
                    Abrir recuperação agora
                  </a>
                </div>
              </Card>
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  )
}
