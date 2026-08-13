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
  whiskey: {
    label: 'ויסקי',
    bg: 'bg-gradient-to-b from-amber-300 via-yellow-100 to-zinc-50',
    accent: 'text-amber-950',
  },
  cheese: {
    label: 'גבינות',
    bg: 'bg-gradient-to-b from-yellow-100 via-yellow-50 to-zinc-50',
    accent: 'text-yellow-800',
  },
  sausage: {
    label: 'נקניקיות ונקניקים',
    bg: 'bg-gradient-to-b from-red-300 via-orange-100 to-zinc-50',
    accent: 'text-red-950',
  },
  burger: {
    label: 'המבורגרים',
    bg: 'bg-gradient-to-b from-orange-300 via-amber-100 to-zinc-50',
    accent: 'text-orange-950',
  },
  pizza: {
    label: 'פיצה',
    bg: 'bg-gradient-to-b from-red-200 via-rose-50 to-zinc-50',
    accent: 'text-red-700',
  },
}
