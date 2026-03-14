export interface TokenPayload {
  userId: string
  role: string
  jti?: string
  exp?: number
  iat?: number
}
