import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { UpdateProfileType } from './profile.dto'

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicProfile(userId: string) {
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

    return { ...user, stories }
  }

  async getOwnProfile(userId: string) {
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
    return user
  }

  async updateProfile(userId: string, data: UpdateProfileType) {
    return await this.prisma.user.update({
      where: { id: userId },
      data,
    })
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    return await this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
    })
  }
}
