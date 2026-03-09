import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Request } from 'express'

export const ActiveUser = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>()
  const user = request.user as Record<string, any>
  if (!user) return undefined
  const key = data === 'sub' ? 'userId' : data
  return key ? user[key] : user
})
