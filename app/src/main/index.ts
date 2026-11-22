import { app, BrowserWindow, session, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { Store } from './store'
import { BiliClient } from './services/bili'
import { MediaProxy } from './services/mediaProxy'
import { DanmakuHub } from './services/danmaku'
import { DirectStreamService } from './services/direct'
import { Ffmpeg } from './services/ffmpeg'
import { RecordingManager } from './services/recorder'
import { SongCaptureService } from './services/songs'
import { StatsService } from './services/stats'
import { registerIpc, rawStreamResolver } from './ipc'

app.setName('ClearStage')
const dataDir = process.env.CLEARSTAGE_DATA_DIR
  ? path.resolve(process.env.CLEARSTAGE_DATA_DIR)
  : path.join(app.getPath('appData'), 'ClearStage')
fs.mkdirSync(dataDir, { recursive: true })
app.setPath('userData', dataDir)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
if (process.env.CLEARSTAGE_DISABLE_GPU === '1') app.disableHardwareAcceleration()

const isDemo = process.env.CLEARSTAGE_DEMO === '1'
let mainWindow: BrowserWindow | null = null
let quitting = false

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    // Bilibili image CDNs (covers, dynamic photos and emoji) expect a browser
    // referer. Add it only for image requests from Bilibili hosts.
    session.defaultSession.webRequest.onBeforeSendHeaders(
      { urls: ['https://*.hdslb.com/*', 'https://*.bilibili.com/*'] },
      (details, callback) => {
        if (details.resourceType === 'image') {
          details.requestHeaders.Referer = 'https://www.bilibili.com/'
          details.requestHeaders['User-Agent'] =
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
        }
        callback({ requestHeaders: details.requestHeaders })
      }
    )
    const store = new Store(dataDir)
    const proxy = new MediaProxy()
    await proxy.start()
    const bili = new BiliClient(store)
    const direct = new DirectStreamService()
    const ffmpeg = new Ffmpeg(store.data.settings.ffmpegPath, process.resourcesPath)
    const recorder = new RecordingManager(store, ffmpeg, rawStreamResolver(store, bili, direct))
    const stats = new StatsService(store, bili)
    const songs = new SongCaptureService(store, recorder, ffmpeg, () => store.data.settings)
    const danmaku = new DanmakuHub(store, bili)
    stats.start()

    mainWindow = createWindow()
    const window = mainWindow

    registerIpc({
      window,
      store,
      bili,
      danmaku,
      proxy,
      recorder,
      songs,
      stats,
      direct,
      ffmpeg,
      dataDir,
      isDemo,
      ffmpegStatus: async () => {
        const binary = await ffmpeg.resolve(true)
        return { available: Boolean(binary), path: binary ?? undefined }
      }
    })

    const sendWindowState = (): void => {
      if (window.isDestroyed()) return
      window.webContents.send('event:window-state', {
        maximized: window.isMaximized(),
        fullscreen: window.isFullScreen()
      })
    }
    window.on('maximize', sendWindowState)
    window.on('unmaximize', sendWindowState)
    window.on('enter-full-screen', sendWindowState)
    window.on('leave-full-screen', sendWindowState)

    window.on('close', async (event) => {
      if (quitting) return
      event.preventDefault()
      quitting = true
      try {
        await songs.stopAll()
        await recorder.stopAll()
        danmaku.disconnectAll()
        stats.stop()
        proxy.stop()
      } finally {
        window.destroy()
        app.quit()
      }
    })

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow()
      }
    })

    // Automated screenshots for documentation and visual regression checks.
    const capturePath = process.env.CLEARSTAGE_CAPTURE
    if (capturePath) {
      const delay = Number(process.env.CLEARSTAGE_CAPTURE_DELAY ?? 5000)
      window.webContents.once('did-finish-load', () => {
        setTimeout(async () => {
          try {
            const image = await window.webContents.capturePage()
            fs.mkdirSync(path.dirname(capturePath), { recursive: true })
            fs.writeFileSync(capturePath, image.toPNG())
            console.log('[capture] wrote', capturePath)
          } catch (error) {
            console.error('[capture] failed', error)
          } finally {
            app.quit()
          }
        }, delay)
      })
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    frame: false,
    backgroundColor: '#070b0c',
    title: '澄幕 ClearStage',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webSecurity: true,
      backgroundThrottling: false
    }
  })
  window.setMenuBarVisibility(false)
  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    const current = window.webContents.getURL()
    if (!url.startsWith('http://localhost:') && !url.startsWith('file://') && url !== current) {
      event.preventDefault()
      if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    const hash = process.env.CLEARSTAGE_START_PAGE
    void window.loadURL(`${process.env.ELECTRON_RENDERER_URL}${hash ? `#${hash}` : ''}`)
  } else {
    const hash = process.env.CLEARSTAGE_START_PAGE
    void window.loadFile(path.join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
  }
  return window
}
