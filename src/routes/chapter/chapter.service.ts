import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { CreateChapterBodyType, UpdateChapterBodyType } from './chapter.dto/chapter.dto'
import { NotificationService } from '../notification/notification.service'
import { WalletService } from '../wallet/wallet.service'

@Injectable()
export class ChapterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly walletService: WalletService,
  ) {}

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

    // Notify bookmarkers if published
    if (chapter.isPublished) {
      await this.notifyBookmarkers(storyId, chapter.chapterNumber, story.title)
    }

    return chapter
  }

  private async notifyBookmarkers(storyId: string, chapterNumber: number, storyTitle: string) {
    const bookmarkers = await this.prisma.bookmark.findMany({
      where: { storyId },
      select: { userId: true },
    })

    await Promise.all(
      bookmarkers.map((b) =>
        this.notificationService.createNotification({
          userId: b.userId,
          type: 'NEW_CHAPTER',
          title: 'Chương mới từ truyện bạn lưu',
          message: `Chương ${chapterNumber} của bộ truyện "${storyTitle}" vừa được đăng tải.`,
          link: `/stories/${storyId}/chapters/${chapterNumber}`,
        }),
      ),
    )
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

  async findOne(storyId: string, chapterNumber: number, skipView = false, userId?: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { storyId_chapterNumber: { storyId, chapterNumber } },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatar: true } },
        story: { select: { id: true, title: true, slug: true, authorId: true, type: true } },
      },
    })
    if (!chapter) throw new NotFoundException('Chapter không tồn tại')

    // Access Control Logic for Premium Chapters
    let isLocked = false
    if (chapter.isPremium) {
      if (!userId) {
        // Guest user -> locked
        isLocked = true
      } else if (chapter.story.authorId === userId) {
        // Author -> unlocked
        isLocked = false
      } else {
        // Logged-in Reader -> check wallet for purchase
        // Allow ADMIN to read everything as well if needed, but here we assume only author/buyer
        const hasPurchased = await this.walletService.hasUnlockedChapter(userId, chapter.id)
        if (!hasPurchased) {
          isLocked = true
        }
      }

      // If locked, completely remove the content from the response
      if (isLocked) {
        chapter.content = '' // Mask content
      }
    }

    // Increment view count
    if (!skipView) {
      await this.prisma.chapter.update({
        where: { id: chapter.id },
        data: { viewCount: { increment: 1 } },
      })
    }

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

    return { ...chapter, prevChapter, nextChapter, isLocked }
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

    const updated = await this.prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        ...body,
        ...(body.isPublished && !chapter.publishedAt && { publishedAt: new Date() }),
      },
    })

    // If it was just published, notify bookmarkers
    if (body.isPublished && !chapter.isPublished) {
      // Need story title
      const story = await this.prisma.story.findUnique({
        where: { id: storyId },
        select: { title: true },
      })
      if (story) {
        await this.notifyBookmarkers(storyId, updated.chapterNumber, story.title)
      }
    }

    return updated
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
