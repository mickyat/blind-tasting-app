'use client'

import { useTranslations } from 'next-intl'
import { TEXT_SIZE_KEYS, type TextSize } from '@/lib/textSize'

interface Props {
  value: TextSize
  onChange: (size: TextSize) => void
}

// Shared between ParticipantFlow and HostDashboard so both read the exact
// same "participantFlow.textSize*" message keys and render pixel-identical
// UI - this is one setting conceptually, not two separately-built ones.
export default function TextSizeControl({ value, onChange }: Props) {
  const t = useTranslations('participantFlow')
  const labels: Record<TextSize, string> = {
    normal: t('textSizeNormal'),
    large: t('textSizeLarge'),
    xlarge: t('textSizeXLarge'),
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-white px-4 py-2">
      <span className="text-xs text-zinc-500">{t('textSizeLabel')}</span>
      {TEXT_SIZE_KEYS.map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => onChange(size)}
          className={`rounded-lg border px-2 py-1 text-xs font-medium ${
            value === size ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-700'
          }`}
        >
          {labels[size]}
        </button>
      ))}
    </div>
  )
}
