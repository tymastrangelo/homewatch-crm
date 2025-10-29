import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabaseServerClient'
import type { Checklist, ChecklistItem, Property } from '@/lib/supabaseClient'

type ChecklistWithRelations = Checklist & {
  properties: Property | null
  checklist_items: ChecklistItem[]
}

type ChecklistMeta = {
  clientId?: string
  propertyId?: string
  clientName?: string
  address?: string
  inspector?: string
  inspectorId?: string | null
  inspectorEmail?: string | null
  inspectorPhone?: string | null
  phone?: string
  email?: string
  comments?: string | null
  emailSentAt?: string | null
  emailSentTo?: string | null
}

type ChecklistSummary = {
  record: ChecklistWithRelations
  meta: ChecklistMeta
  totalItems: number
  doneCount: number
  needsEmail: boolean
  hasRecipient: boolean
  visitTimestamp: number
  createdTimestamp: number
}

function formatDate(value: string | null) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 60 * 60 * 24 * 365],
    ['month', 60 * 60 * 24 * 30],
    ['week', 60 * 60 * 24 * 7],
    ['day', 60 * 60 * 24],
    ['hour', 60 * 60],
    ['minute', 60],
    ['second', 1]
  ]

  for (const [unit, secondsInUnit] of units) {
    const valueInUnit = diffSeconds / secondsInUnit
    if (Math.abs(valueInUnit) >= 1 || unit === 'second') {
      return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(valueInUnit), unit)
    }
  }

  return null
}

function parseMeta(notes: string | null): ChecklistMeta {
  if (!notes) return {}
  try {
    return JSON.parse(notes) as ChecklistMeta
  } catch (error) {
    console.error('Failed to parse checklist metadata', error)
    return {}
  }
}

function buildChecklistSummary(checklist: ChecklistWithRelations): ChecklistSummary {
  const meta = parseMeta(checklist.notes)
  const totalItems = checklist.checklist_items.length
  const doneCount = checklist.checklist_items.filter(item => item.status === 'done').length
  const recipient = (meta.email ?? '').trim()
  const needsEmail = Boolean(recipient) && !meta.emailSentAt
  const visitDateValue = checklist.visit_date ?? checklist.created_at ?? null
  const visitTimestamp = visitDateValue ? new Date(visitDateValue).getTime() : Number.NEGATIVE_INFINITY
  const createdTimestamp = new Date(checklist.created_at).getTime()

  return {
    record: checklist,
    meta,
    totalItems,
    doneCount,
    needsEmail,
    hasRecipient: Boolean(recipient),
    visitTimestamp: Number.isNaN(visitTimestamp) ? Number.NEGATIVE_INFINITY : visitTimestamp,
    createdTimestamp: Number.isNaN(createdTimestamp) ? Number.NEGATIVE_INFINITY : createdTimestamp
  }
}

function summaryToTime(value: string | null | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  const [recentResult, pendingResult, totalResult] = await Promise.all([
    supabase
      .from('checklists')
      .select(`
        id,
        visit_date,
        created_at,
        notes,
        properties:properties!checklists_property_id_fkey (
          id,
          name,
          address
        ),
        checklist_items (
          status
        )
      `)
      .order('visit_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(12),
    supabase
      .from('checklists')
      .select(`
        id,
        visit_date,
        created_at,
        notes,
        properties:properties!checklists_property_id_fkey (
          id,
          name,
          address
        ),
        checklist_items (
          status
        )
      `)
      .filter('notes->>emailSentAt', 'is', null)
      .order('visit_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, nullsFirst: false })
      .limit(40),
    supabase.from('checklists').select('id', { head: true, count: 'exact' })
  ])

  if (recentResult.error) {
    console.error('Failed to load recent checklists', recentResult.error)
  }

  if (pendingResult.error) {
    console.error('Failed to load checklists pending email', pendingResult.error)
  }

  if (totalResult.error) {
    console.error('Failed to count checklists', totalResult.error)
  }

  const permissionDenied = Boolean(
    recentResult.error &&
    typeof recentResult.error.message === 'string' &&
    recentResult.error.message.toLowerCase().includes('permission denied')
  )

  const recentChecklists = (recentResult.data ?? []) as ChecklistWithRelations[]
  const recentSummaries = recentChecklists.map(buildChecklistSummary)

  const pendingMap = new Map<string, ChecklistSummary>()
  recentSummaries.filter(summary => summary.needsEmail).forEach(summary => {
    pendingMap.set(summary.record.id, summary)
  })

  const pendingCandidates = (pendingResult.data ?? []) as ChecklistWithRelations[]
  pendingCandidates.forEach(checklist => {
    const summary = buildChecklistSummary(checklist)
    if (summary.needsEmail && !pendingMap.has(summary.record.id)) {
      pendingMap.set(summary.record.id, summary)
    }
  })

  const pendingSummaries = Array.from(pendingMap.values()).sort((a, b) => b.visitTimestamp - a.visitTimestamp)
  const pendingSummariesPreview = pendingSummaries.slice(0, 6)
  const pendingEmailCount = pendingSummaries.length

  const totalChecklists = totalResult.count ?? recentSummaries.length
  const latestSummary = recentSummaries[0] ?? null

  const lastEmailSummary = [...recentSummaries, ...pendingSummaries]
    .filter(summary => Boolean(summary.meta.emailSentAt))
    .sort((a, b) => summaryToTime(b.meta.emailSentAt) - summaryToTime(a.meta.emailSentAt))[0] ?? null

  const hasRecentData = recentSummaries.length > 0
  const showPendingSection = !permissionDenied

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600">Stay on top of property visits and follow through on checklist emails.</p>
          </div>
          <Link
            href="/checklist"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 md:w-auto"
          >
            New Checklist
          </Link>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Checklists captured</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{totalChecklists}</p>
            <p className="mt-1 text-xs text-gray-500">Total inspections logged for this account.</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Ready to email</h3>
            <p className={`mt-2 text-3xl font-bold ${pendingEmailCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{pendingEmailCount}</p>
            <p className="mt-1 text-xs text-gray-500">Checklists with a recipient that still need a PDF sent.</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Latest visit</h3>
            {latestSummary ? (
              <div className="mt-2 space-y-1">
                <p className="text-base font-semibold text-gray-900">
                  {latestSummary.meta.clientName ?? latestSummary.record.properties?.name ?? 'Property visit'}
                </p>
                <p className="text-sm text-gray-600">{formatDate(latestSummary.record.visit_date ?? latestSummary.record.created_at)}</p>
                {latestSummary.meta.address && (
                  <p className="text-xs text-gray-500">{latestSummary.meta.address}</p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-3xl font-bold text-gray-900">—</p>
            )}
            <p className="mt-1 text-xs text-gray-500">Keep clients updated right after each walkthrough.</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Last email sent</h3>
            {lastEmailSummary ? (
              <div className="mt-2 space-y-1">
                <p className="text-base font-semibold text-gray-900">
                  {lastEmailSummary.meta.clientName ?? lastEmailSummary.record.properties?.name ?? 'Checklist email'}
                </p>
                <p className="text-sm text-gray-600">{formatDateTime(lastEmailSummary.meta.emailSentAt ?? null)}</p>
                <p className="text-xs text-gray-500">
                  {formatRelativeTime(lastEmailSummary.meta.emailSentAt) ?? 'Just sent'}
                  {lastEmailSummary.meta.emailSentTo ? ` · ${lastEmailSummary.meta.emailSentTo}` : ''}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600">No checklist emails have been sent yet.</p>
            )}
            <p className="mt-1 text-xs text-gray-500">Send PDFs directly from each checklist detail page.</p>
          </div>
        </section>

        {showPendingSection && (
          <section id="ready-to-email" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Checklists waiting on an email</h2>
              <p className="text-sm text-gray-500">Send the PDF summary to keep homeowners informed.</p>
            </div>

            {pendingSummariesPreview.length === 0 ? (
              <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 px-4 py-6 text-sm text-gray-600">
                Everything is up to date. New checklists with an email address will show up here until you send the PDF.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {pendingSummariesPreview.map(summary => (
                  <div
                    key={summary.record.id}
                    className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-primary-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {formatDate(summary.record.visit_date ?? summary.record.created_at)}
                      </p>
                      <h3 className="text-base font-semibold text-gray-900">
                        {summary.meta.clientName ?? summary.record.properties?.name ?? 'Home watch visit'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {summary.meta.address ?? summary.record.properties?.address ?? 'Address not recorded'}
                      </p>
                      {summary.meta.email && (
                        <p className="text-xs text-gray-500">Email: {summary.meta.email}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                      <Link
                        href={`/checklists/${summary.record.id}`}
                        className="inline-flex items-center justify-center rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-100"
                      >
                        Open checklist
                      </Link>
                      <Link
                        href={`/checklists/${summary.record.id}`}
                        className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
                      >
                        Send PDF
                      </Link>
                    </div>
                  </div>
                ))}

                {pendingEmailCount > pendingSummariesPreview.length && (
                  <p className="text-xs text-gray-500">Showing the most recent {pendingSummariesPreview.length} checklists that still need an email.</p>
                )}
              </div>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent checklists</h2>
            <Link href="/checklist" className="text-sm text-primary-600 hover:underline">
              Start another checklist
            </Link>
          </div>

          {permissionDenied ? (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
              Supabase row-level security prevented the dashboard from reading recent checklists. Ensure you have a <code className="rounded bg-amber-100 px-1">SELECT</code> policy that allows the signed-in user to read <code className="rounded bg-amber-100 px-1">checklists</code>, <code className="rounded bg-amber-100 px-1">checklist_items</code>, and <code className="rounded bg-amber-100 px-1">properties</code> tied to their account.
            </div>
          ) : !hasRecentData ? (
            <div className="mt-6 text-center text-sm text-gray-500 py-12">
              No checklists yet. Capture your first inspection to see it here.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {recentSummaries.map(summary => {
                const visitDateValue = summary.record.visit_date ?? summary.record.created_at
                const emailStatusLabel = summary.meta.emailSentAt
                  ? `Sent ${formatRelativeTime(summary.meta.emailSentAt) ?? ''}`.trim()
                  : summary.hasRecipient
                    ? 'Ready to send'
                    : 'No recipient'

                const emailStatusClasses = summary.meta.emailSentAt
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : summary.hasRecipient
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-gray-200 bg-gray-50 text-gray-600'

                return (
                  <Link
                    key={summary.record.id}
                    href={`/checklists/${summary.record.id}`}
                    className="block rounded-xl border border-gray-200 bg-white transition hover:border-primary-200 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {formatDate(visitDateValue)}
                        </p>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {summary.meta.clientName ?? summary.record.properties?.name ?? 'Home watch visit'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {summary.meta.address ?? summary.record.properties?.address ?? 'Address not captured'}
                        </p>
                        {summary.meta.inspector && (
                          <p className="text-xs text-gray-500">Inspector: {summary.meta.inspector}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs md:justify-end">
                        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-gray-700">
                          <span className="h-2 w-2 rounded-full bg-green-500" /> Completed {summary.doneCount}/{summary.totalItems}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${emailStatusClasses}`}>
                          <span className="h-2 w-2 rounded-full bg-current opacity-60" /> {emailStatusLabel}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
