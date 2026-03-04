export const ROLES = {
  READER: 'READER',
  WRITER: 'WRITER',
  ADMIN: 'ADMIN',
} as const
export type RoleType = (typeof ROLES)[keyof typeof ROLES]
