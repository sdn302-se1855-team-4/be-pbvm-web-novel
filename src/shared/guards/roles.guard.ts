// src/shared/guards/roles.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '../decorators/roles.decorator'

import { Request } from 'express'
import { RoleType } from '../constants/role.constants'
import { ERROR_CODE } from '../constants/error.constants'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleType[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // Không yêu cầu role → cho qua
    if (!requiredRoles || requiredRoles.length === 0) return true

    const request = context.switchToHttp().getRequest<Request>()
    const user = request.user

    // Chưa login
    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODE.FORBIDDEN_ROLE,
        message: 'User is not authenticated',
      })
    }
    if (!requiredRoles.includes(user.role as RoleType)) {
      throw new ForbiddenException({
        code: ERROR_CODE.FORBIDDEN_ROLE,
        message: 'You do not have permission to access this resource',
        requiredRoles,
        currentRole: user.role as RoleType,
      })
    }

    return true
  }
}
