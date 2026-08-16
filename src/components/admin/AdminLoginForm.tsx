'use client'

import { useState, useTransition } from 'react'
import { adminLogin } from '@/app/admin/actions'

const ERROR_TEXT: Record<string, string> = {
  invalidPassword: 'סיסמה שגויה',
  tooManyAttempts: 'יותר מדי ניסיונות כניסה כושלים. נסה שוב בעוד כמה דקות.',
  loginFailed: 'שגיאה לא צפויה, נסה שוב',
}

export default function AdminLoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await adminLogin(password)
      if (result && 'errorKey' in result) {
        setError(ERROR_TEXT[result.errorKey] ?? ERROR_TEXT.loginFailed)
      }
      // On success the action itself redirects server-side to /admin.
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
      <label htmlFor="admin-password" className="text-sm font-medium text-zinc-700">
        סיסמת ניהול
      </label>
      <input
        id="admin-password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        autoComplete="current-password"
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base focus:border-zinc-500 focus:outline-none"
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'נכנס…' : 'כניסה'}
      </button>
    </form>
  )
}
