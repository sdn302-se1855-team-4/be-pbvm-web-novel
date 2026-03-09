import { Test, TestingModule } from '@nestjs/testing'
import { FollowController } from './follow.controller'
import { FollowService } from './follow.service'

describe('FollowController', () => {
  let controller: FollowController
  let service: FollowService

  const mockFollowService = {
    follow: jest.fn(),
    unfollow: jest.fn(),
    getFollowing: jest.fn(),
    getFollowers: jest.fn(),
    isFollowing: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FollowController],
      providers: [{ provide: FollowService, useValue: mockFollowService }],
    }).compile()

    controller = module.get<FollowController>(FollowController)
    service = module.get<FollowService>(FollowService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('follow', () => {
    it('should call followService.follow', async () => {
      const user = { userId: 'u1' } as any
      await controller.follow(user, 'u2')
      expect(service.follow).toHaveBeenCalledWith('u1', 'u2')
    })
  })

  describe('unfollow', () => {
    it('should call followService.unfollow', async () => {
      const user = { userId: 'u1' } as any
      await controller.unfollow(user, 'u2')
      expect(service.unfollow).toHaveBeenCalledWith('u1', 'u2')
    })
  })

  describe('getFollowing', () => {
    it('should call followService.getFollowing', async () => {
      const user = { userId: 'u1' } as any
      await controller.getFollowing(user, 1, 20)
      expect(service.getFollowing).toHaveBeenCalledWith('u1', 1, 20)
    })
  })

  describe('getFollowers', () => {
    it('should call followService.getFollowers', async () => {
      const user = { userId: 'u1' } as any
      await controller.getFollowers(user, 1, 20)
      expect(service.getFollowers).toHaveBeenCalledWith('u1', 1, 20)
    })
  })

  describe('isFollowing', () => {
    it('should call followService.isFollowing', async () => {
      const user = { userId: 'u1' } as any
      await controller.isFollowing(user, 'u2')
      expect(service.isFollowing).toHaveBeenCalledWith('u1', 'u2')
    })
  })
})
