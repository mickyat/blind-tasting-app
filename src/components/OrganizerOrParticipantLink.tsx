'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { findHostTokenForEvent } from '@/components/MyEvents'

interface Props {
  eventId: string
  mutedClass: string
  // Only relevant for non-organizers: shows a "waiting for the organizer to
  // publish results" line above the "start your own" link. Skip this for
  // screens where results are already visible, or before the participant
  // has even joined.
  waiting?: boolean
}

// Figures out if the person looking at a participant-facing screen is
// actually the organizer (by checking this browser's saved host_token for
// this event) and shows the appropriate link: organizer -> their event
// management page, everyone else -> a "start your own tasting" link plus,
// optionally, a note to wait for results.
export default function OrganizerOrParticipantLink({ eventId, mutedClass, waiting = false }: Props) {
  const [hostToken, setHostToken] = useState<string | null>(null)

  useEffect(() => {
    setHostToken(findHostTokenForEvent(eventId))
  }, [eventId])

  if (hostToken) {
    return (
      <Link href={`/host/${hostToken}`} className={`text-center text-xs underline ${mutedClass}`}>
        את/ה המארגן/ת של האירוע? מעבר לניהול האירוע
      </Link>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {waiting && <span className={`text-xs ${mutedClass}`}>המתן לפרסום התוצאות ע&quot;י המארגן</span>}
      <Link href="/" className={`text-center text-xs underline ${mutedClass}`}>
        רוצה לארגן טעימה עיוורת משלך? לחץ כאן
      </Link>
    </div>
  )
}
