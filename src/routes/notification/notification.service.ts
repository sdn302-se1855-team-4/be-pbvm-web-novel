import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Subject } from 'rxjs'
import { PrismaService } from 'src/shared/services/prisma.service'
import { FirebaseService } from 'src/shared/services/firebase.service'
import { Notification } from '@prisma/client'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { RedisService } from 'src/shared/services/redis.service'

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name)
  public readonly notification$ = new Subject<{ userId: string; notification: Notification }>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
    private readonly redisService: RedisService,
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
  ) {}

  async getNotifications(userId: string, page = 1, limit = 20) {
    const cacheKey = `notifications:user:${userId}:p${page}`
    const cached = await this.redisService.get(cacheKey)
    if (cached) return cached

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

    const result = {
      data,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }

    await this.redisService.set(cacheKey, result, 60) // 1 min (low TTL for notifications)
    return result
  }

  async markAsRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    })

    // Invalidate cache
    await this.redisService.delByPattern(`notifications:user:${userId}*`)

    return { message: 'Đã đánh dấu đã đọc' }
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })

    // Invalidate cache
    await this.redisService.delByPattern(`notifications:user:${userId}*`)

    return { message: 'Đã đánh dấu tất cả đã đọc' }
  }

  // Create notification via background job
  async createNotification(data: {
    userId: string
    type: 'NEW_CHAPTER' | 'NEW_COMMENT' | 'NEW_REVIEW' | 'NEW_FOLLOWER' | 'DONATION_RECEIVED' | 'SYSTEM' | 'ADMIN'
    title: string
    message: string
    link?: string
  }) {
    await this.notificationQueue.add('send-notification', data)
  }

  // Actual processing (Internal use by Consumer)
  async processCreateNotification(data: {
    userId: string
    type: 'NEW_CHAPTER' | 'NEW_COMMENT' | 'NEW_REVIEW' | 'NEW_FOLLOWER' | 'DONATION_RECEIVED' | 'SYSTEM' | 'ADMIN'
    title: string
    message: string
    link?: string
  }) {
    const notification = await this.prisma.notification.create({ data })

    // Broadcast via SSE (Real-time update)
    this.notification$.next({ userId: data.userId, notification })

    // Invalidate cache for user
    await this.redisService.delByPattern(`notifications:user:${data.userId}*`)

    // Send via FCM
    await this.sendPushNotification(data.userId, data.title, data.message, {
      link: data.link || '',
      type: data.type,
      notificationId: notification.id,
    })

    return notification
  }

  private async sendPushNotification(userId: string, title: string, body: string, data?: Record<string, string>) {
    const tokens = await this.prisma.fcmToken.findMany({
      where: { userId },
      select: { token: true },
    })

    if (tokens.length === 0) return

    const tokenStrings = tokens.map((t) => t.token)
    try {
      await this.firebaseService.sendPushNotification(tokenStrings, title, body, data)
    } catch (error) {
      this.logger.error(`Failed to send push notification to user ${userId}`, error)
    }
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
    await this.notificationQueue.add('notify-author-followers', {
      authorId,
      authorDisplayName,
      storyId,
      storyTitle,
    })
  }

  async processNotifyAuthorFollowers(data: {
    authorId: string
    authorDisplayName: string
    storyId: string
    storyTitle: string
  }) {
    const followers = await this.prisma.follow.findMany({
      where: { followingId: data.authorId },
      select: { followerId: true },
    })

    await Promise.all(
      followers.map((f) =>
        this.processCreateNotification({
          userId: f.followerId,
          type: 'SYSTEM',
          title: 'Tác giả bạn theo dõi ra truyện mới',
          message: `${data.authorDisplayName} vừa ra mắt bộ truyện mới: ${data.storyTitle}`,
          link: `/stories/${data.storyId}`,
        }),
      ),
    )
  }

  async notifyFollowersNewChapter(authorId: string, storyId: string, storyTitle: string, chapterNumber: number) {
    await this.notificationQueue.add('notify-followers-new-chapter', {
      authorId,
      storyId,
      storyTitle,
      chapterNumber,
    })
  }

  async processNotifyFollowersNewChapter(data: {
    authorId: string
    storyId: string
    storyTitle: string
    chapterNumber: number
  }) {
    const author = await this.prisma.user.findUnique({
      where: { id: data.authorId },
      select: { displayName: true, username: true },
    })
    const authorName = author?.displayName || author?.username || 'Tác giả'

    const followers = await this.prisma.follow.findMany({
      where: { followingId: data.authorId },
      select: { followerId: true },
    })

    await Promise.all(
      followers.map((f) =>
        this.processCreateNotification({
          userId: f.followerId,
          type: 'NEW_CHAPTER',
          title: 'Chương mới từ tác giả bạn theo dõi',
          message: `${authorName} vừa đăng Chương ${data.chapterNumber} của bộ truyện "${data.storyTitle}".`,
          link: `/stories/${data.storyId}/chapters/${data.chapterNumber}`,
        }),
      ),
    )
  }

  async notifyNewFollower(followerId: string, followingId: string) {
    await this.notificationQueue.add('notify-new-follower', { followerId, followingId })
  }

  async processNotifyNewFollower(data: { followerId: string; followingId: string }) {
    const follower = await this.prisma.user.findUnique({
      where: { id: data.followerId },
      select: { displayName: true, username: true },
    })
    const followerName = follower?.displayName || follower?.username || 'Một người dùng'

    await this.processCreateNotification({
      userId: data.followingId,
      type: 'NEW_FOLLOWER',
      title: 'Người theo dõi mới',
      message: `${followerName} vừa theo dõi bạn.`,
      link: `/users/${data.followerId}`,
    })
  }

  async notifyDonationReceived(payload: {
    toUserId: string
    amount: number
    donorId: string
    message?: string
    isAnonymous?: boolean
    storyId?: string
  }) {
    await this.notificationQueue.add('notify-donation-received', payload)
  }

  async processNotifyDonationReceived(data: {
    toUserId: string
    amount: number
    donorId: string
    message?: string
    isAnonymous?: boolean
    storyId?: string
  }) {
    let donorName = 'Một độc giả'
    if (data.isAnonymous) {
      donorName = 'Một độc giả ẩn danh'
    } else {
      const donor = await this.prisma.user.findUnique({
        where: { id: data.donorId },
        select: { displayName: true, username: true },
      })
      donorName = donor?.displayName || donor?.username || 'Một độc giả'
    }

    await this.processCreateNotification({
      userId: data.toUserId,
      type: 'DONATION_RECEIVED',
      title: 'Bạn nhận được ủng hộ',
      message: `${donorName} vừa ủng hộ bạn ${data.amount} xu.${data.message ? ` Lời nhắn: "${data.message}"` : ''}`,
      link: '/wallet',
    })
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
