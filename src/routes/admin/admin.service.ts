import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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
    const story = await this.prisma.story.findUnique({ where: { id } })
    if (!story) throw new NotFoundException('Truyện không tồn tại')

    return this.prisma.story.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    })
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
    const tx = await this.prisma.transaction.findUnique({ where: { id } })
    if (!tx || tx.type !== 'WITHDRAWAL') throw new NotFoundException('Giao dịch không tồn tại')
    if (tx.status !== 'PENDING') throw new NotFoundException('Giao dịch không ở trạng thái chờ')

    return this.prisma.transaction.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        description: (tx.description || '').replace('Đang chờ xử lý', 'Đã chuyển khoản'),
      },
    })
  }

  async rejectWithdrawal(id: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id, type: 'WITHDRAWAL' } })
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

    return this.prisma.transaction.update({
      where: { id },
      data: {
        status: 'FAILED',
        description: (tx.description || '') + ' - Đã từ chối và hoàn tiền',
      },
    })
  }
}
