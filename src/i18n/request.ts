import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import { DEFAULT_LOCALE, isSupportedLocale, LOCALE_COOKIE, type AppLocale } from './locales'

// Step 1 of the i18n rollout: only `he` and `en` exist today, but adding a
// future locale is meant to be "drop in a new messages/xx.json + list it
// here" - no routing/architecture change. Deliberately NOT using next-intl's
// URL-based i18n routing (no `[locale]` segment, no middleware) so every
// existing route (/host/..., /e/...) keeps resolving exactly as before while
// only the homepage actually consumes translations for now.

// Locale resolution order: explicit manual choice (cookie) > geo-detected
// country (Vercel sets `x-vercel-ip-country` on every edge request, no
// extra package needed) > default. Not present locally / off Vercel, so
// local dev always falls back to the default (`he`, matching how the whole
// app already looked before this change).
export async function resolveLocale(): Promise<AppLocale> {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value
  if (isSupportedLocale(cookieLocale)) return cookieLocale

  const headerStore = await headers()
  const country = headerStore.get('x-vercel-ip-country')
  if (country) return country === 'IL' ? 'he' : 'en'

  return DEFAULT_LOCALE
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale()
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
