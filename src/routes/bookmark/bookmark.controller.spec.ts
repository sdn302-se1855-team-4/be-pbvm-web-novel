import { Test, TestingModule } from '@nestjs/testing'
import { BookmarkController } from './bookmark.controller'
import { BookmarkService } from './bookmark.service'

describe('BookmarkController', () => {
  let controller: BookmarkController
  let service: BookmarkService

  const mockBookmarkService = {
    bookmark: jest.fn(),
    unbookmark: jest.fn(),
    getMyBookmarks: jest.fn(),
    isBookmarked: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookmarkController],
      providers: [{ provide: BookmarkService, useValue: mockBookmarkService }],
    }).compile()

    controller = module.get<BookmarkController>(BookmarkController)
    service = module.get<BookmarkService>(BookmarkService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('bookmark', () => {
    it('should call bookmarkService.bookmark', async () => {
      const user = { userId: 'u' } as any
      await controller.bookmark(user, 's')
      expect(service.bookmark).toHaveBeenCalledWith('u', 's')
    })
  })

  describe('unbookmark', () => {
    it('should call bookmarkService.unbookmark', async () => {
      const user = { userId: 'u' } as any
      await controller.unbookmark(user, 's')
      expect(service.unbookmark).toHaveBeenCalledWith('u', 's')
    })
  })

  describe('getMyBookmarks', () => {
    it('should call bookmarkService.getMyBookmarks', async () => {
      const user = { userId: 'u' } as any
      await controller.getMyBookmarks(user, 1, 20)
      expect(service.getMyBookmarks).toHaveBeenCalledWith('u', 1, 20)
    })
  })

  describe('isBookmarked', () => {
    it('should call bookmarkService.isBookmarked', async () => {
      const user = { userId: 'u' } as any
      await controller.isBookmarked(user, 's')
      expect(service.isBookmarked).toHaveBeenCalledWith('u', 's')
    })
  })
})
