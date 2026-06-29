import { createSupabaseServerClient } from './supabaseServerClient'
import { templateSortOrder } from './checklistTemplate'
import type { ChecklistItemStatus } from './types'

export type StatusCounts = Record<ChecklistItemStatus, number>

export type ReadStatus = 'ok' | 'setup-required' | 'permission-denied' | 'error'

function classifyError(error: { message?: string } | null | undefined): ReadStatus {
  const msg = (error?.message ?? '').toLowerCase()
  if (!msg) return 'error'
  if (msg.includes('permission denied')) return 'permission-denied'
  if (
    msg.includes('does not exist') ||
    msg.includes('could not find') ||
    msg.includes('schema cache') ||
    msg.includes('relationship between')
  ) {
    return 'setup-required'
  }
  return 'error'
}

export type ChecklistPhotoView = { id: string; url: string; storagePath: string }

export type ChecklistItemView = {
  id: string
  itemKey: string | null
  category: string
  label: string
  status: ChecklistItemStatus
  notes: string | null
  sortOrder: number
  photos: ChecklistPhotoView[]
}

export type ChecklistView = {
  id: string
  visitDate: string | null
  createdAt: string
  updatedAt: string
  comments: string | null
  temps: { garage: string | null; mainFloor: string | null; secondFloor: string | null; thirdFloor: string | null }
  emailSentAt: string | null
  emailSentTo: string | null
  client: { id: string; name: string; phone: string | null; email: string | null } | null
  property: { id: string; name: string; address: string | null } | null
  inspector: { id: string; name: string; email: string | null; phone: string | null } | null
  items: ChecklistItemView[]
  counts: StatusCounts
  totalItems: number
  recipientEmail: string | null
}

export type ChecklistSummary = {
  id: string
  visitDate: string | null
  createdAt: string
  clientName: string | null
  address: string | null
  inspectorName: string | null
  emailSentAt: string | null
  recipientEmail: string | null
  counts: StatusCounts
  totalItems: number
}

type SupabaseClientType = Awaited<ReturnType<typeof createSupabaseServerClient>>

const SUMMARY_SELECT = `
  id, visit_date, created_at, email_sent_at, email_sent_to, notes,
  property:properties!checklists_property_id_fkey ( id, name, address,
    client:clients!properties_client_id_fkey ( id, name, email ) ),
  inspector:inspectors!checklists_inspector_id_fkey ( id, name ),
  checklist_items ( status )
`

const FULL_SELECT = `
  id, visit_date, created_at, updated_at, comments,
  temp_garage, temp_main_floor, temp_second_floor, temp_third_floor,
  email_sent_at, email_sent_to, notes,
  property:properties!checklists_property_id_fkey ( id, name, address,
    client:clients!properties_client_id_fkey ( id, name, phone, email ) ),
  inspector:inspectors!checklists_inspector_id_fkey ( id, name, email, phone ),
  checklist_items ( id, item_key, sort_order, category, item_text, status, notes,
    checklist_photos ( id, storage_path ) )
`

// Defensive fallback: if a column came back null we peek at the legacy JSON blob.
function legacyMeta(notes: string | null): Record<string, unknown> {
  if (!notes) return {}
  try {
    const parsed = JSON.parse(notes)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function emptyCounts(): StatusCounts {
  return { done: 0, issue: 0, na: 0, unchecked: 0 }
}

function countStatuses(items: { status: string | null }[]): StatusCounts {
  const counts = emptyCounts()
  for (const item of items) {
    const status = (item.status ?? 'unchecked') as ChecklistItemStatus
    if (status in counts) counts[status] += 1
  }
  return counts
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

async function resolvePhotoUrl(supabase: SupabaseClientType, storagePath: string | null): Promise<string | null> {
  if (!storagePath) return null
  if (/^https?:\/\//.test(storagePath)) return storagePath

  const [bucket, ...rest] = storagePath.split('/')
  if (!bucket || rest.length === 0) return null
  const objectPath = rest.join('/')

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, 60 * 60 * 6)
  if (error) {
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(objectPath)
    return publicData?.publicUrl ?? null
  }
  return data?.signedUrl ?? null
}

export async function getChecklistSummaries(
  limit?: number
): Promise<{ summaries: ChecklistSummary[]; status: ReadStatus }> {
  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from('checklists')
    .select(SUMMARY_SELECT)
    .order('visit_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error) {
    console.error('getChecklistSummaries failed', error)
    return { summaries: [], status: classifyError(error) }
  }

  const summaries = ((data ?? []) as any[]).map(row => {
    const property = firstRelation<any>(row.property)
    const client = firstRelation<any>(property?.client)
    const inspector = firstRelation<any>(row.inspector)
    const meta = legacyMeta(row.notes)
    const items = (row.checklist_items ?? []) as { status: string | null }[]
    return {
      id: row.id,
      visitDate: row.visit_date,
      createdAt: row.created_at,
      clientName: client?.name ?? (meta.clientName as string) ?? property?.name ?? null,
      address: property?.address ?? (meta.address as string) ?? null,
      inspectorName: inspector?.name ?? (meta.inspector as string) ?? null,
      emailSentAt: row.email_sent_at ?? (meta.emailSentAt as string) ?? null,
      recipientEmail: client?.email ?? (meta.email as string) ?? null,
      counts: countStatuses(items),
      totalItems: items.length
    }
  })

  return { summaries, status: 'ok' as const }
}

export async function getChecklistView(
  id: string
): Promise<{ view: ChecklistView | null; permissionDenied: boolean; status: ReadStatus }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('checklists').select(FULL_SELECT).eq('id', id).maybeSingle()

  if (error) {
    console.error('getChecklistView failed', error)
    const status = classifyError(error)
    return { view: null, permissionDenied: status === 'permission-denied', status }
  }
  if (!data) return { view: null, permissionDenied: false, status: 'ok' }

  const row = data as any
  const property = firstRelation<any>(row.property)
  const client = firstRelation<any>(property?.client)
  const inspector = firstRelation<any>(row.inspector)
  const meta = legacyMeta(row.notes)

  const items: ChecklistItemView[] = await Promise.all(
    (row.checklist_items ?? []).map(async (item: any) => {
      const photos = await Promise.all(
        (item.checklist_photos ?? []).map(async (photo: any) => {
          const url = await resolvePhotoUrl(supabase, photo.storage_path)
          return url ? { id: photo.id, url, storagePath: photo.storage_path } : null
        })
      )
      return {
        id: item.id,
        itemKey: item.item_key,
        category: item.category || 'general',
        label: item.item_text,
        status: (item.status ?? 'unchecked') as ChecklistItemStatus,
        notes: item.notes,
        sortOrder: item.sort_order ?? templateSortOrder(item.item_key, item.item_text),
        photos: photos.filter((p): p is ChecklistPhotoView => Boolean(p))
      }
    })
  )

  items.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))

  const recipientEmail = client?.email ?? (meta.email as string) ?? null

  const view: ChecklistView = {
    id: row.id,
    visitDate: row.visit_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    comments: row.comments ?? (meta.comments as string) ?? null,
    temps: {
      garage: row.temp_garage ?? (meta.garageTemp as string) ?? null,
      mainFloor: row.temp_main_floor ?? (meta.mainFloorTemp as string) ?? null,
      secondFloor: row.temp_second_floor ?? (meta.secondFloorTemp as string) ?? null,
      thirdFloor: row.temp_third_floor ?? (meta.thirdFloorTemp as string) ?? null
    },
    emailSentAt: row.email_sent_at ?? (meta.emailSentAt as string) ?? null,
    emailSentTo: row.email_sent_to ?? (meta.emailSentTo as string) ?? null,
    client: client ? { id: client.id, name: client.name, phone: client.phone ?? null, email: client.email ?? null } : null,
    property: property ? { id: property.id, name: property.name, address: property.address ?? null } : null,
    inspector: inspector
      ? { id: inspector.id, name: inspector.name, email: inspector.email ?? null, phone: inspector.phone ?? null }
      : meta.inspector
        ? { id: '', name: meta.inspector as string, email: (meta.inspectorEmail as string) ?? null, phone: (meta.inspectorPhone as string) ?? null }
        : null,
    items,
    counts: countStatuses(items),
    totalItems: items.length,
    recipientEmail
  }

  return { view, permissionDenied: false, status: 'ok' }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
