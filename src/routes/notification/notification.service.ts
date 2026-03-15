import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Subject } from 'rxjs'
import { PrismaService } from 'src/shared/services/prisma.service'
import { FirebaseService } from 'src/shared/services/firebase.service'
import { Notification } from '@prisma/client'

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name)
  public readonly notification$ = new Subject<{ userId: string; notification: Notification }>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
  ) {}

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
    const notification = await this.prisma.notification.create({ data })

    // Broadcast via SSE
    this.notification$.next({ userId: data.userId, notification })

    // Send via FCM
    this.sendPushNotification(data.userId, data.title, data.message, {
      link: data.link || '',
      type: data.type,
      notificationId: notification.id,
    }).catch((err) => this.logger.error('Failed to send push notification', err))

    return notification
  }

  private async sendPushNotification(userId: string, title: string, body: string, data?: Record<string, string>) {
    const tokens = await this.prisma.fcmToken.findMany({
      where: { userId },
      select: { token: true },
    })

    if (tokens.length === 0) return

    const tokenStrings = tokens.map((t) => t.token)
    await this.firebaseService.sendPushNotification(tokenStrings, title, body, data)
  }

  async registerFcmToken(userId: string, token: string, device?: string) {
    await this.prisma.fcmToken.upsert({
      where: { token },
      update: { userId, device },
      create: { userId, token, device },
    })
    return { message: 'Đã đăng ký thiết bị nhận thông báo' }
  }

  async unregisterFcmToken(token: string) {
    try {
      await this.prisma.fcmToken.delete({ where: { token } })
    } catch {
      // ignore if token doesn't exist
    }
    return { message: 'Đã hủy đăng ký thiết bị nhận thông báo' }
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
