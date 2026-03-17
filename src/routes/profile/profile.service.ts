import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { RedisService } from 'src/shared/services/redis.service'
import { UpdateProfileType } from './profile.dto'

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getPublicProfile(userId: string) {
    const cacheKey = `profile:public:${userId}`
    const cached = await this.redisService.get(cacheKey)
    if (cached) return cached

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatar: true,
        bio: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            stories: true,
            following: true,
            followers: true,
          },
        },
      },
    })
    if (!user) throw new NotFoundException('Người dùng không tồn tại')

    // Get their published stories
    const stories = await this.prisma.story.findMany({
      where: { authorId: userId, isPublished: true },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        genres: { include: { genre: true } },
        _count: { select: { chapters: true } },
        author: { select: { id: true, username: true, displayName: true, avatar: true } },
      },
    })

    const result = { ...user, stories }
    await this.redisService.set(cacheKey, result, 1800) // 30 min
    return result
  }

  async getOwnProfile(userId: string) {
    const cacheKey = `profile:me:${userId}`
    const cached = await this.redisService.get(cacheKey)
    if (cached) return cached

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        gender: true,
        isAnonymous: true,
        avatar: true,
        bio: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            stories: true,
            following: true,
            followers: true,
            bookmarks: true,
          },
        },
      },
    })
    if (!user) throw new NotFoundException('Người dùng không tồn tại')

    await this.redisService.set(cacheKey, user, 300) // 5 min
    return user
  }

  async updateProfile(userId: string, data: UpdateProfileType) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    })

    // Invalidate caches
    await this.redisService.del(`profile:me:${userId}`)
    await this.redisService.del(`profile:public:${userId}`)

    return updated
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
    })

    // Invalidate caches
    await this.redisService.del(`profile:me:${userId}`)
    await this.redisService.del(`profile:public:${userId}`)

    return updated
  }
}
