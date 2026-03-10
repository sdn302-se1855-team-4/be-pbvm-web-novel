import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { NotificationService } from '../notification/notification.service'

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async getStats() {
    const [users, stories, chapters] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.story.count(),
      this.prisma.chapter.count(),
    ])

    return {
      users,
      stories,
      chapters,
    }
  }

  async getUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  async getStories() {
    return this.prisma.story.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        type: true,
        status: true,
        isPublished: true,
        createdAt: true,
        author: {
          select: { id: true, displayName: true, username: true },
        },
        _count: {
          select: { chapters: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  async approveStory(id: string) {
    const story = await this.prisma.story.findUnique({
      where: { id },
      include: { author: { select: { id: true, displayName: true } } },
    })
    if (!story) throw new NotFoundException('Truyện không tồn tại')

    const updatedStory = await this.prisma.story.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    })

    // Notify THE AUTHOR that their story was approved
    await this.notificationService.createNotification({
      userId: story.authorId,
      type: 'ADMIN',
      title: 'Truyện đã được duyệt',
      message: `Bộ truyện "${story.title}" của bạn đã được Admin phê duyệt và xuất bản thành công!`,
      link: `/stories/${story.id}`,
    })

    // Send notifications to followers
    await this.notificationService.notifyAuthorFollowers(
      story.authorId,
      story.author.displayName || 'Tác giả',
      story.id,
      story.title,
    )

    return updatedStory
  }

  async rejectStory(id: string) {
    const story = await this.prisma.story.findUnique({ where: { id } })
    if (!story) throw new NotFoundException('Truyện không tồn tại')

    return this.prisma.story.update({
      where: { id },
      data: {
        isPublished: false,
        publishedAt: null,
      },
    })
  }

  async getWithdrawals() {
    return this.prisma.transaction.findMany({
      where: {
        type: 'WITHDRAWAL',
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        wallet: {
          select: {
            user: {
              select: {
                id: true,
                displayName: true,
                username: true,
                email: true,
              },
            },
          },
        },
      },
    })
  }

  async approveWithdrawal(id: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id },
      include: { wallet: { select: { userId: true } } },
    })
    if (!tx || tx.type !== 'WITHDRAWAL') throw new NotFoundException('Giao dịch không tồn tại')
    if (tx.status !== 'PENDING') throw new NotFoundException('Giao dịch không ở trạng thái chờ')

    const xuAmount = Math.abs(tx.amount)
    const vndAmount = (xuAmount * 1000 * 0.85).toLocaleString('vi-VN')

    const result = await this.prisma.transaction.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        description: (tx.description || '').replace('Đang chờ xử lý', 'Đã chuyển khoản'),
      },
    })

    // Send notification to author
    await this.notificationService.createNotification({
      userId: tx.wallet.userId,
      type: 'ADMIN',
      title: 'Yêu cầu rút tiền đã được duyệt',
      message: `Yêu cầu rút ${xuAmount} xu đã được Admin duyệt. Số tiền ${vndAmount}₫ sẽ được chuyển vào tài khoản ngân hàng của bạn.`,
      link: '/wallet',
    })

    return result
  }

  async rejectWithdrawal(id: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id, type: 'WITHDRAWAL' },
      include: { wallet: { select: { userId: true } } },
    })
    if (!tx) throw new NotFoundException('Giao dịch không tồn tại')
    if (tx.status !== 'PENDING') throw new NotFoundException('Giao dịch không ở trạng thái chờ')

    const xuToRefund = Math.abs(tx.amount) // Amount is negative in DB

    // Refund xu to wallet
    const updatedWallet = await this.prisma.wallet.update({
      where: { id: tx.walletId },
      data: {
        balance: { increment: xuToRefund },
        totalSpent: { decrement: xuToRefund },
      },
    })

    // Create a new REFUND transaction
    await this.prisma.transaction.create({
      data: {
        walletId: tx.walletId,
        type: 'DEPOSIT', // using DEPOSIT for refund
        amount: xuToRefund,
        balance: updatedWallet.balance,
        description: `Hoàn tiền yêu cầu rút xu thất bại (${xuToRefund} xu)`,
        status: 'COMPLETED',
      },
    })

    const result = await this.prisma.transaction.update({
      where: { id },
      data: {
        status: 'FAILED',
        description: (tx.description || '') + ' - Đã từ chối và hoàn tiền',
      },
    })

    // Send notification to author
    await this.notificationService.createNotification({
      userId: tx.wallet.userId,
      type: 'ADMIN',
      title: 'Yêu cầu rút tiền bị từ chối',
      message: `Yêu cầu rút ${xuToRefund} xu đã bị từ chối. ${xuToRefund} xu đã được hoàn lại vào ví của bạn.`,
      link: '/wallet',
    })

    return result
  }
}
