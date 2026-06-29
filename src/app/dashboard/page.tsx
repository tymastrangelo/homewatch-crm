import Link from 'next/link'
import { getChecklistSummaries } from '@/lib/checklistData'
import ChecklistCard from '@/components/ChecklistCard'
import SetupNotice from '@/components/SetupNotice'
import { ClipboardListIcon, MailIcon, AlertIcon, CalendarIcon, PlusIcon } from '@/components/icons'

export const revalidate = 0

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export default async function DashboardPage() {
  const { summaries, status } = await getChecklistSummaries()

  const total = summaries.length
  const pending = summaries.filter(s => s.recipientEmail && !s.emailSentAt)
  const openIssues = summaries.reduce((sum, s) => sum + s.counts.issue, 0)
  const recent = summaries.slice(0, 6)
  const latest = summaries[0] ?? null

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">Track property visits and keep homeowners in the loop.</p>
        </div>
        <Link
          href="/checklist"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-800 sm:w-auto"
        >
          <PlusIcon className="h-4 w-4" /> New checklist
        </Link>
      </header>

      <SetupNotice status={status} />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={<ClipboardListIcon className="h-5 w-5" />} label="Checklists logged" value={total} sub="All inspections on record" tone="primary" />
        <Stat icon={<MailIcon className="h-5 w-5" />} label="Ready to email" value={pending.length} sub="Have a recipient, not yet sent" tone={pending.length > 0 ? 'amber' : 'gray'} href="#pending" />
        <Stat icon={<AlertIcon className="h-5 w-5" />} label="Open issues" value={openIssues} sub="Flagged across all visits" tone={openIssues > 0 ? 'red' : 'gray'} />
        <Stat icon={<CalendarIcon className="h-5 w-5" />} label="Latest visit" value={latest ? formatDate(latest.visitDate ?? latest.createdAt) : '—'} sub={latest?.clientName ?? 'No visits yet'} tone="gray" small />
      </section>

      <section id="pending" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Waiting to be emailed</h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-600">{pending.length}</span>
        </div>
        {pending.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            All caught up. Checklists with a client email appear here until their PDF is sent.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {pending.slice(0, 6).map(summary => (
              <ChecklistCard key={summary.id} summary={summary} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent checklists</h2>
          <Link href="/checklists" className="text-sm font-medium text-primary-700 hover:underline">View all →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="mt-6 py-8 text-center">
            <p className="text-sm text-gray-500">No checklists yet.</p>
            <Link href="/checklist" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-800">
              <PlusIcon className="h-4 w-4" /> Capture your first inspection
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {recent.map(summary => (
              <ChecklistCard key={summary.id} summary={summary} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

const TONES = {
  primary: 'bg-primary-50 text-primary-700',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  gray: 'bg-gray-100 text-gray-500'
} as const

function Stat({
  icon,
  label,
  value,
  sub,
  tone = 'gray',
  small,
  href
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub: string
  tone?: keyof typeof TONES
  small?: boolean
  href?: string
}) {
  const content = (
    <div className="h-full rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-primary-200 hover:shadow">
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONES[tone]}`}>{icon}</span>
        <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</h3>
      </div>
      <p className={`mt-3 font-bold text-gray-900 ${small ? 'text-lg' : 'text-3xl'}`}>{value}</p>
      <p className="mt-0.5 truncate text-xs text-gray-500">{sub}</p>
    </div>
  )
  return href ? (
    <a href={href} className="block">
      {content}
    </a>
  ) : (
    content
  )
}
