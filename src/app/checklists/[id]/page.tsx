import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabaseServerClient'
import type { Checklist, ChecklistItem, ChecklistPhoto, Client, Property } from '@/lib/supabaseClient'
import type { ChecklistItemStatus } from '@/lib/types'

export const revalidate = 0

type ChecklistPhotoWithUrl = ChecklistPhoto & {
  resolvedUrl: string
}

type ChecklistItemWithPhotos = ChecklistItem & {
  checklist_photos: ChecklistPhotoWithUrl[]
}

type PropertyWithClient = Property & {
  client: Client | null
}

type ChecklistWithRelations = Checklist & {
  properties: PropertyWithClient | null
  checklist_items: ChecklistItemWithPhotos[]
}

type ChecklistMeta = {
  clientId?: string
  propertyId?: string
  clientName?: string
  address?: string
  inspector?: string
  phone?: string
  email?: string
  comments?: string | null
  itemSummary?: string
}

const STATUS_META: Record<ChecklistItemStatus, { label: string; className: string; dotClassName: string }> = {
  done: {
    label: 'Done',
    className: 'border-green-200 bg-green-50 text-green-700',
    dotClassName: 'bg-green-500'
  },
  na: {
    label: 'Not applicable',
    className: 'border-gray-200 bg-gray-50 text-gray-700',
    dotClassName: 'bg-gray-400'
  },
  issue: {
    label: 'Issue',
    className: 'border-red-200 bg-red-50 text-red-700',
    dotClassName: 'bg-red-500'
  },
  unchecked: {
    label: 'Unchecked',
    className: 'border-yellow-200 bg-yellow-50 text-yellow-700',
    dotClassName: 'bg-yellow-500'
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  exterior: 'Exterior',
  interior: 'Interior',
  security: 'Security',
  final: 'Final tasks'
}

function formatCategoryLabel(key: string) {
  return key
    .split('_')
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
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

function formatDateTime(value: string) {
  const date = new Date(value)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
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

type PageProps = {
  params: { id: string }
}

export default async function ChecklistDetailPage({ params }: PageProps) {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('checklists')
    .select(`
      id,
      notes,
      visit_date,
      created_at,
      updated_at,
      properties:properties!checklists_property_id_fkey (
        id,
        name,
        address,
        client_id,
        client:clients!properties_client_id_fkey (
          id,
          name,
          phone,
          email
        )
      ),
      checklist_items (
        id,
        category,
        item_text,
        status,
        notes,
        checklist_photos (
          id,
          storage_path
        )
      )
    `)
    .eq('id', params.id)
    .maybeSingle<ChecklistWithRelations>()

  if (error) {
    console.error('Failed to load checklist', error)

    if (typeof error.message === 'string' && error.message.toLowerCase().includes('permission denied')) {
      return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-6">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
              <h1 className="text-xl font-semibold">Unable to show this checklist</h1>
              <p className="mt-3 text-sm leading-relaxed">
                Supabase row-level security blocked access to checklist <code className="rounded bg-amber-100 px-1">{params.id}</code>. Verify your <code className="rounded bg-amber-100 px-1">SELECT</code> policies on
                the <code className="rounded bg-amber-100 px-1">checklists</code>, <code className="rounded bg-amber-100 px-1">checklist_items</code>, and <code className="rounded bg-amber-100 px-1">properties</code> tables so that the signed-in user can read their own records.
              </p>
              <p className="mt-4 text-sm">
                <Link href="/dashboard" className="text-primary-600 hover:underline">Return to dashboard</Link>
              </p>
            </div>
          </div>
        </main>
      )
    }
  }

  if (!data) {
    notFound()
  }

  const checklist = data
  const meta = parseMeta(checklist.notes)
  const property = checklist.properties
  const propertyClient = property?.client ?? null

  const resolvePhotoUrl = async (storagePath: string | null) => {
    if (!storagePath) return null
    if (/^https?:\/\//.test(storagePath)) {
      return storagePath
    }

    const [bucket, ...objectParts] = storagePath.split('/')
    if (!bucket || objectParts.length === 0) {
      return null
    }

    const objectPath = objectParts.join('/')
    const { data: signedData, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60 * 6)

    if (error) {
      console.warn('Failed to create signed URL for checklist photo', { storagePath, error })
      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(objectPath)
      return publicUrlData?.publicUrl ?? null
    }

    return signedData?.signedUrl ?? null
  }

  const items = await Promise.all(
    (checklist.checklist_items ?? []).map(async item => {
      const resolvedPhotos = await Promise.all(
        (item.checklist_photos ?? []).map(async photo => {
          const resolvedUrl = await resolvePhotoUrl(photo.storage_path)
          if (!resolvedUrl) return null
          return {
            ...photo,
            resolvedUrl
          }
        })
      )

      return {
        ...item,
        checklist_photos: resolvedPhotos.filter((photo): photo is ChecklistPhotoWithUrl => Boolean(photo))
      }
    })
  )

  const statusCounts: Record<ChecklistItemStatus, number> = {
    done: 0,
    issue: 0,
    na: 0,
    unchecked: 0
  }

  const groupedByCategory = new Map<string, ChecklistItemWithPhotos[]>()

  for (const item of items) {
    const status = (item.status ?? 'unchecked') as ChecklistItemStatus
    statusCounts[status] += 1

    const categoryKey = item.category || 'general'
    const existing = groupedByCategory.get(categoryKey)
    if (existing) {
      existing.push(item)
    } else {
      groupedByCategory.set(categoryKey, [item])
    }
  }

  const orderedCategoryKeys = [
    'exterior',
    'interior',
    'security',
    'final',
    ...Array.from(groupedByCategory.keys()).filter(key => !['exterior', 'interior', 'security', 'final'].includes(key))
  ].filter((key, index, array) => array.indexOf(key) === index && groupedByCategory.has(key))

  const totalItems = items.length

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm text-gray-500">
              <Link href="/dashboard" className="text-primary-600 hover:underline">Back to dashboard</Link>
            </p>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">{meta.clientName ?? propertyClient?.name ?? property?.name ?? 'Checklist details'}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Visit on {formatDate(checklist.visit_date ?? checklist.created_at)}
            </p>
          </div>
          <div className="flex w-full flex-col items-stretch gap-3 text-sm md:w-auto md:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700">
                Total items: {totalItems}
              </div>
              <div className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">
                Issues: {statusCounts.issue}
              </div>
              <div className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-green-700">
                Done: {statusCounts.done}
              </div>
            </div>
            <Link
              href={`/checklists/${checklist.id}/edit`}
              className="inline-flex items-center justify-center rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 font-semibold text-primary-700 transition hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 md:w-auto"
            >
              Edit checklist
            </Link>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Visit details</h2>
            <dl className="mt-4 space-y-3 text-sm text-gray-700">
              <div className="flex justify-between">
                <dt className="text-gray-500">Client</dt>
                <dd className="text-gray-900">{meta.clientName ?? propertyClient?.name ?? property?.name ?? 'Not provided'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Property</dt>
                <dd className="text-right text-gray-900">{meta.address ?? property?.address ?? 'Not provided'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Inspector</dt>
                <dd className="text-gray-900">{meta.inspector ?? 'Not provided'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Date</dt>
                <dd className="text-gray-900">{formatDate(checklist.visit_date ?? checklist.created_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="text-gray-900">{formatDateTime(checklist.created_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Last updated</dt>
                <dd className="text-gray-900">{formatDateTime(checklist.updated_at)}</dd>
              </div>
              {(meta.phone ?? propertyClient?.phone) && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="text-gray-900">{meta.phone ?? propertyClient?.phone ?? 'Not provided'}</dd>
                </div>
              )}
              {(meta.email ?? propertyClient?.email) && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Email</dt>
                  <dd className="text-gray-900">{meta.email ?? propertyClient?.email ?? 'Not provided'}</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Status breakdown</h2>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              {(Object.keys(STATUS_META) as ChecklistItemStatus[]).map(statusKey => (
                <li key={statusKey} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[statusKey].dotClassName}`} />
                    <span>{STATUS_META[statusKey].label}</span>
                  </div>
                  <span className="font-medium text-gray-900">{statusCounts[statusKey]}</span>
                </li>
              ))}
            </ul>
            {meta.comments && (
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                <h3 className="font-semibold">Inspector comments</h3>
                <p className="mt-1 whitespace-pre-line leading-relaxed">{meta.comments}</p>
              </div>
            )}
          </div>
        </section>

        {/* {meta.itemSummary && (
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Submission summary</h2>
            <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{meta.itemSummary}</pre>
          </section>
        )} */}

        <section className="space-y-4">
          {orderedCategoryKeys.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
              No checklist items were stored for this visit.
            </div>
          ) : (
            orderedCategoryKeys.map(categoryKey => {
            const categoryItems = groupedByCategory.get(categoryKey) ?? []
            const categoryLabel = CATEGORY_LABELS[categoryKey] ?? formatCategoryLabel(categoryKey)

            return (
              <div key={categoryKey} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">{categoryLabel}</h2>
                <div className="mt-4 space-y-3">
                  {categoryItems
                    .slice()
                    .sort((a, b) => a.item_text.localeCompare(b.item_text))
                    .map(item => {
                      const status = (item.status ?? 'unchecked') as ChecklistItemStatus
                      const photos = item.checklist_photos ?? []

                      return (
                        <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div className="flex-1">
                              <p className="text-base font-medium text-gray-900">{item.item_text}</p>
                              {item.notes && <p className="mt-1 text-sm text-gray-600 whitespace-pre-line">{item.notes}</p>}
                              {photos.length > 0 && (
                                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                  {photos.map(photo => (
                                    <a
                                      key={photo.id}
                                      href={photo.resolvedUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="group block overflow-hidden rounded-lg border border-gray-200"
                                    >
                                      <Image
                                        src={photo.resolvedUrl}
                                        alt={`Photo for ${item.item_text}`}
                                        width={320}
                                        height={240}
                                        sizes="(min-width: 1024px) 200px, (min-width: 640px) 30vw, 45vw"
                                        className="h-32 w-full object-cover transition duration-200 group-hover:scale-105"
                                      />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${STATUS_META[status].className}`}>
                              <span className={`h-2 w-2 rounded-full ${STATUS_META[status].dotClassName}`} />
                              {STATUS_META[status].label}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )
            })
          )}
        </section>
      </div>
    </main>
  )
}
