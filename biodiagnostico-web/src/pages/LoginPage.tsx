import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Lock, Mail, Shield } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router-dom'
import { Button, Card, Input, Modal, useToast } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import {
  type LoginFormValues,
  type RecoveryFormValues,
  loginSchema,
  recoverySchema,
} from '../lib/authSchemas'
import { authService } from '../services/authService'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false)
  const [recoverySent, setRecoverySent] = useState(false)
  const [recoveryRecipient, setRecoveryRecipient] = useState('')
  const [recoveryLink, setRecoveryLink] = useState('')
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onChange',
  })
  const recoveryForm = useForm<RecoveryFormValues>({
    resolver: zodResolver(recoverySchema),
    defaultValues: {
      email: '',
    },
    mode: 'onChange',
  })

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleLogin = loginForm.handleSubmit(async (data) => {
    try {
      await login(data.email, data.password)
    } catch {
      toast.error('Credenciais inválidas. Confira seu email e senha.')
    }
  })

  const handleRecovery = recoveryForm.handleSubmit(async (data) => {
    try {
      const response = await authService.requestPasswordReset({ email: data.email })
      setRecoveryLink(response.resetUrl ?? '')
      setRecoveryRecipient(data.email)
      setRecoverySent(true)
      toast.success(response.message)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível iniciar a recuperação.'
      toast.error(message)
    }
  })

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

            <form className="space-y-5" onSubmit={handleLogin}>
              <Input
                label="Email corporativo"
                type="email"
                placeholder="voce@empresa.com"
                icon={<Mail className="h-4 w-4" />}
                error={loginForm.formState.errors.email?.message}
                autoComplete="email"
                {...loginForm.register('email')}
              />

              <div className="relative">
                <Input
                  label="Senha"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  icon={<Lock className="h-4 w-4" />}
                  error={loginForm.formState.errors.password?.message}
                  autoComplete="current-password"
                  {...loginForm.register('password')}
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
                    recoveryForm.reset({ email: loginForm.getValues('email') })
                    setRecoverySent(false)
                    setRecoveryRecipient('')
                    setRecoveryLink('')
                    setIsRecoveryOpen(true)
                  }}
                >
                  Esqueceu a senha?
                </button>
              </div>

              <Button type="submit" size="xl" className="w-full" loading={loginForm.formState.isSubmitting}>
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
              <Button onClick={() => void handleRecovery()} loading={recoveryForm.formState.isSubmitting}>
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
            placeholder="voce@empresa.com"
            error={recoveryForm.formState.errors.email?.message}
            autoComplete="email"
            {...recoveryForm.register('email')}
          />
        ) : (
          <div className="space-y-3">
            <Card className="border border-green-100 bg-green-50 text-green-900">
              Um link de recuperação foi enviado para <strong>{recoveryRecipient}</strong>.
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
