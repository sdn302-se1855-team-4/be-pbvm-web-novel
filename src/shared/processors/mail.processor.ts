import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { MailService } from '../services/mail.service'
import { MAIL_QUEUE, MAIL_JOBS } from '../queues/mail.queue'

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name)

  constructor(private readonly mailService: MailService) {
    super()
  }

  async process(job: Job<unknown, unknown, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`)

    switch (job.name) {
      case MAIL_JOBS.SEND_FORGOT_PASSWORD:
        return this.handleForgotPassword(job.data as { email: string; token: string; displayName: string })
      case MAIL_JOBS.SEND_STORY_REJECTION:
        return this.handleStoryRejection(
          job.data as { email: string; authorName: string; storyTitle: string; reason?: string },
        )
      default:
        this.logger.warn(`Unknown job type: ${job.name}`)
    }
  }

  private async handleForgotPassword(data: { email: string; token: string; displayName: string }) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${data.token}`

    await this.mailService.sendMail({
      to: data.email,
      subject: 'Khôi phục mật khẩu - Chapter One',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Xin chào ${data.displayName},</h2>
          <p>Bạn đã yêu cầu khôi phục mật khẩu cho tài khoản tại Chapter One.</p>
          <p>Vui lòng nhấn vào nút bên dưới để đặt lại mật khẩu của bạn. Liên kết này sẽ hết hạn sau 15 phút.</p>
          <div style="margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Đặt lại mật khẩu
            </a>
          </div>
          <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #888; font-size: 12px;">Đây là email tự động, vui lòng không phản hồi.</p>
        </div>
      `,
    })
  }

  private async handleStoryRejection(data: { email: string; authorName: string; storyTitle: string; reason?: string }) {
    await this.mailService.sendMail({
      to: data.email,
      subject: `Thông báo từ chối phê duyệt truyện: ${data.storyTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Xin chào ${data.authorName},</h2>
          <p>Chúng tôi rất tiếc phải thông báo rằng bộ truyện <strong>"${data.storyTitle}"</strong> của bạn đã bị từ chối phê duyệt bởi đội ngũ quản trị.</p>
          ${data.reason ? `<p><strong>Lý do:</strong> ${data.reason}</p>` : ''}
          <p>Bạn có thể chỉnh sửa nội dung và gửi lại yêu cầu phê duyệt sau khi đã khắc phục các vấn đề nêu trên.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #888; font-size: 12px;">Chapter One Team</p>
        </div>
      `,
    })
  }
}
