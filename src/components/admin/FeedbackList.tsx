'use client'

import { useState } from 'react'
import { deleteFeedback } from '@/app/admin/actions'
import type { FeedbackRow } from '@/lib/admin/feedback'

const LOCALE_LABELS: Record<string, string> = { he: 'עברית', en: 'אנגלית' }

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('he-IL')
}

// Client component purely for the delete interaction - the list itself is
// server-fetched (src/app/admin/page.tsx) and passed in as initial data, no
// separate client-side fetch/loading state needed for the common case.
export default function FeedbackList({ initialFeedback }: { initialFeedback: FeedbackRow[] }) {
  const [items, setItems] = useState(initialFeedback)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('למחוק את המשוב הזה לצמיתות?')) return
    setDeletingId(id)
    const result = await deleteFeedback(id)
    setDeletingId(null)
    if (result.ok) {
      setItems((prev) => prev.filter((f) => f.id !== id))
    } else {
      alert('שגיאה במחיקת המשוב, נסה שוב')
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-zinc-400">עדיין לא התקבל משוב</p>
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((f) => (
        <li key={f.id} className="flex flex-col gap-2 rounded-xl border border-zinc-300 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs text-zinc-400">{formatDateTime(f.created_at)}</span>
            <button
              type="button"
              onClick={() => handleDelete(f.id)}
              disabled={deletingId === f.id}
              aria-label="מחק משוב"
              className="shrink-0 rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-500 disabled:opacity-50"
            >
              🗑
            </button>
          </div>
          <p className="whitespace-pre-wrap text-sm text-zinc-800">{f.message}</p>
          {(f.contact || f.event_ref || f.locale) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
              {f.contact && <span>יצירת קשר: {f.contact}</span>}
              {f.event_ref && <span>אירוע: {f.event_ref}</span>}
              {f.locale && <span>שפה: {LOCALE_LABELS[f.locale] ?? f.locale}</span>}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
