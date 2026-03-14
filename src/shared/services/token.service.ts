import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'crypto'
import { TokenPayload } from '../types/jwt.type'

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  signAccessToken(payload: { userId: string; role: string }) {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('auth.accessTokenSecret'),
      expiresIn: this.configService.get<number>('auth.accessTokenExpiresIn'),
      algorithm: 'HS256',
    })
  }

  /**
   * Sign a refresh token with a unique jti (JWT ID).
   * Returns both the token string and the jti for Redis storage.
   */
  async signRefreshToken(payload: { userId: string; role: string }): Promise<{ token: string; jti: string }> {
    const jti = randomUUID()
    const token = await this.jwtService.signAsync(
      { ...payload, jti },
      {
        secret: this.configService.get<string>('auth.refreshTokenSecret'),
        expiresIn: this.configService.get<number>('auth.refreshTokenExpiresIn'),
        algorithm: 'HS256',
      },
    )
    return { token, jti }
  }

  verifyAccessToken(token: string): Promise<TokenPayload> {
    return this.jwtService.verifyAsync(token, {
      secret: this.configService.get<string>('auth.accessTokenSecret'),
    })
  }

  verifyRefreshToken(token: string): Promise<TokenPayload> {
    return this.jwtService.verifyAsync(token, {
      secret: this.configService.get<string>('auth.refreshTokenSecret'),
    })
  }
}
