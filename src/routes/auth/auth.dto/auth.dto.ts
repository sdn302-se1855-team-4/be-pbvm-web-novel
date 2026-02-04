import z4 from 'zod/v4'

export const LoginBodySchema = z4.object({
  email: z4.email('Invalid email address'),
  password: z4.string().min(6, 'Mật khẩu phải >= 6 ký tự').max(20, 'Mật khẩu tối đa 20 ký tự'),
})
export type LoginBodyDTO = z4.infer<typeof LoginBodySchema>
export class LoginResDTO {
  accessToken: string
  refreshToken: string
  constructor(partial: Partial<LoginResDTO>) {
    Object.assign(this, partial)
  }
}
export const RegisterBody = LoginBodySchema.extend({
  name: z4.string({ message: 'Tên phải là chuỗi' }),
  confirmPassword: z4.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword'],
})
export type RegisterBodyDTO = z4.infer<typeof RegisterBody>
export class RegisterResDTO {
  userId: number
  email: string
  name: string
  createdAt: Date
  updatedAt: Date
  constructor(partial: Partial<RegisterResDTO>) {
    Object.assign(this, partial)
  }
}
