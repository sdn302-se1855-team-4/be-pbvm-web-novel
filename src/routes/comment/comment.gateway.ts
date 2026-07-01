import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { TokenService } from 'src/shared/services/token.service'
import { PrismaService } from 'src/shared/services/prisma.service'

type CommentSocketUser = {
  id: string
  username: string
  displayName: string | null
}

type CommentSocketData = {
  user?: CommentSocketUser
  joinedStoryIds?: Set<string>
}

type CommentSocket = Socket & {
  data: CommentSocketData
}

type CommentPayload = {
  id: string
  storyId: string
  userId: string
  content: string
  parentId: string | null
  createdAt: Date
  updatedAt: Date
  user?: {
    id: string
    username: string
    displayName: string | null
    avatar: string | null
  }
  isLiked?: boolean
  likesCount?: number
  _count?: {
    replies?: number
    likes?: number
  }
}

type TypingPayload = {
  storyId?: string
}

type TypingState = {
  storyId: string
  user: CommentSocketUser
  timeout: NodeJS.Timeout
}

const typingTtlMs = 5000

@WebSocketGateway({
  namespace: '/comments',
  cors: { origin: true, credentials: true },
})
export class CommentGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server

  private readonly typingByKey = new Map<string, TypingState>()

  constructor(
    private readonly tokenService: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: CommentSocket) {
    const token = this.readToken(client)
    if (!token) return

    try {
      const payload = await this.tokenService.verifyAccessToken(token)
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, username: true, displayName: true },
      })
      if (user) client.data.user = user
    } catch {
      // Guests can still listen to comment rooms, but cannot emit typing.
    }
  }

  handleDisconnect(client: CommentSocket) {
    this.clearTypingForClient(client)
  }

  @SubscribeMessage('join_story_comments')
  handleJoinStoryComments(@ConnectedSocket() client: CommentSocket, @MessageBody() payload: TypingPayload) {
    const storyId = this.normalizeStoryId(payload?.storyId)
    if (!storyId) return

    client.join(this.roomName(storyId))
    client.data.joinedStoryIds ??= new Set<string>()
    client.data.joinedStoryIds.add(storyId)
  }

  @SubscribeMessage('leave_story_comments')
  handleLeaveStoryComments(@ConnectedSocket() client: CommentSocket, @MessageBody() payload: TypingPayload) {
    const storyId = this.normalizeStoryId(payload?.storyId)
    if (!storyId) return

    client.leave(this.roomName(storyId))
    client.data.joinedStoryIds?.delete(storyId)
    this.clearTyping(client, storyId)
  }

  @SubscribeMessage('comment_typing_start')
  handleTypingStart(@ConnectedSocket() client: CommentSocket, @MessageBody() payload: TypingPayload) {
    const storyId = this.normalizeStoryId(payload?.storyId)
    const user = client.data.user
    if (!storyId || !user) return

    client.join(this.roomName(storyId))
    client.data.joinedStoryIds ??= new Set<string>()
    client.data.joinedStoryIds.add(storyId)

    const key = this.typingKey(storyId, user.id)
    const existing = this.typingByKey.get(key)
    if (existing) clearTimeout(existing.timeout)

    const timeout = setTimeout(() => this.clearTypingByKey(key), typingTtlMs)
    this.typingByKey.set(key, { storyId, user, timeout })
    this.broadcastTyping(storyId, client.id)
  }

  @SubscribeMessage('comment_typing_stop')
  handleTypingStop(@ConnectedSocket() client: CommentSocket, @MessageBody() payload: TypingPayload) {
    const storyId = this.normalizeStoryId(payload?.storyId)
    if (!storyId) return

    this.clearTyping(client, storyId)
  }

  emitCommentCreated(storyId: string, comment: CommentPayload) {
    this.server.to(this.roomName(storyId)).emit('comment.created', {
      storyId,
      comment,
    })
  }

  emitCommentUpdated(storyId: string, comment: CommentPayload) {
    this.server.to(this.roomName(storyId)).emit('comment.updated', {
      storyId,
      comment,
    })
  }

  emitCommentDeleted(storyId: string, commentId: string) {
    this.server.to(this.roomName(storyId)).emit('comment.deleted', {
      storyId,
      commentId,
    })
  }

  emitCommentLiked(storyId: string, commentId: string, likesCount: number, userId: string, isLiked: boolean) {
    this.server.to(this.roomName(storyId)).emit('comment.liked', {
      storyId,
      commentId,
      likesCount,
      userId,
      isLiked,
    })
  }

  private readToken(client: Socket) {
    const authToken = client.handshake.auth?.token
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.trim()
    }

    const queryToken = client.handshake.query?.token
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.trim()
    }

    const header = client.handshake.headers.authorization
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.substring('Bearer '.length).trim()
    }

    return null
  }

  private normalizeStoryId(value?: string) {
    if (typeof value !== 'string') return null
    const storyId = value.trim()
    return storyId.length === 0 ? null : storyId
  }

  private roomName(storyId: string) {
    return `story:${storyId}`
  }

  private typingKey(storyId: string, userId: string) {
    return `${storyId}:${userId}`
  }

  private clearTyping(client: CommentSocket, storyId: string) {
    const user = client.data.user
    if (!user) return

    this.clearTypingByKey(this.typingKey(storyId, user.id), client.id)
  }

  private clearTypingForClient(client: CommentSocket) {
    const user = client.data.user
    const storyIds = client.data.joinedStoryIds
    if (!user || !storyIds) return

    for (const storyId of storyIds) {
      this.clearTypingByKey(this.typingKey(storyId, user.id), client.id)
    }
  }

  private clearTypingByKey(key: string, excludedClientId?: string) {
    const state = this.typingByKey.get(key)
    if (!state) return

    clearTimeout(state.timeout)
    this.typingByKey.delete(key)
    this.broadcastTyping(state.storyId, excludedClientId)
  }

  private broadcastTyping(storyId: string, excludedClientId?: string) {
    const users = Array.from(this.typingByKey.values())
      .filter((state) => state.storyId === storyId)
      .map((state) => state.user)

    const room = this.server.to(this.roomName(storyId))
    const target = excludedClientId ? room.except(excludedClientId) : room

    target.emit('comment.typing', {
      storyId,
      users,
    })
  }
}
