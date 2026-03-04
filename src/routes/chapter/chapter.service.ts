import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { CreateChapterBodyType, UpdateChapterBodyType } from './chapter.dto/chapter.dto'

@Injectable()
export class ChapterService {
  constructor(private readonly prisma: PrismaService) {}

  async create(storyId: string, authorId: string, userRole: string, body: CreateChapterBodyType) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } })
    if (!story) throw new NotFoundException('Truyện không tồn tại')
    if (story.authorId !== authorId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Bạn không có quyền thêm chapter cho truyện này')
    }

    const chapter = await this.prisma.chapter.create({
      data: {
        ...body,
        storyId,
        authorId,
        publishedAt: body.isPublished ? new Date() : undefined,
      },
    })

    // Update totalChapters
    await this.prisma.story.update({
      where: { id: storyId },
      data: { totalChapters: { increment: 1 } },
    })

    return chapter
  }

  async findAllByStory(storyId: string) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } })
    if (!story) throw new NotFoundException('Truyện không tồn tại')

    return this.prisma.chapter.findMany({
      where: { storyId },
      orderBy: { chapterNumber: 'asc' },
      select: {
        id: true,
        title: true,
        slug: true,
        chapterNumber: true,
        wordCount: true,
        viewCount: true,
        isPublished: true,
        isPremium: true,
        price: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  async findOne(storyId: string, chapterNumber: number) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { storyId_chapterNumber: { storyId, chapterNumber } },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatar: true } },
        story: { select: { id: true, title: true, slug: true, authorId: true } },
      },
    })
    if (!chapter) throw new NotFoundException('Chapter không tồn tại')

    // Increment view count
    await this.prisma.chapter.update({
      where: { id: chapter.id },
      data: { viewCount: { increment: 1 } },
    })

    // Get previous/next chapter info
    const [prevChapter, nextChapter] = await Promise.all([
      this.prisma.chapter.findFirst({
        where: { storyId, chapterNumber: chapterNumber - 1, isPublished: true },
        select: { chapterNumber: true, title: true, slug: true },
      }),
      this.prisma.chapter.findFirst({
        where: { storyId, chapterNumber: chapterNumber + 1, isPublished: true },
        select: { chapterNumber: true, title: true, slug: true },
      }),
    ])

    return { ...chapter, prevChapter, nextChapter }
  }

  async update(storyId: string, chapterNumber: number, userId: string, userRole: string, body: UpdateChapterBodyType) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { storyId_chapterNumber: { storyId, chapterNumber } },
      include: { story: { select: { authorId: true } } },
    })
    if (!chapter) throw new NotFoundException('Chapter không tồn tại')
    if (chapter.story.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa chapter này')
    }

    return this.prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        ...body,
        ...(body.isPublished && !chapter.publishedAt && { publishedAt: new Date() }),
      },
    })
  }

  async delete(storyId: string, chapterNumber: number, userId: string, userRole: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { storyId_chapterNumber: { storyId, chapterNumber } },
      include: { story: { select: { authorId: true } } },
    })
    if (!chapter) throw new NotFoundException('Chapter không tồn tại')
    if (chapter.story.authorId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenException('Bạn không có quyền xóa chapter này')
    }

    await this.prisma.chapter.delete({ where: { id: chapter.id } })

    // Update totalChapters
    await this.prisma.story.update({
      where: { id: storyId },
      data: { totalChapters: { decrement: 1 } },
    })

    return { message: 'Xóa chapter thành công' }
  }
}
