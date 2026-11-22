import { useEffect, useState } from 'react'
import { Check, Moon, Palette, RotateCcw, SlidersHorizontal, Sun, X } from 'lucide-react'
import { useAppStore } from '../store'
import { THEMES } from '../lib/themes'

const ACCENTS = ['#70f0c0', '#8bc7ff', '#ffbf7a', '#f38baf', '#c6a6ff', '#d6f36b', '#ff8b6b']

export function ThemeDrawer() {
  const open = useAppStore((state) => state.themeOpen)
  const close = useAppStore((state) => state.setThemeOpen)
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const [css, setCss] = useState(settings.customCss)

  useEffect(() => {
    setCss(settings.customCss)
  }, [settings.customCss, open])

  useEffect(() => {
    if (!open) return
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, close])

  if (!open) return null

  return (
    <div className="drawer-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close(false)}>
      <aside className="theme-drawer" role="dialog" aria-modal="true" aria-labelledby="theme-title">
        <div className="drawer-head">
          <div>
            <span className="eyebrow">SURFACE STUDIO</span>
            <h2 id="theme-title">界面风格</h2>
          </div>
          <button className="icon-btn" onClick={() => close(false)} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          <section className="drawer-section">
            <div className="section-title">
              <Palette size={15} />
              <h3>主题预设</h3>
            </div>
            <div className="theme-grid">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  className={`theme-card ${settings.themeId === theme.id ? 'is-active' : ''}`}
                  onClick={() => void updateSettings({ themeId: theme.id, accent: theme.accent })}
                >
                  <span
                    className={`theme-preview ${theme.art ? 'has-art' : ''}`}
                    style={{
                      background: theme.bg,
                      backgroundImage: theme.art ? `url(${theme.art})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: theme.artPosition ?? 'center',
                      color: theme.text,
                      borderColor: theme.line
                    }}
                  >
                    <i style={{ background: theme.surface }} />
                    <b style={{ background: theme.accent }} />
                    <em style={{ background: theme.muted }} />
                  </span>
                  <span className="theme-meta">
                    <strong>{theme.name}</strong>
                    <small>
                      {theme.mode === 'dark' ? <Moon size={10} /> : <Sun size={10} />}
                      {theme.description}
                    </small>
                  </span>
                  {settings.themeId === theme.id && (
                    <span className="theme-check">
                      <Check size={11} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section className="drawer-section">
            <div className="section-title">
              <SlidersHorizontal size={15} />
              <h3>强调色</h3>
            </div>
            <div className="accent-row">
              {ACCENTS.map((accent) => (
                <button
                  key={accent}
                  className={`accent-swatch ${settings.accent.toLowerCase() === accent ? 'is-active' : ''}`}
                  style={{ background: accent }}
                  aria-label={accent}
                  onClick={() => void updateSettings({ accent })}
                >
                  {settings.accent.toLowerCase() === accent && <Check size={13} />}
                </button>
              ))}
              <label className="accent-custom" title="自定义强调色">
                <input
                  type="color"
                  value={settings.accent}
                  onChange={(event) => void updateSettings({ accent: event.target.value })}
                />
                <span>+</span>
              </label>
            </div>
          </section>

          <section className="drawer-section">
            <div className="section-title">
              <SlidersHorizontal size={15} />
              <h3>弹幕层</h3>
            </div>
            <label className="range-field">
              <span>
                字号 <b>{settings.danmaku.fontSize}px</b>
              </span>
              <input
                type="range"
                min={12}
                max={26}
                value={settings.danmaku.fontSize}
                onChange={(event) =>
                  void updateSettings({
                    danmaku: { ...settings.danmaku, fontSize: Number(event.target.value) }
                  })
                }
              />
            </label>
            <label className="range-field">
              <span>
                不透明度 <b>{Math.round(settings.danmaku.opacity * 100)}%</b>
              </span>
              <input
                type="range"
                min={30}
                max={100}
                value={Math.round(settings.danmaku.opacity * 100)}
                onChange={(event) =>
                  void updateSettings({
                    danmaku: { ...settings.danmaku, opacity: Number(event.target.value) / 100 }
                  })
                }
              />
            </label>
            <label className="toggle-row">
              <span>在画面中显示礼物</span>
              <input
                type="checkbox"
                checked={settings.danmaku.showGifts}
                onChange={(event) =>
                  void updateSettings({
                    danmaku: { ...settings.danmaku, showGifts: event.target.checked }
                  })
                }
              />
            </label>
            <label className="toggle-row">
              <span>显示进场提示</span>
              <input
                type="checkbox"
                checked={settings.danmaku.showEnter}
                onChange={(event) =>
                  void updateSettings({
                    danmaku: { ...settings.danmaku, showEnter: event.target.checked }
                  })
                }
              />
            </label>
          </section>

          <section className="drawer-section">
            <div className="section-title">
              <Palette size={15} />
              <h3>自定义 CSS</h3>
              <span className="beta-pill">高级</span>
            </div>
            <p className="section-help">通过 CSS 变量微调界面。留空则使用主题默认值。</p>
            <textarea
              className="css-editor"
              value={css}
              onChange={(event) => setCss(event.target.value)}
              placeholder={':root {\n  --radius-lg: 18px;\n  --font-display: "Microsoft YaHei";\n}'}
              spellCheck={false}
            />
            <div className="drawer-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setCss('')}>
                <RotateCcw size={13} /> 清空
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => void updateSettings({ customCss: css })}>
                应用样式
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}
