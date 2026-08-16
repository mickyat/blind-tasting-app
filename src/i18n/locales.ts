// Locale constants shared between server-only code (src/i18n/request.ts,
// which needs next/headers) and client components (like LocaleSwitcher) -
// kept in their own file with zero server-only imports so client bundles
// don't accidentally pull in next/headers.
export const SUPPORTED_LOCALES = ['he', 'en'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: AppLocale = 'he'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

export function isSupportedLocale(value: string | undefined): value is AppLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}
