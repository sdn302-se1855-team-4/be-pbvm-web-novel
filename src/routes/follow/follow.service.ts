import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { NotificationService } from '../notification/notification.service'
import { RedisService } from 'src/shared/services/redis.service'

@Injectable()
export class FollowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly redisService: RedisService,
  ) {}

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new ConflictException('Bạn không thể follow chính mình')
    }

    const targetUser = await this.prisma.user.findUnique({ where: { id: followingId } })
    if (!targetUser) throw new NotFoundException('User không tồn tại')

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    })
    if (existing) throw new ConflictException('Bạn đã follow user này rồi')

    await this.prisma.follow.create({
      data: { followerId, followingId },
    })

    // Invalidate caches
    await Promise.all([
      this.redisService.del(`profile:me:${followerId}`),
      this.redisService.del(`profile:public:${followerId}`),
      this.redisService.del(`profile:me:${followingId}`),
      this.redisService.del(`profile:public:${followingId}`),
    ])

    await this.notificationService.notifyNewFollower(followerId, followingId)

    return { message: 'Follow thành công' }
  }

  async unfollow(followerId: string, followingId: string) {
    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    })
    if (!existing) throw new NotFoundException('Bạn chưa follow user này')

    await this.prisma.follow.delete({
      where: { followerId_followingId: { followerId, followingId } },
    })

    // Invalidate caches
    await Promise.all([
      this.redisService.del(`profile:me:${followerId}`),
      this.redisService.del(`profile:public:${followerId}`),
      this.redisService.del(`profile:me:${followingId}`),
      this.redisService.del(`profile:public:${followingId}`),
    ])

    return { message: 'Unfollow thành công' }
  }

  async getFollowing(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          following: {
            select: { id: true, username: true, displayName: true, avatar: true, bio: true },
          },
        },
      }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ])
    return {
      data: data.map((f) => f.following),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  async getFollowers(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followingId: userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          follower: {
            select: { id: true, username: true, displayName: true, avatar: true, bio: true },
          },
        },
      }),
      this.prisma.follow.count({ where: { followingId: userId } }),
    ])
    return {
      data: data.map((f) => f.follower),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  async isFollowing(followerId: string, followingId: string) {
    const follow = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    })
    return { isFollowing: !!follow }
  }
}
