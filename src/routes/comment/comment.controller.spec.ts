import { Test, TestingModule } from '@nestjs/testing'
import { CommentController } from './comment.controller'
import { CommentService } from './comment.service'

describe('CommentController', () => {
  let controller: CommentController
  let service: CommentService

  const mockCommentService = {
    create: jest.fn(),
    findByStory: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentController],
      providers: [{ provide: CommentService, useValue: mockCommentService }],
    }).compile()

    controller = module.get<CommentController>(CommentController)
    service = module.get<CommentService>(CommentService)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('create', () => {
    it('should call commentService.create', async () => {
      const dto = { content: 'test' } as any
      const user = { userId: 'u' } as any
      await controller.create('s', user, dto)
      expect(service.create).toHaveBeenCalledWith('s', user.userId, dto)
    })
  })

  describe('findByStory', () => {
    it('should call commentService.findByStory', async () => {
      await controller.findByStory('s', 1, 20)
      expect(service.findByStory).toHaveBeenCalledWith('s', 1, 20)
    })
  })

  describe('update', () => {
    it('should call commentService.update', async () => {
      const dto = { content: 'upd' } as any
      const user = { userId: 'u' } as any
      await controller.update('c', user, dto)
      expect(service.update).toHaveBeenCalledWith('c', user.userId, dto)
    })
  })

  describe('delete', () => {
    it('should call commentService.delete', async () => {
      const user = { userId: 'u', role: 'USER' } as any
      await controller.delete('c', user)
      expect(service.delete).toHaveBeenCalledWith('c', user.userId, user.role)
    })
  })
})
