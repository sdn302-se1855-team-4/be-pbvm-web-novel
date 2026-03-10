import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class OptionalAuthGuard extends AuthGuard('access-jwt') {
  handleRequest<TUser = any>(err: any, user: any): TUser {
    // Return null instead of throwing an error if no user is found
    return (user || null) as TUser
  }
}
