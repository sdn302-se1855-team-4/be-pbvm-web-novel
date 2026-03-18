import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
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
import { InjectQueue } from '@nestjs/bullmq'
import { MAIL_JOBS, MAIL_QUEUE } from 'src/shared/queues/mail.queue'
import { Queue } from 'bullmq'
import { ChangePasswordBodyType, ResetPasswordBodyType } from './auth.dto/auth.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly hashingService: HashingService,
    private readonly firebaseService: FirebaseService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    @InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue,
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
    const isEmail = body.email.includes('@')
    const user = await this.prisma.user.findFirst({
      where: isEmail ? { email: body.email } : { username: body.email },
    })

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email/username hoặc mật khẩu không đúng')
    }

    const isPasswordValid = await this.hashingService.compare(body.password, user.passwordHash)
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email/username hoặc mật khẩu không đúng')
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin để biết thêm chi tiết.')
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

    // Validate jti exists and belongs to this user
    if (oldJti) {
      const jtiKey = REFRESH_TOKEN_JTI_KEY(oldJti)
      const storedUserId = await this.redisService.get<string>(jtiKey)

      if (!storedUserId) {
        throw new UnauthorizedException('Refresh token đã bị thu hồi hoặc hết hạn')
      }

      if (storedUserId !== userId) {
        // Potential token theft or logical error
        throw new UnauthorizedException('Refresh token không hợp lệ cho người dùng này')
      }

      // Remove old jti (token rotation)
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

      if (user.isBlocked) {
        throw new UnauthorizedException('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin để biết thêm chi tiết.')
      }
    } else {
      // 3. Create new user with generated credentials
      const username = email.split('@')[0]
      // Ensure username is unique by checking or adding a suffix if needed
      let finalUsername = username
      const existingUserByUsername = await this.prisma.user.findUnique({ where: { username } })
      if (existingUserByUsername) {
        finalUsername = `${username}_${uid.slice(0, 4)}`
      }

      const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4)
      const passwordHash = await this.hashingService.hash(tempPassword)

      user = await this.prisma.user.create({
        data: {
          email,
          username: finalUsername,
          passwordHash,
          googleId: uid,
          displayName: name || email.split('@')[0],
          avatar: picture || null,
          emailVerified: new Date(),
          lastLoginAt: new Date(),
        },
      })

      // Queue email with credentials
      await this.mailQueue.add(MAIL_JOBS.SEND_GOOGLE_WELCOME_CREDENTIALS, {
        email,
        username: finalUsername,
        password: tempPassword,
        displayName: user.displayName,
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
      Date.now(),
    )

    return { accessToken, refreshToken: refreshResult.token }
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) {
      // Don't reveal if user exists for security, just return success
      return { message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.' }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const resetKey = `password-reset-otp:${email}`

    // Store OTP in Redis with 15min expiry
    await this.redisService.set(resetKey, { userId: user.id, otp }, 900)

    // Add email job to queue
    await this.mailQueue.add(MAIL_JOBS.SEND_FORGOT_PASSWORD, {
      email,
      otp,
      displayName: user.displayName || user.username,
    })

    return { message: 'Mã OTP đã được gửi đến email của bạn' }
  }

  async resetPassword(body: ResetPasswordBodyType) {
    const resetKey = `password-reset-otp:${body.email}`
    const data = await this.redisService.get<{ userId: string; otp: string }>(resetKey)

    if (!data || data.otp !== body.otp) {
      throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn')
    }

    const passwordHash = await this.hashingService.hash(body.newPassword)

    await this.prisma.user.update({
      where: { id: data.userId },
      data: { passwordHash },
    })

    await this.redisService.del(resetKey)

    return { message: 'Đặt lại mật khẩu thành công' }
  }

  async changePassword(userId: string, body: ChangePasswordBodyType) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Người dùng không hợp lệ')
    }

    const isMatch = await this.hashingService.compare(body.oldPassword, user.passwordHash)
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu cũ không chính xác')
    }

    const passwordHash = await this.hashingService.hash(body.newPassword)

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    })

    return { message: 'Đổi mật khẩu thành công' }
  }
}
