import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import EmailChecklistButton from '@/components/EmailChecklistButton'
import DeleteChecklistButton from '@/components/DeleteChecklistButton'
import SetupNotice from '@/components/SetupNotice'
import { getChecklistView } from '@/lib/checklistData'
import { categoryLabel, CATEGORY_ORDER, STATUS_LABELS } from '@/lib/checklistTemplate'
import type { ChecklistCategory } from '@/lib/checklistTemplate'
import type { ChecklistItemStatus } from '@/lib/types'

export const revalidate = 0

const STATUS_STYLE: Record<ChecklistItemStatus, { chip: string; dot: string }> = {
  done: { chip: 'border-green-200 bg-green-50 text-green-700', dot: 'bg-green-500' },
  issue: { chip: 'border-red-200 bg-red-50 text-red-700', dot: 'bg-red-500' },
  na: { chip: 'border-gray-200 bg-gray-50 text-gray-600', dot: 'bg-gray-400' },
  unchecked: { chip: 'border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-400' }
}

function formatDate(value: string | null) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

export default async function ChecklistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { view, status } = await getChecklistView(id)

  if (status !== 'ok') {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <Link href="/checklists" className="text-sm text-primary-700 hover:underline">← All checklists</Link>
        <SetupNotice status={status} />
      </main>
    )
  }

  if (!view) notFound()

  const visitDate = view.visitDate ?? view.createdAt
  const temps = [
    ['Garage / Storage', view.temps.garage],
    ['Main floor', view.temps.mainFloor],
    ['2nd floor', view.temps.secondFloor],
    ['3rd floor', view.temps.thirdFloor]
  ].filter(([, value]) => Boolean(value)) as Array<[string, string]>

  const grouped = new Map<string, typeof view.items>()
  for (const item of view.items) {
    const list = grouped.get(item.category) ?? []
    list.push(item)
    grouped.set(item.category, list)
  }
  const orderedKeys = [
    ...CATEGORY_ORDER.filter(k => grouped.has(k)),
    ...Array.from(grouped.keys()).filter(k => !CATEGORY_ORDER.includes(k as ChecklistCategory))
  ]

  return (
    <main className="p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="text-sm">
          <Link href="/checklists" className="text-primary-700 hover:underline">← All checklists</Link>
        </div>

        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">{view.client?.name || view.property?.name || 'Checklist'}</h1>
            <p className="mt-1 text-sm text-gray-600">{view.property?.address || 'No address'} · {formatDate(visitDate)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-sm text-green-700">{view.counts.done} done</span>
            {view.counts.issue > 0 && <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm text-red-700">{view.counts.issue} issue{view.counts.issue === 1 ? '' : 's'}</span>}
            <Link href={`/checklists/${view.id}/edit`} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Edit</Link>
            <DeleteChecklistButton checklistId={view.id} />
          </div>
        </header>

        {view.emailSentAt ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Report emailed {view.emailSentTo ? `to ${view.emailSentTo} ` : ''}on {formatDateTime(view.emailSentAt)}.
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900">Visit details</h2>
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Detail label="Client" value={view.client?.name} />
              <Detail label="Property" value={view.property?.address} />
              <Detail label="Inspector" value={view.inspector?.name} />
              <Detail label="Visit date" value={formatDate(visitDate)} />
              <Detail label="Client phone" value={view.client?.phone} />
              <Detail label="Client email" value={view.client?.email} />
              <Detail label="Created" value={formatDateTime(view.createdAt)} />
              <Detail label="Last updated" value={formatDateTime(view.updatedAt)} />
            </dl>
            {temps.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <h3 className="text-sm font-semibold text-gray-900">Temperatures</h3>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  {temps.map(([label, value]) => (
                    <span key={label} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1 text-gray-700">{label}: <strong>{value}</strong></span>
                  ))}
                </div>
              </div>
            )}
            {view.comments && (
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                <h3 className="font-semibold">Inspector comments</h3>
                <p className="mt-1 whitespace-pre-line">{view.comments}</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Send report</h2>
            <p className="mt-1 text-sm text-gray-500">Email the homeowner a PDF of this inspection.</p>
            <div className="mt-3">
              <EmailChecklistButton
                checklistId={view.id}
                recipientEmail={view.recipientEmail ?? ''}
                clientName={view.client?.name ?? ''}
                propertyAddress={view.property?.address ?? ''}
                visitDate={visitDate}
                alreadySentAt={view.emailSentAt}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {orderedKeys.map(key => {
            const list = grouped.get(key) ?? []
            return (
              <div key={key} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">{categoryLabel(key)}</h2>
                <div className="mt-3 space-y-3">
                  {list.map(item => {
                    const style = STATUS_STYLE[item.status]
                    return (
                      <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{item.label}</p>
                            {item.notes && <p className="mt-1 whitespace-pre-line text-sm text-gray-600">{item.notes}</p>}
                            {item.photos.length > 0 && (
                              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                                {item.photos.map(photo => (
                                  <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-gray-200">
                                    <Image src={photo.url} alt={item.label} width={200} height={150} className="h-24 w-full object-cover" />
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${style.chip}`}>
                            <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                            {STATUS_LABELS[item.status]}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>
      </div>
    </main>
  )
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value || '—'}</dd>
    </div>
  )
}
