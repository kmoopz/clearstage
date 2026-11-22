import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const owner = 'kmoopz'
const repo = 'clearstage'
const source = path.join(root, 'source-publish')
const tokenFile = process.argv.find((value) => value.startsWith('--token-file='))?.split('=')[1]
const token = (tokenFile ? fs.readFileSync(tokenFile, 'utf8') : process.env.CLEARSTAGE_GH_TOKEN || '').trim()
if (!token) throw new Error('Missing GitHub token')
const api = 'https://api.github.com'
const headers = {
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'user-agent': 'clearstage-source-publisher'
}

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

const ref = await request('GET', `${api}/repos/${owner}/${repo}/git/ref/heads/main`)
const parent = ref.object.sha
const parentCommit = await request('GET', `${api}/repos/${owner}/${repo}/git/commits/${parent}`)
const entries = []
const walk = (dir, prefix = '') => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    const repoPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) walk(full, repoPath)
    else entries.push({ path: repoPath, file: full })
  }
}
walk(source)

const tree = []
for (const entry of entries) {
  const content = fs.readFileSync(entry.file)
  const blob = await request('POST', `${api}/repos/${owner}/${repo}/git/blobs`, {
    content: content.toString('base64'),
    encoding: 'base64'
  })
  tree.push({ path: entry.path, mode: '100644', type: 'blob', sha: blob.sha })
}
const newTree = await request('POST', `${api}/repos/${owner}/${repo}/git/trees`, {
  base_tree: parentCommit.tree.sha,
  tree
})
const commit = await request('POST', `${api}/repos/${owner}/${repo}/git/commits`, {
  message: 'Add application source, platform build workflow, and project README',
  tree: newTree.sha,
  parents: [parent]
})
await request('PATCH', `${api}/repos/${owner}/${repo}/git/refs/heads/main`, { sha: commit.sha, force: true })
console.log(`Published source commit ${commit.sha.slice(0, 8)} (${tree.length} files)`)

await request('PATCH', `${api}/repos/${owner}/${repo}`, {
  description: '澄幕 ClearStage — 本地优先的 B 站直播工作台：纯净画面、多画面、录制切片、弹幕与主播数据',
  homepage: `https://${owner}.github.io/${repo}/`
})
await request('PUT', `${api}/repos/${owner}/${repo}/topics`, {
  names: ['bilibili', 'electron', 'live-streaming', 'desktop-app', 'react', 'typescript', 'danmaku']
})
console.log('Updated repository description, homepage, and topics')
