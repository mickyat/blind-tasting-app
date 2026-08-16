import { getLocale, getTranslations } from 'next-intl/server'
import CreateEventForm from '@/components/CreateEventForm'
import MyEvents from '@/components/MyEvents'
import LocaleSwitcher from '@/components/LocaleSwitcher'
import type { AppLocale } from '@/i18n/locales'

export default async function Home() {
  const locale = (await getLocale()) as AppLocale
  const t = await getTranslations('home')
  const tSwitcher = await getTranslations('localeSwitcher')

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <LocaleSwitcher locale={locale} labels={{ he: tSwitcher('he'), en: tSwitcher('en') }} />
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-bold text-zinc-900">{t('title')}</h1>
        <p className="text-sm text-zinc-500">{t('subtitle')}</p>
      </header>
      <MyEvents />
      <CreateEventForm />
    </main>
  )
}
