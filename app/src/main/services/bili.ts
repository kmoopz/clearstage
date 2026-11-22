import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { safeStorage } from 'electron'
import type {
  BiliAccount,
  BiliCookieInput,
  FeedItem,
  FeedResult,
  FeedTextSegment,
  LiveStatus,
  PlaybackInfo,
  Room,
  StreamVariant,
  StreamerProfile,
  StreamerStats
} from '../../shared/types'
import type { Store } from '../store'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28,
  14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21,
  56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52
]

const QN_LABELS: Record<number, string> = {
  30000: '杜比',
  20000: '4K',
  10000: '原画',
  401: '蓝光 杜比',
  400: '蓝光',
  250: '超清',
  150: '高清',
  80: '流畅'
}

export class BiliApiError extends Error {
  code: number
  constructor(code: number, message: string) {
    super(message)
    this.code = code
  }
}

interface CookieJarData {
  cookies: Record<string, string>
  updatedAt: number
}

export class BiliClient {
  private readonly store: Store
  private readonly cookiePath: string
  private cookies: Record<string, string> = {}
  private fingerprintPromise?: Promise<void>
  private wbiCache?: { key: string; fetchedAt: number; img: string; sub: string }
  private accountCache?: { account: BiliAccount; fetchedAt: number }

  constructor(store: Store) {
    this.store = store
    this.cookiePath = path.join(store.dataDir, 'bili-cookies.bin')
    this.loadCookies()
  }

  private loadCookies(): void {
    const candidates = [this.cookiePath, path.join(this.store.dataDir, 'bili-cookies.json')]
    for (const file of candidates) {
      if (!fs.existsSync(file)) continue
      try {
        const buffer = fs.readFileSync(file)
        let text: string
        if (file.endsWith('.bin')) {
          try {
            text = safeStorage.decryptString(buffer)
          } catch {
            // Older development builds may have written plain JSON with a .bin name.
            text = buffer.toString('utf8')
          }
        } else {
          text = buffer.toString('utf8')
        }
        const parsed = JSON.parse(text) as CookieJarData
        if (parsed.cookies && typeof parsed.cookies === 'object') {
          this.cookies = parsed.cookies
          return
        }
      } catch (error) {
        console.warn('[bili] could not load cookies', error)
      }
    }
  }

  private saveCookies(): void {
    const payload: CookieJarData = { cookies: this.cookies, updatedAt: Date.now() }
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(JSON.stringify(payload))
        fs.writeFileSync(this.cookiePath, encrypted)
      } else {
        fs.writeFileSync(path.join(this.store.dataDir, 'bili-cookies.json'), JSON.stringify(payload), {
          mode: 0o600
        })
      }
    } catch (error) {
      console.warn('[bili] failed to save cookies', error)
    }
  }

  private absorbSetCookie(headers: Headers): void {
    const values =
      typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [headers.get('set-cookie') ?? '']
    let changed = false
    for (const value of values) {
      if (!value) continue
      const pair = value.split(';')[0] ?? ''
      const index = pair.indexOf('=')
      if (index <= 0) continue
      const name = pair.slice(0, index).trim()
      const cookieValue = pair.slice(index + 1).trim()
      if (!name) continue
      this.cookies[name] = cookieValue
      changed = true
    }
    if (changed) this.saveCookies()
  }

  private cookieHeader(): string {
    return Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
  }

  hasLogin(): boolean {
    return Boolean(this.cookies.SESSDATA)
  }

  getCsrf(): string {
    return this.cookies.bili_jct ?? ''
  }

  getUidSync(): number {
    const fromCookie = Number(this.cookies.DedeUserID)
    if (Number.isFinite(fromCookie) && fromCookie > 0) return fromCookie
    return this.accountCache?.account.mid ?? 0
  }

  getBuvid(): string {
    return this.cookies.buvid3 ?? ''
  }

  async ensureFingerprint(): Promise<void> {
    if (this.cookies.buvid3) return
    if (this.fingerprintPromise) return this.fingerprintPromise
    this.fingerprintPromise = (async () => {
      try {
        const response = await fetch('https://api.bilibili.com/x/frontend/finger/spi', {
          headers: { 'user-agent': UA, referer: 'https://www.bilibili.com/' },
          signal: AbortSignal.timeout(15_000)
        })
        const json = (await response.json()) as {
          code: number
          data?: { b_3: string; b_4: string }
        }
        if (json.code === 0 && json.data) {
          this.cookies.buvid3 = json.data.b_3
          this.cookies.buvid4 = json.data.b_4
          this.cookies.b_nut = String(Math.floor(Date.now() / 1000))
          this.cookies._uuid = crypto.randomUUID().toUpperCase() + 'infoc'
          this.saveCookies()
        }
      } catch (error) {
        console.warn('[bili] fingerprint failed', error)
      } finally {
        this.fingerprintPromise = undefined
      }
    })()
    return this.fingerprintPromise
  }

  private async request(
    url: string,
    options: {
      method?: string
      body?: string
      referer?: string
      origin?: string
      headers?: Record<string, string>
      timeout?: number
    } = {}
  ): Promise<Response> {
    await this.ensureFingerprint()
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        'user-agent': UA,
        accept: 'application/json, text/plain, */*',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.6',
        referer: options.referer ?? 'https://live.bilibili.com/',
        origin: options.origin ?? 'https://live.bilibili.com',
        cookie: this.cookieHeader(),
        ...(options.headers ?? {})
      },
      body: options.body,
      signal: AbortSignal.timeout(options.timeout ?? 20_000)
    })
    this.absorbSetCookie(response.headers)
    return response
  }

  private async json<T>(
    url: string,
    options: Parameters<BiliClient['request']>[1] = {}
  ): Promise<T> {
    const response = await this.request(url, options)
    const text = await response.text()
    let parsed: { code: number; message?: string; msg?: string; data?: T }
    try {
      parsed = JSON.parse(text) as { code: number; message?: string; msg?: string; data?: T }
    } catch {
      throw new BiliApiError(-1, `B站返回了非 JSON 响应（HTTP ${response.status}），请稍后重试`)
    }
    if (parsed.code !== 0) {
      const code = parsed.code
      let message = parsed.message || parsed.msg || `B站接口错误 ${code}`
      if (code === -352 || code === -412) {
        message = 'B站风控拦截了本次请求。请在「设置 → 账号」扫码登录，或先在浏览器打开直播间后再试。'
      } else if (code === -101) {
        message = 'B站账号未登录或登录已过期'
      } else if (code === -799) {
        message = 'B站请求过于频繁，请稍等几分钟再试'
      }
      throw new BiliApiError(code, message)
    }
    return parsed.data as T
  }

  private async getWbiKey(force = false): Promise<string> {
    if (!force && this.wbiCache && Date.now() - this.wbiCache.fetchedAt < 30 * 60_000) {
      return this.wbiCache.key
    }
    await this.ensureFingerprint()
    // The nav endpoint returns -101 when logged out, but still includes wbi_img.
    // Do not route this through json(), or anonymous WBI signing would fail.
    const response = await this.request('https://api.bilibili.com/x/web-interface/nav', {
      referer: 'https://www.bilibili.com/',
      origin: 'https://www.bilibili.com'
    })
    const text = await response.text()
    let parsed: { code: number; message?: string; data?: { wbi_img?: { img_url: string; sub_url: string } } }
    try {
      parsed = JSON.parse(text) as typeof parsed
    } catch {
      throw new BiliApiError(-1, 'B站 WBI 签名接口返回异常')
    }
    const wbi = parsed.data?.wbi_img
    if (!wbi?.img_url || !wbi?.sub_url) {
      throw new BiliApiError(parsed.code || -1, parsed.message || '无法获取 B站 WBI 签名密钥')
    }
    const img = wbi.img_url.split('/').pop()?.split('.')[0] ?? ''
    const sub = wbi.sub_url.split('/').pop()?.split('.')[0] ?? ''
    const raw = img + sub
    const key = MIXIN_KEY_ENC_TAB.map((index) => raw[index] ?? '')
      .join('')
      .slice(0, 32)
    this.wbiCache = {
      key,
      fetchedAt: Date.now(),
      img: wbi.img_url,
      sub: wbi.sub_url
    }
    return key
  }

  private async signWbi(params: Record<string, string | number>): Promise<string> {
    const key = await this.getWbiKey()
    return this.signWithKey(params, key)
  }

  private signWithKey(params: Record<string, string | number>, key: string): string {
    const payload: Record<string, string | number> = {
      ...params,
      wts: Math.floor(Date.now() / 1000)
    }
    const query = Object.keys(payload)
      .sort()
      .map((name) => {
        const value = String(payload[name]).replace(/[!'()*]/g, '')
        return `${encodeURIComponent(name)}=${encodeURIComponent(value)}`
      })
      .join('&')
    const rid = crypto.createHash('md5').update(query + key).digest('hex')
    return `${query}&w_rid=${rid}`
  }

  async getRoom(rawInput: string | number): Promise<Room> {
    await this.ensureFingerprint()
    const input = String(rawInput)
    const started = Date.now()
    const info = await this.json<{
      uid: number
      room_id: number
      short_id: number
      attention: number
      online: number
      live_status: number
      title: string
      user_cover: string
      keyframe: string
      description: string
      area_name: string
      parent_area_name: string
      live_time: string
    }>(`https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${encodeURIComponent(input)}`, {
      referer: `https://live.bilibili.com/${encodeURIComponent(input)}`
    })
    const anchor = await this.json<{
      info: {
        uid: number
        uname: string
        face: string
        official_verify?: { desc?: string }
      }
    }>(
      `https://api.live.bilibili.com/live_user/v1/UserInfo/get_anchor_in_room?roomid=${info.room_id}`,
      { referer: `https://live.bilibili.com/${info.room_id}` }
    ).catch(() => null)
    const liveStatus: LiveStatus =
      info.live_status === 1 ? 'live' : info.live_status === 2 ? 'replay' : 'offline'
    const room: Room = {
      id: `bilibili:${info.room_id}`,
      platform: 'bilibili',
      roomId: String(info.room_id),
      title: info.title || `直播间 ${info.room_id}`,
      streamer: anchor?.info?.uname || `UP ${info.uid}`,
      streamerId: String(info.uid),
      avatar: anchor?.info?.face || undefined,
      cover: info.user_cover || info.keyframe || undefined,
      area: info.area_name || info.parent_area_name || undefined,
      liveStatus,
      viewerCount: info.online,
      followers: info.attention,
      sourceUrl: `https://live.bilibili.com/${info.room_id}`,
      playbackMode: 'native',
      addedAt: started,
      lastOpenedAt: started
    }
    return room
  }

  async refreshRoom(room: Room): Promise<Room> {
    const fresh = await this.getRoom(room.roomId)
    return {
      ...room,
      ...fresh,
      addedAt: room.addedAt,
      lastOpenedAt: room.lastOpenedAt,
      note: room.note
    }
  }

  async getQuickStats(roomId: string): Promise<{
    online: number
    followers: number
    liveStatus: LiveStatus
    title: string
  }> {
    await this.ensureFingerprint()
    const info = await this.json<{
      online: number
      attention: number
      live_status: number
      title: string
    }>(`https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${encodeURIComponent(roomId)}`, {
      referer: `https://live.bilibili.com/${roomId}`
    })
    return {
      online: info.online,
      followers: info.attention,
      liveStatus: info.live_status === 1 ? 'live' : info.live_status === 2 ? 'replay' : 'offline',
      title: info.title
    }
  }

  async getPlayInfo(
    room: Room,
    quality = 10000,
    proxy: (url: string, headers: Record<string, string>) => string
  ): Promise<PlaybackInfo> {
    if (room.platform !== 'bilibili') throw new BiliApiError(-1, '不是 B 站直播间')
    await this.ensureFingerprint()
    const qn = this.hasLogin() ? quality : Math.min(quality, 400)
    const query = new URLSearchParams({
      room_id: room.roomId,
      protocol: '0,1',
      format: '0,1,2',
      codec: '0,1',
      qn: String(qn),
      platform: 'web',
      ptype: '8'
    })
    const data = await this.json<{
      room_id: number
      live_status: number
      playurl_info: {
        playurl: {
          g_qn_desc: Array<{ qn: number; desc: string }>
          stream: Array<{
            protocol_name: string
            format: Array<{
              format_name: string
              codec: Array<{
                codec_name: string
                current_qn: number
                accept_qn: number[]
                base_url: string
                url_info: Array<{ host: string; extra: string }>
              }>
            }>
          }>
        }
      } | null
    }>(
      `https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo?${query.toString()}`,
      { referer: `https://live.bilibili.com/${room.roomId}` }
    )
    if (!data.playurl_info) {
      return {
        roomId: room.roomId,
        title: room.title,
        variants: [],
        defaultVariantId: '',
        qualities: [],
        expiresAt: Date.now(),
        liveStatus: data.live_status === 1 ? 'live' : 'offline',
        hint:
          data.live_status === 1
            ? 'B站没有返回可播放地址，可能需要登录或该画质不可用'
            : '主播当前未开播'
      }
    }
    const headers: Record<string, string> = {
      referer: `https://live.bilibili.com/${room.roomId}`,
      origin: 'https://live.bilibili.com',
      'user-agent': UA
    }
    const variants: StreamVariant[] = []
    const available = new Map<number, string>()
    for (const item of data.playurl_info.playurl.g_qn_desc) {
      available.set(item.qn, item.desc || QN_LABELS[item.qn] || `${item.qn}`)
    }
    for (const stream of data.playurl_info.playurl.stream) {
      const protocol =
        stream.protocol_name === 'http_hls' ? 'hls' : stream.protocol_name === 'http_stream' ? 'flv' : null
      if (!protocol) continue
      for (const format of stream.format) {
        if (protocol === 'hls' && format.format_name !== 'ts') continue
        if (protocol === 'flv' && format.format_name !== 'flv') continue
        for (const codec of format.codec) {
          if (codec.codec_name !== 'avc') continue
          const info = codec.url_info[0]
          if (!info) continue
          const base = info.host + codec.base_url
          const joiner = base.endsWith('?') || base.endsWith('&') ? '' : base.includes('?') ? '&' : '?'
          const sourceUrl = codec.url_info[0].extra ? `${base}${joiner}${info.extra}` : base
          variants.push({
            id: `${protocol}-${codec.current_qn}`,
            label: available.get(codec.current_qn) ?? QN_LABELS[codec.current_qn] ?? '自动',
            quality: codec.current_qn,
            protocol,
            codec: codec.codec_name,
            url: proxy(sourceUrl, headers),
            mime: protocol === 'hls' ? 'application/vnd.apple.mpegurl' : 'video/x-flv'
          })
          for (const q of codec.accept_qn) {
            if (!available.has(q)) available.set(q, QN_LABELS[q] ?? `画质 ${q}`)
          }
        }
      }
    }
    variants.sort((a, b) => (a.protocol === 'hls' ? -1 : 1) - (b.protocol === 'hls' ? -1 : 1))
    const selected = variants[0]
    return {
      roomId: room.roomId,
      title: room.title,
      variants: selected ? [selected] : [],
      defaultVariantId: selected?.id ?? '',
      qualities: [...available.entries()]
        .map(([quality, label]) => ({ quality, label }))
        .sort((a, b) => b.quality - a.quality),
      expiresAt: Date.now() + 2 * 60_000,
      liveStatus: data.live_status === 1 ? 'live' : 'offline',
      hint: selected ? undefined : '没有找到兼容的直播流'
    }
  }

  async getDanmakuServer(roomId: string | number): Promise<{
    token: string
    hosts: Array<{ host: string; wss_port: number; ws_port: number; port: number }>
  }> {
    const params = { id: String(roomId), type: 0, web_location: 444.8 }
    let query = await this.signWbi(params)
    let response: {
      token: string
      host_list: Array<{ host: string; wss_port: number; ws_port: number; port: number }>
    }
    try {
      response = await this.json(
        `https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo?${query}`,
        { referer: `https://live.bilibili.com/${roomId}` }
      )
    } catch (error) {
      if (error instanceof BiliApiError && (error.code === -352 || error.code === -403)) {
        await this.getWbiKey(true)
        query = await this.signWbi(params)
        response = await this.json(
          `https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo?${query}`,
          { referer: `https://live.bilibili.com/${roomId}` }
        )
      } else {
        throw error
      }
    }
    if (!response?.token || !response.host_list?.length) {
      throw new BiliApiError(-1, 'B站没有返回弹幕服务器信息')
    }
    return { token: response.token, hosts: response.host_list }
  }

  async getAccount(force = false, strict = false): Promise<BiliAccount> {
    if (!force && this.accountCache && Date.now() - this.accountCache.fetchedAt < 60_000) {
      return this.accountCache.account
    }
    try {
      await this.ensureFingerprint()
      const nav = await this.json<{
        isLogin: boolean
        mid?: number
        uname?: string
        face?: string
        vipStatus?: number
        wbi_img?: { img_url: string; sub_url: string }
      }>('https://api.bilibili.com/x/web-interface/nav', {
        referer: 'https://www.bilibili.com/',
        origin: 'https://www.bilibili.com'
      })
      if (nav.isLogin) {
        if (nav.mid && this.cookies.DedeUserID !== String(nav.mid)) {
          this.cookies.DedeUserID = String(nav.mid)
          this.saveCookies()
        }
        this.accountCache = {
          account: {
            loggedIn: true,
            mid: nav.mid,
            uname: nav.uname,
            face: nav.face,
            vip: Boolean(nav.vipStatus),
            cookieSaved: true,
            canSendDanmaku: Boolean(this.cookies.bili_jct)
          },
          fetchedAt: Date.now()
        }
      } else {
        this.accountCache = { account: { loggedIn: false }, fetchedAt: Date.now() }
      }
      return this.accountCache.account
    } catch (error) {
      if (strict) {
        if (error instanceof BiliApiError) throw error
        throw new BiliApiError(
          -1,
          `无法连接 B 站验证账号：${error instanceof Error ? error.message : '网络错误'}`
        )
      }
      return {
        loggedIn: this.hasLogin(),
        cookieSaved: this.hasLogin(),
        canSendDanmaku: Boolean(this.cookies.bili_jct)
      }
    }
  }

  async logout(): Promise<void> {
    for (const name of ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'sid']) {
      delete this.cookies[name]
    }
    this.accountCache = undefined
    this.saveCookies()
  }

  async importCookies(input: BiliCookieInput): Promise<BiliAccount> {
    const sessdata = normalizeBiliCookie(input.sessdata, 'SESSDATA')
    if (!sessdata) throw new BiliApiError(-1, '请填写 B 站 SESSDATA')
    const biliJct = normalizeBiliCookie(input.biliJct ?? '', 'bili_jct')
    const dedeUserId = (input.dedeUserId ?? '').replace(/\D/g, '')

    const backup = { ...this.cookies }
    this.cookies.SESSDATA = sessdata
    if (biliJct) this.cookies.bili_jct = biliJct
    else delete this.cookies.bili_jct
    if (dedeUserId) this.cookies.DedeUserID = dedeUserId
    else delete this.cookies.DedeUserID
    delete this.cookies.DedeUserID__ckMd5
    delete this.cookies.sid
    this.accountCache = undefined
    this.saveCookies()

    try {
      const account = await this.getAccount(true, true)
      if (!account.loggedIn) {
        throw new BiliApiError(-101, 'SESSDATA 无效或已过期，请重新从浏览器复制')
      }
      if (account.mid) this.cookies.DedeUserID = String(account.mid)
      this.saveCookies()
      return { ...account, canSendDanmaku: Boolean(this.cookies.bili_jct) }
    } catch (error) {
      this.cookies = backup
      this.accountCache = undefined
      this.saveCookies()
      if (error instanceof BiliApiError) throw error
      throw new BiliApiError(
        -1,
        `无法验证登录凭证：${error instanceof Error ? error.message : '网络错误'}。请检查网络后重试。`
      )
    }
  }

  async sendDanmaku(room: Room, text: string): Promise<void> {
    if (!this.hasLogin()) throw new BiliApiError(-101, '请先在设置中扫码登录 B 站账号')
    const csrf = this.getCsrf()
    if (!csrf) throw new BiliApiError(-101, '登录凭证缺少 bili_jct，请重新登录')
    const cleaned = text.replace(/\s+/g, ' ').trim()
    if (!cleaned) throw new BiliApiError(-1, '弹幕不能为空')
    if ([...cleaned].length > 20) throw new BiliApiError(-1, 'B站弹幕最多 20 个字符')
    const body = new URLSearchParams({
      bubble: '0',
      msg: cleaned,
      color: '16777215',
      mode: '1',
      fontsize: '25',
      rnd: String(Math.floor(Date.now() / 1000)),
      roomid: room.roomId,
      csrf,
      csrf_token: csrf
    })
    await this.json('https://api.live.bilibili.com/msg/send', {
      method: 'POST',
      body: body.toString(),
      referer: `https://live.bilibili.com/${room.roomId}`,
      origin: 'https://live.bilibili.com',
      headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' }
    })
  }

  async getProfile(uid: number | string): Promise<StreamerProfile> {
    const [card, relation] = await Promise.all([
      this.json<{
        card: {
          mid: string
          name: string
          face: string
          sign: string
          level: number
          archive_count?: number
        }
      }>(`https://api.bilibili.com/x/web-interface/card?mid=${uid}`, {
        referer: `https://space.bilibili.com/${uid}`
      }),
      this.json<{ follower: number; following: number }>(
        `https://api.bilibili.com/x/relation/stat?vmid=${uid}`,
        { referer: `https://space.bilibili.com/${uid}` }
      )
    ])
    return {
      uid: Number(uid),
      name: card.card.name,
      face: card.card.face,
      sign: card.card.sign,
      followers: relation.follower,
      following: relation.following,
      level: card.card.level,
      archiveCount: card.card.archive_count
    }
  }

  async getFollowerCount(uid: number | string): Promise<number> {
    const data = await this.json<{ follower: number }>(
      `https://api.bilibili.com/x/relation/stat?vmid=${uid}`,
      { referer: `https://space.bilibili.com/${uid}` }
    )
    return data.follower
  }

  async getDynamics(uid: string, offset = ''): Promise<FeedResult> {
    const params: Record<string, string | number> = {
      host_mid: uid,
      features: 'itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote',
      timezone_offset: -480
    }
    if (offset) params.offset = offset
    const query = await this.signWbi(params)
    const data = await this.json<{
      items: Array<Record<string, unknown>>
      has_more: boolean
      offset?: string
    }>(
      `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?${query}`,
      {
        referer: `https://space.bilibili.com/${uid}/dynamic`,
        origin: 'https://space.bilibili.com',
        headers: { 'accept-language': 'zh-CN,zh;q=0.9' }
      }
    )
    const items = (data.items ?? []).map((item) => this.normalizeDynamic(item)).filter(Boolean) as FeedItem[]
    return {
      items,
      hasMore: Boolean(data.has_more),
      offset: data.offset,
      fetchedAt: Date.now()
    }
  }

  private normalizeDynamic(raw: Record<string, unknown>): FeedItem | null {
    const id = String(raw.id_str ?? raw.id ?? '')
    if (!id) return null
    const modules = (raw.modules ?? {}) as Record<string, Record<string, unknown>>
    const dynamic = (modules.module_dynamic ?? {}) as Record<string, unknown>
    const author = (modules.module_author ?? {}) as Record<string, unknown>
    const stat = (modules.module_stat ?? {}) as Record<string, Record<string, number>>
    const major = (dynamic.major ?? {}) as Record<string, Record<string, unknown>>
    const publishedAt = Date.parse(String(author.pub_ts ? Number(author.pub_ts) * 1000 : Date.now()))
    const authorName = String(author.name ?? '')
    const baseUrl = `https://t.bilibili.com/${id}`
    const desc = (dynamic.desc as { text?: string; rich_text_nodes?: Array<Record<string, unknown>> } | undefined)
    const descText = desc?.text
    const descRich = this.normalizeRichText(desc)
    const archive = major.archive as
      | {
          bvid?: string
          title?: string
          cover?: string
          desc?: string
          duration_text?: string
          stat?: { play?: number; danmaku?: number }
        }
      | undefined
    if (archive) {
      return {
        id,
        type: 'video',
        title: archive.title || '视频',
        text: archive.desc || '',
        cover: this.fixImage(archive.cover),
        url: archive.bvid ? `https://www.bilibili.com/video/${archive.bvid}` : baseUrl,
        publishedAt: Number.isFinite(publishedAt) ? publishedAt : Date.now(),
        author: authorName,
        stats: {
          views: archive.stat?.play,
          comments: archive.stat?.danmaku,
          duration: archive.duration_text
        }
      }
    }
    const opus = major.opus as
      | {
          title?: string
          summary?: { text?: string; rich_text_nodes?: Array<Record<string, unknown>> }
          pics?: Array<{ url?: string }>
        }
      | undefined
    if (opus) {
      const images = (opus.pics ?? []).map((pic) => this.fixImage(pic.url)).filter(Boolean) as string[]
      const opusRich = this.normalizeRichText(opus.summary)
      return {
        id,
        type: images.length ? 'image' : 'dynamic',
        title: opus.title || descText?.slice(0, 50) || '动态',
        text: opus.summary?.text || descText || '',
        richText: opusRich ?? descRich,
        images,
        cover: images[0],
        url: baseUrl,
        publishedAt: Number.isFinite(publishedAt) ? publishedAt : Date.now(),
        author: authorName,
        stats: {
          likes: stat.like?.count,
          comments: stat.comment?.count
        }
      }
    }
    const draw = major.draw as { items?: Array<{ src?: string }> } | undefined
    if (draw?.items?.length) {
      const images = draw.items.map((item) => this.fixImage(item.src)).filter(Boolean) as string[]
      return {
        id,
        type: 'image',
        title: descText?.slice(0, 80) || '图片动态',
        text: descText || '',
        richText: descRich,
        images,
        cover: images[0],
        url: baseUrl,
        publishedAt: Number.isFinite(publishedAt) ? publishedAt : Date.now(),
        author: authorName,
        stats: { likes: stat.like?.count, comments: stat.comment?.count }
      }
    }
    const live = major.live_rcmd as { content?: string } | undefined
    if (live) {
      return {
        id,
        type: 'live',
        title: '直播推荐',
        text: (live.content || '').replace(/<[^>]+>/g, ''),
        url: baseUrl,
        publishedAt: Number.isFinite(publishedAt) ? publishedAt : Date.now(),
        author: authorName
      }
    }
    return {
      id,
      type: raw.type === 'DYNAMIC_TYPE_FORWARD' ? 'forward' : 'dynamic',
      title: descText?.slice(0, 80) || '动态',
      text: descText || '',
      richText: descRich,
      url: baseUrl,
      publishedAt: Number.isFinite(publishedAt) ? publishedAt : Date.now(),
      author: authorName,
      stats: { likes: stat.like?.count, comments: stat.comment?.count }
    }
  }

  private normalizeRichText(value: unknown): FeedTextSegment[] | undefined {
    const nodes = (value as { rich_text_nodes?: Array<Record<string, unknown>> } | undefined)?.rich_text_nodes
    if (!nodes?.length) return undefined
    const segments: FeedTextSegment[] = []
    for (const node of nodes) {
      const text = String(node.text ?? '')
      const type = String(node.type ?? '')
      const emoji = node.emoji as { icon_url?: string; text?: string } | undefined
      if (type.includes('EMOJI') || emoji?.icon_url) {
        const icon = this.fixImage(emoji?.icon_url)
        if (icon) segments.push({ type: 'emoji', text: emoji?.text || text || '[表情]', icon })
        else if (text) segments.push({ type: 'text', text })
      } else if (text) {
        segments.push({ type: 'text', text })
      }
    }
    return segments.length ? segments : undefined
  }

  private fixImage(url?: string | null): string | undefined {
    if (!url) return undefined
    if (url.startsWith('//')) return `https:${url}`
    if (url.startsWith('http://')) return `https://${url.slice(7)}`
    return url
  }

  async getVideos(uid: string): Promise<FeedResult> {
    const params = {
      mid: uid,
      pn: 1,
      ps: 18,
      order: 'pubdate',
      platform: 'web',
      web_location: 1550101
    }
    const query = await this.signWbi(params)
    try {
      const data = await this.json<{
        list: {
          vlist: Array<{
            bvid: string
            title: string
            description: string
            pic: string
            created: number
            length: string
            play: number
            video_review: number
          }>
        }
        page: { count: number }
      }>(`https://api.bilibili.com/x/space/wbi/arc/search?${query}`, {
        referer: `https://space.bilibili.com/${uid}/video`,
        origin: 'https://space.bilibili.com'
      })
      return {
        items: (data.list?.vlist ?? []).map((video) => ({
          id: video.bvid,
          type: 'video' as const,
          title: video.title,
          text: video.description,
          cover: this.fixImage(video.pic),
          url: `https://www.bilibili.com/video/${video.bvid}`,
          publishedAt: video.created * 1000,
          stats: { views: video.play, comments: video.video_review, duration: video.length }
        })),
        hasMore: false,
        fetchedAt: Date.now()
      }
    } catch (error) {
      // Fall back to videos embedded in the dynamic timeline. This also avoids hard-failing
      // for accounts that do not expose the legacy archive endpoint.
      const dynamics = await this.getDynamics(uid)
      const videos = dynamics.items.filter((item) => item.type === 'video')
      return {
        ...dynamics,
        items: videos,
        message:
          error instanceof Error
            ? `完整投稿列表暂时不可用，已回退为近期视频。${error.message}`
            : '已回退为近期视频'
      }
    }
  }

  async getStreamerStats(room: Room, days = 7): Promise<StreamerStats> {
    const stats = await this.getRemoteStats(room, days)
    return stats
  }

  private async getRemoteStats(room: Room, days: number): Promise<StreamerStats> {
    let followers = room.followers ?? 0
    if (room.streamerId) {
      followers = await this.getFollowerCount(room.streamerId).catch(() => followers)
    }
    const allSnapshots = this.store.data.snapshots[room.roomId] ?? []
    const cutoff = Date.now() - days * 86_400_000
    const snapshots = allSnapshots.filter((item) => item.t >= cutoff)
    const dailyMap = new Map<string, StreamerStats['daily'][number]>()
    for (const [key, day] of Object.entries(this.store.data.daily)) {
      if (!key.endsWith(`:${room.roomId}`)) continue
      dailyMap.set(day.date, { ...day })
    }
    const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-days)
    const totalGiftValue = daily.reduce((sum, item) => sum + item.giftValue, 0)
    const today = new Date()
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const todayGiftValue = dailyMap.get(todayKey)?.giftValue ?? 0
    const messages = daily.reduce((sum, item) => sum + item.messages, 0)
    const peakOnline = daily.reduce((max, item) => Math.max(max, item.peakOnline), 0)
    const giftItems = Object.values(this.store.data.giftAgg)
      .filter((item) => item.roomId === room.roomId)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
    return {
      roomId: room.roomId,
      title: room.title,
      platform: room.platform,
      followers,
      online: room.viewerCount ?? 0,
      totalGiftValue,
      todayGiftValue,
      messages,
      peakOnline,
      snapshots,
      topGifts: giftItems.map(({ name, count, value }) => ({ name, count, value })),
      daily,
      disclaimer: '礼物金额来自公开弹幕中的礼物事件估算，不代表平台结算数据；涨粉数据从你使用澄幕期间开始记录。'
    }
  }
}

export function normalizeBiliCookie(raw: string, name: 'SESSDATA' | 'bili_jct'): string {
  let value = raw.trim()
  if (!value) return ''
  value = value.replace(/^cookie:\s*/i, '')
  const match = value.match(new RegExp(`(?:^|[;\\s])${name}=([^;\\s]+)`, 'i'))
  if (match) value = match[1]
  else if (value.toLowerCase().startsWith(`${name.toLowerCase()}=`)) value = value.slice(name.length + 1)
  return value.replace(/^["']|["']$/g, '').replace(/[;,]+$/, '').trim()
}

export function isBiliUrl(input: string): boolean {
  return /(?:live\.bilibili\.com\/|^bilibili:|^\d+$)/.test(input.trim())
}

export function parseBiliRoomId(input: string): string {
  const trimmed = input.trim()
  if (/^\d+$/.test(trimmed)) return trimmed
  const match = trimmed.match(/live\.bilibili\.com\/(?:blanc\/)?(\d+)/)
  return match?.[1] ?? trimmed
}
