import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabaseServerClient'
import type { Checklist, ChecklistItem, Property } from '@/lib/supabaseClient'

type ChecklistWithRelations = Checklist & {
  properties: Property | null
  checklist_items: ChecklistItem[]
}

type ChecklistMeta = {
  clientName?: string
  address?: string
  inspector?: string
  phone?: string
  email?: string
  comments?: string | null
}

function formatDate(value: string | null) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
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

export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
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
    .limit(8)

  if (error) {
    console.error('Failed to load checklists', error)
  }

  const permissionDenied = Boolean(error && typeof error.message === 'string' && error.message.toLowerCase().includes('permission denied'))

  const checklists = (data ?? []) as ChecklistWithRelations[]

  const totalChecklists = checklists.length
  const totalIssues = checklists.reduce((count, checklist) => count + checklist.checklist_items.filter(item => item.status === 'issue').length, 0)
  const latestChecklist = checklists.at(0)
  const latestMeta = latestChecklist ? parseMeta(latestChecklist.notes) : {}

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">Track recent inspections, flagged issues, and jump back into the checklist workflow.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/checklist" className="inline-flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg shadow-sm hover:bg-primary-800 transition">
              New Checklist
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Checklists captured</h3>
            <p className="mt-2 text-2xl font-bold text-gray-900">{totalChecklists}</p>
            <p className="text-xs text-gray-500 mt-1">Last {totalChecklists === 1 ? 'submission' : 'submissions'} displayed below.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Issues flagged</h3>
            <p className={`mt-2 text-2xl font-bold ${totalIssues > 0 ? 'text-red-600' : 'text-gray-900'}`}>{totalIssues}</p>
            <p className="text-xs text-gray-500 mt-1">Total items marked as issue across recent checklists.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-500">Latest visit</h3>
            {latestChecklist ? (
              <div className="mt-2 space-y-1">
                <p className="text-base font-semibold text-gray-900">{latestMeta.clientName ?? latestChecklist.properties?.name ?? 'Property visit'}</p>
                <p className="text-sm text-gray-600">{formatDate(latestChecklist.visit_date ?? latestChecklist.created_at)}</p>
              </div>
            ) : (
              <p className="mt-2 text-2xl font-bold text-gray-900">—</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Stay current on the most recent walkthrough.</p>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent checklists</h2>
            <Link href="/checklist" className="text-sm text-primary-600 hover:underline">Start another checklist</Link>
          </div>

          {permissionDenied ? (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-sm text-amber-800">
              Supabase row-level security prevented the dashboard from reading recent checklists. Ensure you have a <code className="rounded bg-amber-100 px-1">SELECT</code> policy that allows the signed-in user to read <code className="rounded bg-amber-100 px-1">checklists</code>, <code className="rounded bg-amber-100 px-1">checklist_items</code>, and <code className="rounded bg-amber-100 px-1">properties</code> tied to their account.
            </div>
          ) : checklists.length === 0 ? (
            <div className="mt-6 text-center text-sm text-gray-500 py-12">
              No checklists yet. Capture your first inspection to see it here.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {checklists.map(checklist => {
                const meta = parseMeta(checklist.notes)
                const issueCount = checklist.checklist_items.filter(item => item.status === 'issue').length
                const doneCount = checklist.checklist_items.filter(item => item.status === 'done').length
                const totalItems = checklist.checklist_items.length

                return (
                  <Link
                    key={checklist.id}
                    href={`/checklists/${checklist.id}`}
                    className="block rounded-xl border border-gray-200 hover:border-primary-200 hover:shadow-md transition bg-white"
                  >
                    <div className="p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm uppercase tracking-wide text-gray-500">{formatDate(checklist.visit_date ?? checklist.created_at)}</p>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {meta.clientName ?? checklist.properties?.name ?? 'Home watch visit'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {meta.address ?? checklist.properties?.address ?? 'Address not captured'}
                          </p>
                          {meta.inspector && (
                            <p className="mt-1 text-sm text-gray-500">Inspector: {meta.inspector}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 text-sm">
                          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-gray-700">
                            <span className="h-2 w-2 rounded-full bg-green-500" /> Done {doneCount}/{totalItems}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">
                            <span className="h-2 w-2 rounded-full bg-red-500" /> Issues {issueCount}
                          </span>
                        </div>
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
