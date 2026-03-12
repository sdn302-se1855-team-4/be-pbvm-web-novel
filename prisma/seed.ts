import { hash } from 'bcrypt'
import { users } from './data/users'
import { genres } from './data/genres'
import { tags } from './data/tags'
import { stories } from './data/stories'
import { chapters } from './data/chapters'

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = `${process.env.DATABASE_URL}`
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })
const saltRounds = 10

async function main() {
  console.log('Cleaning up database...')
  // Delete in reverse order of dependencies
  await prisma.chapter.deleteMany()
  await prisma.storyGenre.deleteMany()
  await prisma.storyTag.deleteMany()
  await prisma.story.deleteMany()
  await prisma.genre.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.user.deleteMany()

  console.log('Seeding users...')
  for (const userData of users) {
    const { password, ...rest } = userData
    const passwordHash = await hash(password, saltRounds)
    await prisma.user.create({
      data: {
        ...rest,
        passwordHash,
      },
    })
  }

  console.log('Seeding genres...')
  const createdGenres = await Promise.all(
    genres.map((genre) =>
      prisma.genre.upsert({
        where: { slug: genre.slug },
        update: {},
        create: genre,
      }),
    ),
  )

  console.log('Seeding tags...')
  const createdTags = await Promise.all(
    tags.map((tag) =>
      prisma.tag.upsert({
        where: { slug: tag.slug },
        update: {},
        create: tag,
      }),
    ),
  )

  console.log('Seeding stories...')
  for (const storyData of stories) {
    const { id, ...rest } = storyData
    const story = await prisma.story.create({
      data: {
        ...rest,
        id,
      },
    })

    // Randomly assign 2 genres
    const randomGenres = createdGenres.sort(() => 0.5 - Math.random()).slice(0, 2)
    for (const genre of randomGenres) {
      await prisma.storyGenre.create({
        data: {
          storyId: story.id,
          genreId: genre.id,
        },
      })
    }

    // Randomly assign 2 tags
    const randomTags = createdTags.sort(() => 0.5 - Math.random()).slice(0, 2)
    for (const tag of randomTags) {
      await prisma.storyTag.create({
        data: {
          storyId: story.id,
          tagId: tag.id,
        },
      })
    }
  }

  console.log('Seeding chapters...')
  await prisma.chapter.createMany({
    data: chapters,
  })

  console.log('Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
