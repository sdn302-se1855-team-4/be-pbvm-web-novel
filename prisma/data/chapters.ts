export const chapters = [
  {
    id: 'chapter_1_1',
    storyId: 'story_1',
    authorId: 'user_writer1',
    title: 'The Awakening',
    slug: 'the-awakening',
    chapterNumber: 1,
    content: {
      blocks: [
        {
          type: 'paragraph',
          data: { text: 'In the small village of Leaf, a young boy named Lin was looking at the stars...' },
        },
      ],
    },
    wordCount: 500,
    isPublished: true,
    publishedAt: new Date(),
  },
  {
    id: 'chapter_1_2',
    storyId: 'story_1',
    authorId: 'user_writer1',
    title: 'The Mysterious Ring',
    slug: 'the-mysterious-ring',
    chapterNumber: 2,
    content: {
      blocks: [{ type: 'paragraph', data: { text: 'While walking in the forest, Lin tripped over something shiny.' } }],
    },
    wordCount: 600,
    isPublished: true,
    publishedAt: new Date(),
  },
  {
    id: 'chapter_2_1',
    storyId: 'story_2',
    authorId: 'user_writer1',
    title: 'Where am I?',
    slug: 'where-am-i',
    chapterNumber: 1,
    content: {
      blocks: [{ type: 'paragraph', data: { text: 'The last thing I remember was the truck hitting me.' } }],
    },
    wordCount: 700,
    isPublished: true,
    publishedAt: new Date(),
  },
]
