import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),

  ACCESS_TOKEN_SECRET: z.string(),
  ACCESS_TOKEN_EXPIRES_IN: z.string(),
  REFRESH_TOKEN_SECRET: z.string(),
  REFRESH_TOKEN_EXPIRES_IN: z.string(),

  SECRET_API_KEY: z.string(),

  PAYOS_CLIENT_ID: z.string(),
  PAYOS_API_KEY: z.string(),
  PAYOS_CHECKSUM_KEY: z.string(),

  UPTASH_REDIS_HOST: z.string(),
  UPTASH_REDIS_PASSWORD: z.string(),
  UPTASH_REDIS_PORT: z.string(),
  UPTASH_REDIS_USER: z.string(),
  UPTASH_REDIS_TLS: z.string(),

  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_CLIENT_EMAIL: z.string(),
  FIREBASE_PRIVATE_KEY: z.string().transform((key) => key.replace(/\\n/g, '\n')),

  PORT: z.string().optional().default('3000'),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((val) => val.split(',').map((s) => s.trim())),

  RESEND_API_KEY: z.string(),
  EMAIL_FROM: z.string(),

  CLOUDINARY_CLOUD_NAME: z.string(),
  CLOUDINARY_API_KEY: z.string(),
  CLOUDINARY_API_SECRET: z.string(),
})

export type EnvConfig = z.infer<typeof envSchema>

export function validate(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config)

  if (!result.success) {
    console.error('❌ Invalid environment variables:')
    console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2))
    throw new Error('Environment variables validation failed')
  }

  return result.data
}
