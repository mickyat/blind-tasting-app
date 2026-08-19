'use client'

import { useEffect, useState } from 'react'

export type TextSize = 'normal' | 'large' | 'xlarge'
export const TEXT_SIZE_KEYS: TextSize[] = ['normal', 'large', 'xlarge']
export const TEXT_SIZE_STORAGE_KEY = 'bt_text_size'

// One shared preference for ParticipantFlow and HostDashboard, not a
// separate one per screen - someone bumping the size because it's too
// small on their phone almost certainly wants that everywhere, not just
// on whichever screen they happened to be on first.
export function useTextSize() {
  const [textSize, setTextSizeState] = useState<TextSize>('normal')

  useEffect(() => {
    const saved = localStorage.getItem(TEXT_SIZE_STORAGE_KEY)
    if (saved === 'normal' || saved === 'large' || saved === 'xlarge') setTextSizeState(saved)
  }, [])

  function setTextSize(size: TextSize) {
    setTextSizeState(size)
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, size)
  }

  return [textSize, setTextSize] as const
}
