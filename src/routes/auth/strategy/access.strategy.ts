import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import envConfig from 'src/shared/config'
import { TokenPayload } from 'src/shared/types/jwt.type'

@Injectable()
export class AccessStrategy extends PassportStrategy(Strategy, 'access-jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: envConfig.ACCESS_TOKEN_SECRET,
    })
  }

  validate(payload: TokenPayload) {
    return {
      userId: payload.userId,
      role: payload.role,
    }
  }
}
