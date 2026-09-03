import { useState } from 'react'
import { Eye, EyeOff, KeyRound, ShieldAlert, UserX, X } from 'lucide-react'
import { Button, Input, Modal, useToast } from '../ui'
import { useResetPassword } from '../../hooks/useAdmin'
import { extractErrorMessage } from './adminHelpers'
import type { User } from '../../types'

interface ResetPasswordModalProps {
  user: User
  onClose: () => void
}

export function ResetPasswordModal({ user, onClose }: ResetPasswordModalProps) {
  const { toast } = useToast()
  const resetPassword = useResetPassword()
  const [newPassword, setNewPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (resetPassword.isPending) return
    setErrorMessage(null)

    if (newPassword.length < 4) {
      setErrorMessage('A nova senha deve possuir no mínimo 4 caracteres.')
      toast.warning('A senha deve ter pelo menos 4 caracteres.')
      return
    }

    try {
      await resetPassword.mutateAsync({ id: user.id, request: { newPassword } })
      toast.success(`Senha do usuário "${user.name}" redefinida com sucesso!`)
      setNewPassword('')
      onClose()
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Erro ao redefinir senha.')
      setErrorMessage(msg)
      toast.error(msg)
    }
  }

  return (
    <Modal
      isOpen
      onClose={() => {
        setNewPassword('')
        onClose()
      }}
      title="Redefinir Senha de Acesso"
      footer={
        <div className="flex justify-end gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              setNewPassword('')
              onClose()
            }}
          >
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} loading={resetPassword.isPending}>
            <KeyRound className="mr-2 h-4 w-4" />
            Confirmar Nova Senha
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Banner de Erro */}
        {errorMessage ? (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <ShieldAlert className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1">
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {/* Alerta de Segurança */}
        <div className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3.5 text-sm text-amber-900 border border-amber-200/80">
          <UserX className="h-5 w-5 shrink-0 text-amber-700" />
          <span>
            Você está redefinindo a senha de <strong>{user.name}</strong> (@{user.username}).
            Todas as sessões ativas deste usuário serão invalidadas imediatamente por segurança.
          </span>
        </div>

        {/* Campo de Senha */}
        <div className="relative">
          <Input
            label="Nova Senha *"
            type={showPw ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Digite a nova senha (mínimo 4 dígitos)"
          />
          <button
            type="button"
            className="absolute right-3 top-[2.65rem] rounded-full p-1 text-neutral-400 transition hover:text-neutral-700"
            onClick={() => setShowPw(!showPw)}
            tabIndex={-1}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </Modal>
  )
}
