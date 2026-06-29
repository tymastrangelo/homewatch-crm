'use client'

import { useMemo, useState } from 'react'
import ChecklistCard from '@/components/ChecklistCard'
import { SearchIcon } from '@/components/icons'
import type { ChecklistSummary } from '@/lib/checklistData'

type Filter = 'all' | 'pending' | 'issues' | 'sent'

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Ready to email' },
  { value: 'issues', label: 'With issues' },
  { value: 'sent', label: 'Emailed' }
]

export default function ChecklistsBrowser({ summaries }: { summaries: ChecklistSummary[] }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return summaries.filter(s => {
      if (filter === 'pending' && !(s.recipientEmail && !s.emailSentAt)) return false
      if (filter === 'issues' && s.counts.issue === 0) return false
      if (filter === 'sent' && !s.emailSentAt) return false
      if (!q) return true
      return [s.clientName, s.address, s.inspectorName].filter(Boolean).some(v => v!.toLowerCase().includes(q))
    })
  }, [summaries, query, filter])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by client, address, or inspector…"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                filter === f.value ? 'border-primary-600 bg-primary-600 text-white' : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-500">{filtered.length} of {summaries.length} checklists</p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          No checklists match your search.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(summary => (
            <ChecklistCard key={summary.id} summary={summary} />
          ))}
        </div>
      )}
    </div>
  )
}
