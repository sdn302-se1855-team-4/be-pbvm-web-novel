import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'

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
}
