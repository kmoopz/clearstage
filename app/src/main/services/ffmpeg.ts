import { execFile, execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export class Ffmpeg {
  private resolved?: string | null
  private configuredPath: string

  constructor(
    configuredPath: string,
    private readonly resourcesPath: string
  ) {
    this.configuredPath = configuredPath
  }

  setConfiguredPath(configuredPath: string): void {
    this.configuredPath = configuredPath
    this.resolved = undefined
  }

  async resolve(force = false): Promise<string | null> {
    if (!force && this.resolved !== undefined) return this.resolved
    const candidates: string[] = []
    if (this.configuredPath) candidates.push(this.configuredPath)
    if (process.platform === 'win32') {
      candidates.push(path.join(this.resourcesPath, 'ffmpeg.exe'))
      candidates.push(path.join(this.resourcesPath, 'bin', 'ffmpeg.exe'))
      candidates.push('C:\\ffmpeg\\bin\\ffmpeg.exe')
      candidates.push('C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe')
    } else {
      candidates.push(path.join(this.resourcesPath, 'ffmpeg'))
      candidates.push(path.join(this.resourcesPath, 'bin', 'ffmpeg'))
      candidates.push('/usr/local/bin/ffmpeg')
      candidates.push('/opt/homebrew/bin/ffmpeg')
      candidates.push('/usr/bin/ffmpeg')
    }
    for (const candidate of candidates) {
      if (!candidate) continue
      if (candidate.includes(path.sep) && !fs.existsSync(candidate)) continue
      try {
        await execFileAsync(candidate, ['-version'], { timeout: 5000 })
        this.resolved = candidate
        return candidate
      } catch {
        // try next
      }
    }
    if (!this.configuredPath.includes(path.sep)) {
      try {
        const command = process.platform === 'win32' ? 'where.exe' : 'which'
        const { stdout } = await execFileAsync(command, ['ffmpeg'], { timeout: 5000 })
        const first = stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean)
        if (first && fs.existsSync(first)) {
          this.resolved = first
          return first
        }
      } catch {
        // not found
      }
    }
    this.resolved = null
    return null
  }

  async run(args: string[], timeoutMs = 30 * 60_000): Promise<void> {
    const binary = await this.resolve()
    if (!binary) throw new Error('未找到 FFmpeg，请安装后在设置中填写路径')
    await execFileAsync(binary, args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 })
  }

  async capture(args: string[], timeoutMs = 60_000): Promise<Buffer> {
    const binary = await this.resolve()
    if (!binary) throw new Error('未找到 FFmpeg，请安装后在设置中填写路径')
    return new Promise<Buffer>((resolve, reject) => {
      const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      const chunks: Buffer[] = []
      const errors: Buffer[] = []
      let size = 0
      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error('FFmpeg 采样超时'))
      }, timeoutMs)
      child.stdout.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > 30 * 1024 * 1024) {
          child.kill('SIGKILL')
          return
        }
        chunks.push(chunk)
      })
      child.stderr.on('data', (chunk: Buffer) => {
        if (errors.length < 50) errors.push(chunk)
      })
      child.on('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0 && chunks.length) resolve(Buffer.concat(chunks))
        else reject(new Error(`FFmpeg 采样失败：${Buffer.concat(errors).toString('utf8').slice(-500)}`))
      })
    })
  }

  resolveSyncHint(): string | null {
    if (this.resolved) return this.resolved
    if (this.configuredPath && fs.existsSync(this.configuredPath)) return this.configuredPath
    try {
      const command = process.platform === 'win32' ? 'where.exe' : 'which'
      const result = execFileSync(command, ['ffmpeg'], { timeout: 5000, encoding: 'utf8' })
      const first = result.split(/\r?\n/).map((line) => line.trim()).find(Boolean)
      return first ?? null
    } catch {
      return null
    }
  }
}
