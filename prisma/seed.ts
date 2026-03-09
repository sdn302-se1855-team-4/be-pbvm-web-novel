import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import * as bcrypt from 'bcrypt'
import * as dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

async function main() {
  console.log('Seeding data...')

  // Genres
  const genreNames = ['Hành động', 'Tình cảm', 'Hài hước', 'Kỳ ảo', 'Học đường']
  for (const name of genreNames) {
    const slug = slugify(name)
    await prisma.genre.upsert({
      where: { name },
      update: {},
      create: { name, slug },
    })
  }
  console.log('Genres seeded.')

  // Tags
  const tagNames = ['Trọng sinh', 'Hệ thống', 'Ngọt sủng']
  for (const name of tagNames) {
    const slug = slugify(name)
    await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name, slug },
    })
  }
  console.log('Tags seeded.')

  const hashedPassword = await bcrypt.hash('123456', 10)

  // Author
  const author = await prisma.user.upsert({
    where: { email: 'author@test.com' },
    update: {},
    create: {
      username: 'testauthor',
      email: 'author@test.com',
      passwordHash: hashedPassword,
      displayName: 'Test Author',
      role: 'WRITER',
    },
  })

  // Reader
  await prisma.user.upsert({
    where: { email: 'reader@test.com' },
    update: {},
    create: {
      username: 'testreader',
      email: 'reader@test.com',
      passwordHash: hashedPassword,
      displayName: 'Test Reader',
      role: 'READER',
    },
  })

  // Admin
  await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      username: 'testadmin',
      email: 'admin@test.com',
      passwordHash: hashedPassword,
      displayName: 'Test Admin',
      role: 'ADMIN',
    },
  })
  console.log('Users seeded.')

  // Story
  const storyTitle = 'Chuyện Tình Mùa Xuân'
  const storySlug = slugify(storyTitle)
  const story = await prisma.story.upsert({
    where: { slug: storySlug },
    update: {},
    create: {
      title: storyTitle,
      slug: storySlug,
      description: 'Một câu chuyện tình lãng mạn giữa lòng thành phố.',
      status: 'ONGOING',
      type: 'NOVEL',
      isPublished: true,
      authorId: author.id,
      genres: {
        create: [{ genre: { connect: { name: 'Tình cảm' } } }],
      },
      tags: {
        create: [{ tag: { connect: { name: 'Ngọt sủng' } } }],
      },
    },
  })
  console.log('Story seeded.')

  // Chapters
  const chapters = [
    { title: 'Gặp gỡ', chapterNumber: 1 },
    { title: 'Làm quen', chapterNumber: 2 },
  ]

  for (const ch of chapters) {
    const chSlug = slugify(ch.title)
    await prisma.chapter.upsert({
      where: {
        storyId_chapterNumber: {
          storyId: story.id,
          chapterNumber: ch.chapterNumber,
        },
      },
      update: {},
      create: {
        storyId: story.id,
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        slug: chSlug,
        content: { text: `Nội dung chương ${ch.chapterNumber}...` },
        authorId: author.id,
        isPublished: true,
      },
    })
  }
  console.log('Chapters seeded.')

  console.log('Seeding finished.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    await pool.end()
    process.exit(1)
  })
