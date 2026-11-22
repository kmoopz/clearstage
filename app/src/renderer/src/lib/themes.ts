import type { ThemePreset } from '../../../shared/types'

const starlightArt = new URL('../assets/themes/starlight.svg', import.meta.url).href
const sakuraArt = new URL('../assets/themes/sakura.svg', import.meta.url).href
const neonArt = new URL('../assets/themes/neon.svg', import.meta.url).href
const seasideArt = new URL('../assets/themes/seaside.svg', import.meta.url).href

export const THEMES: ThemePreset[] = [
  {
    id: 'nocturne',
    name: '夜幕',
    description: '默认 · 墨黑与薄荷',
    mode: 'dark',
    accent: '#70f0c0',
    bg: '#070b0c',
    surface: '#0d1416',
    text: '#eef5f0',
    muted: '#8d9d97',
    line: 'rgba(255,255,255,0.075)'
  },
  {
    id: 'tide',
    name: '潮汐',
    description: '深海蓝 · 安静专注',
    mode: 'dark',
    accent: '#8bc7ff',
    bg: '#080d15',
    surface: '#0f1721',
    text: '#eef4ff',
    muted: '#8e9fb5',
    line: 'rgba(166,201,255,0.10)'
  },
  {
    id: 'film',
    name: '胶片',
    description: '暖褐 · 低饱和放映室',
    mode: 'dark',
    accent: '#ffbf7a',
    bg: '#0f0d0b',
    surface: '#171411',
    text: '#f5eee3',
    muted: '#a69a89',
    line: 'rgba(255,228,190,0.09)'
  },
  {
    id: 'porcelain',
    name: '晨雾',
    description: '浅色 · 纸与青瓷',
    mode: 'light',
    accent: '#0b8f6b',
    bg: '#f2f1ec',
    surface: '#fbfaf6',
    text: '#141a18',
    muted: '#68736f',
    line: 'rgba(14,30,25,0.10)'
  },
  {
    id: 'starlit',
    name: '星野',
    description: '原创星空 · 紫夜与月光',
    mode: 'dark',
    accent: '#c0a8ff',
    bg: '#080a18',
    surface: '#11142a',
    text: '#f1efff',
    muted: '#9599ba',
    line: 'rgba(192,168,255,0.13)',
    art: starlightArt,
    artOpacity: 0.3,
    artPosition: 'center 45%'
  },
  {
    id: 'sakura',
    name: '樱町',
    description: '原创黄昏 · 樱色街道',
    mode: 'dark',
    accent: '#ffa6c9',
    bg: '#170d14',
    surface: '#24131d',
    text: '#fff3f7',
    muted: '#bda1ae',
    line: 'rgba(255,166,201,0.14)',
    art: sakuraArt,
    artOpacity: 0.27,
    artPosition: 'center 55%'
  },
  {
    id: 'denpa',
    name: '电波',
    description: '原创霓虹 · 电子夜城',
    mode: 'dark',
    accent: '#68f7ff',
    bg: '#050a14',
    surface: '#0b1424',
    text: '#ecfbff',
    muted: '#82a5b8',
    line: 'rgba(104,247,255,0.14)',
    art: neonArt,
    artOpacity: 0.28,
    artPosition: 'center 50%'
  },
  {
    id: 'seaside',
    name: '海盐',
    description: '原创夏日 · 青空与海',
    mode: 'light',
    accent: '#0c8f8b',
    bg: '#f2f7f5',
    surface: '#ffffff',
    text: '#122b2a',
    muted: '#5e7a76',
    line: 'rgba(13,90,83,0.13)',
    art: seasideArt,
    artOpacity: 0.2,
    artPosition: 'center 60%'
  }
]

export function themeById(id: string): ThemePreset {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]
}
