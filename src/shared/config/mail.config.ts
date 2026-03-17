import { registerAs } from '@nestjs/config'

export interface MailConfig {
  apiKey: string
  from: string
}

export default registerAs(
  'mail',
  (): MailConfig => ({
    apiKey: process.env.RESEND_API_KEY!,
    from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
  }),
)
