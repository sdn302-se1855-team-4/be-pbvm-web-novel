export const stories = [
  {
    id: 'story_1',
    title: 'The Great Cultivator',
    slug: 'the-great-cultivator',
    description: 'A story about a boy who found a mysterious ring and started his journey to the peak.',
    coverImage: 'https://placehold.co/400x600?text=The+Great+Cultivator',
    type: 'NOVEL' as const,
    status: 'ONGOING' as const,
    authorId: 'user_writer1',
    isPublished: true,
    publishedAt: new Date(),
    viewCount: 1500,
    rating: 4.8,
  },
  {
    id: 'story_2',
    title: 'My Daily Life in Another World',
    slug: 'my-daily-life-in-another-world',
    description: 'I was just a normal office worker until I woke up in a world of magic and swords.',
    coverImage: 'https://placehold.co/400x600?text=Daily+Life+Isekai',
    type: 'LIGHTNOVEL' as const,
    status: 'COMPLETED' as const,
    authorId: 'user_writer1',
    isPublished: true,
    publishedAt: new Date(),
    viewCount: 2500,
    rating: 4.5,
  },
]

export const storyGenres = [
  { storyId: 'story_1', genreId: 'genre_fantasy' }, // Using helper names later
  { storyId: 'story_2', genreId: 'genre_adventure' },
]

export const storyTags = [
  { storyId: 'story_1', tagId: 'tag_cultivation' },
  { storyId: 'story_2', tagId: 'tag_reincarnation' },
]
