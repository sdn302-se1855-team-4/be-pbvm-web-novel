import z4 from 'zod/v4'
import { createZodDto } from 'nestjs-zod'

// ==================== Create Chapter ====================
export const CreateChapterBodySchema = z4.object({
  title: z4.string().min(1, 'Tiêu đề không được để trống').max(200, 'Tiêu đề tối đa 200 ký tự'),
  slug: z4.string().min(1, 'Slug không được để trống'),
  chapterNumber: z4.coerce.number().int().min(1, 'Số chương phải >= 1'),
  content: z4.any(),
  isPublished: z4.boolean().default(false),
  isPremium: z4.boolean().default(false),
  price: z4.coerce.number().int().min(0).default(0),
  wordCount: z4.coerce.number().int().min(0).default(0),
})

export type CreateChapterBodyType = z4.infer<typeof CreateChapterBodySchema>
export class CreateChapterBodyDTO extends createZodDto(CreateChapterBodySchema) {}

// ==================== Update Chapter ====================
export const UpdateChapterBodySchema = z4.object({
  title: z4.string().min(1).max(200).optional(),
  slug: z4.string().min(1).optional(),
  content: z4.any().optional(),
  isPublished: z4.boolean().optional(),
  isPremium: z4.boolean().optional(),
  price: z4.coerce.number().int().min(0).optional(),
  wordCount: z4.coerce.number().int().min(0).optional(),
})

export type UpdateChapterBodyType = z4.infer<typeof UpdateChapterBodySchema>
export class UpdateChapterBodyDTO extends createZodDto(UpdateChapterBodySchema) {}
