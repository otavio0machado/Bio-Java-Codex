import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Lock, UserIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router-dom'
import { Button, Input, useToast } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { type LoginFormValues, loginSchema } from '../lib/authSchemas'
import logoBio from '../assets/logobio.png'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
    mode: 'onChange',
  })

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleLogin = loginForm.handleSubmit(async (data) => {
    try {
      await login(data.username, data.password)
    } catch {
      toast.error('Credenciais inválidas. Confira seu nome de usuário e senha.')
    }
  })

  return (
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Lock, UserIcon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate } from 'react-router-dom'
import { Button, useToast } from '../components/ui'
import { useAuth } from '../hooks/useAuth'
import { type LoginFormValues, loginSchema } from '../lib/authSchemas'
import logoBio from '../assets/logobio.png'

export function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
    mode: 'onChange',
  })

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleLogin = loginForm.handleSubmit(async (data) => {
    try {
      await login(data.username, data.password)
    } catch {
      toast.error('Credenciais inválidas. Confira seu nome de usuário e senha.')
    }
  })

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#f4f7f5] p-4 sm:p-6 lg:p-8">
      {/* Background ambient lighting and subtle technical dot grid */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_45%,_rgba(4,106,56,0.08),_transparent_70%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,_rgba(4,106,56,0.05),_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-60" />

      {/* Floating Central Container */}
      <div className="relative z-10 w-full max-w-[420px] animate-fadeIn">
        {/* Main Card */}
        <div className="rounded-3xl border border-neutral-200/90 bg-white p-8 sm:p-10 shadow-2xl shadow-neutral-900/[0.07]">
          {/* Brand Logo & Header */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-3 flex items-center justify-center">
              <img
                src={logoBio}
                alt="Biodiagnóstico Controle de Qualidade"
                className="h-12 w-auto max-w-[260px] object-contain"
              />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              Acesse o Sistema
            </h1>
            <p className="mt-1 text-xs text-neutral-500">
              Entre com suas credenciais de bancada
            </p>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={handleLogin} noValidate>
            <div>
              <label
                htmlFor="username"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-700"
              >
                Nome de usuário
              </label>
              <div
                className={`flex items-center gap-3 rounded-xl border bg-neutral-50/60 px-3.5 py-3 transition focus-within:border-emerald-700 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-700/10 ${
                  loginForm.formState.errors.username
                    ? 'border-red-500 focus-within:border-red-500 focus-within:ring-red-500/15'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <UserIcon className="h-4 w-4 shrink-0 text-neutral-400" />
                <input
                  id="username"
                  type="text"
                  placeholder="seu.usuario"
                  autoComplete="username"
                  className="w-full border-none bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                  {...loginForm.register('username')}
                />
              </div>
              {loginForm.formState.errors.username?.message ? (
                <p className="mt-1.5 text-xs font-medium text-red-600">
                  {loginForm.formState.errors.username.message}
                </p>
              ) : null}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral-700"
              >
                Senha
              </label>
              <div
                className={`relative flex items-center gap-3 rounded-xl border bg-neutral-50/60 px-3.5 py-3 transition focus-within:border-emerald-700 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-700/10 ${
                  loginForm.formState.errors.password
                    ? 'border-red-500 focus-within:border-red-500 focus-within:ring-red-500/15'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <Lock className="h-4 w-4 shrink-0 text-neutral-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  className="w-full border-none bg-transparent pr-8 text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                  {...loginForm.register('password')}
                />
                <button
                  type="button"
                  className="absolute right-3 rounded-md p-1 text-neutral-400 transition hover:text-neutral-700 focus:outline-none"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {loginForm.formState.errors.password?.message ? (
                <p className="mt-1.5 text-xs font-medium text-red-600">
                  {loginForm.formState.errors.password.message}
                </p>
              ) : null}
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                className="w-full rounded-xl bg-[#046A38] font-semibold text-white shadow-md shadow-emerald-950/15 transition hover:bg-[#03542c] active:scale-[0.99]"
                loading={loginForm.formState.isSubmitting}
              >
                Entrar no Sistema
              </Button>
            </div>
          </form>
        </div>

        {/* Discrete Institutional Footer */}
        <footer className="mt-6 text-center text-xs text-neutral-400">
          <span>Biodiagnóstico Laboratório Clínico</span>
          <span className="mx-2 text-neutral-300">•</span>
          <span>v1.0.0</span>
        </footer>
      </div>
    </main>
  )
}
  )
}
