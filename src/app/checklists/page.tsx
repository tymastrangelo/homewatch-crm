import Link from 'next/link'
import { getChecklistSummaries } from '@/lib/checklistData'
import ChecklistsBrowser from '@/components/ChecklistsBrowser'
import SetupNotice from '@/components/SetupNotice'
import { PlusIcon, ClipboardListIcon } from '@/components/icons'

export const revalidate = 0

export default async function ChecklistsPage() {
  const { summaries, status } = await getChecklistSummaries()

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Checklists</h1>
          <p className="mt-1 text-sm text-gray-600">Every property inspection, searchable in one place.</p>
        </div>
        <Link
          href="/checklist"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-800 sm:w-auto"
        >
          <PlusIcon className="h-4 w-4" /> New checklist
        </Link>
      </header>

      <SetupNotice status={status} />

      {summaries.length === 0 && status === 'ok' ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <ClipboardListIcon className="h-6 w-6" />
          </span>
          <h2 className="mt-3 text-lg font-semibold text-gray-900">No checklists yet</h2>
          <p className="mt-1 text-sm text-gray-600">Capture your first property inspection to get started.</p>
          <Link href="/checklist" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800">
            <PlusIcon className="h-4 w-4" /> New checklist
          </Link>
        </div>
      ) : (
        <ChecklistsBrowser summaries={summaries} />
      )}
    </main>
  )
}
