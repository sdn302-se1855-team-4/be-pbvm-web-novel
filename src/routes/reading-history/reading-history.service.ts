import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'

@Injectable()
export class ReadingHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyHistory(userId: string, limit = 20) {
    const history = await this.prisma.readingHistory.findMany({
      where: { userId },
      orderBy: { readAt: 'desc' },
      take: limit,
      distinct: ['storyId'],
      include: {
        story: {
          include: {
            author: {
              select: { id: true, username: true, displayName: true, avatar: true },
            },
            genres: { include: { genre: true } },
            _count: { select: { chapters: true } },
          },
        },
        chapter: {
          select: { id: true, title: true, chapterNumber: true },
        },
      },
    })

    return history
  }

  async saveProgress(
    userId: string,
    body: { storyId: string; chapterId: string; progress?: number; lastPosition?: number },
  ) {
    const { storyId, chapterId, progress, lastPosition } = body

    const existing = await this.prisma.readingHistory.findUnique({
      where: {
        userId_storyId_chapterId: { userId, storyId, chapterId },
      },
    })

    if (existing) {
      return this.prisma.readingHistory.update({
        where: { id: existing.id },
        data: {
          progress: progress ?? existing.progress,
          lastPosition: lastPosition ?? existing.lastPosition,
          readAt: new Date(),
        },
      })
    }

    return this.prisma.readingHistory.create({
      data: {
        userId,
        storyId,
        chapterId,
        progress: progress ?? 0,
        lastPosition: lastPosition ?? 0,
      },
    })
  }
}
