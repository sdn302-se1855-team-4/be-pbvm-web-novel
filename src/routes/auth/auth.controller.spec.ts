import { Test, TestingModule } from '@nestjs/testing'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'

describe('AuthController', () => {
  let controller: AuthController
  let service: AuthService

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    getProfile: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile()

    controller = module.get<AuthController>(AuthController)
    service = module.get<AuthService>(AuthService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('register', () => {
    it('should call authService.register', async () => {
      const dto = { email: 'test@example.com', username: 'test', password: 'password' }
      mockAuthService.register.mockResolvedValue({ user: {}, accessToken: '', refreshToken: '' })
      await controller.register(dto)
      expect(service.register).toHaveBeenCalledWith(dto)
    })
  })

  describe('login', () => {
    it('should call authService.login', async () => {
      const dto = { email: 'test@example.com', password: 'password' }
      mockAuthService.login.mockResolvedValue({ user: {}, accessToken: '', refreshToken: '' })
      await controller.login(dto)
      expect(service.login).toHaveBeenCalledWith(dto)
    })
  })

  describe('refreshToken', () => {
    it('should call authService.refreshToken', async () => {
      const user = { userId: 'user_id' } as any
      mockAuthService.refreshToken.mockResolvedValue({ accessToken: '', refreshToken: '' })
      await controller.refreshToken(user)
      expect(service.refreshToken).toHaveBeenCalledWith(user.userId)
    })
  })

  describe('getProfile', () => {
    it('should call authService.getProfile', async () => {
      const user = { userId: 'user_id' } as any
      mockAuthService.getProfile.mockResolvedValue({})
      await controller.getProfile(user)
      expect(service.getProfile).toHaveBeenCalledWith(user.userId)
    })
  })
})
