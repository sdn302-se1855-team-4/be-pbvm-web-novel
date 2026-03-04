export interface TokenPayload {
  userId: string
  role: string
  exp?: number
  iat?: number
}
