import { z } from 'zod'

const strongPasswordMessage =
  'A senha deve ter pelo menos 8 caracteres, com letra maiuscula, minuscula e numero.'

export const loginSchema = z.object({
  email: z.string().trim().email('Informe um email valido.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
})

export const recoverySchema = z.object({
  email: z.string().trim().email('Informe um email valido para recuperacao.'),
})

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, strongPasswordMessage)
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, strongPasswordMessage),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'As senhas precisam ser iguais.',
    path: ['confirmPassword'],
  })

export type LoginFormValues = z.infer<typeof loginSchema>
export type RecoveryFormValues = z.infer<typeof recoverySchema>
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>
