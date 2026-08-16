'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

interface SavedEvent {
  title: string
  hostToken: string
  eventId?: string
  createdAt: string
}

const STORAGE_KEY = 'bt_my_events'

function getMyEvents(): SavedEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveMyEvent(entry: SavedEvent) {
  if (typeof window === 'undefined') return
  const updated = [entry, ...getMyEvents().filter((e) => e.hostToken !== entry.hostToken)].slice(0, 50)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

// Called after a successful deleteEvent so this browser's "My Events" list
// doesn't keep a dangling entry pointing at a host_token that no longer
// resolves to anything.
export function removeMyEvent(hostToken: string) {
  if (typeof window === 'undefined') return
  const updated = getMyEvents().filter((e) => e.hostToken !== hostToken)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
}

// Lets a participant-facing screen check "is the person looking at this on
// their own device the organizer?" - only works if they created the event
// from this same browser (host_token was saved locally at creation time,
// there's no login system to check against instead).
export function findHostTokenForEvent(eventId: string): string | null {
  return getMyEvents().find((e) => e.eventId === eventId)?.hostToken ?? null
}

export default function MyEvents() {
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState<SavedEvent[]>([])
  const t = useTranslations('myEvents')
  const locale = useLocale()

  useEffect(() => {
    setEvents(getMyEvents())
  }, [])

  if (events.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="self-center text-sm font-medium text-zinc-600 underline"
      >
        {open ? t('toggleHide') : t('toggleShow')} ({events.length})
      </button>
      {open && (
        <ul className="flex flex-col gap-2">
          {events.map((e) => (
            <li key={e.hostToken}>
              <a
                href={`/host/${e.hostToken}`}
                className="flex items-center justify-between rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm"
              >
                <span className="font-medium">{e.title}</span>
                <span className="text-xs text-zinc-400">
                  {new Date(e.createdAt).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US')}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
