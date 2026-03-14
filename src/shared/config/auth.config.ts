import { registerAs } from '@nestjs/config'
import ms from 'ms'

export interface AuthConfig {
  accessTokenSecret: string
  accessTokenExpiresIn: number
  refreshTokenSecret: string
  refreshTokenExpiresIn: number
  secretApiKey: string
}

export default registerAs('auth', (): AuthConfig => {
  const accessMs = ms(process.env.ACCESS_TOKEN_EXPIRES_IN || '1h')
  const refreshMs = ms(process.env.REFRESH_TOKEN_EXPIRES_IN || '7d')

  return {
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET!,
    accessTokenExpiresIn: Math.floor(accessMs / 1000), // convert to seconds for jwt
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET!,
    refreshTokenExpiresIn: Math.floor(refreshMs / 1000), // convert to seconds for jwt
    secretApiKey: process.env.SECRET_API_KEY!,
  }
})
