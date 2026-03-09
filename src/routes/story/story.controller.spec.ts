import { Test, TestingModule } from '@nestjs/testing'
import { StoryController } from './story.controller'
import { StoryService } from './story.service'

describe('StoryController', () => {
  let controller: StoryController
  let service: StoryService

  const mockStoryService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findAllGenres: jest.fn(),
    findAllTags: jest.fn(),
    getMyStories: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoryController],
      providers: [{ provide: StoryService, useValue: mockStoryService }],
    }).compile()

    controller = module.get<StoryController>(StoryController)
    service = module.get<StoryService>(StoryService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('create', () => {
    it('should call storyService.create', async () => {
      const dto = { title: 'Test' } as any
      const user = { userId: 'user_id' } as any
      await controller.create(user, dto)
      expect(service.create).toHaveBeenCalledWith(user.userId, dto)
    })
  })

  describe('findAll', () => {
    it('should call storyService.findAll', async () => {
      const query = {} as any
      await controller.findAll(query)
      expect(service.findAll).toHaveBeenCalledWith(query)
    })
  })

  describe('findOne', () => {
    it('should call storyService.findOne', async () => {
      await controller.findOne('id')
      expect(service.findOne).toHaveBeenCalledWith('id')
    })
  })

  describe('update', () => {
    it('should call storyService.update', async () => {
      const dto = { title: 'Updated' } as any
      const user = { userId: 'user_id', role: 'USER' } as any
      await controller.update('id', user, dto)
      expect(service.update).toHaveBeenCalledWith('id', user.userId, user.role, dto)
    })
  })

  describe('delete', () => {
    it('should call storyService.delete', async () => {
      const user = { userId: 'user_id', role: 'USER' } as any
      await controller.delete('id', user)
      expect(service.delete).toHaveBeenCalledWith('id', user.userId, user.role)
    })
  })
})
