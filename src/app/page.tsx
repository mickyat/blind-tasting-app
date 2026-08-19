import { cookies } from 'next/headers'
import { getLocale, getTranslations } from 'next-intl/server'
import CreateEventForm from '@/components/CreateEventForm'
import MyEvents from '@/components/MyEvents'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFreePlan } from '@/lib/plans'
import { VISITOR_ID_COOKIE } from '@/lib/visitor'
import type { AppLocale } from '@/i18n/locales'

export default async function Home(props: PageProps<'/'>) {
  const locale = (await getLocale()) as AppLocale
  const t = await getTranslations('home')
  const tSwitcher = await getTranslations('localeSwitcher')
  const searchParams = await props.searchParams
  const deleted = searchParams?.deleted === '1'

  // Soft, informational only - see supabase/migration-014-plans.sql. Never
  // blocks event creation, just a heads-up once this browser's lifetime
  // event count reaches the free plan's limit.
  const plan = await getFreePlan()
  let reachedLifetimeLimit = false
  if (plan) {
    const visitorId = (await cookies()).get(VISITOR_ID_COOKIE)?.value
    if (visitorId) {
      const supabase = createAdminClient()
      const { data } = await supabase
        .from('visitor_event_count')
        .select('event_count')
        .eq('visitor_id', visitorId)
        .maybeSingle()
      reachedLifetimeLimit = (data?.event_count ?? 0) >= plan.max_lifetime_events
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <LocaleSwitcher locale={locale} labels={{ he: tSwitcher('he'), en: tSwitcher('en') }} />
      {deleted && (
        <p className="rounded-xl bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-700">
          {t('eventDeleted')}
        </p>
      )}
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-bold text-zinc-900">{t('title')}</h1>
        <p className="text-sm text-zinc-500">{t('subtitle')}</p>
      </header>
      {reachedLifetimeLimit && plan && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-800">
          {t('lifetimeLimitReached', { max: plan.max_lifetime_events })}
        </p>
      )}
      <MyEvents />
      <CreateEventForm />
    </main>
  )
}
