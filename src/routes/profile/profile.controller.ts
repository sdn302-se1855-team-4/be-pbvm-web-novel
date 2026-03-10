import { Controller, Get, Param } from '@nestjs/common'
import { ProfileService } from './profile.service'

@Controller('users')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get(':id/profile')
  async getPublicProfile(@Param('id') id: string) {
    return this.profileService.getPublicProfile(id)
  }
}
