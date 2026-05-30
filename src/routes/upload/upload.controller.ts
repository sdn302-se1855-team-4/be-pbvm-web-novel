import { Controller, Post, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger'
import { FileInterceptor } from '@nestjs/platform-express'
import { CloudinaryService } from '../../shared/services/cloudinary.service'
import { AccessAuthGuard } from '../../shared/guards/access-auth.guard'
import { ResponseMessage } from '../../shared/decorators/response-message.decorator'

@Controller('upload')
@UseGuards(AccessAuthGuard)
export class UploadController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @Post('image')
  @ApiBearerAuth()
  @ApiTags('upload')
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
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ResponseMessage('Tải ảnh lên thành công')
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn một tệp ảnh')
    }

    try {
      const result = await this.cloudinaryService.uploadImage(file)
      return { url: result.secure_url, publicId: result.public_id }
    } catch {
      throw new BadRequestException('Lỗi khi tải ảnh lên Cloudinary')
    }
  }
}
