import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(userId: string, body: { storyId: string; rating: number; content?: string }) {
    const story = await this.prisma.story.findUnique({ where: { id: body.storyId } })
    if (!story) throw new NotFoundException('Truyện không tồn tại')

    const existing = await this.prisma.review.findUnique({
      where: { userId_storyId: { userId, storyId: body.storyId } },
    })
    if (existing) throw new ConflictException('Bạn đã đánh giá truyện này rồi')

    const review = await this.prisma.review.create({
      data: { userId, storyId: body.storyId, rating: body.rating, content: body.content },
      include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
    })

    // Update story average rating
    const agg = await this.prisma.review.aggregate({
      where: { storyId: body.storyId },
      _avg: { rating: true },
      _count: { rating: true },
    })

    await this.prisma.story.update({
      where: { id: body.storyId },
      data: {
        rating: agg._avg.rating || 0,
        totalRatings: agg._count.rating || 0,
      },
    })

    return review
  }

  async getReviews(storyId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { storyId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, username: true, displayName: true, avatar: true } } },
      }),
      this.prisma.review.count({ where: { storyId } }),
    ])
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }
  }

  async deleteReview(userId: string, reviewId: string) {
    const review = await this.prisma.review.findUnique({ where: { id: reviewId } })
    if (!review) throw new NotFoundException('Review không tồn tại')
    if (review.userId !== userId) throw new NotFoundException('Không có quyền xóa')

    await this.prisma.review.delete({ where: { id: reviewId } })

    // Re-calc avg
    const agg = await this.prisma.review.aggregate({
      where: { storyId: review.storyId },
      _avg: { rating: true },
      _count: { rating: true },
    })
    await this.prisma.story.update({
      where: { id: review.storyId },
      data: { rating: agg._avg.rating || 0, totalRatings: agg._count.rating || 0 },
    })

    return { message: 'Xóa đánh giá thành công' }
  }
}
