import { Injectable, Logger } from '@nestjs/common'
import { v2 as cloudinary } from 'cloudinary'
import { ConfigService } from '@nestjs/config'
import * as streamifier from 'streamifier'

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name)

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME')
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY')
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET')

    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.error(
        'Cloudinary configuration is missing. Please check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env',
      )
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
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
