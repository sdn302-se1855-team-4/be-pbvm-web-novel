import { Test, TestingModule } from '@nestjs/testing'
import { FollowService } from './follow.service'
import { PrismaService } from 'src/shared/services/prisma.service'
import { ConflictException, NotFoundException } from '@nestjs/common'

describe('FollowService', () => {
  let service: FollowService
  let prisma: PrismaService

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    follow: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FollowService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile()

    service = module.get<FollowService>(FollowService)
    prisma = module.get<PrismaService>(PrismaService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('follow', () => {
    it('should throw ConflictException if follower follows themselves', async () => {
      await expect(service.follow('u1', 'u1')).rejects.toThrow(ConflictException)
    })

    it('should throw NotFoundException if target user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null)
      await expect(service.follow('u1', 'u2')).rejects.toThrow(NotFoundException)
    })

    it('should throw ConflictException if already following', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'u2' })
      mockPrismaService.follow.findUnique.mockResolvedValue({ followerId: 'u1', followingId: 'u2' })
      await expect(service.follow('u1', 'u2')).rejects.toThrow(ConflictException)
    })

    it('should follow a user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'u2' })
      mockPrismaService.follow.findUnique.mockResolvedValue(null)
      const result = await service.follow('u1', 'u2')
      expect(result.message).toBe('Follow thành công')
      expect(prisma.follow.create).toHaveBeenCalled()
    })
  })

  describe('unfollow', () => {
    it('should throw NotFoundException if not following', async () => {
      mockPrismaService.follow.findUnique.mockResolvedValue(null)
      await expect(service.unfollow('u1', 'u2')).rejects.toThrow(NotFoundException)
    })

    it('should unfollow a user', async () => {
      mockPrismaService.follow.findUnique.mockResolvedValue({ followerId: 'u1', followingId: 'u2' })
      const result = await service.unfollow('u1', 'u2')
      expect(result.message).toBe('Unfollow thành công')
      expect(prisma.follow.delete).toHaveBeenCalled()
    })
  })

  describe('getFollowing', () => {
    it('should return following list', async () => {
      mockPrismaService.follow.findMany.mockResolvedValue([{ following: { id: 'u2' } }])
      mockPrismaService.follow.count.mockResolvedValue(1)
      const result = await service.getFollowing('u1')
      expect(result.data[0].id).toBe('u2')
    })
  })

  describe('isFollowing', () => {
    it('should return true if following', async () => {
      mockPrismaService.follow.findUnique.mockResolvedValue({ id: 'f' })
      const result = await service.isFollowing('u1', 'u2')
      expect(result.isFollowing).toBe(true)
    })
  })
})
