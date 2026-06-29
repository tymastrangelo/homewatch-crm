import Link from 'next/link'
import type { ChecklistSummary } from '@/lib/checklistData'

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export default function ChecklistCard({ summary }: { summary: ChecklistSummary }) {
  const sent = Boolean(summary.emailSentAt)
  const hasRecipient = Boolean(summary.recipientEmail)
  const emailLabel = sent ? 'Emailed' : hasRecipient ? 'Ready to email' : 'No recipient'
  const emailClass = sent
    ? 'border-green-200 bg-green-50 text-green-700'
    : hasRecipient
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-gray-200 bg-gray-50 text-gray-500'

  return (
    <Link
      href={`/checklists/${summary.id}`}
      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-primary-300 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{formatDate(summary.visitDate ?? summary.createdAt)}</p>
          <h3 className="truncate text-base font-semibold text-gray-900">{summary.clientName ?? 'Home watch visit'}</h3>
          <p className="truncate text-sm text-gray-600">{summary.address ?? 'No address'}</p>
          {summary.inspectorName && <p className="truncate text-xs text-gray-400">Inspector: {summary.inspectorName}</p>}
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${emailClass}`}>{emailLabel}</span>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-green-700">
          {summary.counts.done}/{summary.totalItems} done
        </span>
        {summary.counts.issue > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-red-700">
            {summary.counts.issue} issue{summary.counts.issue === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </Link>
  )
}
