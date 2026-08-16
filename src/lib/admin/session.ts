import { createHmac, timingSafeEqual } from 'crypto'

// Server-only (uses Node's `crypto`) - never import this from a Client
// Component. Single-admin auth backed by one env var (ADMIN_PASSWORD,
// never committed to the repo) rather than a full user/session table,
// since there is exactly one admin and the rest of the app has no account
// system at all - a dedicated auth stack here would be pure overkill.

export const ADMIN_SESSION_COOKIE = 'admin_session'
export const ADMIN_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// The HMAC key is *derived* from ADMIN_PASSWORD (not the raw password
// itself) so the cookie-signing secret isn't literally the login
// credential - a copy of one doesn't hand over the other by inspection.
function signingKey(): string {
  const password = process.env.ADMIN_PASSWORD
  if (!password) throw new Error('ADMIN_PASSWORD is not set')
  return createHmac('sha256', 'tastepanel-admin-session-v1').update(password).digest('hex')
}

function sign(payload: string): string {
  return createHmac('sha256', signingKey()).update(payload).digest('hex')
}

// Constant-time password check (avoids leaking how many leading characters
// matched via response timing) - a modest hardening on top of the login
// rate limit, cheap to include.
export function verifyPassword(candidate: string): boolean {
  const password = process.env.ADMIN_PASSWORD
  if (!password) return false
  const a = Buffer.from(candidate)
  const b = Buffer.from(password)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// Cookie value is `<expiryMs>.<hmac>` - stateless (no session table/store
// needed), tamper-evident (the signature covers the expiry, so it can't be
// extended by an attacker who only has the cookie, not the password), and
// self-expiring (verification checks the embedded expiry against `now`).
export function createSessionCookieValue(): string {
  const payload = String(Date.now() + ADMIN_SESSION_TTL_MS)
  return `${payload}.${sign(payload)}`
}

export function verifySessionCookieValue(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false
  const dot = cookieValue.indexOf('.')
  if (dot < 0) return false
  const payload = cookieValue.slice(0, dot)
  const signature = cookieValue.slice(dot + 1)

  let expected: string
  try {
    expected = sign(payload)
  } catch {
    return false
  }

  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false

  const expiresAt = Number(payload)
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}
