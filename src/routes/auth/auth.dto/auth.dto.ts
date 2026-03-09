import z4 from 'zod/v4'
import { createZodDto } from 'nestjs-zod'

// ==================== Register ====================
export const RegisterBodySchema = z4
  .object({
    email: z4.email('Email không hợp lệ'),
    username: z4.string().min(3, 'Username tối thiểu 3 ký tự').max(30, 'Username tối đa 30 ký tự'),
    password: z4.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').max(50, 'Mật khẩu tối đa 50 ký tự'),
    confirmPassword: z4.string(),
    displayName: z4.string().optional(),
    role: z4.enum(['READER', 'WRITER']).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  })

export type RegisterBodyType = z4.infer<typeof RegisterBodySchema>

export class RegisterBodyDTO extends createZodDto(RegisterBodySchema) {}

// ==================== Login ====================
export const LoginBodySchema = z4.object({
  email: z4.email('Email không hợp lệ'),
  password: z4.string().min(1, 'Mật khẩu không được để trống'),
})

export type LoginBodyType = z4.infer<typeof LoginBodySchema>

export class LoginBodyDTO extends createZodDto(LoginBodySchema) {}

// ==================== Response DTOs ====================
export class AuthTokensResDTO {
  accessToken: string
  refreshToken: string
  constructor(partial: Partial<AuthTokensResDTO>) {
    Object.assign(this, partial)
  }
}

export class UserProfileResDTO {
  id: string
  email: string
  username: string
  displayName: string | null
  avatar: string | null
  bio: string | null
  role: string
  createdAt: Date
  constructor(partial: Partial<UserProfileResDTO>) {
    Object.assign(this, partial)
  }
}
