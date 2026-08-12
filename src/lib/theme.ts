import type { EventTheme } from './types'

interface ThemeStyle {
  label: string
  bg: string
  accent: string
}

export const THEME_STYLES: Record<EventTheme, ThemeStyle> = {
  default: {
    label: 'ללא ערכת נושא',
    bg: 'bg-zinc-50',
    accent: 'text-zinc-900',
  },
  wine: {
    label: 'יין',
    bg: 'bg-gradient-to-b from-rose-100 via-rose-50 to-zinc-50',
    accent: 'text-rose-900',
  },
  meat: {
    label: 'בשר',
    bg: 'bg-gradient-to-b from-orange-100 via-orange-50 to-zinc-50',
    accent: 'text-orange-900',
  },
  beer: {
    label: 'בירה',
    bg: 'bg-gradient-to-b from-amber-100 via-amber-50 to-zinc-50',
    accent: 'text-amber-900',
  },
  coffee: {
    label: 'קפה',
    bg: 'bg-gradient-to-b from-stone-200 via-stone-100 to-zinc-50',
    accent: 'text-stone-900',
  },
}
