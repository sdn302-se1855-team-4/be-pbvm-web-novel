import { Test, TestingModule } from '@nestjs/testing'
import { StoryService } from './story.service'
import { PrismaService } from 'src/shared/services/prisma.service'
import { ForbiddenException, NotFoundException } from '@nestjs/common'

describe('StoryService', () => {
  let service: StoryService
  let prisma: PrismaService

  const mockPrismaService = {
    story: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    storyGenre: {
      deleteMany: jest.fn(),
    },
    storyTag: {
      deleteMany: jest.fn(),
    },
    genre: {
      findMany: jest.fn(),
    },
    tag: {
      findMany: jest.fn(),
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StoryService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile()

    service = module.get<StoryService>(StoryService)
    prisma = module.get<PrismaService>(PrismaService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('create', () => {
    it('should create a story', async () => {
      const dto = { title: 'Test Story', description: 'Test', genreIds: [], tagIds: [] } as any
      mockPrismaService.story.create.mockResolvedValue({ id: 'story_id', ...dto })
      const result = await service.create('author_id', dto)
      expect(result.id).toBe('story_id')
      expect(prisma.story.create).toHaveBeenCalled()
    })
  })

  describe('findAll', () => {
    it('should return stories with pagination', async () => {
      const query = { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' } as any
      mockPrismaService.story.findMany.mockResolvedValue([])
      mockPrismaService.story.count.mockResolvedValue(0)
      const result = await service.findAll(query)
      expect(result.data).toEqual([])
      expect(result.pagination.total).toBe(0)
    })
  })

  describe('findOne', () => {
    it('should throw NotFoundException if story not found', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(null)
      await expect(service.findOne('id')).rejects.toThrow(NotFoundException)
    })

    it('should return story and increment view count', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({ id: 'id' })
      mockPrismaService.story.update.mockResolvedValue({ id: 'id' })
      const result = await service.findOne('id')
      expect(result.id).toBe('id')
      expect(prisma.story.update).toHaveBeenCalledWith({
        where: { id: 'id' },
        data: { viewCount: { increment: 1 } },
      })
    })
  })

  describe('update', () => {
    it('should throw ForbiddenException if user is not author or admin', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({ authorId: 'other' })
      await expect(service.update('id', 'user', 'USER', {})).rejects.toThrow(ForbiddenException)
    })

    it('should update story', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({ authorId: 'user' })
      mockPrismaService.story.update.mockResolvedValue({ id: 'id', title: 'Updated' })
      const result = await service.update('id', 'user', 'USER', { title: 'Updated' })
      expect(result.title).toBe('Updated')
    })
  })

  describe('delete', () => {
    it('should delete story', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({ authorId: 'user' })
      mockPrismaService.story.delete.mockResolvedValue({ id: 'id' })
      const result = await service.delete('id', 'user', 'USER')
      expect(result.message).toBe('Xóa truyện thành công')
    })
  })
})
