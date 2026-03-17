import { Body, Controller, Get, Param, Patch, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { ProfileService } from './profile.service'
import { AccessAuthGuard } from 'src/shared/guards/access-auth.guard'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { ResponseMessage } from 'src/shared/decorators/response-message.decorator'
import { UpdateProfileDTO } from './profile.dto'
import { FileInterceptor } from '@nestjs/platform-express'
import { CloudinaryService } from 'src/shared/services/cloudinary.service'

@ApiTags('users')
@Controller('users')
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AccessAuthGuard)
  @ResponseMessage('Lấy thông tin cá nhân thành công')
  async getOwnProfile(@ActiveUser() user: Express.User) {
    return this.profileService.getOwnProfile(user.userId)
  }

  @Patch('me')
  @ApiBearerAuth()
  @UseGuards(AccessAuthGuard)
  @ResponseMessage('Cập nhật hồ sơ thành công')
  async updateProfile(@ActiveUser() user: Express.User, @Body() body: UpdateProfileDTO) {
    return this.profileService.updateProfile(user.userId, body)
  }

  @Patch('me/avatar')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseGuards(AccessAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ResponseMessage('Cập nhật ảnh đại diện thành công')
  async updateAvatar(@ActiveUser() user: Express.User, @UploadedFile() file: Express.Multer.File) {
    const result = await this.cloudinaryService.uploadImage(file)
    return this.profileService.updateAvatar(user.userId, result.secure_url)
  }

  @Get(':id/profile')
  async getPublicProfile(@Param('id') id: string) {
    return this.profileService.getPublicProfile(id)
  }
}
