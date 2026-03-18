import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { CreateCommentBodyType, UpdateCommentBodyType } from './comment.dto/comment.dto'
import { RedisService } from 'src/shared/services/redis.service'

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async create(storyId: string, userId: string, body: CreateCommentBodyType) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } })
    if (!story) throw new NotFoundException('Truyện không tồn tại')

    if (body.parentId) {
      const parentComment = await this.prisma.comment.findUnique({ where: { id: body.parentId } })
      if (!parentComment) throw new NotFoundException('Comment cha không tồn tại')
    }

    const comment = await this.prisma.comment.create({
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

    // Invalidate cache
    await this.redisService.delByPattern(`comments:story:${storyId}*`)

    return comment
  }

  async findByStory(storyId: string, userId?: string, query?: { page?: number; limit?: number }) {
    const page = query?.page || 1
    const limit = query?.limit || 20
    const skip = (page - 1) * limit
    const cacheKey = `comments:story:${storyId}:${userId || 'guest'}:p${page}`
    const cached = await this.redisService.get(cacheKey)
    if (cached) return cached

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
              _count: { select: { likes: true } },
              likes: userId ? { where: { userId } } : false,
            },
          },
          _count: { select: { replies: true, likes: true } },
          likes: userId ? { where: { userId } } : false,
        },
      }),
      this.prisma.comment.count({ where: { storyId, parentId: null } }),
    ])

    const formattedComments = comments.map((c) => ({
      ...c,
      isLiked: (c.likes?.length ?? 0) > 0,
      likesCount: c._count.likes,
      replies: c.replies.map((r) => ({
        ...r,
        isLiked: (r.likes?.length ?? 0) > 0,
        likesCount: r._count.likes,
      })),
    }))

    const result = {
      data: formattedComments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }

    await this.redisService.set(cacheKey, result, 1800) // 30 min
    return result
  }

  async like(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } })
    if (!comment) throw new NotFoundException('Comment không tồn tại')

    try {
      const result = await this.prisma.commentLike.create({
        data: { commentId, userId },
      })
      await this.redisService.delByPattern(`comments:story:${comment.storyId}*`)
      return result
    } catch {
      // If unique constraint fails, user already liked the comment
      return { message: 'Bạn đã like comment này rồi' }
    }
  }

  async unlike(commentId: string, userId: string) {
    const like = await this.prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId } },
    })
    if (!like) return { message: 'Bạn chưa like comment này' }

    await this.prisma.commentLike.delete({
      where: { id: like.id },
    })
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } })
    if (comment) {
      await this.redisService.delByPattern(`comments:story:${comment.storyId}*`)
    }
    return { message: 'Đã bỏ like comment' }
  }

  async update(commentId: string, userId: string, body: UpdateCommentBodyType) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } })
    if (!comment) throw new NotFoundException('Comment không tồn tại')
    if (comment.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa comment này')
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content: body.content },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatar: true } },
      },
    })

    // Invalidate cache
    await this.redisService.delByPattern(`comments:story:${comment.storyId}*`)

    return updated
  }

  async delete(commentId: string, userId: string, userRole: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } })
    if (!comment) throw new NotFoundException('Comment không tồn tại')
    if (comment.userId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Bạn không có quyền xóa comment này')
    }

    await this.prisma.comment.delete({ where: { id: commentId } })

    // Invalidate cache
    await this.redisService.delByPattern(`comments:story:${comment.storyId}*`)

    return { message: 'Xóa comment thành công' }
  }
}
