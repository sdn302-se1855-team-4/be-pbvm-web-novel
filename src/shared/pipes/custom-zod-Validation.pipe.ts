import { UnprocessableEntityException } from '@nestjs/common'
import { createZodValidationPipe, ZodValidationPipe } from 'nestjs-zod'
import { ZodError } from 'zod'

export const CustomZodValidationPipe: typeof ZodValidationPipe = createZodValidationPipe({
  createValidationException: (error: ZodError) => {
    return new UnprocessableEntityException({
      code: 'VALIDATION_ERROR',
      errors: error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path.join('.'),
      })),
    })
  },
})
