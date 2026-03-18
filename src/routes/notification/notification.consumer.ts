import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { NotificationService } from './notification.service'

@Processor('notifications')
export class NotificationConsumer extends WorkerHost {
  private readonly logger = new Logger(NotificationConsumer.name)

  constructor(private readonly notificationService: NotificationService) {
    super()
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`)

    switch (job.name) {
      case 'send-notification':
        return await this.notificationService.processCreateNotification(job.data)
      case 'notify-followers-new-chapter':
        return await this.notificationService.processNotifyFollowersNewChapter(job.data)
      case 'notify-author-followers':
        return await this.notificationService.processNotifyAuthorFollowers(job.data)
      case 'notify-new-follower':
        return await this.notificationService.processNotifyNewFollower(job.data)
      case 'notify-donation-received':
        return await this.notificationService.processNotifyDonationReceived(job.data)
      default:
        this.logger.warn(`Unknown job type: ${job.name}`)
    }
  }
}
