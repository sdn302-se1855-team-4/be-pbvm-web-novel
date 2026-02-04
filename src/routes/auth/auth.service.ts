import { Injectable } from '@nestjs/common'
import { TokenService } from 'src/shared/services/token.service'
import { TokenPayload } from 'src/shared/types/jwt.type'

@Injectable()
export class AuthService {
  constructor(private readonly tokenService: TokenService) {}
  async generateTokens(payload: TokenPayload) {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken(payload),
      this.tokenService.signRefreshToken(payload),
    ])
    const decodedRefreshToken = await this.tokenService.verifyRefreshToken(refreshToken)
    return { accessToken, refreshToken, decodedRefreshToken }
  }
}
