import { Test, TestingModule } from '@nestjs/testing'
import { ChapterController } from './chapter.controller'
import { ChapterService } from './chapter.service'

describe('ChapterController', () => {
  let controller: ChapterController
  let service: ChapterService

  const mockChapterService = {
    create: jest.fn(),
    findAllByStory: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChapterController],
      providers: [{ provide: ChapterService, useValue: mockChapterService }],
    }).compile()

    controller = module.get<ChapterController>(ChapterController)
    service = module.get<ChapterService>(ChapterService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('create', () => {
    it('should call chapterService.create', async () => {
      const dto = { title: 'Test' } as any
      const user = { userId: 'u', role: 'USER' } as any
      await controller.create('story_id', user, dto)
      expect(service.create).toHaveBeenCalledWith('story_id', user.userId, user.role, dto)
    })
  })

  describe('findAll', () => {
    it('should call chapterService.findAllByStory', async () => {
      await controller.findAll('story_id')
      expect(service.findAllByStory).toHaveBeenCalledWith('story_id')
    })
  })

  describe('findOne', () => {
    it('should call chapterService.findOne', async () => {
      await controller.findOne('story_id', 1)
      expect(service.findOne).toHaveBeenCalledWith('story_id', 1)
    })
  })

  describe('update', () => {
    it('should call chapterService.update', async () => {
      const dto = { title: 'Updated' } as any
      const user = { userId: 'u', role: 'USER' } as any
      await controller.update('story_id', 1, user, dto)
      expect(service.update).toHaveBeenCalledWith('story_id', 1, user.userId, user.role, dto)
    })
  })

  describe('delete', () => {
    it('should call chapterService.delete', async () => {
      const user = { userId: 'u', role: 'USER' } as any
      await controller.delete('story_id', 1, user)
      expect(service.delete).toHaveBeenCalledWith('story_id', 1, user.userId, user.role)
    })
  })
})
