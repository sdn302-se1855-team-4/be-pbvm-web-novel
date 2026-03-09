import { Test, TestingModule } from '@nestjs/testing'
import { CommentService } from './comment.service'
import { PrismaService } from 'src/shared/services/prisma.service'
import { ForbiddenException, NotFoundException } from '@nestjs/common'

describe('CommentService', () => {
  let service: CommentService
  let prisma: PrismaService

  const mockPrismaService = {
    story: {
      findUnique: jest.fn(),
    },
    comment: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommentService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile()

    service = module.get<CommentService>(CommentService)
    prisma = module.get<PrismaService>(PrismaService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('create', () => {
    it('should throw NotFoundException if story not found', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(null)
      await expect(service.create('s', 'u', { content: 'test' })).rejects.toThrow(NotFoundException)
    })

    it('should create a comment', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({ id: 's' })
      mockPrismaService.comment.create.mockResolvedValue({ id: 'c' })
      const result = await service.create('s', 'u', { content: 'test' })
      expect(result.id).toBe('c')
      expect(prisma.comment.create).toHaveBeenCalled()
    })
  })

  describe('findByStory', () => {
    it('should return comments for a story', async () => {
      mockPrismaService.comment.findMany.mockResolvedValue([])
      mockPrismaService.comment.count.mockResolvedValue(0)
      const result = await service.findByStory('s')
      expect(result.data).toEqual([])
      expect(result.pagination.total).toBe(0)
    })
  })

  describe('update', () => {
    it('should throw ForbiddenException if user is not author', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue({ userId: 'other' })
      await expect(service.update('c', 'u', { content: 'upd' })).rejects.toThrow(ForbiddenException)
    })

    it('should update comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue({ userId: 'u' })
      mockPrismaService.comment.update.mockResolvedValue({ id: 'c', content: 'upd' })
      const result = await service.update('c', 'u', { content: 'upd' })
      expect(result.content).toBe('upd')
    })
  })

  describe('delete', () => {
    it('should delete comment', async () => {
      mockPrismaService.comment.findUnique.mockResolvedValue({ userId: 'u' })
      const result = await service.delete('c', 'u', 'USER')
      expect(result.message).toBe('Xóa comment thành công')
      expect(prisma.comment.delete).toHaveBeenCalled()
    })
  })
})
