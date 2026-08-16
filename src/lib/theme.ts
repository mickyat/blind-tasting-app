import type { EventTheme } from './types'

interface ThemeStyle {
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
    bg: 'bg-[#1f2023]',
    accent: 'text-[#f4f4f5]',
    muted: 'text-[#c7c7cc]',
  },
  wine: {
    bg: 'bg-[#3d0c18]',
    accent: 'text-[#f6ecd6]',
    muted: 'text-[#d8b98f]',
  },
  meat: {
    bg: 'bg-[#3a1f18]',
    accent: 'text-[#f6ecd6]',
    muted: 'text-[#d8b98f]',
  },
  beer: {
    bg: 'bg-[#4a3110]',
    accent: 'text-[#f9f0d9]',
    muted: 'text-[#e0c98f]',
  },
  coffee: {
    bg: 'bg-[#2e1d14]',
    accent: 'text-[#f2e6d0]',
    muted: 'text-[#d4b98d]',
  },
  whiskey: {
    bg: 'bg-[#4a2c08]',
    accent: 'text-[#f9f0d9]',
    muted: 'text-[#e0c98f]',
  },
  cheese: {
    bg: 'bg-[#3d3410]',
    accent: 'text-[#f6f0d6]',
    muted: 'text-[#ddd28f]',
  },
  sausage: {
    bg: 'bg-[#3a1712]',
    accent: 'text-[#f6ecd6]',
    muted: 'text-[#d8b98f]',
  },
  burger: {
    bg: 'bg-[#3d2412]',
    accent: 'text-[#f6ecd6]',
    muted: 'text-[#dcbf8f]',
  },
  pizza: {
    bg: 'bg-[#4a1512]',
    accent: 'text-[#f6ecd6]',
    muted: 'text-[#dcac8f]',
  },
}

// Separate, more vivid/saturated swatch used ONLY in the template-picker
// tiles (CreateEventForm) so the 10 templates read as visually distinct at a
// glance - THEME_STYLES.bg is deliberately near-black across every theme for
// the dramatic look on the actual event pages, which made picker tiles look
// too similar to each other. White text contrast on each swatch verified
// with the WCAG relative-luminance formula, lowest ratio ~4.83:1 (cheese),
// clear of the 4.5:1 AA threshold.
export const SWATCH_COLORS: Record<EventTheme, string> = {
  default: 'bg-[#52525b]',
  wine: 'bg-[#881337]',
  meat: 'bg-[#b91c1c]',
  beer: 'bg-[#b45309]',
  coffee: 'bg-[#5c3a21]',
  whiskey: 'bg-[#92400e]',
  cheese: 'bg-[#a16207]',
  sausage: 'bg-[#9a3412]',
  burger: 'bg-[#78350f]',
  pizza: 'bg-[#c2340f]',
}
