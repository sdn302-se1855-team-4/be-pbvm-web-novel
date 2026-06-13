import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bullmq'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import { TokenService } from 'src/shared/services/token.service'
import { PrismaService } from 'src/shared/services/prisma.service'
import { HashingService } from 'src/shared/services/hashing.service'
import { FirebaseService } from 'src/shared/services/firebase.service'
import { RedisService } from 'src/shared/services/redis.service'
import { MAIL_QUEUE } from 'src/shared/queues/mail.queue'
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common'

describe('AuthService', () => {
  let service: AuthService
  let prisma: PrismaService
  let hashingService: HashingService
  let tokenService: TokenService

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  }

  const mockHashingService = {
    hash: jest.fn(),
    compare: jest.fn(),
  }

  const mockTokenService = {
    signAccessToken: jest.fn(),
    signRefreshToken: jest.fn(),
  }

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    addRefreshTokenSession: jest.fn(),
    removeRefreshTokenSession: jest.fn(),
  }

  const mockFirebaseService = {
    verifyIdToken: jest.fn(),
  }

  const mockConfigService = {
    get: jest.fn().mockReturnValue(86400),
  }

  const mockMailQueue = {
    add: jest.fn(),
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    mockConfigService.get.mockReturnValue(86400)

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: HashingService, useValue: mockHashingService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: FirebaseService, useValue: mockFirebaseService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getQueueToken(MAIL_QUEUE), useValue: mockMailQueue },
      ],
    }).compile()

    service = module.get<AuthService>(AuthService)
    prisma = module.get<PrismaService>(PrismaService)
    hashingService = module.get<HashingService>(HashingService)
    tokenService = module.get<TokenService>(TokenService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('register', () => {
    const registerDto = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
      confirmPassword: 'password123',
      displayName: 'Test User',
    }

    it('should throw ConflictException if email exists', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ email: registerDto.email })
      await expect(service.register(registerDto)).rejects.toThrow(ConflictException)
    })

    it('should throw ConflictException if username exists', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ username: registerDto.username })
      await expect(service.register(registerDto)).rejects.toThrow(ConflictException)
    })

    it('should stash a pending registration, queue an OTP email and NOT create the user', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null)
      mockHashingService.hash.mockResolvedValue('hashed_password')

      const result = await service.register(registerDto)

      expect(prisma.user.create).not.toHaveBeenCalled()
      expect(mockRedisService.set).toHaveBeenCalledWith(
        `register-otp:${registerDto.email}`,
        expect.objectContaining({ email: registerDto.email, passwordHash: 'hashed_password', otp: expect.any(String) }),
        expect.any(Number),
      )
      expect(mockMailQueue.add).toHaveBeenCalledWith(
        'send_register_otp',
        expect.objectContaining({ email: registerDto.email, otp: expect.any(String) }),
      )
      expect(result.email).toBe(registerDto.email)
    })
  })

  describe('verifyRegister', () => {
    const pending = {
      email: 'test@example.com',
      username: 'testuser',
      passwordHash: 'hashed_password',
      displayName: 'Test User',
      role: 'READER',
      otp: '123456',
    }

    it('should throw BadRequestException if no pending registration / OTP expired', async () => {
      mockRedisService.get.mockResolvedValue(null)
      await expect(service.verifyRegister({ email: pending.email, otp: '123456' })).rejects.toThrow(BadRequestException)
    })

    it('should throw BadRequestException if OTP is incorrect', async () => {
      mockRedisService.get.mockResolvedValue(pending)
      await expect(service.verifyRegister({ email: pending.email, otp: '000000' })).rejects.toThrow(BadRequestException)
    })

    it('should create a verified user and return tokens when OTP matches', async () => {
      mockRedisService.get.mockResolvedValue(pending)
      mockPrismaService.user.findFirst.mockResolvedValue(null)
      const mockUser = { id: 'user_id', ...pending }
      mockPrismaService.user.create.mockResolvedValue(mockUser)
      mockTokenService.signAccessToken.mockResolvedValue('access_token')
      mockTokenService.signRefreshToken.mockResolvedValue({ token: 'refresh_token', jti: 'jti_1' })

      const result = await service.verifyRegister({ email: pending.email, otp: '123456' })

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: pending.email, emailVerified: expect.any(Date) }),
        }),
      )
      expect(mockRedisService.del).toHaveBeenCalledWith(`register-otp:${pending.email}`)
      expect(result.user.id).toBe(mockUser.id)
      expect(result.accessToken).toBe('access_token')
      expect(result.refreshToken).toBe('refresh_token')
    })
  })

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'password123',
    }

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null)
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException)
    })

    it('should throw UnauthorizedException if password invalid', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ passwordHash: 'hashed_password' })
      mockHashingService.compare.mockResolvedValue(false)
      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException)
    })

    it('should login with email and return tokens', async () => {
      const mockUser = { id: 'user_id', email: loginDto.email, passwordHash: 'hashed_password', role: 'READER' }
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser)
      mockHashingService.compare.mockResolvedValue(true)
      mockPrismaService.user.update.mockResolvedValue(mockUser)
      mockTokenService.signAccessToken.mockResolvedValue('access_token')
      mockTokenService.signRefreshToken.mockResolvedValue({ token: 'refresh_token', jti: 'jti' })

      const result = await service.login(loginDto)

      expect(result.user.id).toBe(mockUser.id)
      expect(result.accessToken).toBe('access_token')
      expect(result.refreshToken).toBe('refresh_token')
    })

    it('should login with username and return tokens', async () => {
      const loginWithUsernameDto = { email: 'testuser', password: 'password123' }
      const mockUser = { id: 'user_id', username: 'testuser', passwordHash: 'hashed_password', role: 'READER' }
      mockPrismaService.user.findFirst.mockResolvedValue(mockUser)
      mockHashingService.compare.mockResolvedValue(true)
      mockPrismaService.user.update.mockResolvedValue(mockUser)
      mockTokenService.signAccessToken.mockResolvedValue('access_token')
      mockTokenService.signRefreshToken.mockResolvedValue({ token: 'refresh_token', jti: 'jti' })

      const result = await service.login(loginWithUsernameDto)

      expect(result.user.id).toBe(mockUser.id)
      expect(result.accessToken).toBe('access_token')
      expect(result.refreshToken).toBe('refresh_token')
    })
  })

  describe('refreshToken', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null)
      await expect(service.refreshToken('user_id')).rejects.toThrow(UnauthorizedException)
    })

    it('should return new tokens', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user_id', role: 'USER' })
      mockTokenService.signAccessToken.mockResolvedValue('new_access_token')
      mockTokenService.signRefreshToken.mockResolvedValue({ token: 'new_refresh_token', jti: 'jti_2' })

      const result = await service.refreshToken('user_id')

      expect(result.accessToken).toBe('new_access_token')
      expect(result.refreshToken).toBe('new_refresh_token')
    })
  })

  describe('getProfile', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null)
      await expect(service.getProfile('user_id')).rejects.toThrow(UnauthorizedException)
    })

    it('should return user profile', async () => {
      const mockProfile = { id: 'user_id', email: 'test@example.com' }
      mockPrismaService.user.findUnique.mockResolvedValue(mockProfile)

      const result = await service.getProfile('user_id')

      expect(result).toEqual(mockProfile)
    })
  })
})
