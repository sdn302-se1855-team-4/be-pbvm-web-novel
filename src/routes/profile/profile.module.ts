import { Module } from '@nestjs/common'
import { ProfileController } from './profile.controller'
import { ProfileService } from './profile.service'
import { CloudinaryService } from 'src/shared/services/cloudinary.service'

@Module({
  controllers: [ProfileController],
  providers: [ProfileService, CloudinaryService],
})
export class ProfileModule {}
