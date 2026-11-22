import crypto from 'node:crypto'
import zlib from 'node:zlib'
import WebSocket from 'ws'
import type { BurstState, ChatMessage, Room } from '../../shared/types'
import type { Store } from '../store'
import type { BiliClient } from './bili'

type MessageListener = (roomId: string, message: ChatMessage) => void
type BurstListener = (state: BurstState) => void

interface RoomConnection {
  room: Room
  socket?: WebSocket
  token?: string
  hostIndex: number
  stopped: boolean
  attempts: number
  heartbeat?: NodeJS.Timeout
  reconnectTimer?: NodeJS.Timeout
  lastLikeAt: number
  online?: number
}

const HEARTBEAT_BODY = '[object Object]'

export class DanmakuHub {
  private readonly store: Store
  private readonly bili: BiliClient
  private readonly connections = new Map<string, RoomConnection>()
  private readonly messageListeners = new Set<MessageListener>()
  private readonly burstListeners = new Set<BurstListener>()
  private burst?: {
    room: Room
    text: string
    total: number
    sent: number
    gapMs: number
    stopped: boolean
    timer?: NodeJS.Timeout
  }

  constructor(store: Store, bili: BiliClient) {
    this.store = store
    this.bili = bili
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener)
    return () => this.messageListeners.delete(listener)
  }

  onBurst(listener: BurstListener): () => void {
    this.burstListeners.add(listener)
    return () => this.burstListeners.delete(listener)
  }

  isConnected(roomId: string): boolean {
    const conn = this.connections.get(roomId)
    return Boolean(conn?.socket && conn.socket.readyState === WebSocket.OPEN)
  }

  async connect(room: Room): Promise<{ connected: boolean; message?: string }> {
    if (process.env.CLEARSTAGE_DEBUG_DANMAKU === '1') {
      console.log('[danmaku] connect request', room.roomId, room.platform)
    }
    if (room.platform !== 'bilibili') {
      return { connected: false, message: '该平台暂不支持原生弹幕连接' }
    }
    const existing = this.connections.get(room.roomId)
    if (existing && existing.socket?.readyState === WebSocket.OPEN) {
      return { connected: true }
    }
    if (existing) this.disconnect(room.roomId)
    const conn: RoomConnection = {
      room,
      hostIndex: 0,
      stopped: false,
      attempts: 0,
      lastLikeAt: 0
    }
    this.connections.set(room.roomId, conn)
    const result = await this.open(conn)
    if (process.env.CLEARSTAGE_DEBUG_DANMAKU === '1') {
      console.log('[danmaku] connect result', room.roomId, result)
    }
    return result
  }

  private async open(conn: RoomConnection): Promise<{ connected: boolean; message?: string }> {
    try {
      const server = await this.bili.getDanmakuServer(conn.room.roomId)
      if (process.env.CLEARSTAGE_DEBUG_DANMAKU === '1') {
        console.log('[danmaku] server ready', conn.room.roomId, server.hosts[0]?.host)
      }
      conn.token = server.token
      const host = server.hosts[conn.hostIndex % server.hosts.length]
      if (!host) throw new Error('没有可用的弹幕服务器')
      const socket = new WebSocket(`wss://${host.host}/sub`, {
        handshakeTimeout: 15_000,
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
          origin: 'https://live.bilibili.com'
        }
      })
      conn.socket = socket
      socket.binaryType = 'arraybuffer'
      socket.on('open', () => {
        conn.attempts = 0
        if (process.env.CLEARSTAGE_DEBUG_DANMAKU === '1') {
          console.log('[danmaku] socket open', conn.room.roomId)
        }
        const auth: Record<string, string | number> = {
          uid: this.bili.getUidSync(),
          roomid: Number(conn.room.roomId),
          protover: 3,
          platform: 'web',
          type: 2,
          key: conn.token ?? ''
        }
        const buvid = this.bili.getBuvid()
        if (buvid) auth.buvid = buvid
        socket.send(buildPacket(7, Buffer.from(JSON.stringify(auth))))
        conn.heartbeat = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(buildPacket(2, Buffer.from(HEARTBEAT_BODY)))
          }
        }, 30_000)
      })
      socket.on('message', (data) => {
        try {
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
          this.parsePackets(conn, buffer)
        } catch (error) {
          console.warn('[danmaku] parse failed', error)
        }
      })
      socket.on('error', (error) => {
        console.warn('[danmaku] socket error', error.message)
      })
      socket.on('close', (code, reason) => {
        if (process.env.CLEARSTAGE_DEBUG_DANMAKU === '1') {
          console.log('[danmaku] socket close', conn.room.roomId, code, reason.toString())
        }
        if (conn.heartbeat) clearInterval(conn.heartbeat)
        conn.socket = undefined
        if (conn.stopped) return
        conn.attempts += 1
        if (conn.attempts > 8) {
          this.emitSystem(conn.room, '弹幕连接多次失败，请稍后在播放器中重新连接')
          return
        }
        conn.hostIndex += 1
        const delay = Math.min(30_000, 1000 * 2 ** Math.min(conn.attempts, 5))
        conn.reconnectTimer = setTimeout(() => {
          if (!conn.stopped) void this.open(conn)
        }, delay)
      })
      return { connected: true }
    } catch (error) {
      if (process.env.CLEARSTAGE_DEBUG_DANMAKU === '1') {
        console.warn('[danmaku] connect failed', conn.room.roomId, error)
      }
      return {
        connected: false,
        message: error instanceof Error ? error.message : '弹幕连接失败'
      }
    }
  }

  private parsePackets(conn: RoomConnection, buffer: Buffer): void {
    let offset = 0
    while (offset + 16 <= buffer.length) {
      const total = buffer.readUInt32BE(offset)
      const headerLength = buffer.readUInt16BE(offset + 4)
      const version = buffer.readUInt16BE(offset + 6)
      const operation = buffer.readUInt32BE(offset + 8)
      if (total < headerLength || total > buffer.length - offset) break
      const body = buffer.subarray(offset + headerLength, offset + total)
      if (operation === 5) {
        if (version === 2) {
          try {
            this.parsePackets(conn, zlib.inflateSync(body))
          } catch (error) {
            console.warn('[danmaku] inflate failed', error)
          }
        } else if (version === 3) {
          try {
            this.parsePackets(conn, zlib.brotliDecompressSync(body))
          } catch (error) {
            console.warn('[danmaku] brotli failed', error)
          }
        } else {
          this.handlePayload(conn, body.toString('utf8'))
        }
      } else if (operation === 8) {
        try {
          const result = JSON.parse(body.toString('utf8')) as { code?: number }
          if (process.env.CLEARSTAGE_DEBUG_DANMAKU === '1') {
            console.log('[danmaku] auth reply', conn.room.roomId, result.code)
          }
          if (result.code !== 0) {
            this.emitSystem(conn.room, '弹幕服务器鉴权失败，可能需要在设置中登录 B 站账号')
          }
        } catch {
          // ignore
        }
      }
      offset += total
    }
  }

  private handlePayload(conn: RoomConnection, text: string): void {
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(text) as Record<string, unknown>
    } catch {
      return
    }
    const cmd = String(payload.cmd ?? '')
    if (!cmd) return
    if (process.env.CLEARSTAGE_DEBUG_DANMAKU === '1') {
      console.log('[danmaku] payload', conn.room.roomId, cmd.slice(0, 60))
    }
    if (cmd.startsWith('DANMU_MSG')) {
      const info = payload.info as unknown[] | undefined
      if (!Array.isArray(info)) return
      const content = String(info[1] ?? '')
      const user = info[2] as unknown[] | undefined
      const medal = info[3] as unknown[] | undefined
      const meta = info[0] as unknown[] | undefined
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        roomId: conn.room.id,
        type: 'chat',
        userId: user ? String(user[0] ?? '') : undefined,
        userName: user ? String(user[1] ?? '') : '观众',
        text: content,
        timestamp: Date.now(),
        color: meta ? `#${Number(meta[3] ?? 16777215).toString(16).padStart(6, '0')}` : undefined,
        medal:
          medal && Number(medal[0]) > 0
            ? { name: String(medal[1] ?? ''), level: Number(medal[0]) }
            : undefined,
        rawCommand: cmd
      }
      this.emit(conn.room, message)
      return
    }
    if (cmd === 'SEND_GIFT') {
      const data = payload.data as Record<string, unknown>
      if (!data) return
      const count = Number(data.num ?? 1)
      const price = Number(data.price ?? 0)
      const totalCoin = Number(data.total_coin ?? price * count)
      const coinType = String(data.coin_type ?? 'gold')
      const value = coinType === 'gold' ? Math.max(0, totalCoin / 1000) : 0
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        roomId: conn.room.id,
        type: 'gift',
        userId: String(data.uid ?? ''),
        userName: String(data.uname ?? '观众'),
        avatar: typeof data.face === 'string' ? data.face : undefined,
        text: `送出 ${String(data.giftName ?? '礼物')} ×${count}`,
        timestamp: Date.now(),
        giftName: String(data.giftName ?? '礼物'),
        giftCount: count,
        price: value,
        rawCommand: cmd
      }
      this.store.recordGift(conn.room.roomId, String(data.giftName ?? '礼物'), value)
      this.emit(conn.room, message)
      return
    }
    if (cmd === 'SUPER_CHAT_MESSAGE') {
      const data = payload.data as Record<string, unknown>
      if (!data) return
      const userInfo = (data.user_info ?? {}) as Record<string, unknown>
      const price = Number(data.price ?? 0)
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        roomId: conn.room.id,
        type: 'superchat',
        userId: String(data.uid ?? ''),
        userName: String(userInfo.uname ?? '观众'),
        avatar: typeof userInfo.face === 'string' ? userInfo.face : undefined,
        text: String(data.message ?? ''),
        timestamp: Date.now(),
        price,
        giftName: '醒目留言',
        rawCommand: cmd
      }
      this.store.recordGift(conn.room.roomId, '醒目留言', price)
      this.emit(conn.room, message)
      return
    }
    if (cmd === 'GUARD_BUY') {
      const data = payload.data as Record<string, unknown>
      if (!data) return
      const level = Number(data.guard_level ?? 3)
      const names = ['', '总督', '提督', '舰长']
      const price = Number(data.price ?? 0) / 1000
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        roomId: conn.room.id,
        type: 'guard',
        userId: String(data.uid ?? ''),
        userName: String(data.username ?? '观众'),
        text: `开通了 ${names[level] ?? '大航海'}`,
        timestamp: Date.now(),
        guardName: names[level] ?? '大航海',
        price,
        rawCommand: cmd
      }
      this.store.recordGift(conn.room.roomId, names[level] ?? '大航海', price)
      this.emit(conn.room, message)
      return
    }
    if (cmd === 'INTERACT_WORD') {
      const data = payload.data as Record<string, unknown>
      if (!data) return
      const msgType = Number(data.msg_type ?? 1)
      if (msgType !== 1) return
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        roomId: conn.room.id,
        type: 'enter',
        userId: String(data.uid ?? ''),
        userName: String(data.uname ?? '观众'),
        text: '进入了直播间',
        timestamp: Date.now(),
        rawCommand: cmd
      }
      this.emit(conn.room, message)
      return
    }
    if (cmd === 'LIKE_INFO_V3_CLICK') {
      const now = Date.now()
      if (now - conn.lastLikeAt < 3000) return
      conn.lastLikeAt = now
      const data = payload.data as Record<string, unknown>
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        roomId: conn.room.id,
        type: 'like',
        userName: String(data?.uname ?? '观众'),
        text: `为主播点赞 ×${Number(data?.like_text ?? 1) || 1}`,
        timestamp: now,
        rawCommand: cmd
      }
      this.emit(conn.room, message)
      return
    }
    if (cmd === 'WATCHED_CHANGE') {
      const data = payload.data as Record<string, unknown>
      const watched = Number(data?.num ?? 0)
      if (watched > 0) {
        conn.online = watched
        const message: ChatMessage = {
          id: crypto.randomUUID(),
          roomId: conn.room.id,
          type: 'watched',
          text: `${watched.toLocaleString('zh-CN')} 人看过`,
          timestamp: Date.now(),
          rawCommand: cmd
        }
        this.emit(conn.room, message)
      }
      return
    }
    if (cmd === 'ROOM_REAL_TIME_MESSAGE_UPDATE') {
      const data = payload.data as Record<string, unknown>
      if (typeof data?.fans === 'number') {
        this.store.recordSnapshot(conn.room.roomId, { t: Date.now(), followers: data.fans })
      }
      return
    }
    if (cmd === 'LIVE') {
      this.emitSystem(conn.room, '直播已开始')
    } else if (cmd === 'PREPARING') {
      this.emitSystem(conn.room, '主播已下播，稍后回来')
    }
  }

  private emitSystem(room: Room, text: string): void {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      roomId: room.id,
      type: 'system',
      text,
      timestamp: Date.now()
    }
    this.emit(room, message)
  }

  private emit(room: Room, message: ChatMessage): void {
    if (message.type === 'chat' || message.type === 'gift' || message.type === 'superchat') {
      this.store.recordMessage(room.roomId)
    }
    for (const listener of this.messageListeners) {
      try {
        listener(room.id, message)
      } catch (error) {
        console.warn('[danmaku] listener failed', error)
      }
    }
  }

  disconnect(roomId: string): void {
    const conn = this.connections.get(roomId)
    if (!conn) return
    conn.stopped = true
    if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer)
    if (conn.heartbeat) clearInterval(conn.heartbeat)
    try {
      conn.socket?.removeAllListeners()
      conn.socket?.close()
    } catch {
      // ignore
    }
    this.connections.delete(roomId)
  }

  disconnectAll(): void {
    for (const roomId of [...this.connections.keys()]) this.disconnect(roomId)
    this.stopBurst()
  }

  async send(room: Room, text: string): Promise<void> {
    const cleaned = text.trim()
    if (!cleaned) throw new Error('弹幕不能为空')
    await this.bili.sendDanmaku(room, cleaned)
    this.store.addHistory({ roomId: room.id, text: cleaned, type: 'sent' })
  }

  startBurst(room: Room, text: string, count: number, gapMs: number): BurstState {
    if (room.platform !== 'bilibili') throw new Error('连发弹幕目前仅支持 B 站')
    if (this.burst) throw new Error('已有一组连发正在进行')
    const cleaned = text.trim()
    if (!cleaned) throw new Error('弹幕不能为空')
    if ([...cleaned].length > 20) throw new Error('B站弹幕最多 20 个字符')
    const total = Math.max(2, Math.min(15, Math.round(count)))
    const gap = Math.max(3000, Math.min(10_000, Math.round(gapMs)))
    this.burst = {
      room,
      text: cleaned,
      total,
      sent: 0,
      gapMs: gap,
      stopped: false
    }
    const state = this.burstState()
    this.emitBurst(state)
    void this.runBurst()
    return state
  }

  private async runBurst(): Promise<void> {
    const burst = this.burst
    if (!burst) return
    try {
      while (!burst.stopped && burst.sent < burst.total) {
        await this.bili.sendDanmaku(burst.room, burst.text)
        burst.sent += 1
        this.store.addHistory({ roomId: burst.room.id, text: burst.text, type: 'sent' })
        this.emitBurst(this.burstState())
        if (burst.sent >= burst.total) break
        await new Promise<void>((resolve) => {
          burst.timer = setTimeout(resolve, burst.gapMs)
        })
      }
      if (burst.sent > 0) {
        this.emitBurst({
          active: false,
          roomId: burst.room.id,
          sent: burst.sent,
          total: burst.total,
          text: burst.text
        })
      }
    } catch (error) {
      this.emitBurst({
        active: false,
        roomId: burst.room.id,
        sent: burst.sent,
        total: burst.total,
        text: burst.text,
        error: error instanceof Error ? error.message : '发送失败'
      })
    } finally {
      if (this.burst === burst) this.burst = undefined
    }
  }

  private burstState(): BurstState {
    const burst = this.burst
    if (!burst) return { active: false, sent: 0, total: 0 }
    return {
      active: true,
      roomId: burst.room.id,
      sent: burst.sent,
      total: burst.total,
      text: burst.text,
      nextAt: Date.now() + burst.gapMs
    }
  }

  stopBurst(): void {
    if (!this.burst) return
    this.burst.stopped = true
    if (this.burst.timer) clearTimeout(this.burst.timer)
    const state = {
      active: false,
      roomId: this.burst.room.roomId,
      sent: this.burst.sent,
      total: this.burst.total,
      text: this.burst.text
    }
    this.burst = undefined
    this.emitBurst(state)
  }

  private emitBurst(state: BurstState): void {
    for (const listener of this.burstListeners) {
      try {
        listener(state)
      } catch {
        // ignore
      }
    }
  }
}

function buildPacket(operation: number, body: Buffer): Buffer {
  const header = Buffer.alloc(16)
  header.writeUInt32BE(16 + body.length, 0)
  header.writeUInt16BE(16, 4)
  header.writeUInt16BE(1, 6)
  header.writeUInt32BE(operation, 8)
  header.writeUInt32BE(1, 12)
  return Buffer.concat([header, body])
}
