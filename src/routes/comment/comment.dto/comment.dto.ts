import z4 from 'zod/v4'
import { createZodDto } from 'nestjs-zod'

export const CreateCommentBodySchema = z4.object({
  content: z4.string().min(1, 'Nội dung bình luận không được để trống').max(5000, 'Nội dung tối đa 5000 ký tự'),
  parentId: z4.string().optional(),
})

export type CreateCommentBodyType = z4.infer<typeof CreateCommentBodySchema>
export class CreateCommentBodyDTO extends createZodDto(CreateCommentBodySchema) {}

export const UpdateCommentBodySchema = z4.object({
  content: z4.string().min(1, 'Nội dung bình luận không được để trống').max(5000, 'Nội dung tối đa 5000 ký tự'),
})

export type UpdateCommentBodyType = z4.infer<typeof UpdateCommentBodySchema>
export class UpdateCommentBodyDTO extends createZodDto(UpdateCommentBodySchema) {}
