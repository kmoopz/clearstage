import fs from 'node:fs'
import path from 'node:path'

const outDir = path.resolve('site/assets/fonts')
fs.mkdirSync(outDir, { recursive: true })

const UA_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function download(url, file) {
  const response = await fetch(url, { headers: { 'user-agent': UA_CHROME } })
  if (!response.ok) throw new Error(`Failed ${response.status} for ${url}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  fs.writeFileSync(path.join(outDir, file), buffer)
  console.log(file, buffer.length)
}

// Sora — Latin display face. Use the TTF files served to generic clients.
const soraCss = await (
  await fetch('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap', {
    headers: { 'user-agent': UA_CHROME }
  })
).text()
const soraFaces = []
for (const weight of ['400', '500', '600', '700']) {
  const block = soraCss
    .split('@font-face')
    .find((item) => item.includes(`font-weight: ${weight};`))
  const match = block?.match(/url\((https:[^)]+)\)/)
  if (!match) {
    console.warn('Missing Sora weight', weight)
    continue
  }
  const file = `Sora-${weight}.woff2`
  await download(match[1], file)
  soraFaces.push({ weight, file })
}

// Noto Serif SC — a carefully sized Chinese display subset.
const text =
  '把直播还给画面让每一路现场都在同一张桌上录制切片歌曲数据纯净多路可本地了解功能观看下载文档常见问题边界'
const notoUrl =
  'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&display=swap&text=' +
  encodeURIComponent(text)
const notoCss = await (await fetch(notoUrl, { headers: { 'user-agent': UA_CHROME } })).text()
const notoMatch = notoCss.match(/url\((https:[^)]+)\)/)
if (notoMatch) {
  await download(notoMatch[1], 'NotoSerifSC-subset.woff2')
}

const css = `/* Bundled for the ClearStage website. Sora and Noto Serif SC are licensed under the SIL Open Font License. */
${soraFaces
  .map(
    (face) => `@font-face {
  font-family: 'Sora';
  font-style: normal;
  font-weight: ${face.weight};
  font-display: swap;
  src: url('./fonts/${face.file}') format('woff2');
}`
  )
  .join('\n\n')}

${
  notoMatch
    ? `@font-face {
  font-family: 'Noto Serif SC';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url('./fonts/NotoSerifSC-subset.woff2') format('woff2');
}`
    : ''
}
`
fs.writeFileSync(path.resolve('site/assets/fonts.css'), css, 'utf8')
console.log('Wrote fonts.css')
