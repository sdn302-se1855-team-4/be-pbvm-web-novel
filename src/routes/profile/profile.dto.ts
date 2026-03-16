import z4 from 'zod/v4'
import { createZodDto } from 'nestjs-zod'

export const UpdateProfileSchema = z4.object({
  displayName: z4.string().min(1, 'Tên hiển thị không được để trống').max(50, 'Tên hiển thị tối đa 50 ký tự').optional(),
  bio: z4.string().max(500, 'Giới thiệu tối đa 500 ký tự').optional().nullable(),
})

export type UpdateProfileType = z4.infer<typeof UpdateProfileSchema>
export class UpdateProfileDTO extends createZodDto(UpdateProfileSchema) {}
