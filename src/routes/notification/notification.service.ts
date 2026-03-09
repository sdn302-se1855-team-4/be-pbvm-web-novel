import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'

@Injectable()
export class NotificationService {
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
}
