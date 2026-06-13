/**
 * Redis key patterns for refresh token management.
 *
 * Storage model:
 *   - Each user has a Redis SET holding their active jti values:
 *       Key:  `refresh_token:user:{userId}:sessions`
 *       Type: SET of jti strings
 *
 *   - Each jti maps to the refresh token string:
 *       Key:  `refresh_token:jti:{jti}`
 *       Type: STRING (the userId)
 */

/** Maximum number of concurrent sessions (devices) per user */
export const MAX_SESSIONS_PER_USER = 3

/** Redis key for the SET of active jti's for a user */
export const REFRESH_TOKEN_SESSIONS_KEY = (userId: string) => `refresh_token:user:${userId}:sessions`

/** Redis key for a single jti → userId mapping */
export const REFRESH_TOKEN_JTI_KEY = (jti: string) => `refresh_token:jti:${jti}`

/** Redis key holding the pending registration payload + OTP, keyed by email */
export const REGISTER_OTP_KEY = (email: string) => `register-otp:${email.toLowerCase()}`

/** TTL (seconds) for a pending registration OTP */
export const REGISTER_OTP_TTL_SECONDS = 600 // 10 minutes
