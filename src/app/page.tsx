import CreateEventForm from '@/components/CreateEventForm'
import MyEvents from '@/components/MyEvents'

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-bold text-zinc-900">פאנל הטעם</h1>
        <p className="text-sm text-zinc-500">
          צור אירוע טעימה עיוורת, שתף קישור עם המשתתפים, וקבל תוצאות מחושבות בזמן אמת
        </p>
      </header>
      <MyEvents />
      <CreateEventForm />
    </main>
  )
}
