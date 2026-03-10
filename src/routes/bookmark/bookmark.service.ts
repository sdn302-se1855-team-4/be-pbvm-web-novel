import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'

@Injectable()
export class BookmarkService {
  constructor(private readonly prisma: PrismaService) {}

  async bookmark(userId: string, storyId: string) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } })
    if (!story) throw new NotFoundException('Truyện không tồn tại')

    const existing = await this.prisma.bookmark.findUnique({
      where: { userId_storyId: { userId, storyId } },
    })
    if (existing) throw new ConflictException('Bạn đã bookmark truyện này rồi')

    await this.prisma.bookmark.create({ data: { userId, storyId } })
    return { message: 'Bookmark thành công' }
  }

  async unbookmark(userId: string, storyId: string) {
    const existing = await this.prisma.bookmark.findUnique({
      where: { userId_storyId: { userId, storyId } },
    })
    if (!existing) throw new NotFoundException('Bạn chưa bookmark truyện này')

    await this.prisma.bookmark.delete({
      where: { userId_storyId: { userId, storyId } },
    })
    return { message: 'Xóa bookmark thành công' }
  }

  async getMyBookmarks(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.bookmark.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          story: {
            include: {
              author: { select: { id: true, username: true, displayName: true, avatar: true } },
              genres: { include: { genre: true } },
              _count: { select: { chapters: true } },
            },
          },
        },
      }),
      this.prisma.bookmark.count({ where: { userId } }),
    ])
    return {
      data: data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  async isBookmarked(userId: string, storyId: string) {
    const bookmark = await this.prisma.bookmark.findUnique({
      where: { userId_storyId: { userId, storyId } },
    })
    return { isBookmarked: !!bookmark }
  }
}
