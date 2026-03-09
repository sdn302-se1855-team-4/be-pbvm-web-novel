import { Test, TestingModule } from '@nestjs/testing'
import { BookmarkService } from './bookmark.service'
import { PrismaService } from 'src/shared/services/prisma.service'
import { ConflictException, NotFoundException } from '@nestjs/common'

describe('BookmarkService', () => {
  let service: BookmarkService
  let prisma: PrismaService

  const mockPrismaService = {
    story: {
      findUnique: jest.fn(),
    },
    bookmark: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BookmarkService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile()

    service = module.get<BookmarkService>(BookmarkService)
    prisma = module.get<PrismaService>(PrismaService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('bookmark', () => {
    it('should throw NotFoundException if story not found', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue(null)
      await expect(service.bookmark('u', 's')).rejects.toThrow(NotFoundException)
    })

    it('should throw ConflictException if already bookmarked', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({ id: 's' })
      mockPrismaService.bookmark.findUnique.mockResolvedValue({ userId: 'u', storyId: 's' })
      await expect(service.bookmark('u', 's')).rejects.toThrow(ConflictException)
    })

    it('should create a bookmark', async () => {
      mockPrismaService.story.findUnique.mockResolvedValue({ id: 's' })
      mockPrismaService.bookmark.findUnique.mockResolvedValue(null)
      const result = await service.bookmark('u', 's')
      expect(result.message).toBe('Bookmark thành công')
      expect(prisma.bookmark.create).toHaveBeenCalled()
    })
  })

  describe('unbookmark', () => {
    it('should throw NotFoundException if not bookmarked', async () => {
      mockPrismaService.bookmark.findUnique.mockResolvedValue(null)
      await expect(service.unbookmark('u', 's')).rejects.toThrow(NotFoundException)
    })

    it('should delete bookmark', async () => {
      mockPrismaService.bookmark.findUnique.mockResolvedValue({ userId: 'u', storyId: 's' })
      const result = await service.unbookmark('u', 's')
      expect(result.message).toBe('Xóa bookmark thành công')
      expect(prisma.bookmark.delete).toHaveBeenCalled()
    })
  })

  describe('getMyBookmarks', () => {
    it('should return bookmarked stories', async () => {
      mockPrismaService.bookmark.findMany.mockResolvedValue([{ story: { id: 's' } }])
      mockPrismaService.bookmark.count.mockResolvedValue(1)
      const result = await service.getMyBookmarks('u')
      expect(result.data[0].id).toBe('s')
      expect(result.pagination.total).toBe(1)
    })
  })

  describe('isBookmarked', () => {
    it('should return true if bookmarked', async () => {
      mockPrismaService.bookmark.findUnique.mockResolvedValue({ id: 'b' })
      const result = await service.isBookmarked('u', 's')
      expect(result.isBookmarked).toBe(true)
    })

    it('should return false if not bookmarked', async () => {
      mockPrismaService.bookmark.findUnique.mockResolvedValue(null)
      const result = await service.isBookmarked('u', 's')
      expect(result.isBookmarked).toBe(false)
    })
  })
})
