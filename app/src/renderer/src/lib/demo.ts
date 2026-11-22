import type {
  ChatMessage,
  Clip,
  FeedItem,
  Recording,
  Room,
  Song,
  StreamerStats
} from '../../../shared/types'

const now = Date.now()
const demoStarlight = new URL('../assets/themes/starlight.svg', import.meta.url).href
const demoSakura = new URL('../assets/themes/sakura.svg', import.meta.url).href
const demoStarEmoji = new URL('../assets/themes/emoji-star.svg', import.meta.url).href


export const DEMO_ROOMS: Room[] = [
  {
    id: 'demo:arena',
    platform: 'bilibili',
    roomId: 'demo-arena',
    title: '总决赛 · 二路解说席',
    streamer: '澄幕放映室',
    streamerId: '9617619',
    area: '赛事',
    liveStatus: 'live',
    viewerCount: 128_400,
    followers: 2_028_594,
    sourceUrl: 'https://live.bilibili.com/6',
    playbackMode: 'native',
    isDemo: true,
    addedAt: now - 86_400_000,
    lastOpenedAt: now
  },
  {
    id: 'demo:radio',
    platform: 'bilibili',
    roomId: 'demo-radio',
    title: '深夜电台｜把城市唱给你听',
    streamer: '林澈',
    streamerId: '2',
    area: '唱见',
    liveStatus: 'live',
    viewerCount: 12_890,
    followers: 128_000,
    sourceUrl: 'https://live.bilibili.com/2',
    playbackMode: 'native',
    isDemo: true,
    addedAt: now - 172_800_000,
    lastOpenedAt: now - 3_600_000
  },
  {
    id: 'demo:indie',
    platform: 'direct',
    roomId: 'demo-indie',
    title: '独立游戏首发试玩 · 第 2 夜',
    streamer: '像素旅馆',
    area: '单机游戏',
    liveStatus: 'live',
    viewerCount: 5_602,
    followers: 64_200,
    sourceUrl: 'https://example.com/clearstage-demo-stream',
    playbackMode: 'direct',
    note: '演示画面 · 通用直链',
    isDemo: true,
    addedAt: now - 3600_000 * 5,
    lastOpenedAt: now - 1200_000
  }
]

let messageSeed = 0
let messageId = 0
function msg(
  roomId: string,
  type: ChatMessage['type'],
  userName: string,
  text: string,
  extra: Partial<ChatMessage> = {},
  secondsAgo = messageSeed++
): ChatMessage {
  messageId += 1
  return {
    id: `demo-msg-${messageId}`,
    roomId,
    type,
    userName,
    text,
    timestamp: now - secondsAgo * 1500,
    ...extra
  }
}

export const DEMO_MESSAGES: ChatMessage[] = [
  msg('demo:arena', 'system', '', '欢迎来到澄幕演示直播间', {}, 60),
  msg('demo:arena', 'enter', '青柠气泡', '进入了直播间', {}, 50),
  msg('demo:arena', 'chat', '夜行列车', '这波团战开得太漂亮了', { medal: { name: '放映员', level: 21 } }, 42),
  msg('demo:arena', 'gift', '七号观众', '送出 打call ×6', { giftName: '打call', giftCount: 6, price: 6 }, 39),
  msg('demo:arena', 'chat', '薄荷汽水', '二路解说的节奏好舒服', { medal: { name: '观众', level: 6 } }, 33),
  msg('demo:arena', 'superchat', 'Aki', '第一次用澄幕看比赛，四路同开太爽了！', { price: 30 }, 29),
  msg('demo:arena', 'chat', '纸飞机', '请问这个多画面最多能开几路？', {}, 25),
  msg('demo:arena', 'chat', 'Ash', '看到左侧录制标志了，正在存档吗', {}, 21),
  msg('demo:arena', 'gift', '路过的风', '送出 小花花 ×10', { giftName: '小花花', giftCount: 10, price: 1 }, 17),
  msg('demo:arena', 'chat', '白桃乌龙', '主播这一手预判太准了', { medal: { name: '放映员', level: 18 } }, 13),
  msg('demo:arena', 'guard', '海盐芝士', '开通了 舰长', { guardName: '舰长', price: 198 }, 9),
  msg('demo:arena', 'chat', 'Nori', '今晚的解说阵容满分', {}, 6),
  msg('demo:arena', 'chat', '澄幕小助手', '录制文件可以在「录制库」里按时间线切片。', { isSelf: false }, 3),
  msg('demo:radio', 'chat', '落日飞车', '这首歌好适合夜里听', { medal: { name: '听友', level: 12 } }, 45),
  msg('demo:radio', 'gift', '桔梗', '送出 荧光棒 ×3', { giftName: '荧光棒', giftCount: 3, price: 3 }, 38),
  msg('demo:radio', 'superchat', '岛屿来信', '点一首《晚风》可以吗', { price: 50 }, 30),
  msg('demo:radio', 'chat', '半糖', '耳机党已经沉进去了', {}, 24),
  msg('demo:radio', 'chat', 'Lin', '刚才那首是什么名字？', {}, 18),
  msg('demo:radio', 'system', '', '歌曲识别：陈婧霏 - 深蓝', {}, 12),
  msg('demo:radio', 'chat', '木木', '自动分轨太方便了', { medal: { name: '听友', level: 8 } }, 7),
  msg('demo:radio', 'chat', '晚安电台', '今晚会唱到几点呀', {}, 2),
  msg('demo:indie', 'chat', '像素旅人', '这个美术风格好戳我', {}, 40),
  msg('demo:indie', 'gift', '8bit', '送出 小心心 ×8', { giftName: '小心心', giftCount: 8, price: 0.8 }, 33),
  msg('demo:indie', 'chat', 'Kite', '首发有折扣吗？', {}, 26),
  msg('demo:indie', 'chat', '果冻', '看主播玩比自己玩还紧张', {}, 19),
  msg('demo:indie', 'chat', 'Nox', '这段配乐好听，识别一下', {}, 11),
  msg('demo:indie', 'chat', '云层', '已经加愿望单了', {}, 4)
]

export const DEMO_RECORDINGS: Recording[] = [
  {
    id: 'demo-rec-1',
    roomId: 'demo:arena',
    roomTitle: '总决赛 · 二路解说席',
    streamer: '澄幕放映室',
    platform: 'bilibili',
    quality: '原画',
    startedAt: now - 3_540_000,
    endedAt: now - 1_800_000,
    status: 'completed',
    durationSec: 1721,
    sizeBytes: 1_760_000_000,
    segmentCount: 574,
    dir: 'C:\\Users\\Public\\Videos\\ClearStage\\20261122-143000_澄幕放映室',
    filePath: 'C:\\Users\\Public\\Videos\\ClearStage\\20261122-143000_澄幕放映室\\recording.mp4',
    songMode: false
  },
  {
    id: 'demo-rec-2',
    roomId: 'demo:radio',
    roomTitle: '深夜电台｜把城市唱给你听',
    streamer: '林澈',
    platform: 'bilibili',
    quality: '蓝光',
    startedAt: now - 7_200_000,
    endedAt: now - 5_040_000,
    status: 'completed',
    durationSec: 2160,
    sizeBytes: 892_000_000,
    segmentCount: 720,
    dir: 'C:\\Users\\Public\\Videos\\ClearStage\\20261122-120000_林澈',
    filePath: 'C:\\Users\\Public\\Videos\\ClearStage\\20261122-120000_林澈\\recording.mp4',
    songMode: true
  },
  {
    id: 'demo-rec-3',
    roomId: 'demo:indie',
    roomTitle: '独立游戏首发试玩 · 第 2 夜',
    streamer: '像素旅馆',
    platform: 'direct',
    quality: '原始画质',
    startedAt: now - 480_000,
    status: 'recording',
    durationSec: 478,
    sizeBytes: 209_000_000,
    segmentCount: 159,
    dir: 'C:\\Users\\Public\\Videos\\ClearStage\\20261122-154000_像素旅馆',
    filePath: 'C:\\Users\\Public\\Videos\\ClearStage\\20261122-154000_像素旅馆\\recording.m3u8',
    songMode: false
  }
]

export const DEMO_CLIPS: Clip[] = [
  {
    id: 'demo-clip-1',
    recordingId: 'demo-rec-1',
    roomId: 'demo:arena',
    roomTitle: '总决赛 · 二路解说席',
    title: '决胜团战 · 最后一波',
    startSec: 1260,
    endSec: 1378,
    createdAt: now - 1_500_000,
    filePath: 'C:\\Users\\Public\\Videos\\ClearStage\\clips\\决胜团战.mp4',
    sizeBytes: 96_400_000,
    method: 'precise',
    status: 'ready'
  },
  {
    id: 'demo-clip-2',
    recordingId: 'demo-rec-2',
    roomId: 'demo:radio',
    roomTitle: '深夜电台｜把城市唱给你听',
    title: '深蓝 · 现场版',
    startSec: 402,
    endSec: 658,
    createdAt: now - 4_000_000,
    filePath: 'C:\\Users\\Public\\Videos\\ClearStage\\clips\\深蓝-现场版.mp4',
    sizeBytes: 42_800_000,
    method: 'precise',
    status: 'ready'
  },
  {
    id: 'demo-clip-3',
    recordingId: 'demo-rec-2',
    roomId: 'demo:radio',
    roomTitle: '深夜电台｜把城市唱给你听',
    title: '晚风 · 点歌时间',
    startSec: 1180,
    endSec: 1392,
    createdAt: now - 3_900_000,
    filePath: 'C:\\Users\\Public\\Videos\\ClearStage\\clips\\晚风.mp4',
    sizeBytes: 61_200_000,
    method: 'segment',
    status: 'ready'
  }
]

export const DEMO_SONGS: Song[] = [
  {
    id: 'demo-song-1',
    recordingId: 'demo-rec-2',
    roomId: 'demo:radio',
    roomTitle: '深夜电台｜把城市唱给你听',
    title: '深蓝',
    artist: '陈婧霏',
    startedAt: now - 6_780_000,
    endedAt: now - 6_530_000,
    filePath: 'C:\\Users\\Public\\Videos\\ClearStage\\songs\\陈婧霏 - 深蓝.m4a',
    provider: 'acrcloud',
    confidence: 96
  },
  {
    id: 'demo-song-2',
    recordingId: 'demo-rec-2',
    roomId: 'demo:radio',
    roomTitle: '深夜电台｜把城市唱给你听',
    title: '晚风',
    artist: '陈婧霏',
    startedAt: now - 6_120_000,
    endedAt: now - 5_860_000,
    filePath: 'C:\\Users\\Public\\Videos\\ClearStage\\songs\\陈婧霏 - 晚风.m4a',
    provider: 'acrcloud',
    confidence: 91
  },
  {
    id: 'demo-song-3',
    recordingId: 'demo-rec-2',
    roomId: 'demo:radio',
    roomTitle: '深夜电台｜把城市唱给你听',
    title: '一生中最爱',
    artist: '陈奕迅',
    startedAt: now - 5_740_000,
    endedAt: now - 5_510_000,
    filePath: 'C:\\Users\\Public\\Videos\\ClearStage\\songs\\陈奕迅 - 一生中最爱.m4a',
    provider: 'manual'
  }
]

export function demoStats(roomId: string): StreamerStats {
  const room = DEMO_ROOMS.find((item) => item.id === roomId) ?? DEMO_ROOMS[0]
  const base = room.id === 'demo:radio' ? 128_420 : room.id === 'demo:indie' ? 64_280 : 2_028_594
  const snapshots = Array.from({ length: 32 }, (_, index) => ({
    t: now - (31 - index) * 5 * 60_000,
    followers: base - 900 + index * (room.id === 'demo:arena' ? 20 : 8) + Math.round(Math.sin(index) * 18),
    online: Math.max(1200, (room.viewerCount ?? 5000) - 2500 + index * 130 + Math.round(Math.cos(index * 0.7) * 480))
  }))
  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now - (6 - index) * 86_400_000)
    return {
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      giftValue: [328, 512, 268, 990, 742, 1_340, 866][index] + (room.id === 'demo:arena' ? 400 : 0),
      messages: [1800, 2410, 1600, 3900, 3200, 5100, 4300][index],
      peakOnline: [32_000, 41_000, 29_000, 62_000, 54_000, 88_000, 76_000][index],
      secondsWatched: 3600 * (index + 1)
    }
  })
  return {
    roomId: room.id,
    title: room.title,
    platform: room.platform,
    followers: base,
    online: room.viewerCount ?? 0,
    totalGiftValue: daily.reduce((sum, item) => sum + item.giftValue, 0),
    todayGiftValue: daily[6].giftValue,
    messages: daily.reduce((sum, item) => sum + item.messages, 0),
    peakOnline: Math.max(...daily.map((item) => item.peakOnline)),
    snapshots,
    topGifts: [
      { name: '打call', count: 182, value: 182 },
      { name: '舰长', count: 6, value: 1188 },
      { name: '醒目留言', count: 9, value: 260 },
      { name: '小花花', count: 324, value: 32.4 },
      { name: '小心心', count: 612, value: 61.2 }
    ],
    daily,
    disclaimer: '演示数据。真实环境中，礼物金额来自公开弹幕事件估算，涨粉数据从你使用澄幕期间开始记录。'
  }
}

export const DEMO_FEED: FeedItem[] = [
  {
    id: 'demo-feed-1',
    type: 'video',
    title: '凌晨三点的直播间，藏着城市里最温柔的声音',
    text: '这一期我们跟着声音，走过便利店、末班车和还没熄灯的房间。',
    cover: demoStarlight,
    url: 'https://www.bilibili.com/',
    publishedAt: now - 2 * 3600_000,
    author: '澄幕放映室',
    stats: { views: 184_000, likes: 12_400, duration: '18:42' }
  },
  {
    id: 'demo-feed-2',
    type: 'image',
    title: '今晚的直播间布置',
    text: '换了一块新的调音台，夜里的声音会更干净一点。',
    images: [demoStarlight, demoSakura],
    cover: demoStarlight,
    url: 'https://t.bilibili.com/',
    publishedAt: now - 26 * 3600_000,
    author: '澄幕放映室',
    stats: { likes: 3_210, comments: 186 }
  },
  {
    id: 'demo-feed-3',
    type: 'dynamic',
    title: '关于多画面的一点想法',
    text: '同时看四路比赛，不是为了看得更多，而是为了不错过那些同时发生的瞬间。',
    richText: [
      { type: 'text', text: '同时看四路比赛，不是为了看得更多，而是为了不错过那些同时发生的瞬间。 ' },
      { type: 'emoji', text: '[星星]', icon: demoStarEmoji }
    ],
    url: 'https://t.bilibili.com/',
    publishedAt: now - 3 * 86_400_000,
    author: '澄幕放映室',
    stats: { likes: 8_040, comments: 412 }
  },
  {
    id: 'demo-feed-4',
    type: 'video',
    title: '总决赛二路解说｜全场回放精选',
    text: '把最值得反复看的三十分钟剪了出来。',
    cover: demoSakura,
    url: 'https://www.bilibili.com/',
    publishedAt: now - 5 * 86_400_000,
    author: '澄幕放映室',
    stats: { views: 520_000, likes: 32_000, duration: '31:08' }
  }
]
