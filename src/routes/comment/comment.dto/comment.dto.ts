import z4 from 'zod/v4'
import { createZodDto } from 'nestjs-zod'

export const CreateCommentBodySchema = z4.object({
  content: z4.string().min(1, 'Nội dung bình luận không được để trống').max(5000, 'Nội dung tối đa 5000 ký tự'),
  parentId: z4.string().nullable().optional(),
})

export type CreateCommentBodyType = z4.infer<typeof CreateCommentBodySchema>
export class CreateCommentBodyDTO extends createZodDto(CreateCommentBodySchema) {}

export const UpdateCommentBodySchema = z4.object({
  content: z4.string().min(1, 'Nội dung bình luận không được để trống').max(5000, 'Nội dung tối đa 5000 ký tự'),
})

export type UpdateCommentBodyType = z4.infer<typeof UpdateCommentBodySchema>
export class UpdateCommentBodyDTO extends createZodDto(UpdateCommentBodySchema) {}

// ==================== Query Params ====================
export const CommentQuerySchema = z4.object({
  page: z4.coerce.number().int().min(1).default(1),
  limit: z4.coerce.number().int().min(1).max(50).default(10),
})

export type CommentQueryType = z4.infer<typeof CommentQuerySchema>
export class CommentQueryDTO extends createZodDto(CommentQuerySchema) {}
