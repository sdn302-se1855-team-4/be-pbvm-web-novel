import { CommentGateway } from './comment.gateway'

describe('CommentGateway', () => {
  const tokenService = { verifyAccessToken: jest.fn() }
  const prisma = { user: { findUnique: jest.fn() } }
  const emit = jest.fn()
  const except = jest.fn(() => ({ emit }))
  const to = jest.fn(() => ({ emit, except }))
  let gateway: CommentGateway

  beforeEach(() => {
    jest.clearAllMocks()
    gateway = new CommentGateway(tokenService as any, prisma as any)
    ;(gateway as any).server = { to }
  })

  it('joins clients to the story comment room', () => {
    const client = createSocket()

    gateway.handleJoinStoryComments(client, { storyId: 'story-1' })

    expect(client.join).toHaveBeenCalledWith('story:story-1')
    expect(client.data.joinedStoryIds?.has('story-1')).toBe(true)
  })

  it('broadcasts typing users for authenticated clients', () => {
    const client = createSocket()
    client.data.user = {
      id: 'user-1',
      username: 'alice',
      displayName: 'Alice',
    }

    gateway.handleTypingStart(client, { storyId: 'story-1' })

    expect(to).toHaveBeenCalledWith('story:story-1')
    expect(except).toHaveBeenLastCalledWith(client.id)
    expect(emit).toHaveBeenLastCalledWith('comment.typing', {
      storyId: 'story-1',
      users: [client.data.user],
    })

    gateway.handleTypingStop(client, { storyId: 'story-1' })

    expect(except).toHaveBeenLastCalledWith(client.id)
    expect(emit).toHaveBeenLastCalledWith('comment.typing', {
      storyId: 'story-1',
      users: [],
    })
  })

  it('clears typing state when a client disconnects', () => {
    const client = createSocket()
    client.data.user = {
      id: 'user-1',
      username: 'alice',
      displayName: 'Alice',
    }

    gateway.handleTypingStart(client, { storyId: 'story-1' })
    gateway.handleDisconnect(client)

    expect(emit).toHaveBeenLastCalledWith('comment.typing', {
      storyId: 'story-1',
      users: [],
    })
  })

  it('emits created comments to the story room', () => {
    const comment = {
      id: 'comment-1',
      storyId: 'story-1',
      userId: 'user-1',
      content: 'Hello',
      parentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    gateway.emitCommentCreated('story-1', comment)

    expect(to).toHaveBeenCalledWith('story:story-1')
    expect(emit).toHaveBeenCalledWith('comment.created', {
      storyId: 'story-1',
      comment,
    })
  })
})

function createSocket() {
  return {
    id: 'socket-1',
    handshake: {
      auth: {},
      query: {},
      headers: {},
    },
    data: {},
    join: jest.fn(),
    leave: jest.fn(),
  } as any
}
