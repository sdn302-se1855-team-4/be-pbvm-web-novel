import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { CreateCommentBodyType, UpdateCommentBodyType } from './comment.dto/comment.dto'

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(storyId: string, userId: string, body: CreateCommentBodyType) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } })
    if (!story) throw new NotFoundException('Truyện không tồn tại')

    if (body.parentId) {
      const parentComment = await this.prisma.comment.findUnique({ where: { id: body.parentId } })
      if (!parentComment) throw new NotFoundException('Comment cha không tồn tại')
    }

    return this.prisma.comment.create({
      data: {
        content: body.content,
        storyId,
        userId,
        parentId: body.parentId || null,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
      },
    })
  }

  async findByStory(storyId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { storyId, parentId: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, displayName: true, avatar: true } },
          replies: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: { select: { id: true, username: true, displayName: true, avatar: true } },
            },
          },
          _count: { select: { replies: true } },
        },
      }),
      this.prisma.comment.count({ where: { storyId, parentId: null } }),
    ])

    return {
      data: comments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  async update(commentId: string, userId: string, body: UpdateCommentBodyType) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } })
    if (!comment) throw new NotFoundException('Comment không tồn tại')
    if (comment.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa comment này')
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content: body.content },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
      },
    })
  }

  async delete(commentId: string, userId: string, userRole: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } })
    if (!comment) throw new NotFoundException('Comment không tồn tại')
    if (comment.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Bạn không có quyền xóa comment này')
    }

    await this.prisma.comment.delete({ where: { id: commentId } })
    return { message: 'Xóa comment thành công' }
  }
}
