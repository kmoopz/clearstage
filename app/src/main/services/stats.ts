import type { Room } from '../../shared/types'
import type { BiliClient } from './bili'
import type { Store } from '../store'

export class StatsService {
  private readonly store: Store
  private readonly bili: BiliClient
  private activeRooms = new Map<string, Room>()
  private timer?: NodeJS.Timeout
  private polling = false

  constructor(store: Store, bili: BiliClient) {
    this.store = store
    this.bili = bili
  }

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.poll(), 60_000)
    this.timer.unref()
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }

  setActive(rooms: Room[]): void {
    this.activeRooms = new Map(rooms.map((room) => [room.id, room]))
    void this.poll()
  }

  async refresh(room: Room): Promise<void> {
    if (room.platform !== 'bilibili') return
    try {
      const stats = await this.bili.getQuickStats(room.roomId)
      this.store.recordSnapshot(room.roomId, {
        t: Date.now(),
        online: stats.online,
        followers: stats.followers
      })
    } catch (error) {
      console.warn('[stats] refresh failed', error)
    }
  }

  private async poll(): Promise<void> {
    if (this.polling) return
    if (!this.activeRooms.size) return
    this.polling = true
    try {
      for (const room of this.activeRooms.values()) {
        if (room.platform !== 'bilibili') {
          this.store.addWatchedSeconds(room.roomId, 60)
          continue
        }
        try {
          const stats = await this.bili.getQuickStats(room.roomId)
          this.store.recordSnapshot(room.roomId, {
            t: Date.now(),
            online: stats.online,
            followers: stats.followers
          })
          this.store.addWatchedSeconds(room.roomId, 60)
          const stored = this.store.data.rooms.find((item) => item.id === room.id)
          if (stored) {
            stored.viewerCount = stats.online
            stored.followers = stats.followers
            stored.liveStatus = stats.liveStatus
            if (stats.title) stored.title = stats.title
          }
        } catch (error) {
          console.warn('[stats] poll room failed', room.roomId, error)
        }
        await new Promise((resolve) => setTimeout(resolve, 800))
      }
      this.store.save()
    } finally {
      this.polling = false
    }
  }
}
