import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from 'src/shared/services/prisma.service'

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name)

  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [data, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ])
    return {
      data,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  async markAsRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    })
    return { message: 'Đã đánh dấu đã đọc' }
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })
    return { message: 'Đã đánh dấu tất cả đã đọc' }
  }

  // Helper to create notifications from other services
  async createNotification(data: {
    userId: string
    type: 'NEW_CHAPTER' | 'NEW_COMMENT' | 'NEW_REVIEW' | 'NEW_FOLLOWER' | 'DONATION_RECEIVED' | 'SYSTEM' | 'ADMIN'
    title: string
    message: string
    link?: string
  }) {
    return this.prisma.notification.create({ data })
  }

  async notifyAuthorFollowers(authorId: string, authorDisplayName: string, storyId: string, storyTitle: string) {
    const followers = await this.prisma.follow.findMany({
      where: { followingId: authorId },
      select: { followerId: true },
    })

    await Promise.all(
      followers.map((f) =>
        this.createNotification({
          userId: f.followerId,
          type: 'SYSTEM',
          title: 'Tác giả bạn theo dõi ra truyện mới',
          message: `${authorDisplayName} vừa ra mắt bộ truyện mới: ${storyTitle}`,
          link: `/stories/${storyId}`,
        }),
      ),
    )
  }

  async notifyFollowersNewChapter(authorId: string, storyId: string, storyTitle: string, chapterNumber: number) {
    const author = await this.prisma.user.findUnique({
      where: { id: authorId },
      select: { displayName: true, username: true },
    })
    const authorName = author?.displayName || author?.username || 'Tác giả'

    const followers = await this.prisma.follow.findMany({
      where: { followingId: authorId },
      select: { followerId: true },
    })

    await Promise.all(
      followers.map((f) =>
        this.createNotification({
          userId: f.followerId,
          type: 'NEW_CHAPTER',
          title: 'Chương mới từ tác giả bạn theo dõi',
          message: `${authorName} vừa đăng Chương ${chapterNumber} của bộ truyện "${storyTitle}".`,
          link: `/stories/${storyId}/chapters/${chapterNumber}`,
        }),
      ),
    )
  }

  // Auto-cleanup: delete notifications older than 30 days every day at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCleanup() {
    this.logger.log('Starting notification auto-cleanup...')
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const result = await this.prisma.notification.deleteMany({
      where: {
        createdAt: {
          lte: thirtyDaysAgo,
        },
      },
    })

    this.logger.log(`Notification auto-cleanup finished. Deleted ${result.count} notifications.`)
  }
}
