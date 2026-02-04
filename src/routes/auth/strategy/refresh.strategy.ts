import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import envConfig from 'src/shared/config'
import { TokenPayload } from 'src/shared/types/jwt.type'

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'refresh-jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: envConfig.REFRESH_TOKEN_SECRET,
    })
  }

  validate(payload: TokenPayload) {
    return {
      userId: payload.userId,
      role: payload.roles,
    }
  }
}
