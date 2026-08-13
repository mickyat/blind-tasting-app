import type { EventTheme } from './types'

interface ThemeStyle {
  label: string
  bg: string
  // Primary text sitting directly on `bg` (titles) - verified WCAG AA (>=4.5:1).
  accent: string
  // Secondary/hint text sitting directly on `bg` - also verified WCAG AA,
  // just a touch dimmer than `accent` for visual hierarchy.
  muted: string
}

// Deep, rich backgrounds with light cream/gold text. Every bg/accent and
// bg/muted pair here was checked against the WCAG AA contrast threshold
// (4.5:1 for normal text) using the actual relative-luminance formula, not
// eyeballed - the lowest ratio among them is ~7.35:1, well clear of 4.5:1,
// so it stays compliant even as the participant text-size control makes
// text larger (larger text only needs 3:1).
export const THEME_STYLES: Record<EventTheme, ThemeStyle> = {
  default: {
    label: 'ללא ערכת נושא',
    bg: 'bg-[#1f2023]',
    accent: 'text-[#f4f4f5]',
    muted: 'text-[#c7c7cc]',
  },
  wine: {
    label: 'יין',
    bg: 'bg-[#3d0c18]',
    accent: 'text-[#f6ecd6]',
    muted: 'text-[#d8b98f]',
  },
  meat: {
    label: 'בשר',
    bg: 'bg-[#3a1f18]',
    accent: 'text-[#f6ecd6]',
    muted: 'text-[#d8b98f]',
  },
  beer: {
    label: 'בירה',
    bg: 'bg-[#4a3110]',
    accent: 'text-[#f9f0d9]',
    muted: 'text-[#e0c98f]',
  },
  coffee: {
    label: 'קפה',
    bg: 'bg-[#2e1d14]',
    accent: 'text-[#f2e6d0]',
    muted: 'text-[#d4b98d]',
  },
  whiskey: {
    label: 'ויסקי',
    bg: 'bg-[#4a2c08]',
    accent: 'text-[#f9f0d9]',
    muted: 'text-[#e0c98f]',
  },
  cheese: {
    label: 'גבינות',
    bg: 'bg-[#3d3410]',
    accent: 'text-[#f6f0d6]',
    muted: 'text-[#ddd28f]',
  },
  sausage: {
    label: 'נקניקיות ונקניקים',
    bg: 'bg-[#3a1712]',
    accent: 'text-[#f6ecd6]',
    muted: 'text-[#d8b98f]',
  },
  burger: {
    label: 'המבורגרים',
    bg: 'bg-[#3d2412]',
    accent: 'text-[#f6ecd6]',
    muted: 'text-[#dcbf8f]',
  },
  pizza: {
    label: 'פיצה',
    bg: 'bg-[#4a1512]',
    accent: 'text-[#f6ecd6]',
    muted: 'text-[#dcac8f]',
  },
}
