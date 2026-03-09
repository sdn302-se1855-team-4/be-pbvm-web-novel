import { Test, TestingModule } from '@nestjs/testing'
import { ChapterService } from './chapter.service'
import { PrismaService } from 'src/shared/services/prisma.service'
import { ForbiddenException, NotFoundException } from '@nestjs/common'

describe('ChapterService', () => {
  let service: ChapterService
  let prisma: PrismaService

  const mockPrismaService = {
    story: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    chapter: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChapterService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile()

    service = module.get<ChapterService>(ChapterService)
    prisma = module.get<PrismaService>(PrismaService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('create', () => {
    it('should throw NotFoundException if story not found', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(null)
      await expect(service.create('story_id', 'author_id', 'USER', {} as any)).rejects.toThrow(NotFoundException)
    })

    it('should throw ForbiddenException if user is not author or admin', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({ authorId: 'other' })
      await expect(service.create('story_id', 'user', 'USER', {} as any)).rejects.toThrow(ForbiddenException)
    })

    it('should create a chapter and update totalChapters', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({ authorId: 'user' })
      mockPrismaService.chapter.create.mockResolvedValue({ id: 'chapter_id' })
      await service.create('story_id', 'user', 'USER', { title: 'Chapter 1' } as any)
      expect(prisma.chapter.create).toHaveBeenCalled()
      expect(prisma.story.update).toHaveBeenCalled()
    })
  })

  describe('findAllByStory', () => {
    it('should return chapters for a story', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({ id: 'story_id' })
      mockPrismaService.chapter.findMany.mockResolvedValue([])
      const result = await service.findAllByStory('story_id')
      expect(result).toEqual([])
    })
  })

  describe('findOne', () => {
    it('should throw NotFoundException if chapter not found', async () => {
      mockPrismaService.chapter.findUnique.mockResolvedValue(null)
      await expect(service.findOne('story_id', 1)).rejects.toThrow(NotFoundException)
    })

    it('should return chapter with navigation', async () => {
      const mockChapter = { id: 'id', storyId: 's', chapterNumber: 1 }
      mockPrismaService.chapter.findUnique.mockResolvedValue(mockChapter)
      mockPrismaService.chapter.update.mockResolvedValue(mockChapter)
      mockPrismaService.chapter.findFirst.mockResolvedValue(null) // for prev/next
      const result = await service.findOne('s', 1)
      expect(result.id).toBe('id')
      expect(prisma.chapter.update).toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('should update chapter', async () => {
      mockPrismaService.chapter.findUnique.mockResolvedValue({ id: 'id', story: { authorId: 'user' } })
      mockPrismaService.chapter.update.mockResolvedValue({ id: 'id' })
      await service.update('s', 1, 'user', 'USER', {} as any)
      expect(prisma.chapter.update).toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('should delete chapter and update totalChapters', async () => {
      mockPrismaService.chapter.findUnique.mockResolvedValue({ id: 'id', story: { authorId: 'user' } })
      await service.delete('s', 1, 'user', 'USER')
      expect(prisma.chapter.delete).toHaveBeenCalled()
      expect(prisma.story.update).toHaveBeenCalled()
    })
  })
})
