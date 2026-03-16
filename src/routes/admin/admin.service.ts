import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Role } from '@prisma/client'
import { PrismaService } from 'src/shared/services/prisma.service'
import { RedisService } from 'src/shared/services/redis.service'
import { NotificationService } from '../notification/notification.service'

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
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

    await this.notificationService.createNotification({
      userId: story.authorId,
      type: 'ADMIN',
      title: 'Truyện đã được duyệt',
      message: `Bộ truyện "${story.title}" của bạn đã được Admin phê duyệt và xuất bản thành công!`,
      link: `/stories/${story.id}`,
    })

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

    const xuToRefund = Math.abs(tx.amount)

    const updatedWallet = await this.prisma.wallet.update({
      where: { id: tx.walletId },
      data: {
        balance: { increment: xuToRefund },
        totalSpent: { decrement: xuToRefund },
      },
    })

    await this.prisma.transaction.create({
      data: {
        walletId: tx.walletId,
        type: 'DEPOSIT',
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

    await this.notificationService.createNotification({
      userId: tx.wallet.userId,
      type: 'ADMIN',
      title: 'Yêu cầu rút tiền bị từ chối',
      message: `Yêu cầu rút ${xuToRefund} xu đã bị từ chối. ${xuToRefund} xu đã được hoàn lại vào ví của bạn.`,
      link: '/wallet',
    })

    return result
  }

  // ==================== Genre CRUD ====================

  async getGenres() {
    return this.prisma.genre.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { stories: true } } },
    })
  }

  async createGenre(name: string, slug: string) {
    const existing = await this.prisma.genre.findFirst({
      where: { OR: [{ name }, { slug }] },
    })
    if (existing) throw new ConflictException('Thể loại đã tồn tại')

    const genre = await this.prisma.genre.create({ data: { name, slug } })
    await this.redisService.del('genres:all')
    return genre
  }

  async updateGenre(id: string, name?: string, slug?: string) {
    const genre = await this.prisma.genre.findUnique({ where: { id } })
    if (!genre) throw new NotFoundException('Thể loại không tồn tại')

    const updated = await this.prisma.genre.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
      },
    })
    await this.redisService.del('genres:all')
    return updated
  }

  async deleteGenre(id: string) {
    const genre = await this.prisma.genre.findUnique({ where: { id } })
    if (!genre) throw new NotFoundException('Thể loại không tồn tại')

    await this.prisma.genre.delete({ where: { id } })
    await this.redisService.del('genres:all')
    return { message: 'Xóa thể loại thành công' }
  }

  // ==================== Tag CRUD ====================

  async getTags() {
    return this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { stories: true } } },
    })
  }

  async createTag(name: string, slug: string) {
    const existing = await this.prisma.tag.findFirst({
      where: { OR: [{ name }, { slug }] },
    })
    if (existing) throw new ConflictException('Tag đã tồn tại')

    const tag = await this.prisma.tag.create({ data: { name, slug } })
    await this.redisService.del('tags:all')
    return tag
  }

  async updateTag(id: string, name?: string, slug?: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } })
    if (!tag) throw new NotFoundException('Tag không tồn tại')

    const updated = await this.prisma.tag.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
      },
    })
    await this.redisService.del('tags:all')
    return updated
  }

  async deleteTag(id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } })
    if (!tag) throw new NotFoundException('Tag không tồn tại')

    await this.prisma.tag.delete({ where: { id } })
    await this.redisService.del('tags:all')
    return { message: 'Xóa tag thành công' }
  }

  // ==================== User Management ====================

  async updateUserRole(id: string, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('Người dùng không tồn tại')

    return this.prisma.user.update({
      where: { id },
      data: { role },
    })
  }

  async blockUser(id: string, isBlocked: boolean, reason?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('Người dùng không tồn tại')

    return this.prisma.user.update({
      where: { id },
      data: { isBlocked, blockReason: reason },
    })
  }

  // ==================== Analytics V2 ====================

  async getExtendedStats() {
    const cacheKey = 'admin:stats:extended'
    const cached = await this.redisService.get(cacheKey)
    if (cached) return cached

    const now = new Date()
    const monthlyData: {
      name: string
      users: number
      stories: number
      revenue: number
      chapters: number
    }[] = []

    // Get data for last 6 months
    for (let i = 5; i >= 0; i--) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)

      const [users, stories, chapters, revenue] = await Promise.all([
        this.prisma.user.count({ where: { createdAt: { gte: startOfMonth, lte: endOfMonth } } }),
        this.prisma.story.count({ where: { createdAt: { gte: startOfMonth, lte: endOfMonth } } }),
        this.prisma.chapter.count({ where: { createdAt: { gte: startOfMonth, lte: endOfMonth } } }),
        this.prisma.transaction.aggregate({
          where: {
            type: 'DEPOSIT',
            status: 'COMPLETED',
            createdAt: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { amount: true },
        }),
      ])

      monthlyData.push({
        name: `T${startOfMonth.getMonth() + 1}`,
        users,
        stories,
        revenue: revenue._sum.amount || 0,
        chapters,
      })
    }

    const currentMonth = monthlyData[5]
    const lastMonth = monthlyData[4]

    const calculateGrowth = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0
      return parseFloat((((curr - prev) / prev) * 100).toFixed(1))
    }

    const result = {
      summary: {
        userGrowth: calculateGrowth(currentMonth.users, lastMonth.users),
        storyGrowth: calculateGrowth(currentMonth.stories, lastMonth.stories),
        chapterGrowth: calculateGrowth(currentMonth.chapters, lastMonth.chapters),
        revenueGrowth: calculateGrowth(currentMonth.revenue, lastMonth.revenue),
      },
      monthlyData,
    }

    await this.redisService.set(cacheKey, result, 900) // 15 mins
    return result
  }

  async getRoleDistribution() {
    const cacheKey = 'admin:stats:roles'
    const cached = await this.redisService.get(cacheKey)
    if (cached) return cached

    const roles = await this.prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true },
    })

    const roleMap = {
      READER: 'Độc giả',
      WRITER: 'Tác giả',
      ADMIN: 'Admin',
    }

    const result = roles.map((r) => ({
      name: roleMap[r.role] || r.role,
      value: r._count._all,
    }))

    await this.redisService.set(cacheKey, result, 900)
    return result
  }

  async getContentTypeStats() {
    const cacheKey = 'admin:stats:content-types'
    const cached = await this.redisService.get(cacheKey)
    if (cached) return cached

    const types = await this.prisma.story.groupBy({
      by: ['type'],
      _count: { _all: true },
    })

    const result = types.map((t) => ({
      name: t.type,
      count: t._count._all,
    }))

    await this.redisService.set(cacheKey, result, 900)
    return result
  }
}
