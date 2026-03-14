import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { TokenService } from 'src/shared/services/token.service'
import { PrismaService } from 'src/shared/services/prisma.service'
import { HashingService } from 'src/shared/services/hashing.service'
import { FirebaseService } from 'src/shared/services/firebase.service'
import { RedisService } from 'src/shared/services/redis.service'
import { ConfigService } from '@nestjs/config'
import { RegisterBodyType, LoginBodyType } from './auth.dto/auth.dto'
import {
  MAX_SESSIONS_PER_USER,
  REFRESH_TOKEN_SESSIONS_KEY,
  REFRESH_TOKEN_JTI_KEY,
} from 'src/shared/constants/redis-keys.constant'

@Injectable()
export class AuthService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly hashingService: HashingService,
    private readonly firebaseService: FirebaseService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async register(body: RegisterBodyType) {
    // Check email/username uniqueness
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: body.email }, { username: body.username }],
      },
    })
    if (existingUser) {
      if (existingUser.email === body.email) {
        throw new ConflictException('Email đã được sử dụng')
      }
      throw new ConflictException('Username đã được sử dụng')
    }

    const passwordHash = await this.hashingService.hash(body.password)

    const user = await this.prisma.user.create({
      data: {
        email: body.email,
        username: body.username,
        passwordHash,
        displayName: body.displayName || body.username,
        role: body.role || 'READER',
      },
    })

    const tokens = await this.generateTokens({ userId: user.id, role: user.role })
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
      ...tokens,
    }
  }

  async login(body: LoginBodyType) {
    const user = await this.prisma.user.findUnique({
      where: { email: body.email },
    })
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng')
    }

    const isPasswordValid = await this.hashingService.compare(body.password, user.passwordHash)
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng')
    }

    // Update lastLoginAt
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const tokens = await this.generateTokens({ userId: user.id, role: user.role })
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        role: user.role,
      },
      ...tokens,
    }
  }

  async refreshToken(userId: string, oldJti?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })
    if (!user) {
      throw new UnauthorizedException('User không tồn tại')
    }

    // Validate old jti exists in Redis (token reuse detection)
    if (oldJti) {
      const jtiKey = REFRESH_TOKEN_JTI_KEY(oldJti)
      const exists = await this.redisService.exists(jtiKey)
      if (!exists) {
        throw new UnauthorizedException('Refresh token đã bị thu hồi hoặc hết hạn')
      }

      // Remove old jti (token rotation: old token is invalidated)
      const sessionsKey = REFRESH_TOKEN_SESSIONS_KEY(userId)
      await this.redisService.removeRefreshTokenSession(sessionsKey, jtiKey, oldJti)
    }

    return this.generateTokens({ userId: user.id, role: user.role })
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatar: true,
        bio: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            stories: true,
            followers: true,
            following: true,
          },
        },
      },
    })
    if (!user) {
      throw new UnauthorizedException('User không tồn tại')
    }
    return user
  }

  async googleLogin(idToken: string) {
    // 1. Verify Firebase ID token
    let decodedToken: Awaited<ReturnType<FirebaseService['verifyIdToken']>>
    try {
      decodedToken = await this.firebaseService.verifyIdToken(idToken)
    } catch {
      throw new UnauthorizedException('Google token không hợp lệ')
    }

    const { uid, email, name, picture } = decodedToken
    if (!email) {
      throw new UnauthorizedException('Tài khoản Google không có email')
    }

    // 2. Find user by googleId or email
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: uid }, { email }] },
    })

    if (user) {
      if (!user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: uid,
            avatar: user.avatar || picture || null,
            emailVerified: new Date(),
            lastLoginAt: new Date(),
          },
        })
      } else {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })
      }
    } else {
      // 3. Create new user
      const username = email.split('@')[0] + '_' + uid.slice(0, 6)
      user = await this.prisma.user.create({
        data: {
          email,
          username,
          googleId: uid,
          displayName: name || email.split('@')[0],
          avatar: picture || null,
          emailVerified: new Date(),
          lastLoginAt: new Date(),
        },
      })
    }

    const tokens = await this.generateTokens({ userId: user.id, role: user.role })
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        role: user.role,
      },
      ...tokens,
    }
  }

  /**
   * Logout: invalidate the refresh token by jti.
   */
  async logout(userId: string, jti?: string) {
    if (jti) {
      const sessionsKey = REFRESH_TOKEN_SESSIONS_KEY(userId)
      const jtiKey = REFRESH_TOKEN_JTI_KEY(jti)
      await this.redisService.removeRefreshTokenSession(sessionsKey, jtiKey, jti)
    }
    return { message: 'Đăng xuất thành công' }
  }

  private async generateTokens(payload: { userId: string; role: string }) {
    const [accessToken, refreshResult] = await Promise.all([
      this.tokenService.signAccessToken(payload),
      this.tokenService.signRefreshToken(payload),
    ])

    // Store refresh token jti in Redis atomically (max 3 devices)
    const sessionsKey = REFRESH_TOKEN_SESSIONS_KEY(payload.userId)
    const jtiKey = REFRESH_TOKEN_JTI_KEY(refreshResult.jti)

    const expiresInSec = this.configService.get<number>('auth.refreshTokenExpiresIn') || 86400

    await this.redisService.addRefreshTokenSession(
      sessionsKey,
      jtiKey,
      refreshResult.jti,
      payload.userId,
      MAX_SESSIONS_PER_USER,
      expiresInSec,
    )

    return { accessToken, refreshToken: refreshResult.token }
  }
}
