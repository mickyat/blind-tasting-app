import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_SESSION_COOKIE, verifySessionCookieValue } from './session'

// Call at the top of every protected /admin server component. Bounces to
// the login page on a missing/invalid/expired cookie instead of rendering
// anything - there is no partial/"preview" admin view.
export async function requireAdminSession() {
  const cookieStore = await cookies()
  const value = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!verifySessionCookieValue(value)) {
    redirect('/admin/login')
  }
}
