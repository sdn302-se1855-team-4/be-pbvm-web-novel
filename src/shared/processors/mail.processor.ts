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

  async process(job: Job<unknown, unknown, string>): Promise<unknown> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`)

    switch (job.name) {
      case MAIL_JOBS.SEND_REGISTER_OTP:
        return this.handleRegisterOtp(job.data as { email: string; otp: string; displayName: string })
      case MAIL_JOBS.SEND_FORGOT_PASSWORD:
        return this.handleForgotPassword(job.data as { email: string; otp: string; displayName: string })
      case MAIL_JOBS.SEND_STORY_REJECTION:
        return this.handleStoryRejection(
          job.data as { email: string; authorName: string; storyTitle: string; reason?: string },
        )
      case MAIL_JOBS.SEND_GOOGLE_WELCOME_CREDENTIALS:
        return this.handleGoogleWelcomeCredentials(
          job.data as { email: string; username: string; password: string; displayName: string },
        )
      case MAIL_JOBS.SEND_ACCOUNT_BLOCK:
        return this.handleAccountBlock(job.data as { email: string; displayName: string; reason?: string })
      case MAIL_JOBS.SEND_ACCOUNT_UNBLOCK:
        return this.handleAccountUnblock(job.data as { email: string; displayName: string })
      default:
        this.logger.warn(`Unknown job type: ${job.name}`)
    }
  }

  private async handleRegisterOtp(data: { email: string; otp: string; displayName: string }) {
    await this.mailService.sendMail({
      to: data.email,
      subject: 'Mã xác thực đăng ký tài khoản - Chapter One',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #333; text-align: center;">Xác thực địa chỉ email</h2>
          <p>Xin chào <strong>${data.displayName}</strong>,</p>
          <p>Cảm ơn bạn đã đăng ký tài khoản tại <strong>Chapter One</strong>. Vui lòng sử dụng mã OTP dưới đây để hoàn tất việc xác thực email và kích hoạt tài khoản của bạn:</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2e7d32;">${data.otp}</span>
          </div>
          <p style="color: #555;">Mã có hiệu lực trong vòng <strong>10 phút</strong>. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #888; font-size: 12px;">Đây là email tự động, vui lòng không phản hồi.</p>
        </div>
      `,
    })
  }

  private async handleForgotPassword(data: { email: string; otp: string; displayName: string }) {
    await this.mailService.sendMail({
      to: data.email,
      subject: 'Mã xác thực khôi phục mật khẩu - Chapter One',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #333; text-align: center;">Khôi phục mật khẩu</h2>
          <p>Xin chào <strong>${data.displayName}</strong>,</p>
          <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng sử dụng mã OTP dưới đây để hoàn tất quá trình:</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #d32f2f;">${data.otp}</span>
          </div>
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

  private async handleGoogleWelcomeCredentials(data: {
    email: string
    username: string
    password: string
    displayName: string
  }) {
    await this.mailService.sendMail({
      to: data.email,
      subject: 'Chào mừng bạn đến với Chapter One - Thông tin đăng nhập của bạn',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #333; text-align: center;">Chào mừng bạn đến với Chapter One!</h2>
          <p>Xin chào <strong>${data.displayName}</strong>,</p>
          <p>Cảm ơn bạn đã sử dụng Google để đăng nhập vào Chapter One. Chúng tôi đã tự động khởi tạo tài khoản và mật khẩu cho bạn để bạn có thể đăng nhập bằng phương thức thông thường nếu muốn:</p>
          
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Username:</strong> ${data.username}</p>
            <p style="margin: 5px 0;"><strong>Password:</strong> <span style="font-family: monospace; font-size: 18px; color: #d32f2f;">${data.password}</span></p>
          </div>
          
          <p>Bạn nên đổi mật khẩu sau khi đăng nhập lần đầu để đảm bảo an toàn cho tài khoản.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #888; font-size: 12px;">Chapter One Team - Đưa thế giới truyện đến gần bạn hơn.</p>
        </div>
      `,
    })
  }
  private async handleAccountBlock(data: { email: string; displayName: string; reason?: string }) {
    await this.mailService.sendMail({
      to: data.email,
      subject: 'Thông báo khóa tài khoản - Chapter One',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #d32f2f; text-align: center;">Thông báo khóa tài khoản</h2>
          <p>Xin chào <strong>${data.displayName}</strong>,</p>
          <p>Chúng tôi rất tiếc phải thông báo rằng tài khoản của bạn trên <strong>Chapter One</strong> đã bị khóa tạm thời hoặc vĩnh viễn do vi phạm điều khoản sử dụng của hệ thống.</p>
          ${data.reason ? `<p><strong>Lý do:</strong> ${data.reason}</p>` : '<p><strong>Lý do:</strong> Vi phạm quy định cộng đồng hoặc nội dung không phù hợp.</p>'}
          <p>Nếu bạn cho rằng đây là một sự nhầm lẫn, vui lòng liên hệ với bộ phận hỗ trợ của chúng tôi.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #888; font-size: 12px;">Chapter One Team - Đưa thế giới truyện đến gần bạn hơn.</p>
        </div>
      `,
    })
  }

  private async handleAccountUnblock(data: { email: string; displayName: string }) {
    await this.mailService.sendMail({
      to: data.email,
      subject: 'Tài khoản của bạn đã được mở khóa - Chapter One',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #2e7d32; text-align: center;">Tài khoản đã được mở khóa</h2>
          <p>Xin chào <strong>${data.displayName}</strong>,</p>
          <p>Chúng tôi vui mừng thông báo rằng tài khoản của bạn trên <strong>Chapter One</strong> đã được mở khóa. Bây giờ bạn đã có thể đăng nhập và tiếp tục sử dụng các dịch vụ của chúng tôi.</p>
          <p>Cảm ơn bạn đã kiên nhẫn và đồng hành cùng Chapter One.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #888; font-size: 12px;">Chapter One Team - Đưa thế giới truyện đến gần bạn hơn.</p>
        </div>
      `,
    })
  }
}
