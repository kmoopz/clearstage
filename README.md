# 澄幕 ClearStage

**把直播，还给画面。**

澄幕是一个本地优先的 PC 直播工作台：把 B 站直播与通用 HLS / FLV 直链的画面、弹幕互动、本地录制、时间线切片、歌曲分轨、主播数据与动态收拢到同一张桌面。

- 官网：https://kmoopz.github.io/clearstage/
- 下载：https://github.com/kmoopz/clearstage/releases/latest
- 源码目录：[`app/`](app/)
- 问题与建议：https://github.com/kmoopz/clearstage/issues

![澄幕直播工作台](https://kmoopz.github.io/clearstage/assets/app-overview.webp)

## 功能

- **B 站原生接入**：浏览器 Cookie 登录；实时弹幕、礼物、舰长、醒目留言；发送弹幕与限速连发。
- **多画面**：最多 9 路，按实际路数自适应 16:9 网格；每路独立画质、音量、弹幕层与录制，支持拖动排序、专注当前画面与布局恢复。5 路以上可自动降载。
- **快捷操作**：`Ctrl+K` 快捷命令面板、页面/布局/互动/专注快捷键、剪贴板一键添加直播间、启动页面自选；多画面支持拖动换位。
- **快捷添加**：添加直播间窗口直接列出历史直播间，点一下即可加入直播台；自动识别剪贴板里的直播间链接或 HLS / FLV 直链。
- **画中画**：单路画面可进入系统画中画，切到其他页面继续观看。
- **画质与稳定性**：B 站优先 HTTP-FLV 连续缓冲，HLS 覆盖直链；实际画质/分辨率/协议/缓冲 HUD，支持完整显示或裁剪填充。
- **账号画质**：未登录时 B 站通常限制到 720P；登录后按账号权限获取蓝光/原画，播放器会明确标出实际画质与限制原因。
- **本地录制与切片**：HLS 分段落盘，时间线选择范围，FFmpeg 精确切片；意外退出保留已下载分段。
- **歌曲与主播数据**：手动标记，或 AcoustID（免费 API Key）/ SongRec（免费外部程序）/ AudD / ACRCloud 自动识别；本地粉丝、人气、礼物与弹幕快照。
- **动态与视频**：B 站公开动态、图文、封面、表情与近期投稿；图片支持大图查看，风控时自动回退。
- **通用直链**：支持你有权访问的 HLS / FLV 流，可播放、多画面、录制与切片；不解析弹幕或主播数据。
- **本地优先**：无云端账号、无遥测、无广告；Cookie 使用系统安全存储加密，录制和数据都在本机。
- **界面风格**：八套主题，其中四套为原创二次元氛围插画（星野、樱町、电波、海盐）；支持强调色、弹幕参数和自定义 CSS。

## 平台与下载

最新发布：https://github.com/kmoopz/clearstage/releases/tag/v0.1.0

macOS 构建要求 **macOS 13+**（Electron 45 平台要求）。

| 平台 | 直接下载 | 安装方式 |
| --- | --- | --- |
| Windows 10 / 11 x64 | [安装程序](https://github.com/kmoopz/clearstage/releases/download/v0.1.0/ClearStage-Setup-0.1.0.exe) · [便携包](https://github.com/kmoopz/clearstage/releases/download/v0.1.0/ClearStage-0.1.0-win-x64.zip) | 安装程序自动创建快捷方式；便携包完整解压后运行 |
| Linux x64 | [AppImage](https://github.com/kmoopz/clearstage/releases/download/v0.1.0/ClearStage-0.1.0-linux-x64.AppImage) | `chmod +x` 后运行，见下文 |
| macOS Apple Silicon | [arm64 zip](https://github.com/kmoopz/clearstage/releases/download/v0.1.0/ClearStage-0.1.0-mac-arm64.zip) | 解压后拖入 Applications |
| macOS Intel | [x64 zip](https://github.com/kmoopz/clearstage/releases/download/v0.1.0/ClearStage-0.1.0-mac-x64.zip) | 解压后拖入 Applications |

Windows 安装包和主程序已签名，但使用的是 **ClearStage 本地自签名证书**，不是 CA 证书：

- 安装程序内置证书并自动导入当前用户的受信任存储；便携包内含 `ClearStage-CodeSigning.cer` 和 `Install-Certificate.cmd`，无需二次下载证书。
- 首次运行安装包时 Windows 仍可能提示未知发布者，因为证书要在安装程序启动后才生效；选择「更多信息 → 仍要运行」即可。
- 要彻底消除首次提示，需要 CA 签发的代码签名证书。macOS / Linux 构建没有 Apple Developer ID 或 Linux 官方签名，均为未公证 / 未签名构建，系统可能要求手动放行。

## 安装与首次使用

### Windows

1. 从 [Releases](https://github.com/kmoopz/clearstage/releases/latest) 下载 `ClearStage-Setup-*.exe` 或 `ClearStage-*-win-x64.zip`。
2. 安装程序安装到 `%LOCALAPPDATA%\Programs\ClearStage`，无需管理员权限；便携包请完整解压到普通目录，不要在压缩包内直接双击 EXE。
3. 打开「设置 → 账号与登录」，点「粘贴浏览器 Cookie」。在电脑浏览器登录 bilibili.com，按 F12 → 应用 / Application → Cookies → https://www.bilibili.com，复制 `SESSDATA` 和 `bili_jct`，粘贴后验证登录。应用会先调用 B 站 nav 接口验证，无效凭证不会保存。
4. 公开画面与录制不登录也可用；更高画质、发送弹幕和更完整动态需要自己的 B 站账号。

### Linux

1. 从 Releases 下载 `ClearStage-0.1.0-linux-x64.AppImage`。
2. `chmod +x ClearStage-0.1.0-linux-x64.AppImage` 后运行。若系统未启用用户命名空间，可能需要 `--no-sandbox`（不建议长期关闭沙箱）。
3. 也可以在 `app/` 中执行 `npm ci && npm run build && npm run package:linux` 构建 AppImage。

### macOS

1. 从 Releases 下载对应架构的 `ClearStage-0.1.0-mac-*.zip`。
2. 解压后把 `澄幕.app` 拖到 Applications；首次打开若被 Gatekeeper 拦截，在 Finder 中右键「打开」，或执行：
   `xattr -cr "/Applications/澄幕.app"`
3. 当前 macOS 构建使用 ad-hoc 签名，没有 Apple Developer ID 公证。要获得无提示的正式分发包，需要 Apple Developer 账号完成签名和 notarization。

## 从源码构建

要求 Node.js 22+、npm 10+。Windows 可构建 Windows；macOS 上可构建 macOS；Linux 上可构建 Linux。跨平台构建建议使用仓库中的 GitHub Actions 工作流。

```bash
cd app
npm ci
npm run build

# 当前平台
npm run package:win      # Windows
npm run package:mac      # macOS
npm run package:linux    # Linux
```

源码目录结构：

```text
app/
├─ src/main/        Electron 主进程、B 站接口、弹幕、录制、媒体代理
├─ src/preload/     contextBridge 安全 API
├─ src/renderer/    React 界面
├─ src/shared/      跨进程类型与 IPC 契约
├─ tests/           Vitest 单元测试
└─ build/           图标与 NSIS 安装脚本
```

## 数据与隐私

- 没有云端账号系统，也不含遥测和广告。
- 设置、直播间、录制索引和数据快照保存在 `%APPDATA%/ClearStage/clearstage.json`（Windows）或对应平台的应用数据目录。
- B 站 Cookie 使用 Electron `safeStorage` 加密保存在本机；删除应用数据即可清除。
- 录制、切片、歌曲默认保存在系统「视频/ClearStage」目录，可在设置中修改。
- 媒体代理只监听 `127.0.0.1` 随机端口，仅本机访问。

## 注意事项

- 本项目是第三方本地工具，**与哔哩哔哩无隶属关系**。
- 请仅观看、录制、切片你有权访问的内容，遵守平台服务条款和主播授权，不得用于商业盗播、付费内容绕过或再分发。
- 不提供 B 站风控绕过、签名逆向、私有接口抓取、代充值、代送礼或支付能力。
- 礼物与打赏数据只读展示，不代表平台结算。
- 不要把自己的 B 站 Cookie、录制文件或未公开内容发给他人或提交到 Issue。
- 源码公开用于审阅与构建，但项目未采用开源许可证；除 GitHub 服务条款允许的浏览、fork 外，未授予再分发或商业使用许可。
- Electron、hls.js、mpegts.js、React、Lucide 等第三方组件遵循各自许可证，详见 `app/package.json` 与发布包内 `LICENSES.chromium.html`。

## 验证

- `cd app && npm run typecheck && npm test`
- Windows 安装包与主程序可用 `Get-AuthenticodeSignature` / `signtool verify /pa` 检查；公开证书在 `downloads/ClearStage-CodeSigning.cer`。
- 发布资产 SHA-256 见官网下载页与 Release 说明：Windows 安装包 `c012b3a6…`、Windows 便携包 `bbcefed1…`、Linux AppImage `f642fe09…`、macOS arm64 `c94f84c7…`、macOS x64 `c5329560…`。
