'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { EventTheme } from '@/lib/types'

interface Props {
  type: 'winner' | 'participant'
  theme: EventTheme
  eventTitle: string
  itemName: string
  itemImageUrl?: string | null
  score: string
  nickname?: string
  participantScore?: string
  isClosest?: boolean
  prizeDescription?: string | null
  className?: string
}

// Free growth/marketing feature - not tied to any plan/template limit,
// deliberately available to everyone. Generates a branded, shareable image
// via /api/share-card (next/og ImageResponse, see that route for why) and
// hands it to the OS share sheet (Web Share API with files - works on both
// iOS Safari and Android Chrome) so a viewer can post it straight to
// WhatsApp/Instagram/etc.; falls back to a plain download when the Web
// Share API or file-sharing isn't available (desktop browsers, older
// mobile browsers).
export default function ShareCardButton({
  type,
  theme,
  eventTitle,
  itemName,
  itemImageUrl,
  score,
  nickname,
  participantScore,
  isClosest,
  prizeDescription,
  className,
}: Props) {
  const t = useTranslations('shareCard')
  const locale = useLocale()
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  function buildImageUrl() {
    const params = new URLSearchParams({ type, locale, theme, eventTitle, itemName, score })
    if (itemImageUrl) params.set('itemImageUrl', itemImageUrl)
    if (nickname) params.set('nickname', nickname)
    if (participantScore) params.set('participantScore', participantScore)
    if (isClosest) params.set('isClosest', 'true')
    if (prizeDescription) params.set('prizeDescription', prizeDescription)
    return `/api/share-card?${params.toString()}`
  }

  function buildCaption() {
    return type === 'winner'
      ? t('winnerShareCaption', { itemName, eventTitle })
      : t('participantShareCaption', { itemName, eventTitle, score: participantScore ?? score })
  }

  async function handleClick() {
    setBusy(true)
    setHint(null)
    try {
      const imageUrl = buildImageUrl()
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      const file = new File([blob], 'tastepanel.png', { type: 'image/png' })
      const caption = buildCaption()

      const canUseWebShare =
        typeof navigator !== 'undefined' &&
        'share' in navigator &&
        'canShare' in navigator &&
        navigator.canShare({ files: [file] })

      if (canUseWebShare) {
        try {
          await navigator.share({ files: [file], text: caption })
          return
        } catch (shareError) {
          if (shareError instanceof Error && shareError.name === 'AbortError') return
          // fall through to download fallback below
        }
      }

      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = 'tastepanel.png'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
      setHint(t('downloadHint'))
    } catch {
      setHint(t('shareFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={className ?? 'rounded-xl border-2 border-white bg-white/10 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50'}
      >
        {busy ? t('generatingImage') : type === 'winner' ? t('shareWinnerButton') : t('shareMyCardButton')}
      </button>
      {hint && <span className="text-center text-xs text-white/70">{hint}</span>}
    </div>
  )
}
