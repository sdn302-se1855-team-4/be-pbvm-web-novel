import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { CreateStoryBodyType, UpdateStoryBodyType, StoryQueryType } from './story.dto/story.dto'
import { Prisma } from '@prisma/client'

@Injectable()
export class StoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, body: CreateStoryBodyType) {
    const { genreIds, tagIds, ...storyData } = body

    const story = await this.prisma.story.create({
      data: {
        ...storyData,
        authorId,
        genres: genreIds?.length ? { create: genreIds.map((genreId) => ({ genreId })) } : undefined,
        tags: tagIds?.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatar: true } },
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
      },
    })
    return story
  }

  async findAll(query: StoryQueryType) {
    const { page, limit, search, type, status, genreId, sortBy, sortOrder } = query
    const skip = (page - 1) * limit

    const where: Prisma.StoryWhereInput = {
      isPublished: true,
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(type && { type }),
      ...(status && { status }),
      ...(genreId && { genres: { some: { genreId } } }),
    }

    const [stories, total] = await Promise.all([
      this.prisma.story.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          author: { select: { id: true, username: true, displayName: true, avatar: true } },
          genres: { include: { genre: true } },
          tags: { include: { tag: true } },
          _count: { select: { chapters: true, comments: true, reviews: true, bookmarks: true } },
        },
      }),
      this.prisma.story.count({ where }),
    ])

    return {
      data: stories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  async findOne(id: string) {
    const story = await this.prisma.story.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatar: true, bio: true } },
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
        chapters: {
          where: { isPublished: true },
          orderBy: { chapterNumber: 'asc' },
          select: {
            id: true,
            title: true,
            chapterNumber: true,
            slug: true,
            wordCount: true,
            viewCount: true,
            createdAt: true,
            isPremium: true,
          },
        },
        _count: { select: { chapters: true, comments: true, reviews: true, bookmarks: true } },
      },
    })
    if (!story) throw new NotFoundException('Truyện không tồn tại')

    // Increment view count
    await this.prisma.story.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    })

    return story
  }

  async update(id: string, userId: string, userRole: string, body: UpdateStoryBodyType) {
    const story = await this.prisma.story.findUnique({ where: { id } })
    if (!story) throw new NotFoundException('Truyện không tồn tại')
    if (story.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa truyện này')
    }

    const { genreIds, tagIds, ...storyData } = body

    // Update genres if provided
    if (genreIds) {
      await this.prisma.storyGenre.deleteMany({ where: { storyId: id } })
    }
    // Update tags if provided
    if (tagIds) {
      await this.prisma.storyTag.deleteMany({ where: { storyId: id } })
    }

    const updated = await this.prisma.story.update({
      where: { id },
      data: {
        ...storyData,
        ...(body.isPublished && !story.publishedAt && { publishedAt: new Date() }),
        genres: genreIds?.length ? { create: genreIds.map((genreId) => ({ genreId })) } : undefined,
        tags: tagIds?.length ? { create: tagIds.map((tagId) => ({ tagId })) } : undefined,
      },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatar: true } },
        genres: { include: { genre: true } },
        tags: { include: { tag: true } },
      },
    })
    return updated
  }

  async delete(id: string, userId: string, userRole: string) {
    const story = await this.prisma.story.findUnique({ where: { id } })
    if (!story) throw new NotFoundException('Truyện không tồn tại')
    if (story.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Bạn không có quyền xóa truyện này')
    }

    await this.prisma.story.delete({ where: { id } })
    return { message: 'Xóa truyện thành công' }
  }

  // ==================== Genre & Tag helpers ====================
  async findAllGenres() {
    return this.prisma.genre.findMany({ orderBy: { name: 'asc' } })
  }

  async findAllTags() {
    return this.prisma.tag.findMany({ orderBy: { name: 'asc' } })
  }

  async getMyStories(userId: string, query: StoryQueryType) {
    const { page, limit, sortBy, sortOrder } = query
    const skip = (page - 1) * limit

    const [stories, total] = await Promise.all([
      this.prisma.story.findMany({
        where: { authorId: userId },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          genres: { include: { genre: true } },
          tags: { include: { tag: true } },
          _count: { select: { chapters: true, comments: true, reviews: true, bookmarks: true } },
        },
      }),
      this.prisma.story.count({ where: { authorId: userId } }),
    ])

    return {
      data: stories,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }
}
