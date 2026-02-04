export const ROLES = {
  ADMIN: 'ADMIN',
  USER: 'USER',
}
export type RoleType = (typeof ROLES)[keyof typeof ROLES]
