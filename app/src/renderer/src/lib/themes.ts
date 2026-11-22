import type { ThemePreset } from '../../../shared/types'

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
  }
]

export function themeById(id: string): ThemePreset {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]
}
