import fs from 'node:fs'

const token = fs.readFileSync('C:/Users/Lenovo/AppData/Local/clearstage-gh-token.tmp', 'utf8').trim()
const headers = {
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'user-agent': 'clearstage-release',
  'content-type': 'application/json'
}
const body = `## 澄幕 ClearStage 0.1.0

### Windows 10 / 11 x64
- 安装程序：运行 \`ClearStage-Setup-0.1.0.exe\`。安装包内置 ClearStage 自签名证书并自动导入当前用户信任存储，无需二次下载证书。
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
校验值与签名说明：https://kmoopz.github.io/clearstage/download.html`

const release = await fetch('https://api.github.com/repos/kmoopz/clearstage/releases/tags/v0.1.0', { headers }).then((r) => r.json())
const response = await fetch(`https://api.github.com/repos/kmoopz/clearstage/releases/${release.id}`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({ body })
})
console.log('release notes', response.status)
