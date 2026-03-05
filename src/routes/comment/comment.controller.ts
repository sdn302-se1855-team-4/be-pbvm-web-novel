import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { CommentService } from './comment.service'
import { CreateCommentBodyDTO, UpdateCommentBodyDTO } from './comment.dto/comment.dto'
import { AccessAuthGuard } from 'src/shared/guards/access-auth.guard'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { ResponseMessage } from 'src/shared/decorators/response-message.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

@ApiTags('comments')
@Controller()
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post('stories/:storyId/comments')
  @ApiBearerAuth()
  @UseGuards(AccessAuthGuard)
  @ResponseMessage('Tạo bình luận thành công')
  create(@Param('storyId') storyId: string, @ActiveUser() user: Express.User, @Body() body: CreateCommentBodyDTO) {
    return this.commentService.create(storyId, user.userId, body)
  }

  @Get('stories/:storyId/comments')
  @ResponseMessage('Lấy danh sách bình luận thành công')
  findByStory(@Param('storyId') storyId: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.commentService.findByStory(storyId, page, limit)
  }

  @Put('comments/:id')
  @ApiBearerAuth()
  @UseGuards(AccessAuthGuard)
  @ResponseMessage('Cập nhật bình luận thành công')
  update(@Param('id') id: string, @ActiveUser() user: Express.User, @Body() body: UpdateCommentBodyDTO) {
    return this.commentService.update(id, user.userId, body)
  }

  @Delete('comments/:id')
  @ApiBearerAuth()
  @UseGuards(AccessAuthGuard)
  @ResponseMessage('Xóa bình luận thành công')
  delete(@Param('id') id: string, @ActiveUser() user: Express.User) {
    return this.commentService.delete(id, user.userId, user.role)
  }
}
