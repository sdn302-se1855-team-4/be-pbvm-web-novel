import z4 from 'zod/v4'
import { createZodDto } from 'nestjs-zod'

// ==================== Create Story ====================
export const CreateStoryBodySchema = z4.object({
  title: z4.string().min(1, 'Tiêu đề không được để trống').max(200, 'Tiêu đề tối đa 200 ký tự'),
  slug: z4.string().min(1, 'Slug không được để trống').max(200, 'Slug tối đa 200 ký tự'),
  description: z4.string().min(1, 'Mô tả không được để trống'),
  coverImage: z4.string().optional(),
  type: z4.enum(['NOVEL', 'MANGA', 'COMIC', 'LIGHTNOVEL']).default('NOVEL'),
  status: z4.enum(['ONGOING', 'COMPLETED', 'HIATUS', 'DROPPED']).default('ONGOING'),
  genreIds: z4.array(z4.string()).optional(),
  tagIds: z4.array(z4.string()).optional(),
  isPublished: z4.boolean().default(false),
})

export type CreateStoryBodyType = z4.infer<typeof CreateStoryBodySchema>
export class CreateStoryBodyDTO extends createZodDto(CreateStoryBodySchema) {}

// ==================== Update Story ====================
export const UpdateStoryBodySchema = z4.object({
  title: z4.string().min(1).max(200).optional(),
  slug: z4.string().min(1).max(200).optional(),
  description: z4.string().min(1).optional(),
  coverImage: z4.string().optional(),
  type: z4.enum(['NOVEL', 'MANGA', 'COMIC', 'LIGHTNOVEL']).optional(),
  status: z4.enum(['ONGOING', 'COMPLETED', 'HIATUS', 'DROPPED']).optional(),
  genreIds: z4.array(z4.string()).optional(),
  tagIds: z4.array(z4.string()).optional(),
  isPublished: z4.boolean().optional(),
})

export type UpdateStoryBodyType = z4.infer<typeof UpdateStoryBodySchema>
export class UpdateStoryBodyDTO extends createZodDto(UpdateStoryBodySchema) {}

// ==================== Query Params ====================
export const StoryQuerySchema = z4.object({
  page: z4.coerce.number().int().min(1).default(1),
  limit: z4.coerce.number().int().min(1).max(50).default(10),
  search: z4.string().optional(),
  type: z4.enum(['NOVEL', 'MANGA', 'COMIC', 'LIGHTNOVEL']).optional(),
  status: z4.enum(['ONGOING', 'COMPLETED', 'HIATUS', 'DROPPED']).optional(),
  genreId: z4.string().optional(),
  sortBy: z4.enum(['createdAt', 'updatedAt', 'viewCount', 'rating', 'title']).default('createdAt'),
  sortOrder: z4.enum(['asc', 'desc']).default('desc'),
})

export type StoryQueryType = z4.infer<typeof StoryQuerySchema>
export class StoryQueryDTO extends createZodDto(StoryQuerySchema) {}
