import fs from 'node:fs'
import path from 'node:path'

const owner = 'kmoopz'
const repo = 'clearstage'
const tokenFile = process.argv.find((value) => value.startsWith('--token-file='))?.split('=')[1]
const token = (tokenFile ? fs.readFileSync(tokenFile, 'utf8') : process.env.CLEARSTAGE_GH_TOKEN || '').trim()
if (!token) throw new Error('Missing GitHub token')
const headers = {
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'user-agent': 'clearstage-release-upload'
}

async function request(method, url, body, extraHeaders = {}) {
  const response = await fetch(url, {
    method,
    headers: { ...headers, ...extraHeaders },
    body
  })
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!response.ok) {
    const error = new Error(`${method} ${url} -> ${response.status}: ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)}`)
    error.status = response.status
    throw error
  }
  return data
}

const release = await request('GET', `https://api.github.com/repos/${owner}/${repo}/releases/tags/v0.1.0`)
const existing = new Set((release.assets || []).map((asset) => asset.name))
const files = [
  ['D:/项目管理/.ci-linux-artifact/ClearStage-0.1.0-linux-x64.AppImage', 'application/vnd.appimage'],
  ['D:/项目管理/.ci-macos-artifact/ClearStage-0.1.0-mac-arm64.zip', 'application/zip'],
  ['D:/项目管理/.ci-macos-artifact/ClearStage-0.1.0-mac-x64.zip', 'application/zip']
]
for (const [file, type] of files) {
  const name = path.basename(file)
  if (existing.has(name)) {
    console.log(`Already present: ${name}`)
    continue
  }
  const stat = fs.statSync(file)
  console.log(`Uploading ${name} (${(stat.size / 1024 / 1024).toFixed(1)} MB)…`)
  const response = await request(
    'POST',
    `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`,
    fs.readFileSync(file),
    { 'content-type': type, 'content-length': String(stat.size) }
  )
  console.log(`Uploaded ${response.name} (${response.size} bytes)`)
}

const body = '澄幕 ClearStage 0.1.0 Windows / Linux / macOS 公测版。Windows 安装包内置 ClearStage 代码签名证书并在安装时自动导入；便携包包含证书和 Install-Certificate.cmd，无需二次下载。macOS 为 ad-hoc 签名、未公证；Linux AppImage 未签名。首次运行 Windows 自签名安装包仍可能提示未知发布者，这是证书在安装程序启动前尚未受信任导致的。'
await request('PATCH', `https://api.github.com/repos/${owner}/${repo}/releases/${release.id}`, JSON.stringify({ body }), { 'content-type': 'application/json' })
console.log('Updated release notes')
