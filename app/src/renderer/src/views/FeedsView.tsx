import { startTransition, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Bookmark,
  ExternalLink,
  Eye,
  Film,
  Image as ImageIcon,
  MessageCircle,
  Radio,
  RefreshCw,
  Rss,
  ThumbsUp,
  Users,
  X
} from 'lucide-react'
import type { FeedItem, FeedResult, FeedTextSegment, StreamerProfile } from '../../../shared/types'
import { useAppStore } from '../store'
import { DEMO_FEED } from '../lib/demo'
import { errorMessage, formatNumber, timeAgo, uidSalt } from '../lib/format'

type FeedTab = 'dynamic' | 'video'

export function FeedsView() {
  const rooms = useAppStore((state) => state.rooms)
  const selectedId = useAppStore((state) => state.selectedId)
  const info = useAppStore((state) => state.info)
  const auth = useAppStore((state) => state.auth)
  const setPage = useAppStore((state) => state.setPage)
  const [roomId, setRoomId] = useState(selectedId ?? rooms[0]?.id ?? '')
  const [tab, setTab] = useState<FeedTab>('dynamic')
  const [feed, setFeed] = useState<FeedResult | null>(null)
  const [profile, setProfile] = useState<StreamerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)

  const room = rooms.find((item) => item.id === roomId) ?? rooms[0]
  const isDirect = Boolean(room) && room?.platform !== 'bilibili'

  useEffect(() => {
    if (!roomId && rooms[0]) setRoomId(rooms[0].id)
  }, [rooms, roomId])

  async function load(force = false) {
    if (!room) {
      setLoading(false)
      return
    }
    if (isDirect) {
      setFeed(null)
      setProfile(null)
      setLoading(false)
      setError('')
      return
    }
    setLoading(true)
    setError('')
    try {
      if (info?.isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        const items = tab === 'video' ? DEMO_FEED.filter((item) => item.type === 'video') : DEMO_FEED
        setFeed({ items, hasMore: false, fetchedAt: Date.now() })
        setProfile({
          uid: Number(room.streamerId ?? 0),
          name: room.streamer,
          face: room.avatar,
          sign: '把喜欢的声音和画面，留在自己的桌面上。',
          followers: room.followers,
          following: 128,
          level: 6,
          archiveCount: 48
        })
      } else {
        const [result, profileResult] = await Promise.all([
          window.clearstage.feeds.get(room.id, tab),
          window.clearstage.feeds.profile(room.streamerId ?? '').catch(() => null)
        ])
        setFeed(result)
        if (profileResult) setProfile(profileResult)
        if (result.message) setError(result.message)
      }
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, tab, info?.isDemo])

  const visibleItems = useMemo(() => {
    if (!feed) return []
    return feed.items
  }, [feed])

  if (rooms.length === 0) {
    return (
      <section className="view feeds-view">
        <header className="page-head">
          <div className="page-head-copy">
            <span className="eyebrow"><Rss size={12} /> SIGNAL FEED · 动态与投稿</span>
            <h1>画面之外<span className="head-em">还有完整的表达。</span></h1>
            <p>在同一个界面里浏览主播的动态、图文与近期投稿。</p>
          </div>
        </header>
        <div className="library-empty wide stats-empty">
          <Rss size={28} />
          <strong>还没有可关注的主播</strong>
          <p>添加 B 站直播间后，这里会显示主播的公开动态与视频。</p>
          <button className="btn btn-primary" onClick={() => useAppStore.getState().setAddRoomOpen(true)}>
            添加直播间
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="view feeds-view">
      <header className="page-head">
        <div className="page-head-copy">
          <span className="eyebrow"><Rss size={12} /> SIGNAL FEED · 动态与投稿</span>
          <h1>
            画面之外
            <span className="head-em">还有完整的表达。</span>
          </h1>
          <p>不离开工作台，读完主播最近说了什么、发了什么。</p>
        </div>
        <div className="page-head-actions">
          <div className="select-wrap">
            <select value={room?.id ?? ''} onChange={(event) => startTransition(() => setRoomId(event.target.value))}>
              {rooms.map((item) => (
                <option key={item.id} value={item.id}>{item.streamer} · {item.title.slice(0, 12)}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => void load(true)} disabled={isDirect}>
            <RefreshCw size={14} /> 刷新
          </button>
          {room?.platform === 'bilibili' && room.streamerId && (
            <button
              className="btn btn-soft btn-sm"
              onClick={() => void window.clearstage.app.openExternal(`https://space.bilibili.com/${room.streamerId}`)}
            >
              打开 B 站空间 <ArrowUpRight size={13} />
            </button>
          )}
        </div>
      </header>

      {isDirect ? (
        <div className="platform-limit">
          <span className="platform-limit-art"><AlertTriangle size={26} /></span>
          <div>
            <span className="eyebrow">DIRECT MODE</span>
            <h2>通用直链没有动态与投稿</h2>
            <p>
              通用 HLS / FLV 直链只提供直播画面与本地录制，不包含主播资料、动态或投稿接口。需要浏览 B 站主播动态时，请添加对应的 B 站直播间；澄幕不会对任意直链猜测或抓取作者数据。
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="creator-banner">
            <div className="creator-profile">
              <span className="creator-avatar">
                {profile?.face ? <img src={profile.face} alt="" /> : room?.avatar ? <img src={room.avatar} alt="" /> : room?.streamer.slice(0, 1)}
              </span>
              <div>
                <span className="eyebrow">CREATOR PROFILE</span>
                <h2>{profile?.name ?? room?.streamer}</h2>
                <p>{profile?.sign || '这个主播还没有填写签名。'}</p>
              </div>
            </div>
            <div className="creator-stats">
              <div><span><Users size={12} /> 粉丝</span><b>{formatNumber(profile?.followers ?? room?.followers)}</b></div>
              <div><span>关注</span><b>{formatNumber(profile?.following)}</b></div>
              <div><span>等级</span><b>LV{profile?.level ?? 6}</b></div>
              <div><span>投稿</span><b>{formatNumber(profile?.archiveCount)}</b></div>
            </div>
          </div>

          <div className="feed-toolbar">
            <div className="library-tabs compact-tabs">
              <button className={tab === 'dynamic' ? 'is-active' : ''} onClick={() => startTransition(() => setTab('dynamic'))}>
                <Rss size={14} /> 动态
              </button>
              <button className={tab === 'video' ? 'is-active' : ''} onClick={() => startTransition(() => setTab('video'))}>
                <Film size={14} /> 视频
              </button>
            </div>
            <span className="feed-updated">
              {feed ? `更新于 ${timeAgo(feed.fetchedAt)}` : '等待同步'}
            </span>
          </div>

          {!auth.loggedIn && (
            <div className="notice notice-mint feed-notice">
              <Users size={15} />
              <p>动态和更高画质属于账号权限内容。请使用你自己的 B 站账号，在设置页粘贴浏览器 Cookie；澄幕不会用你的账号执行其他操作。</p>
              <button className="btn btn-soft btn-sm" onClick={() => setPage('settings')}>去登录</button>
            </div>
          )}

          {error && (
            <div className="notice notice-warm feed-notice">
              <AlertTriangle size={15} />
              <p>{error}</p>
            </div>
          )}

          {loading ? (
            <div className="feed-loading-skeleton" aria-busy="true" aria-label="正在加载动态">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="feed-skeleton-card" key={index}>
                  <div className="feed-skeleton-head"><i /><span /></div>
                  <div className="feed-skeleton-line wide" />
                  <div className="feed-skeleton-line" />
                  <div className="feed-skeleton-cover" />
                </div>
              ))}
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="library-empty wide">
              <Rss size={24} />
              <strong>这里暂时没有内容</strong>
              <p>可能是主播近期没有发布，或 B 站接口需要登录后访问。</p>
            </div>
          ) : tab === 'video' ? (
            <div className="video-feed-grid">
              {visibleItems.map((item) => (
                <VideoCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="dynamic-feed">
              {visibleItems.map((item) => (
                <DynamicCard
                  key={item.id}
                  item={item}
                  onOpen={() => void window.clearstage.app.openExternal(item.url)}
                  onPreview={setPreview}
                />
              ))}
            </div>
          )}

          {feed?.hasMore && (
            <button className="load-more" onClick={() => void load()}>
              加载更多动态
            </button>
          )}
        </>
      )}

      {preview && (
        <div className="feed-lightbox" role="dialog" aria-modal="true" onClick={() => setPreview(null)}>
          <button className="feed-lightbox-close" aria-label="关闭图片" onClick={() => setPreview(null)}>
            <X size={18} />
          </button>
          <img src={preview} alt="" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </section>
  )
}

function FeedRichText({ item }: { item: FeedItem }) {
  if (item.richText?.length) {
    return (
      <span className="feed-rich-text">
        {item.richText.map((segment: FeedTextSegment, index: number) =>
          segment.type === 'emoji' && segment.icon ? (
            <img
              key={`${segment.icon}-${index}`}
              className="feed-emoji"
              src={segment.icon}
              alt={segment.text}
              title={segment.text}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={(event) => {
                event.currentTarget.style.display = 'none'
              }}
            />
          ) : (
            <span key={`text-${index}`}>{segment.text}</span>
          )
        )}
      </span>
    )
  }
  return <>{item.text}</>
}

function FeedCover({ item, tall = false }: { item: FeedItem; tall?: boolean }) {
  const [failed, setFailed] = useState(false)
  if (item.cover && !failed) {
    return (
      <img
        className={`feed-cover ${tall ? 'is-tall' : ''}`}
        src={item.cover}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <div className={`feed-cover is-generated ${tall ? 'is-tall' : ''} feed-art-${uidSalt(item.id) % 4}`}>
      <div className="feed-art-grid" />
      {item.type === 'video' ? <Film size={24} /> : item.type === 'live' ? <Radio size={24} /> : <ImageIcon size={24} />}
      <span>{item.type === 'video' ? 'VIDEO' : 'MOMENT'}</span>
    </div>
  )
}

function FeedImage({ src, alt = '', onClick }: { src: string; alt?: string; onClick?: () => void }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span className="feed-image-fallback" aria-label="图片加载失败">
        <ImageIcon size={16} />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onClick={onClick}
      onError={() => setFailed(true)}
    />
  )
}

function VideoCard({ item }: { item: FeedItem }) {
  return (
    <button
      className="video-feed-card"
      onClick={() => void window.clearstage.app.openExternal(item.url)}
    >
      <div className="video-feed-cover">
        <FeedCover item={item} tall />
        {item.stats?.duration && <span className="duration-chip">{item.stats.duration}</span>}
        <span className="video-play"><Film size={16} /></span>
      </div>
      <div className="video-feed-body">
        <h3>{item.title}</h3>
        <p><FeedRichText item={item} /></p>
        <div className="video-stats">
          <span><Eye size={11} /> {formatNumber(item.stats?.views)}</span>
          <span><MessageCircle size={11} /> {formatNumber(item.stats?.comments)}</span>
          <span>{timeAgo(item.publishedAt)}</span>
        </div>
      </div>
    </button>
  )
}

function DynamicCard({
  item,
  onOpen,
  onPreview
}: {
  item: FeedItem
  onOpen: () => void
  onPreview: (url: string) => void
}) {
  return (
    <article className="dynamic-card">
      <div className="dynamic-head">
        <span className="dynamic-avatar">{item.author?.slice(0, 1) ?? 'C'}</span>
        <div>
          <strong>{item.author ?? '主播'}</strong>
          <span>{timeAgo(item.publishedAt)} · {item.type === 'video' ? '投稿视频' : item.type === 'image' ? '图片动态' : '动态'}</span>
        </div>
        <span className={`dynamic-type ${item.type}`}>
          {item.type === 'video' ? <Film size={12} /> : item.type === 'image' ? <ImageIcon size={12} /> : <Rss size={12} />}
        </span>
        <button className="icon-btn" title="在浏览器打开" onClick={onOpen}><ExternalLink size={15} /></button>
      </div>
      <div className={`dynamic-body ${item.cover ? 'has-cover' : ''}`}>
        <div className="dynamic-text">
          <h3>{item.title}</h3>
          {item.text && <p><FeedRichText item={item} /></p>}
          {item.stats && (
            <div className="dynamic-stats">
              {item.stats.views !== undefined && <span><Eye size={11} /> {formatNumber(item.stats.views)}</span>}
              {item.stats.likes !== undefined && <span><ThumbsUp size={11} /> {formatNumber(item.stats.likes)}</span>}
              {item.stats.comments !== undefined && <span><MessageCircle size={11} /> {formatNumber(item.stats.comments)}</span>}
            </div>
          )}
        </div>
        {item.type === 'video' && <FeedCover item={item} />}
        {item.type === 'image' && item.images && item.images.length > 0 && (
          <div className={`dynamic-images count-${Math.min(9, item.images.length)}`}>
            {item.images.slice(0, 9).map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                className="dynamic-image-button"
                onClick={() => onPreview(image)}
                title="查看大图"
              >
                <FeedImage src={image} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="dynamic-foot">
        <button onClick={onOpen}><Bookmark size={12} /> 在 B 站查看</button>
        <span>{item.type === 'video' ? '视频' : '动态'}</span>
      </div>
    </article>
  )
}
