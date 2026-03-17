import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { ChapterService } from './chapter.service'
import { CreateChapterBodyDTO, UpdateChapterBodyDTO } from './chapter.dto/chapter.dto'
import { AccessAuthGuard } from 'src/shared/guards/access-auth.guard'
import { OptionalAuthGuard } from 'src/shared/guards/optional-auth.guard'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { ResponseMessage } from 'src/shared/decorators/response-message.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

@ApiTags('chapters')
@Controller('stories/:storyId/chapters')
export class ChapterController {
  constructor(private readonly chapterService: ChapterService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(AccessAuthGuard)
  @ResponseMessage('Tạo chapter thành công')
  create(@Param('storyId') storyId: string, @ActiveUser() user: Express.User, @Body() body: CreateChapterBodyDTO) {
    return this.chapterService.create(storyId, user.userId, user.role, body)
  }

  @Get()
  @ResponseMessage('Lấy danh sách chapter thành công')
  findAll(@Param('storyId') storyId: string) {
    return this.chapterService.findAllByStory(storyId)
  }

  @Get(':chapterNumber')
  @UseGuards(OptionalAuthGuard)
  @ApiBearerAuth()
  @ResponseMessage('Lấy chi tiết chapter thành công')
  findOne(
    @Param('storyId') storyId: string,
    @Param('chapterNumber', ParseIntPipe) chapterNumber: number,
    @Req() req: Request,
    @Query('skipView') skipView?: string,
  ) {
    const user = req.user as any
    const userId = user?.userId || user?.id
    const userRole = user?.role
    return this.chapterService.findOne(storyId, chapterNumber, skipView === 'true', userId, userRole)
  }

  @Put(':chapterNumber')
  @ApiBearerAuth()
  @UseGuards(AccessAuthGuard)
  @ResponseMessage('Cập nhật chapter thành công')
  update(
    @Param('storyId') storyId: string,
    @Param('chapterNumber', ParseIntPipe) chapterNumber: number,
    @ActiveUser() user: Express.User,
    @Body() body: UpdateChapterBodyDTO,
  ) {
    return this.chapterService.update(storyId, chapterNumber, user.userId, user.role, body)
  }

  @Delete(':chapterNumber')
  @ApiBearerAuth()
  @UseGuards(AccessAuthGuard)
  @ResponseMessage('Xóa chapter thành công')
  delete(
    @Param('storyId') storyId: string,
    @Param('chapterNumber', ParseIntPipe) chapterNumber: number,
    @ActiveUser() user: Express.User,
  ) {
    return this.chapterService.delete(storyId, chapterNumber, user.userId, user.role)
  }
}
