'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { LOCALE_COOKIE, SUPPORTED_LOCALES, type AppLocale } from '@/i18n/locales'

interface Props {
  locale: AppLocale
  labels: Record<AppLocale, string>
}

// Sets the manual-override cookie and refreshes the current route so every
// server component (layout included) re-reads the new locale. No client-side
// translation state to sync - next-intl's request config re-resolves from
// the cookie on the next request, which router.refresh() triggers without a
// full page reload.
export default function LocaleSwitcher({ locale, labels }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function switchTo(next: AppLocale) {
    if (next === locale) return
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex items-center justify-center gap-1 text-xs">
      {SUPPORTED_LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          disabled={pending}
          className={`rounded-lg px-2 py-1 font-medium disabled:opacity-50 ${
            l === locale ? 'bg-zinc-900 text-white' : 'text-zinc-500 underline'
          }`}
        >
          {labels[l]}
        </button>
      ))}
    </div>
  )
}
