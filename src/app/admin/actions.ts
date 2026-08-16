'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_MS,
  createSessionCookieValue,
  verifyPassword,
} from '@/lib/admin/session'

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX_ATTEMPTS = 5

function err(errorKey: 'tooManyAttempts' | 'invalidPassword' | 'loginFailed') {
  return { errorKey }
}

// Best-effort IP extraction from standard proxy headers (Vercel sets
// x-forwarded-for) - good enough to rate-limit a single-admin login form,
// not meant to be spoof-proof.
async function clientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return h.get('x-real-ip') ?? 'unknown'
}

export async function adminLogin(password: string) {
  const supabase = createAdminClient()
  const ip = await clientIp()

  // Counted in the DB (not an in-memory Map) so the limit actually holds
  // across Vercel's multiple serverless instances - an in-process counter
  // would reset per-instance and be trivial to route around.
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { count } = await supabase
    .from('admin_login_attempt')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', since)

  if ((count ?? 0) >= RATE_LIMIT_MAX_ATTEMPTS) {
    return err('tooManyAttempts')
  }

  if (!verifyPassword(password)) {
    // Only failed attempts count toward the limit - the legitimate admin
    // logging in repeatedly never locks themselves out.
    await supabase.from('admin_login_attempt').insert({ ip })
    return err('invalidPassword')
  }

  const cookieStore = await cookies()
  cookieStore.set(ADMIN_SESSION_COOKIE, createSessionCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/admin',
    maxAge: ADMIN_SESSION_TTL_MS / 1000,
  })

  redirect('/admin')
}

export async function adminLogout() {
  const cookieStore = await cookies()
  // Must match the `path` the cookie was set with (path: '/admin' above) -
  // cookies are keyed by (name, domain, path), so deleting without it sets
  // an unrelated path='/' cookie instead and silently leaves the real
  // session cookie (path='/admin') valid and logged in.
  cookieStore.delete({ name: ADMIN_SESSION_COOKIE, path: '/admin' })
  redirect('/admin/login')
}
