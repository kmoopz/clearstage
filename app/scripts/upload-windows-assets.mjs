import fs from 'node:fs'
import path from 'node:path'

const token = fs.readFileSync('C:/Users/Lenovo/AppData/Local/clearstage-gh-token.tmp', 'utf8').trim()
const headers = {
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'user-agent': 'clearstage-release'
}
const owner = 'kmoopz'
const repo = 'clearstage'
const api = `https://api.github.com/repos/${owner}/${repo}`

async function request(method, url, body, extraHeaders = {}) {
  const response = await fetch(url, { method, headers: { ...headers, ...extraHeaders }, body })
  const text = await response.text()
  if (!response.ok) throw new Error(`${method} ${url} -> ${response.status}: ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

const release = await request('GET', `${api}/releases/tags/v0.1.0`)
for (const asset of release.assets || []) {
  if (asset.name === 'ClearStage-Setup-0.1.0.exe' || asset.name === 'ClearStage-0.1.0-win-x64.zip') {
    await request('DELETE', `${api}/releases/assets/${asset.id}`)
    console.log('removed old Windows asset', asset.name)
  }
}

for (const [file, type] of [
  ['D:/项目管理/release/ClearStage-Setup-0.1.0.exe', 'application/vnd.microsoft.portable-executable'],
  ['D:/项目管理/release/ClearStage-0.1.0-win-x64.zip', 'application/zip']
]) {
  const name = path.basename(file)
  const stat = fs.statSync(file)
  console.log('uploading', name, stat.size)
  const response = await fetch(
    `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'content-type': type,
        'content-length': String(stat.size)
      },
      body: fs.readFileSync(file),
      signal: AbortSignal.timeout(600_000)
    }
  )
  const text = await response.text()
  if (!response.ok) throw new Error(`upload failed ${response.status}: ${text.slice(0, 300)}`)
  console.log('uploaded', name)
}

const body = `## 澄幕 ClearStage 0.1.0

### 本次更新
- 多画面按实际路数自适应排成 16:9 网格，修复画面拉伸、比例错误和单路被「添加画面」挤占的问题。
- 新增「专注当前」：只保留选中画面，其余播放器停止解码；退出或重启后恢复上次的多画面组合。
- 新增 \`Ctrl+K\` 快捷命令面板与全局快捷键：页面跳转、布局切换、互动面板、专注、刷新、添加直播间均可键盘完成。
- 多画面支持拖动排序并保存顺序；添加直播间窗口新增历史直播间快捷列表，并自动识别剪贴板链接；设置中可选择启动页面。
- 移除默认画质选项，每路默认请求最高画质；实际档位仍由 B 站账号权限与网络决定。
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
await request('PATCH', `${api}/releases/${release.id}`, JSON.stringify({ body }), { 'content-type': 'application/json' })
console.log('updated release notes')
