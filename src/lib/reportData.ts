import { templateSortOrder } from './checklistTemplate'
import type { ChecklistItemStatus } from './types'
import type { Report, ReportItem, ReportPhoto } from './reportPdf'

/**
 * Loads a checklist row and shapes it into the Report model consumed by the
 * PDF renderer. Shared by the email route and the PDF download route.
 */

// Cap embedded photos so a visit with dozens of images can't exhaust memory.
const MAX_EMBEDDED_PHOTOS = 24

const FULL_SELECT = `
  id, visit_date, created_at, comments,
  temp_garage, temp_main_floor, temp_second_floor, temp_third_floor,
  property:properties!checklists_property_id_fkey ( id, name, address,
    client:clients!properties_client_id_fkey ( id, name, phone, email ) ),
  inspector:inspectors!checklists_inspector_id_fkey ( id, name, email, phone ),
  checklist_items ( id, item_key, sort_order, category, item_text, status, notes,
    checklist_photos ( id, storage_path ) )
`

/* eslint-disable @typescript-eslint/no-explicit-any */
function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

async function downloadPhoto(supabase: any, storagePath: string): Promise<Buffer | null> {
  try {
    if (/^https?:\/\//i.test(storagePath)) {
      const res = await fetch(storagePath)
      if (!res.ok) return null
      return Buffer.from(await res.arrayBuffer())
    }
    const [bucket, ...rest] = storagePath.split('/')
    if (!bucket || rest.length === 0) return null
    const { data, error } = await supabase.storage.from(bucket).download(rest.join('/'))
    if (error || !data) return null
    return Buffer.from(await data.arrayBuffer())
  } catch {
    return null
  }
}

export type LoadedReport = {
  report: Report
  photos: ReportPhoto[]
  /** Client email on file, for defaulting the send-to address. */
  clientEmail: string
}

export async function loadReport(supabase: any, checklistId: string): Promise<LoadedReport | null | { error: string }> {
  const { data, error } = await supabase.from('checklists').select(FULL_SELECT).eq('id', checklistId).maybeSingle()
  if (error) {
    console.error('loadReport: failed to load checklist', error)
    return { error: 'Unable to load checklist data.' }
  }
  if (!data) return null

  const row = data as any
  const property = firstRelation<any>(row.property)
  const client = firstRelation<any>(property?.client)
  const inspector = firstRelation<any>(row.inspector)

  const counts: Record<ChecklistItemStatus, number> = { done: 0, issue: 0, na: 0, unchecked: 0 }
  const items: ReportItem[] = (row.checklist_items ?? []).map((item: any) => {
    const status = (item.status ?? 'unchecked') as ChecklistItemStatus
    if (status in counts) counts[status] += 1
    return {
      label: item.item_text,
      category: item.category || 'general',
      status,
      notes: item.notes,
      sortOrder: item.sort_order ?? templateSortOrder(item.item_key, item.item_text)
    }
  })
  items.sort((a, b) => a.sortOrder - b.sortOrder)

  const temps = [
    ['Garage / Storage', row.temp_garage],
    ['Main floor', row.temp_main_floor],
    ['2nd floor', row.temp_second_floor],
    ['3rd floor', row.temp_third_floor]
  ]
    .filter(([, value]) => value && String(value).trim())
    .map(([label, value]) => ({ label: label as string, value: String(value) }))

  const photos: ReportPhoto[] = []
  outer: for (const item of row.checklist_items ?? []) {
    for (const photo of item.checklist_photos ?? []) {
      if (photos.length >= MAX_EMBEDDED_PHOTOS) break outer
      if (!photo?.storage_path) continue
      const buffer = await downloadPhoto(supabase, photo.storage_path)
      if (buffer) photos.push({ buffer, itemLabel: item.item_text })
    }
  }

  const report: Report = {
    clientName: client?.name || property?.name || 'Not specified',
    propertyAddress: property?.address || 'Not provided',
    inspectorName: inspector?.name || 'Not recorded',
    clientPhone: client?.phone || '',
    clientEmail: client?.email || '',
    visitDate: row.visit_date ?? row.created_at,
    comments: row.comments || '',
    temps,
    items,
    counts
  }

  return { report, photos, clientEmail: client?.email || '' }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function reportFileName(propertyAddress: string) {
  const fileSafe = propertyAddress.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'inspection'
  return `home-watch-report-${fileSafe}.pdf`
}
