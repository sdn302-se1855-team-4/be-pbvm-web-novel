import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { BookmarkService } from './bookmark.service'
import { AccessAuthGuard } from 'src/shared/guards/access-auth.guard'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { ResponseMessage } from 'src/shared/decorators/response-message.decorator'

@Controller('bookmarks')
@UseGuards(AccessAuthGuard)
export class BookmarkController {
  constructor(private readonly bookmarkService: BookmarkService) {}

  @Post(':storyId')
  @ResponseMessage('Bookmark thành công')
  bookmark(@ActiveUser() user: Express.User, @Param('storyId') storyId: string) {
    return this.bookmarkService.bookmark(user.userId, storyId)
  }

  @Delete(':storyId')
  @ResponseMessage('Xóa bookmark thành công')
  unbookmark(@ActiveUser() user: Express.User, @Param('storyId') storyId: string) {
    return this.bookmarkService.unbookmark(user.userId, storyId)
  }

  @Get()
  @ResponseMessage('Lấy danh sách bookmark thành công')
  getMyBookmarks(@ActiveUser() user: Express.User, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.bookmarkService.getMyBookmarks(user.userId, page, limit)
  }

  @Get('check/:storyId')
  @ResponseMessage('Kiểm tra bookmark thành công')
  isBookmarked(@ActiveUser() user: Express.User, @Param('storyId') storyId: string) {
    return this.bookmarkService.isBookmarked(user.userId, storyId)
  }
}
