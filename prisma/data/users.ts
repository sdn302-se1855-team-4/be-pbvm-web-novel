export const users = [
  {
    id: 'user_admin',
    email: 'admin@novel.com',
    username: 'admin',
    displayName: 'System Admin',
    role: 'ADMIN' as const,
    password: 'password123',
  },
  {
    id: 'user_writer1',
    email: 'writer1@novel.com',
    username: 'writer1',
    displayName: 'Lazy Author',
    role: 'WRITER' as const,
    password: 'password123',
  },
  {
    id: 'user_reader1',
    email: 'reader1@novel.com',
    username: 'reader1',
    displayName: 'Book Worm',
    role: 'READER' as const,
    password: 'password123',
  },
]
