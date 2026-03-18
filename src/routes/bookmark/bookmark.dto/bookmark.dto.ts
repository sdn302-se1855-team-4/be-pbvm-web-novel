import z4 from 'zod/v4'
import { createZodDto } from 'nestjs-zod'

export const BookmarkQuerySchema = z4.object({
  page: z4.coerce.number().int().min(1).default(1),
  limit: z4.coerce.number().int().min(1).max(50).default(10),
})

export type BookmarkQueryType = z4.infer<typeof BookmarkQuerySchema>
export class BookmarkQueryDTO extends createZodDto(BookmarkQuerySchema) {}
