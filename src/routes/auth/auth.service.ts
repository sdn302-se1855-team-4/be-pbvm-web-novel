import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { TokenService } from 'src/shared/services/token.service'
import { PrismaService } from 'src/shared/services/prisma.service'
import { HashingService } from 'src/shared/services/hashing.service'
import { FirebaseService } from 'src/shared/services/firebase.service'
import { RegisterBodyType, LoginBodyType } from './auth.dto/auth.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
    private readonly hashingService: HashingService,
    private readonly firebaseService: FirebaseService,
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

  async refreshToken(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })
    if (!user) {
      throw new UnauthorizedException('User không tồn tại')
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
      // Update googleId if not set (user registered with email before)
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

  private async generateTokens(payload: { userId: string; role: string }) {
    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.signAccessToken(payload),
      this.tokenService.signRefreshToken(payload),
    ])
    return { accessToken, refreshToken }
  }
}
