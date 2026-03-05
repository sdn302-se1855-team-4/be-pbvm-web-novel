import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common'
import { StoryService } from './story.service'
import { CreateStoryBodyDTO, UpdateStoryBodyDTO, StoryQueryDTO } from './story.dto/story.dto'
import { AccessAuthGuard } from 'src/shared/guards/access-auth.guard'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { ResponseMessage } from 'src/shared/decorators/response-message.decorator'
import { RolesGuard } from 'src/shared/guards/roles.guard'
import { Roles } from 'src/shared/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

@ApiTags('stories')
@Controller('stories')
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(AccessAuthGuard, RolesGuard)
  @Roles('WRITER', 'ADMIN')
  @ResponseMessage('Tạo truyện thành công')
  create(@ActiveUser() user: Express.User, @Body() body: CreateStoryBodyDTO) {
    return this.storyService.create(user.userId, body)
  }

  @Get()
  @ResponseMessage('Lấy danh sách truyện thành công')
  findAll(@Query() query: StoryQueryDTO) {
    return this.storyService.findAll(query)
  }

  @Get('genres')
  @ResponseMessage('Lấy danh sách thể loại thành công')
  findAllGenres() {
    return this.storyService.findAllGenres()
  }

  @Get('tags')
  @ResponseMessage('Lấy danh sách tag thành công')
  findAllTags() {
    return this.storyService.findAllTags()
  }

  @Get('my')
  @ApiBearerAuth()
  @UseGuards(AccessAuthGuard)
  @ResponseMessage('Lấy danh sách truyện của tôi thành công')
  getMyStories(@ActiveUser() user: Express.User, @Query() query: StoryQueryDTO) {
    return this.storyService.getMyStories(user.userId, query)
  }

  @Get(':id')
  @ResponseMessage('Lấy chi tiết truyện thành công')
  findOne(@Param('id') id: string) {
    return this.storyService.findOne(id)
  }

  @Put(':id')
  @ApiBearerAuth()
  @UseGuards(AccessAuthGuard, RolesGuard)
  @Roles('WRITER', 'ADMIN')
  @ResponseMessage('Cập nhật truyện thành công')
  update(@Param('id') id: string, @ActiveUser() user: Express.User, @Body() body: UpdateStoryBodyDTO) {
    return this.storyService.update(id, user.userId, user.role, body)
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AccessAuthGuard, RolesGuard)
  @Roles('WRITER', 'ADMIN')
  @ResponseMessage('Xóa truyện thành công')
  delete(@Param('id') id: string, @ActiveUser() user: Express.User) {
    return this.storyService.delete(id, user.userId, user.role)
  }
}
