import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, Role } from '@prisma/client'
import { PrismaService } from 'src/shared/services/prisma.service'
import { RedisService } from 'src/shared/services/redis.service'
import { NotificationService } from '../notification/notification.service'
import { InjectQueue } from '@nestjs/bullmq'
import { MAIL_JOBS, MAIL_QUEUE } from 'src/shared/queues/mail.queue'
import { Queue } from 'bullmq'
import {
  AdminChapterQueryDTO,
  AdminGenreQueryDTO,
  AdminStoryQueryDTO,
  AdminTagQueryDTO,
  AdminUserQueryDTO,
  AdminWithdrawalQueryDTO,
} from './admin.dto'

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
    @InjectQueue(MAIL_QUEUE) private readonly mailQueue: Queue,
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

  async getUsers(query: AdminUserQueryDTO) {
    const { page, limit, search, role, sortBy, sortOrder } = query
    const skip = (page - 1) * limit

    const where: Prisma.UserWhereInput = {
      ...(role && { role }),
      ...(search && {
        OR: [
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    }

    const [users, total, roles, blocked] = await Promise.all([
      this.prisma.user.findMany({
        where,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : { skip }),
        take: limit,
        select: {
          id: true,
          displayName: true,
          username: true,
          email: true,
          role: true,
          createdAt: true,
          isBlocked: true,
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.user.count({ where: { isBlocked: true } }),
    ])

    const counts = {
      all: total,
      READER: roles.find((r) => r.role === 'READER')?._count._all || 0,
      WRITER: roles.find((r) => r.role === 'WRITER')?._count._all || 0,
      ADMIN: roles.find((r) => r.role === 'ADMIN')?._count._all || 0,
      blocked,
    }

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        nextCursor: users.length === limit ? users[users.length - 1].id : null,
        counts,
      },
    }
  }

  async getStories(query: AdminStoryQueryDTO) {
    const { page, limit, search, type, status, isPublished, sortBy, sortOrder } = query
    const skip = (page - 1) * limit

    const where: Prisma.StoryWhereInput = {
      ...(type && { type }),
      ...(status && { status }),
      ...(isPublished !== undefined && { isPublished }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
          { author: { username: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    }

    const [stories, total, published, draft, statuses] = await Promise.all([
      this.prisma.story.findMany({
        where,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : { skip }),
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          type: true,
          status: true,
          isPublished: true,
          totalChapters: true,
          createdAt: true,
          author: {
            select: { id: true, displayName: true, username: true },
          },
          _count: {
            select: { chapters: true },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      this.prisma.story.count({ where }),
      this.prisma.story.count({ where: { isPublished: true } }),
      this.prisma.story.count({ where: { isPublished: false } }),
      this.prisma.story.groupBy({ by: ['status'], _count: { _all: true } }),
    ])

    const counts = {
      all: total,
      published,
      draft,
      ONGOING: statuses.find((s) => s.status === 'ONGOING')?._count._all || 0,
      COMPLETED: statuses.find((s) => s.status === 'COMPLETED')?._count._all || 0,
      HIATUS: statuses.find((s) => s.status === 'HIATUS')?._count._all || 0,
      DROPPED: statuses.find((s) => s.status === 'DROPPED')?._count._all || 0,
    }

    return {
      data: stories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        nextCursor: stories.length === limit ? stories[stories.length - 1].id : null,
        counts,
      },
    }
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

    // Invalidate caches
    await this.redisService.del(`story:${id}`)
    await this.redisService.del(`story:slug:${story.slug}`)
    await this.redisService.delByPattern('stories:*')

    return updatedStory
  }

  async rejectStory(id: string) {
    const story = await this.prisma.story.findUnique({
      where: { id },
      include: { author: { select: { email: true, displayName: true, username: true } } },
    })
    if (!story) throw new NotFoundException('Truyện không tồn tại')

    const updated = await this.prisma.story.update({
      where: { id },
      data: {
        isPublished: false,
        publishedAt: null,
      },
    })

    // Queue rejection email
    await this.mailQueue.add(MAIL_JOBS.SEND_STORY_REJECTION, {
      email: story.author.email,
      authorName: story.author.displayName || story.author.username,
      storyTitle: story.title,
    })

    // Send system notification
    await this.notificationService.createNotification({
      userId: story.authorId,
      type: 'ADMIN',
      title: 'Truyện bị từ chối',
      message: `Truyện "${story.title}" của bạn đã bị từ chối. Vui lòng kiểm tra email để biết thêm chi tiết.`,
    })

    // Invalidate caches
    await this.redisService.del(`story:${id}`)
    await this.redisService.del(`story:slug:${story.slug}`)
    await this.redisService.delByPattern('stories:*')

    return updated
  }

  async deleteStory(id: string) {
    const story = await this.prisma.story.findUnique({ where: { id } })
    if (!story) throw new NotFoundException('Truyện không tồn tại')

    const { authorId, title } = story

    await this.prisma.story.delete({ where: { id } })

    // Notify Author
    await this.notificationService.createNotification({
      userId: authorId,
      type: 'ADMIN',
      title: 'Truyện đã bị xóa',
      message: `Truyện "${title}" của bạn đã bị xóa vĩnh viễn bởi Admin.`,
    })

    // Invalidate caches
    await this.redisService.del(`story:${id}`)
    await this.redisService.del(`story:slug:${story.slug}`)
    await this.redisService.delByPattern('stories:*')

    return { message: 'Xóa truyện vĩnh viễn thành công' }
  }

  async getStoryChapters(storyId: string, query: AdminChapterQueryDTO) {
    const { page, limit, isPublished } = query
    const skip = (page - 1) * limit

    const story = await this.prisma.story.findUnique({ where: { id: storyId } })
    if (!story) throw new NotFoundException('Truyện không tồn tại')

    const cacheKey = `admin:chapters:${storyId}:${JSON.stringify(query)}`
    const cached = await this.redisService.get(cacheKey)
    if (cached) return cached

    const where: Prisma.ChapterWhereInput = {
      storyId,
      ...(isPublished !== undefined && { isPublished }),
    }

    const [chapters, total] = await Promise.all([
      this.prisma.chapter.findMany({
        where,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : { skip }),
        take: limit,
        orderBy: { chapterNumber: 'asc' },
        select: {
          id: true,
          title: true,
          slug: true,
          chapterNumber: true,
          isPublished: true,
          isPremium: true,
          publishedAt: true,
          viewCount: true,
          createdAt: true,
        },
      }),
      this.prisma.chapter.count({ where }),
    ])

    const result = {
      data: chapters,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        nextCursor: chapters.length === limit ? chapters[chapters.length - 1].id : null,
      },
    }

    await this.redisService.set(cacheKey, result, 600) // 10 min
    return result
  }

  async approveChapter(id: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id },
      include: {
        story: {
          select: {
            id: true,
            title: true,
            authorId: true,
          },
        },
      },
    })
    if (!chapter) throw new NotFoundException('Chương không tồn tại')

    const updated = await this.prisma.chapter.update({
      where: { id },
      data: {
        isPublished: true,
        publishedAt: new Date(),
      },
    })

    // Notify Author
    await this.notificationService.createNotification({
      userId: chapter.story.authorId,
      type: 'ADMIN',
      title: 'Chương đã được duyệt',
      message: `Chương "${chapter.title}" của bộ truyện "${chapter.story.title}" đã được duyệt.`,
      link: `/stories/${chapter.storyId}/chapters/${chapter.chapterNumber}`,
    })

    // Notify Followers
    await this.notificationService.notifyFollowersNewChapter(
      chapter.story.authorId,
      chapter.storyId,
      chapter.story.title,
      chapter.chapterNumber,
    )

    // Invalidate caches
    await this.redisService.delByPattern(`chapters:story:${chapter.storyId}*`)
    await this.redisService.delByPattern(`admin:chapters:${chapter.storyId}*`)
    await this.redisService.del(`story:${chapter.storyId}`)

    return updated
  }

  async rejectChapter(id: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id },
      include: {
        story: {
          select: {
            title: true,
            authorId: true,
          },
        },
      },
    })
    if (!chapter) throw new NotFoundException('Chương không tồn tại')

    const updated = await this.prisma.chapter.update({
      where: { id },
      data: {
        isPublished: false,
      },
    })

    // Notify Author
    await this.notificationService.createNotification({
      userId: chapter.story.authorId,
      type: 'ADMIN',
      title: 'Chương bị từ chối',
      message: `Chương "${chapter.title}" của bộ truyện "${chapter.story.title}" đã bị từ chối.`,
    })

    // Invalidate caches
    await this.redisService.delByPattern(`chapters:story:${chapter.storyId}*`)
    await this.redisService.delByPattern(`admin:chapters:${chapter.storyId}*`)
    await this.redisService.del(`story:${chapter.storyId}`)

    return updated
  }

  async deleteChapter(id: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id },
      include: {
        story: {
          select: {
            title: true,
            authorId: true,
          },
        },
      },
    })
    if (!chapter) throw new NotFoundException('Chương không tồn tại')

    await this.prisma.$transaction([
      this.prisma.chapter.delete({ where: { id } }),
      this.prisma.story.update({
        where: { id: chapter.storyId },
        data: {
          totalChapters: { decrement: 1 },
        },
      }),
    ])

    // Notify Author
    await this.notificationService.createNotification({
      userId: chapter.story.authorId,
      type: 'ADMIN',
      title: 'Chương đã bị xóa',
      message: `Chương "${chapter.title}" của bộ truyện "${chapter.story.title}" đã bị xóa bởi Admin.`,
    })

    // Invalidate caches
    await this.redisService.delByPattern(`chapters:story:${chapter.storyId}*`)
    await this.redisService.delByPattern(`admin:chapters:${chapter.storyId}*`)
    await this.redisService.del(`story:${chapter.storyId}`)

    return { message: 'Xóa chương vĩnh viễn thành công' }
  }

  async getWithdrawals(query: AdminWithdrawalQueryDTO) {
    const { page, limit, status, sortBy, sortOrder } = query
    const skip = (page - 1) * limit

    const where: Prisma.TransactionWhereInput = {
      type: 'WITHDRAWAL',
      ...(status && { status }),
    }

    const [withdrawals, total, statusCounts] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : { skip }),
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
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
      }),
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.groupBy({
        where: { type: 'WITHDRAWAL' },
        by: ['status'],
        _count: { _all: true },
      }),
    ])

    const counts = {
      all: total,
      PENDING: statusCounts.find((s) => s.status === 'PENDING')?._count._all || 0,
      COMPLETED: statusCounts.find((s) => s.status === 'COMPLETED')?._count._all || 0,
      FAILED: statusCounts.find((s) => s.status === 'FAILED')?._count._all || 0,
      CANCELLED: statusCounts.find((s) => s.status === 'CANCELLED')?._count._all || 0,
    }

    return {
      data: withdrawals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        nextCursor: withdrawals.length === limit ? withdrawals[withdrawals.length - 1].id : null,
        counts,
      },
    }
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

  async getGenres(query: AdminGenreQueryDTO) {
    const { page, limit, search } = query
    const skip = (page - 1) * limit

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { slug: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const [genres, total] = await Promise.all([
      this.prisma.genre.findMany({
        where,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : { skip }),
        take: limit,
        orderBy: { name: 'asc' },
        include: { _count: { select: { stories: true } } },
      }),
      this.prisma.genre.count({ where }),
    ])

    return {
      data: genres,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        nextCursor: genres.length === limit ? genres[genres.length - 1].id : null,
        counts: { all: total },
      },
    }
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
    const genre = await this.prisma.genre.findUnique({
      where: { id },
      include: { _count: { select: { stories: true } } },
    })
    if (!genre) throw new NotFoundException('Thể loại không tồn tại')

    if (genre._count.stories > 0) {
      throw new ConflictException('Không thể xóa thể loại đang có truyện sử dụng')
    }

    await this.prisma.genre.delete({ where: { id } })
    await this.redisService.del('genres:all')
    return { message: 'Xóa thể loại thành công' }
  }

  // ==================== Tag CRUD ====================

  async getTags(query: AdminTagQueryDTO) {
    const { page, limit, search } = query
    const skip = (page - 1) * limit

    const where = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { slug: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    }

    const [tags, total] = await Promise.all([
      this.prisma.tag.findMany({
        where,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : { skip }),
        take: limit,
        orderBy: { name: 'asc' },
        include: { _count: { select: { stories: true } } },
      }),
      this.prisma.tag.count({ where }),
    ])

    return {
      data: tags,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        nextCursor: tags.length === limit ? tags[tags.length - 1].id : null,
        counts: { all: total },
      },
    }
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
    const tag = await this.prisma.tag.findUnique({
      where: { id },
      include: { _count: { select: { stories: true } } },
    })
    if (!tag) throw new NotFoundException('Tag không tồn tại')

    if (tag._count.stories > 0) {
      throw new ConflictException('Không thể xóa tag đang có truyện sử dụng')
    }

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
