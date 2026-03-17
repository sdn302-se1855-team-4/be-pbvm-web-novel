import z4 from 'zod/v4'
import { createZodDto } from 'nestjs-zod'

export const BasePaginationQuerySchema = z4.object({
  page: z4.coerce.number().int().min(1).default(1),
  limit: z4.coerce.number().int().min(1).max(100).default(10),
  cursor: z4.string().optional(),
})

export const AdminUserQuerySchema = BasePaginationQuerySchema.extend({
  search: z4.string().optional(),
  role: z4.enum(['READER', 'WRITER', 'ADMIN']).optional(),
  sortBy: z4.enum(['createdAt', 'username', 'email']).default('createdAt'),
  sortOrder: z4.enum(['asc', 'desc']).default('desc'),
})

export class AdminUserQueryDTO extends createZodDto(AdminUserQuerySchema) {}

export const AdminStoryQuerySchema = BasePaginationQuerySchema.extend({
  search: z4.string().optional(),
  type: z4.enum(['NOVEL', 'MANGA', 'COMIC', 'LIGHTNOVEL']).optional(),
  status: z4.enum(['ONGOING', 'COMPLETED', 'HIATUS', 'DROPPED']).optional(),
  isPublished: z4.coerce.boolean().optional(),
  sortBy: z4.enum(['createdAt', 'updatedAt', 'viewCount', 'title']).default('createdAt'),
  sortOrder: z4.enum(['asc', 'desc']).default('desc'),
})

export class AdminStoryQueryDTO extends createZodDto(AdminStoryQuerySchema) {}

export const AdminWithdrawalQuerySchema = BasePaginationQuerySchema.extend({
  status: z4.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  sortBy: z4.enum(['createdAt', 'amount']).default('createdAt'),
  sortOrder: z4.enum(['asc', 'desc']).default('desc'),
})

export class AdminWithdrawalQueryDTO extends createZodDto(AdminWithdrawalQuerySchema) {}

export const AdminGenreQuerySchema = BasePaginationQuerySchema.extend({
  search: z4.string().optional(),
})

export class AdminGenreQueryDTO extends createZodDto(AdminGenreQuerySchema) {}

export const AdminTagQuerySchema = BasePaginationQuerySchema.extend({
  search: z4.string().optional(),
})

export class AdminTagQueryDTO extends createZodDto(AdminTagQuerySchema) {}

export const AdminChapterQuerySchema = BasePaginationQuerySchema.extend({
  isPublished: z4.coerce.boolean().optional(),
})

export class AdminChapterQueryDTO extends createZodDto(AdminChapterQuerySchema) {}
