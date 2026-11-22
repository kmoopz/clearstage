import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Cookie,
  Cpu,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Info,
  Loader2,
  LockKeyhole,
  LogOut,
  MonitorPlay,
  Music2,
  Palette,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X
} from 'lucide-react'
import type { AppSettings, BiliAccount } from '../../../shared/types'
import { useAppStore } from '../store'
import { THEMES } from '../lib/themes'
import { errorMessage, formatNumber } from '../lib/format'

type Section = 'account' | 'playback' | 'recording' | 'songs' | 'appearance' | 'data'

const SECTIONS: Array<{ key: Section; label: string; icon: typeof UserRound; hint: string }> = [
  { key: 'account', label: '账号与登录', icon: UserRound, hint: 'B 站 Cookie、弹幕身份' },
  { key: 'playback', label: '播放偏好', icon: MonitorPlay, hint: '画质、布局与弹幕' },
  { key: 'recording', label: '录制与存储', icon: HardDrive, hint: '目录、FFmpeg、切片' },
  { key: 'songs', label: '歌曲识别', icon: Music2, hint: '自动分轨服务' },
  { key: 'appearance', label: '界面风格', icon: Palette, hint: '主题、强调色、CSS' },
  { key: 'data', label: '数据与关于', icon: ShieldCheck, hint: '本地目录、合规说明' }
]

export function SettingsView() {
  const settings = useAppStore((state) => state.settings)
  const info = useAppStore((state) => state.info)
  const auth = useAppStore((state) => state.auth)
  const isDemo = useAppStore((state) => state.info?.isDemo)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const setAuth = useAppStore((state) => state.setAuth)
  const importCookies = useAppStore((state) => state.importCookies)
  const logout = useAppStore((state) => state.logout)
  const toast = useAppStore((state) => state.toast)
  const setThemeOpen = useAppStore((state) => state.setThemeOpen)
  const [section, setSection] = useState<Section>('account')
  const [manualOpen, setManualOpen] = useState(false)
  const [ffmpeg, setFfmpeg] = useState<{ available: boolean; path?: string } | null>(null)
  const [checkingFfmpeg, setCheckingFfmpeg] = useState(false)
  const [ffmpegPath, setFfmpegPath] = useState(settings.ffmpegPath)
  const [songForm, setSongForm] = useState(settings.songRecognition)
  const [savingSong, setSavingSong] = useState(false)

  useEffect(() => {
    setFfmpegPath(settings.ffmpegPath)
    setSongForm(settings.songRecognition)
  }, [settings.ffmpegPath, settings.songRecognition])

  useEffect(() => {
    let alive = true
    void window.clearstage.settings.checkFfmpeg().then((status) => alive && setFfmpeg(status))
    return () => {
      alive = false
    }
  }, [])

  const theme = useMemo(() => THEMES.find((item) => item.id === settings.themeId) ?? THEMES[0], [settings.themeId])

  async function chooseFolder() {
    if (isDemo) {
      toast('info', '演示模式', '正式版会打开系统文件夹选择器。')
      return
    }
    const folder = await window.clearstage.settings.chooseFolder()
    if (folder) await updateSettings({ recordDir: folder })
  }

  async function saveFfmpegPath() {
    await updateSettings({ ffmpegPath })
    setCheckingFfmpeg(true)
    try {
      const status = await window.clearstage.settings.checkFfmpeg()
      setFfmpeg(status)
      toast(status.available ? 'success' : 'warning', status.available ? 'FFmpeg 已就绪' : '没有找到 FFmpeg', status.path)
    } finally {
      setCheckingFfmpeg(false)
    }
  }

  async function checkFfmpeg() {
    setCheckingFfmpeg(true)
    try {
      const status = await window.clearstage.settings.checkFfmpeg()
      setFfmpeg(status)
      toast(status.available ? 'success' : 'warning', status.available ? 'FFmpeg 已就绪' : '未找到 FFmpeg', status.path ?? '精确切片与歌曲导出将回退或不可用。')
    } finally {
      setCheckingFfmpeg(false)
    }
  }

  async function saveSongSettings() {
    setSavingSong(true)
    try {
      await updateSettings({ songRecognition: songForm })
      toast('success', '歌曲识别设置已保存')
    } finally {
      setSavingSong(false)
    }
  }

  return (
    <section className="view settings-view">
      <header className="page-head">
        <div className="page-head-copy">
          <span className="eyebrow"><SlidersHorizontal size={12} /> PREFERENCES · 偏好设置</span>
          <h1>
            把工作台
            <span className="head-em">调成你的样子。</span>
          </h1>
          <p>登录、画质、录制、主题与识别服务。所有偏好都保存在本地。</p>
        </div>
        <div className="page-head-actions">
          <span className="settings-version">ClearStage {info?.version ?? '0.1.0'}</span>
        </div>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav">
          {SECTIONS.map(({ key, label, icon: Icon, hint }) => (
            <button
              key={key}
              className={section === key ? 'is-active' : ''}
              onClick={() => setSection(key)}
            >
              <span className="settings-nav-icon"><Icon size={16} /></span>
              <span><b>{label}</b><small>{hint}</small></span>
              <ChevronRight size={13} />
            </button>
          ))}
          <div className="settings-nav-help">
            <CircleHelp size={15} />
            <p>遇到问题？官网 FAQ 覆盖了直播流、登录、录制与切片的常见解法。</p>
          </div>
        </nav>

        <div className="settings-content">
          {section === 'account' && (
            <div className="settings-section">
              <div className="settings-section-head">
                <span className="eyebrow">IDENTITY</span>
                <h2>账号与登录</h2>
                <p>登录后可以发送弹幕、使用更高画质，并让直播数据更完整。Cookie 只保存在本机。</p>
              </div>
              {auth.loggedIn ? (
                <div className="account-card">
                  <div className="account-main">
                    <span className="account-avatar">
                      {auth.face ? <img src={auth.face} alt="" /> : auth.uname?.slice(0, 1)}
                      <i />
                    </span>
                    <div>
                      <span className="eyebrow">BILIBILI ACCOUNT</span>
                      <h3>{auth.uname ?? '已登录'}</h3>
                      <p>UID {auth.mid ?? '—'} · 登录凭证已加密保存在本机</p>
                    </div>
                    <span className="account-status">
                      <Check size={12} /> {auth.canSendDanmaku === false ? '只读登录' : '已连接'}
                    </span>
                  </div>
                  <div className="account-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => void logout()}>
                      <LogOut size={14} /> 退出登录
                    </button>
                    <button className="btn btn-soft btn-sm" onClick={() => setManualOpen(true)}>
                      <Cookie size={14} /> 更新 Cookie
                    </button>
                  </div>
                </div>
              ) : (
                <div className="account-card is-logged-out">
                  <div className="account-main">
                    <span className="account-avatar placeholder"><Cookie size={22} /></span>
                    <div>
                      <span className="eyebrow">BILIBILI ACCOUNT</span>
                      <h3>用浏览器 Cookie 登录</h3>
                      <p>从已登录的浏览器复制 SESSDATA，登录后才能发送弹幕、连发和收藏常用弹幕。观看与录制无需登录。</p>
                    </div>
                  </div>
                  <div className="account-actions">
                    <button className="btn btn-primary" onClick={() => setManualOpen(true)}>
                      <Cookie size={15} /> 粘贴浏览器 Cookie
                    </button>
                  </div>
                </div>
              )}

              <div className="settings-info-grid">
                <div className="info-tile">
                  <span><ShieldCheck size={16} /></span>
                  <div><b>本地加密</b><p>登录 Cookie 使用系统安全存储加密，不上传云端。</p></div>
                </div>
                <div className="info-tile">
                  <span><LockKeyhole size={16} /></span>
                  <div><b>权限最小化</b><p>只调用发送弹幕所需接口，不读取账号私信与交易信息。</p></div>
                </div>
                <div className="info-tile">
                  <span><AlertTriangle size={16} /></span>
                  <div><b>平台规则</b><p>连发有次数与间隔限制。请遵守直播间规则，避免刷屏；礼物与打赏不代理。</p></div>
                </div>
              </div>
            </div>
          )}

          {section === 'playback' && (
            <div className="settings-section">
              <div className="settings-section-head">
                <span className="eyebrow">PLAYBACK</span>
                <h2>播放偏好</h2>
                <p>默认画质会在每次接入直播时使用。未登录时 B 站通常最高只提供超清 720P；登录后按账号权限提供蓝光或原画。</p>
              </div>
              <div className="settings-card">
                <div className="settings-row">
                  <div><b>默认画质</b><p>直播流支持的最高画质可能受账号、粉丝等级与网络影响。</p></div>
                  <select
                    value={settings.defaultQuality}
                    onChange={(event) => void updateSettings({ defaultQuality: Number(event.target.value) })}
                  >
                    <option value={10000}>原画 / 自动最高</option>
                    <option value={400}>蓝光</option>
                    <option value={250}>超清</option>
                    <option value={150}>高清</option>
                    <option value={80}>流畅</option>
                  </select>
                </div>
                <div className="settings-row">
                  <div><b>画面适配</b><p>16:9 画面铺满；非 16:9 流可选择完整显示，避免裁切。</p></div>
                  <select
                    value={settings.videoFit ?? 'cover'}
                    onChange={(event) => void updateSettings({ videoFit: event.target.value === 'contain' ? 'contain' : 'cover' })}
                  >
                    <option value="cover">裁剪填充（铺满画面）</option>
                    <option value="contain">完整显示（保留黑边）</option>
                  </select>
                </div>
                <div className="settings-row">
                  <div><b>多画面自动降载</b><p>同时打开 5 路以上时，把所有画面限制到蓝光，降低解码与带宽压力；单路不受影响。</p></div>
                  <select
                    value={settings.multiViewQuality ?? 'auto'}
                    onChange={(event) => void updateSettings({ multiViewQuality: event.target.value === 'high' ? 'high' : 'auto' })}
                  >
                    <option value="auto">自动降载（推荐）</option>
                    <option value="high">保持手动画质</option>
                  </select>
                </div>
                <div className="settings-row">
                  <div><b>默认布局</b><p>直播台打开时的画面格数容量；画面会按实际路数自适应排成 16:9。</p></div>
                  <div className="layout-switch inline">
                    {['1', '2', '4', '6', '9'].map((value) => (
                      <button
                        key={value}
                        className={settings.layout === value ? 'is-active' : ''}
                        onClick={() => void updateSettings({ layout: value })}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="settings-row">
                  <div><b>弹幕字号</b><p>画面内弹幕层的字号，聊天面板不受影响。</p></div>
                  <div className="inline-range">
                    <input
                      type="range"
                      min={12}
                      max={26}
                      value={settings.danmaku.fontSize}
                      onChange={(event) =>
                        void updateSettings({ danmaku: { ...settings.danmaku, fontSize: Number(event.target.value) } })
                      }
                    />
                    <span>{settings.danmaku.fontSize}px</span>
                  </div>
                </div>
                <div className="settings-row">
                  <div><b>画面内礼物提示</b><p>礼物、舰长事件以浮层显示；可随时用播放器上的字幕按钮关闭全部弹幕。</p></div>
                  <button
                    className={`switch ${settings.danmaku.showGifts ? 'is-on' : ''}`}
                    onClick={() =>
                      void updateSettings({ danmaku: { ...settings.danmaku, showGifts: !settings.danmaku.showGifts } })
                    }
                    aria-label="切换礼物提示"
                  >
                    <i />
                  </button>
                </div>
              </div>
              <div className="settings-note">
                <Info size={14} />
                直播流地址会由本机媒体代理转发，避免 Referer 与 CORS 导致的播放失败；不会经过第三方服务器。
              </div>
            </div>
          )}

          {section === 'recording' && (
            <div className="settings-section">
              <div className="settings-section-head">
                <span className="eyebrow">RECORDING</span>
                <h2>录制与存储</h2>
                <p>录制默认使用 HLS 分段写入，停止后可在录制库中切片。FFmpeg 用于精确切片、合并 MP4 和歌曲导出。</p>
              </div>
              <div className="settings-card">
                <div className="settings-row">
                  <div><b>录制目录</b><p>录制、切片与歌曲文件都会保存在这里。</p></div>
                  <div className="inline-field">
                    <input value={settings.recordDir} readOnly />
                    <button className="btn btn-ghost btn-sm" onClick={() => void chooseFolder()}>
                      <FolderOpen size={13} /> 选择
                    </button>
                  </div>
                </div>
                <div className="settings-row">
                  <div><b>FFmpeg 路径</b><p>留空则自动查找系统 PATH。用于精确切片与音频导出。</p></div>
                  <div className="inline-field">
                    <input
                      value={ffmpegPath}
                      onChange={(event) => setFfmpegPath(event.target.value)}
                      placeholder="C:\\ffmpeg\\bin\\ffmpeg.exe"
                      spellCheck={false}
                    />
                    <button className="btn btn-ghost btn-sm" onClick={() => void saveFfmpegPath()}>
                      保存
                    </button>
                  </div>
                </div>
                <div className="settings-row">
                  <div>
                    <b>FFmpeg 状态</b>
                    <p>{ffmpeg?.available ? ffmpeg.path : '未检测到。分段切片仍可用，精确切片与歌曲导出不可用。'}</p>
                  </div>
                  <div className={`ffmpeg-status ${ffmpeg?.available ? 'ok' : 'bad'}`}>
                    {checkingFfmpeg ? <Loader2 size={14} className="spin" /> : ffmpeg?.available ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                    {checkingFfmpeg ? '检测中' : ffmpeg?.available ? '已就绪' : '未安装'}
                    <button onClick={() => void checkFfmpeg()} title="重新检测"><RefreshCw size={12} /></button>
                  </div>
                </div>
              </div>
              <div className="settings-info-grid">
                <div className="info-tile">
                  <span><HardDrive size={16} /></span>
                  <div><b>分段写入</b><p>即使意外退出，已下载的媒体分段仍保留在录制目录中。</p></div>
                </div>
                <div className="info-tile">
                  <span><Cpu size={16} /></span>
                  <div><b>停止后合并</b><p>检测到 FFmpeg 时，停止录制会自动合并为 MP4；否则保留 M3U8 + TS 分段。</p></div>
                </div>
              </div>
            </div>
          )}

          {section === 'songs' && (
            <div className="settings-section">
              <div className="settings-section-head">
                <span className="eyebrow">SONG CAPTURE</span>
                <h2>歌曲识别与自动分轨</h2>
                <p>开启后，录制中的直播间会每隔约 30 秒采样一次音频，识别到歌曲切换时自动保存独立音频。</p>
              </div>
              <div className="settings-card">
                <div className="settings-row">
                  <div><b>启用歌曲捕获</b><p>需要 FFmpeg 与第三方识别服务。会产生少量 API 调用费用。</p></div>
                  <button
                    className={`switch ${songForm.enabled ? 'is-on' : ''}`}
                    onClick={() => setSongForm({ ...songForm, enabled: !songForm.enabled })}
                    aria-label="启用歌曲捕获"
                  >
                    <i />
                  </button>
                </div>
                <div className="settings-row">
                  <div><b>识别服务</b><p>密钥只保存在本机设置中，不会写入日志。</p></div>
                  <select
                    value={songForm.provider}
                    onChange={(event) =>
                      setSongForm({ ...songForm, provider: event.target.value as AppSettings['songRecognition']['provider'] })
                    }
                  >
                    <option value="none">不启用自动识别</option>
                    <option value="audd">AudD</option>
                    <option value="acrcloud">ACRCloud</option>
                  </select>
                </div>
                {songForm.provider === 'audd' && (
                  <div className="settings-row vertical">
                    <div><b>AudD API Token</b><p>在 audd.io 注册后获取。</p></div>
                    <input
                      type="password"
                      value={songForm.auddToken}
                      onChange={(event) => setSongForm({ ...songForm, auddToken: event.target.value })}
                      placeholder="API Token"
                    />
                  </div>
                )}
                {songForm.provider === 'acrcloud' && (
                  <>
                    <div className="settings-row vertical">
                      <div><b>ACRCloud Host</b><p>例如 identify-ap-southeast-1.acrcloud.com</p></div>
                      <input
                        value={songForm.acrHost}
                        onChange={(event) => setSongForm({ ...songForm, acrHost: event.target.value })}
                        placeholder="identify-ap-southeast-1.acrcloud.com"
                        spellCheck={false}
                      />
                    </div>
                    <div className="form-row two">
                      <label className="field">
                        <span>Access Key</span>
                        <input
                          type="password"
                          value={songForm.acrAccessKey}
                          onChange={(event) => setSongForm({ ...songForm, acrAccessKey: event.target.value })}
                        />
                      </label>
                      <label className="field">
                        <span>Access Secret</span>
                        <input
                          type="password"
                          value={songForm.acrAccessSecret}
                          onChange={(event) => setSongForm({ ...songForm, acrAccessSecret: event.target.value })}
                        />
                      </label>
                    </div>
                  </>
                )}
                <div className="settings-row">
                  <div><b>FFmpeg 依赖</b><p>采样与保存歌曲音频需要 FFmpeg。未安装时可手动标记歌曲。</p></div>
                  <span className={`mini-status ${ffmpeg?.available ? 'ok' : 'bad'}`}>
                    {ffmpeg?.available ? 'FFmpeg 已就绪' : 'FFmpeg 未安装'}
                  </span>
                </div>
              </div>
              <div className="settings-section-foot">
                <span className="muted-caption">识别结果仅用于本地分轨，不会自动上传或分发。</span>
                <button className="btn btn-primary btn-sm" onClick={() => void saveSongSettings()} disabled={savingSong}>
                  {savingSong ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                  保存识别设置
                </button>
              </div>
            </div>
          )}

          {section === 'appearance' && (
            <div className="settings-section">
              <div className="settings-section-head">
                <span className="eyebrow">APPEARANCE</span>
                <h2>界面风格</h2>
                <p>主题、强调色、弹幕层参数与自定义 CSS。所有变化即时生效。</p>
              </div>
              <div className="appearance-themes">
                {THEMES.map((item) => (
                  <button
                    key={item.id}
                    className={`appearance-theme ${settings.themeId === item.id ? 'is-active' : ''}`}
                    onClick={() => void updateSettings({ themeId: item.id, accent: item.accent })}
                  >
                    <span
                      className="appearance-swatch"
                      style={{
                        background: item.bg,
                        backgroundImage: item.art ? `url(${item.art})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: item.artPosition ?? 'center'
                      }}
                    >
                      <i style={{ background: item.surface }} />
                      <b style={{ background: item.accent }} />
                    </span>
                    <span><b>{item.name}</b><small>{item.description}</small></span>
                    {settings.themeId === item.id && <Check size={13} />}
                  </button>
                ))}
              </div>
              <div className="theme-current-card">
                <div>
                  <span className="eyebrow">CURRENT SURFACE</span>
                  <h3>{theme.name} · {settings.accent.toUpperCase()}</h3>
                  <p>当前风格会应用于直播台、录制库、数据舱与聊天面板。</p>
                </div>
                <button className="btn btn-soft" onClick={() => setThemeOpen(true)}>
                  <Palette size={15} /> 打开风格工坊
                </button>
              </div>
              <div className="settings-card">
                <div className="settings-row">
                  <div><b>弹幕不透明度</b><p>只影响画面浮层，不影响互动面板。</p></div>
                  <div className="inline-range">
                    <input
                      type="range"
                      min={30}
                      max={100}
                      value={Math.round(settings.danmaku.opacity * 100)}
                      onChange={(event) =>
                        void updateSettings({ danmaku: { ...settings.danmaku, opacity: Number(event.target.value) / 100 } })
                      }
                    />
                    <span>{Math.round(settings.danmaku.opacity * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === 'data' && (
            <div className="settings-section">
              <div className="settings-section-head">
                <span className="eyebrow">LOCAL FIRST</span>
                <h2>数据与关于</h2>
                <p>澄幕没有云端账号体系，直播记录、录制与设置都在本机。</p>
              </div>
              <div className="settings-card data-card">
                <div className="data-row"><span>应用版本</span><b>{info?.version ?? '0.1.0'} · Public Beta</b></div>
                <div className="data-row"><span>运行平台</span><b>{info?.platform} / {info?.arch}</b></div>
                <div className="data-row"><span>数据目录</span><code>{info?.dataDir ?? '—'}</code></div>
                <div className="data-row"><span>录制目录</span><code>{settings.recordDir || '—'}</code></div>
                <div className="data-row"><span>本地媒体代理</span><b className={info?.mediaServerReady ? 'ok-text' : 'err-text'}>{info?.mediaServerReady ? '运行中 · 仅 127.0.0.1' : '未启动'}</b></div>
                <div className="data-row"><span>遥测 / 广告</span><b>无</b></div>
              </div>
              <div className="compliance-card">
                <span className="compliance-icon"><ShieldCheck size={18} /></span>
                <div>
                  <h3>使用边界</h3>
                  <p>
                    澄幕是第三方本地工具，与哔哩哔哩无隶属关系。请仅观看和录制你有权访问的内容，遵守平台服务条款与主播授权，不得用于商业盗播或再分发。
                    礼物与打赏不代理；请在官方直播间完成。
                  </p>
                  <div className="compliance-links">
                    <button onClick={() => void window.clearstage.app.openExternal('https://live.bilibili.com/')}>
                      哔哩哔哩直播 <ExternalLink size={11} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="about-signature">
                <Sparkles size={14} />
                <span>澄幕 ClearStage · 把直播，还给画面。</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {manualOpen && (
        <CookieLoginModal
          onClose={() => setManualOpen(false)}
          onSuccess={(account) => {
            setManualOpen(false)
            toast(
              'success',
              '登录成功',
              account.canSendDanmaku === false
                ? '已登录，但缺少 bili_jct，暂时不能发送弹幕'
                : `欢迎，${account.uname ?? 'B站用户'}`
            )
            setAuth(account)
          }}
        />
      )}
    </section>
  )
}

function CookieLoginModal({
  onClose,
  onSuccess
}: {
  onClose: () => void
  onSuccess: (account: BiliAccount) => void
}) {
  const importCookies = useAppStore((state) => state.importCookies)
  const [sessdata, setSessdata] = useState('')
  const [biliJct, setBiliJct] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!sessdata.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const account = await importCookies({
        sessdata: sessdata.trim(),
        biliJct: biliJct.trim() || undefined
      })
      onSuccess(account)
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal cookie-modal" role="dialog" aria-modal="true" aria-labelledby="cookie-login-title">
        <div className="modal-head">
          <div>
            <span className="eyebrow">MANUAL LOGIN</span>
            <h2 id="cookie-login-title">用浏览器 Cookie 登录</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>
        <form className="cookie-login-form" onSubmit={submit}>
          <div className="notice notice-warm">
            <ShieldCheck size={16} />
            <p>凭证只发送到 B 站接口，并加密保存在本机。不要粘贴到聊天、网盘或公开页面，也不要把 Cookie 发给他人。</p>
          </div>
          <label className="field">
            <span>浏览器登录 bilibili.com 后，按 F12 → 应用 / Application → Cookies → https://www.bilibili.com，复制 SESSDATA</span>
            <input
              autoFocus
              value={sessdata}
              onChange={(event) => setSessdata(event.target.value)}
              placeholder="可以直接粘贴 Cookie 片段：SESSDATA=..."
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span>bili_jct（建议同时填写；发弹幕需要）</span>
            <input
              value={biliJct}
              onChange={(event) => setBiliJct(event.target.value)}
              placeholder="bili_jct=..."
              spellCheck={false}
              autoComplete="off"
            />
            <small>只填 SESSDATA 也能登录；缺少 bili_jct 时只能切换画质，不能发送弹幕。</small>
          </label>
          {error && (
            <div className="form-error">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>取消</button>
            <button type="submit" className="btn btn-primary" disabled={!sessdata.trim() || busy}>
              {busy ? <Loader2 size={15} className="spin" /> : <Cookie size={15} />}
              {busy ? '正在验证…' : '验证并登录'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
