import type { Metadata } from 'next'
import AdminLoginForm from '@/components/admin/AdminLoginForm'

// Internal-only route: never linked from the public UI, and explicitly kept
// out of search indexes even though nothing links here anyway (defense in
// depth against crawlers that discover URLs some other way).
export const metadata: Metadata = {
  title: 'ניהול',
  robots: { index: false, follow: false },
}

export default function AdminLoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-lg font-semibold text-zinc-900">כניסת מנהל</h1>
      <AdminLoginForm />
    </div>
  )
}
