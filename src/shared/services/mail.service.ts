import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'
import { MailConfig } from '../config/mail.config'

@Injectable()
export class MailService {
  private readonly resend: Resend
  private readonly logger = new Logger(MailService.name)
  private readonly from: string

  constructor(private readonly configService: ConfigService) {
    const mailConfig = this.configService.get<MailConfig>('mail')
    this.resend = new Resend(mailConfig?.apiKey)
    this.from = mailConfig?.from || 'onboarding@resend.dev'
  }

  async sendMail(options: { to: string | string[]; subject: string; html: string; text?: string; from?: string }) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: options.from || this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      })

      if (error) {
        this.logger.error('Failed to send email via Resend', error)
        throw new Error(error.message || 'Failed to send email')
      }

      return data
    } catch (error) {
      this.logger.error('Error in MailService.sendMail', error)
      throw error
    }
  }
}
