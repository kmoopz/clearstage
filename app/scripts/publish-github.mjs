import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const owner = process.env.CLEARSTAGE_GH_OWNER || 'kmoopz'
const repo = process.env.CLEARSTAGE_GH_REPO || 'clearstage'
const tag = 'v0.1.0'
const releaseBody = `## 澄幕 ClearStage 0.1.0

### 本次更新
- 多画面按实际路数自适应排成 16:9 网格，修复画面拉伸、比例错误和单路被「添加画面」挤占的问题。
- 新增「专注当前」：只保留选中画面，其余播放器停止解码；退出或重启后恢复上次的多画面组合。
- 新增 \`Ctrl+K\` 快捷命令面板与全局快捷键：页面跳转、布局切换、互动面板、专注、刷新、添加直播间均可键盘完成。
- 多画面支持拖动排序并保存顺序；添加直播间自动识别剪贴板链接；设置中可选择启动页面。
- 播放器新增系统画中画按钮，切到录制库、数据或动态页时可继续观看当前画面。
- B 站直播改为优先 HTTP-FLV 连续缓冲，HLS 保留给直链和兼容回退；修复播放到直播边缘后冻结、误报「直播流中断」和缓冲不足。
- 画质菜单显示实际画质；新增码流 HUD（画质 / 分辨率 / 协议 / 缓冲）、完整显示 / 裁剪填充、5 路以上自动降载。
- 未登录时 B 站通常最高只提供超清 720P；播放器会显示「登录解锁」或「账号限制」，登录后按账号权限提供蓝光/原画。
- 媒体代理延长分片超时、关闭提前中断并避免压缩媒体分片，减少多路同时播放时的偶发卡顿。

### Windows 10 / 11 x64
- 安装程序：\`ClearStage-Setup-0.1.0.exe\`。安装包内置 ClearStage 自签名证书并自动导入当前用户信任存储，无需二次下载证书。
- 便携包：完整解压后运行 \`ClearStage.exe\`。包内含证书和 \`Install-Certificate.cmd\`。
- 首次运行自签名安装包仍可能提示未知发布者，选择“更多信息 → 仍要运行”即可；彻底消除需要 CA 证书。

### Linux x64
- 下载 \`ClearStage-0.1.0-linux-x64.AppImage\`，\`chmod +x\` 后运行。
- 需要 FUSE；若系统限制用户命名空间，可临时使用 \`--no-sandbox\`，具体见文档。
- Linux 构建未签名。

### macOS 13+（Intel / Apple Silicon）
- 下载对应架构的 zip，解压后把「澄幕.app」拖入 Applications。
- 当前为 ad-hoc 签名，没有 Apple Developer ID、未公证；首次打开若被 Gatekeeper 拦截，请右键「打开」或执行 \`xattr -cr "/Applications/澄幕.app"\`。
- 当前没有 Apple 签名证书，无法提供无提示的正式 macOS 分发。

官网：https://kmoopz.github.io/clearstage/
`
const replaceAssets = process.argv.includes('--replace-assets')
const tokenFile = process.argv.find((value) => value.startsWith('--token-file='))?.split('=')[1]
const token = (tokenFile ? fs.readFileSync(tokenFile, 'utf8') : process.env.CLEARSTAGE_GH_TOKEN || '').trim()
if (!token) throw new Error('Missing GitHub token')
const api = 'https://api.github.com'
const headers = {
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'user-agent': 'clearstage-publisher'
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function request(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: { ...headers, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!response.ok) {
    const error = new Error(`${method} ${url.replace(api, '')} -> ${response.status}: ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)}`)
    error.status = response.status
    throw error
  }
  return data
}

async function uploadAsset(releaseId, file, contentType) {
  const name = path.basename(file)
  const stat = fs.statSync(file)
  const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`
  console.log(`Uploading ${name} (${(stat.size / 1024 / 1024).toFixed(1)} MB)…`)
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      ...headers,
      'content-type': contentType,
      'content-length': String(stat.size)
    },
    body: fs.readFileSync(file),
    signal: AbortSignal.timeout(600_000)
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Asset upload failed (${response.status}): ${text.slice(0, 300)}`)
  console.log(`Uploaded ${name}`)
  return JSON.parse(text)
}

function publicSite() {
  const out = path.join(root, 'dist-github')
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })
  const skip = new Set(['.exe', '.zip'])
  const copy = (from, to) => {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      if (entry.name === 'downloads' && from.endsWith('site')) {
        fs.mkdirSync(path.join(to, 'downloads'), { recursive: true })
        for (const download of fs.readdirSync(path.join(from, 'downloads'), { withFileTypes: true })) {
          if (!download.isFile() || skip.has(path.extname(download.name).toLowerCase())) continue
          fs.copyFileSync(path.join(from, 'downloads', download.name), path.join(to, 'downloads', download.name))
        }
        continue
      }
      const source = path.join(from, entry.name)
      const target = path.join(to, entry.name)
      if (entry.isDirectory()) {
        fs.mkdirSync(target, { recursive: true })
        copy(source, target)
      } else {
        fs.copyFileSync(source, target)
      }
    }
  }
  copy(path.join(root, 'site'), out)

  const assetBase = `https://github.com/${owner}/${repo}/releases/download/${tag}`
  for (const file of ['index.html', 'download.html']) {
    const filePath = path.join(out, file)
    let html = fs.readFileSync(filePath, 'utf8')
    html = html
      .replaceAll('downloads/ClearStage-Setup-0.1.0.exe', `${assetBase}/ClearStage-Setup-0.1.0.exe`)
      .replaceAll('downloads/ClearStage-0.1.0-win-x64.zip', `${assetBase}/ClearStage-0.1.0-win-x64.zip`)
    fs.writeFileSync(filePath, html)
  }
  fs.writeFileSync(path.join(out, '.nojekyll'), '')
  return out
}

async function createOrUpdateSiteFiles(siteDir) {
  let repoInfo
  try {
    repoInfo = await request('GET', `${api}/repos/${owner}/${repo}`)
  } catch (error) {
    if (error.status !== 404) throw error
    console.log(`Creating public repository ${owner}/${repo}…`)
    repoInfo = await request('POST', `${api}/user/repos`, {
      name: repo,
      description: '澄幕 ClearStage — 纯净、可录制的 B 站直播桌面工作台（官网与下载）',
      homepage: `https://${owner}.github.io/${repo}/`,
      private: false,
      has_issues: true,
      has_wiki: false,
      auto_init: false
    })
  }

  let baseTree
  let parent
  const loadHead = async () => {
    const ref = await request('GET', `${api}/repos/${owner}/${repo}/git/ref/heads/main`)
    const commit = await request('GET', `${api}/repos/${owner}/${repo}/git/commits/${ref.object.sha}`)
    baseTree = commit.tree.sha
    parent = commit.sha
  }
  try {
    await loadHead()
  } catch (error) {
    if (error.status !== 404 && error.status !== 409) throw error
    const readme = fs.readFileSync(path.join(siteDir, 'README.md'))
    await request('PUT', `${api}/repos/${owner}/${repo}/contents/README.md`, {
      message: 'Initialize ClearStage site',
      content: readme.toString('base64')
    })
    await loadHead()
  }

  const entries = []
  const walk = (dir, prefix = '') => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      const repoPath = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(full, repoPath)
      else entries.push({ path: repoPath, file: full })
    }
  }
  walk(siteDir)

  const tree = []
  for (const entry of entries) {
    const content = fs.readFileSync(entry.file)
    const blob = await request('POST', `${api}/repos/${owner}/${repo}/git/blobs`, {
      content: content.toString('base64'),
      encoding: 'base64'
    })
    tree.push({ path: entry.path, mode: '100644', type: 'blob', sha: blob.sha })
  }
  console.log(`Uploading ${tree.length} site files…`)
  const treeBody = { tree }
  if (baseTree) treeBody.base_tree = baseTree
  const newTree = await request('POST', `${api}/repos/${owner}/${repo}/git/trees`, treeBody)
  const commitBody = { message: 'Publish ClearStage 0.1.0 site', tree: newTree.sha }
  if (parent) commitBody.parents = [parent]
  const commit = await request('POST', `${api}/repos/${owner}/${repo}/git/commits`, commitBody)
  try {
    const ref = await request('GET', `${api}/repos/${owner}/${repo}/git/ref/heads/main`)
    await request('PATCH', `${api}/repos/${owner}/${repo}/git/refs/heads/main`, { sha: commit.sha, force: true })
  } catch (error) {
    if (error.status !== 404 && error.status !== 409) throw error
    await request('POST', `${api}/repos/${owner}/${repo}/git/refs`, { ref: 'refs/heads/main', sha: commit.sha })
  }
  console.log(`Published site commit ${commit.sha.slice(0, 8)}`)
  return repoInfo
}

async function publishRelease() {
  let release
  try {
    release = await request('GET', `${api}/repos/${owner}/${repo}/releases/tags/${tag}`)
    release = await request('PATCH', `${api}/repos/${owner}/${repo}/releases/${release.id}`, {
      body: releaseBody
    })
  } catch (error) {
    if (error.status !== 404) throw error
    release = await request('POST', `${api}/repos/${owner}/${repo}/releases`, {
      tag_name: tag,
      target_commitish: 'main',
      name: 'ClearStage 0.1.0',
      body: releaseBody,
      draft: false,
      prerelease: false
    })
    console.log(`Created release ${tag}`)
  }
  if (replaceAssets) {
    for (const asset of release.assets || []) {
      await request('DELETE', `${api}/repos/${owner}/${repo}/releases/assets/${asset.id}`)
      console.log(`Removed old asset ${asset.name}`)
    }
    release.assets = []
  }
  const assets = new Map((release.assets || []).map((asset) => [asset.name, asset]))
  for (const [file, type] of [
    [path.join(root, 'site', 'downloads', 'ClearStage-Setup-0.1.0.exe'), 'application/vnd.microsoft.portable-executable'],
    [path.join(root, 'site', 'downloads', 'ClearStage-0.1.0-win-x64.zip'), 'application/zip']
  ]) {
    const name = path.basename(file)
    if (assets.has(name)) continue
    await uploadAsset(release.id, file, type)
  }
}

async function ensurePages() {
  try {
    const pages = await request('GET', `${api}/repos/${owner}/${repo}/pages`)
    console.log(`Pages already configured: ${pages.html_url}`)
  } catch (error) {
    if (error.status !== 404) throw error
    await request('POST', `${api}/repos/${owner}/${repo}/pages`, {
      source: { branch: 'main', path: '/' },
      build_type: 'legacy'
    })
    console.log('Enabled GitHub Pages')
  }
}

const siteDir = publicSite()
await createOrUpdateSiteFiles(siteDir)
await publishRelease()
await ensurePages()
console.log(`Site: https://${owner}.github.io/${repo}/`)
console.log(`Release: https://github.com/${owner}/${repo}/releases/tag/${tag}`)
