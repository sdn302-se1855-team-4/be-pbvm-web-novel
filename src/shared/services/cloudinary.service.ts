import { Injectable, Logger } from '@nestjs/common'
import { v2 as cloudinary } from 'cloudinary'
import { ConfigService } from '@nestjs/config'
import * as streamifier from 'streamifier'

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name)

  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    })
  }

  uploadImage(file: Express.Multer.File): Promise<any> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream({ folder: 'work-ai' }, (error, result) => {
        if (error) {
          this.logger.error('Failed to upload image to Cloudinary', error)
          return reject(new Error(error.message))
        }
        resolve(result)
      })

      streamifier.createReadStream(file.buffer).pipe(uploadStream)
    })
  }
}
