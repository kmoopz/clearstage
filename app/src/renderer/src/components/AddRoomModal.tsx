import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Link2, Loader2, Plus, Radio, X } from 'lucide-react'
import { useAppStore } from '../store'
import { errorMessage } from '../lib/format'

type Mode = 'bilibili' | 'direct'

export function AddRoomModal() {
  const open = useAppStore((state) => state.addRoomOpen)
  const close = useAppStore((state) => state.setAddRoomOpen)
  const addRoom = useAppStore((state) => state.addRoom)
  const [mode, setMode] = useState<Mode>('bilibili')
  const [url, setUrl] = useState('')
  const [directUrl, setDirectUrl] = useState('')
  const [referer, setReferer] = useState('')
  const [title, setTitle] = useState('')
  const [streamer, setStreamer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [probe, setProbe] = useState('')
  const [probing, setProbing] = useState(false)

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close])

  const canSubmit = useMemo(() => {
    if (mode === 'bilibili') return Boolean(url.trim())
    return Boolean(directUrl.trim())
  }, [mode, url, directUrl])

  if (!open) return null

  async function handleProbe() {
    if (!directUrl.trim()) return
    setProbing(true)
    setProbe('')
    try {
      const result = await window.clearstage.direct.probe(directUrl.trim(), {
        referer: referer.trim() || undefined
      })
      setProbe(`检测通过 · ${result.protocol.toUpperCase()} 流`)
    } catch (probeError) {
      setProbe(errorMessage(probeError))
    } finally {
      setProbing(false)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    setError('')
    try {
      if (mode === 'bilibili') {
        await addRoom({ url: url.trim(), platform: 'bilibili' })
      } else {
        await addRoom({
          url: directUrl.trim(),
          platform: 'direct',
          directUrl: directUrl.trim(),
          headers: { referer: referer.trim() || undefined },
          title: title.trim() || undefined,
          streamer: streamer.trim() || undefined
        })
      }
    } catch (submitError) {
      setError(errorMessage(submitError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close(false)}>
      <div className="modal add-room-modal" role="dialog" aria-modal="true" aria-labelledby="add-room-title">
        <div className="modal-head">
          <div>
            <span className="eyebrow">ADD A STAGE</span>
            <h2 id="add-room-title">添加直播间</h2>
          </div>
          <button className="icon-btn" onClick={() => close(false)} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="platform-tabs">
          <button className={mode === 'bilibili' ? 'is-active' : ''} onClick={() => setMode('bilibili')}>
            <Radio size={15} /> 哔哩哔哩
          </button>
          <button className={mode === 'direct' ? 'is-active' : ''} onClick={() => setMode('direct')}>
            <Link2 size={15} /> 通用直链
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-room-form">
          {mode === 'bilibili' ? (
            <>
              <label className="field">
                <span>直播间地址或房间号</span>
                <input
                  autoFocus
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://live.bilibili.com/6 或 6"
                  spellCheck={false}
                />
                <small>支持短号。登录 B 站账号后可解锁更高画质与弹幕发送。</small>
              </label>
              <div className="room-detect-card">
                <span className="detect-orbit">
                  <Radio size={17} />
                </span>
                <div>
                  <strong>原生纯净流</strong>
                  <p>自动解析 HLS / FLV、实时弹幕、礼物与醒目留言，并写入本地数据舱。</p>
                </div>
                <span className="badge badge-mint">推荐</span>
              </div>
            </>
          ) : (
            <>
              <div className="notice notice-warm">
                <AlertTriangle size={16} />
                <p>
                  通用直链模式用于接入你有权访问的 HLS / FLV 直播流。它只提供画面与录制，不解析弹幕、礼物或主播数据。请确认你对该流拥有访问与保存权限。
                </p>
              </div>
              <label className="field">
                <span>直播流直链（HLS .m3u8 / FLV .flv）</span>
                <div className="input-with-action">
                  <input
                    autoFocus
                    value={directUrl}
                    onChange={(event) => {
                      setDirectUrl(event.target.value)
                      setProbe('')
                    }}
                    placeholder="https://.../live.m3u8"
                    spellCheck={false}
                  />
                  <button type="button" className="mini-action" onClick={handleProbe} disabled={!directUrl || probing}>
                    {probing ? <Loader2 size={13} className="spin" /> : '检测'}
                  </button>
                </div>
                {probe && <small className={probe.startsWith('检测通过') ? 'ok-text' : 'err-text'}>{probe}</small>}
              </label>
              <div className="form-row two">
                <label className="field">
                  <span>主播 / 名称（可选）</span>
                  <input value={streamer} onChange={(event) => setStreamer(event.target.value)} placeholder="主播昵称" />
                </label>
                <label className="field">
                  <span>画面标题（可选）</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="自定义标题" />
                </label>
              </div>
              <label className="field">
                <span>Referer（必要时填写）</span>
                <input
                  value={referer}
                  onChange={(event) => setReferer(event.target.value)}
                  placeholder="https://example.com/"
                  spellCheck={false}
                />
                <small>部分 CDN 会校验来源页。仅在你有权访问该流时使用。</small>
              </label>
            </>
          )}

          {error && (
            <div className="form-error">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => close(false)}>
              取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={!canSubmit || busy}>
              {busy ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
              {busy ? '正在连接…' : '加入直播台'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
