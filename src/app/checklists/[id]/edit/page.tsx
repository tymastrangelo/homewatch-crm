import Link from 'next/link'
import { notFound } from 'next/navigation'
import ChecklistForm from '@/components/ChecklistForm'
import { createSupabaseServerClient } from '@/lib/supabaseServerClient'
import type { Checklist, ChecklistItem, ChecklistPhoto, Client, Property } from '@/lib/supabaseClient'
import type { ChecklistItemStatus } from '@/lib/types'

export const revalidate = 0

type ChecklistItemWithPhotos = ChecklistItem & {
  checklist_photos: ChecklistPhoto[]
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
}

type PageProps = {
  params: Promise<{ id: string }>
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

function toDateInput(value: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10)
  }
  return parsed.toISOString().slice(0, 10)
}

export default async function EditChecklistPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('checklists')
    .select(`
      id,
      notes,
      visit_date,
      created_at,
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
  .eq('id', id)
    .maybeSingle<ChecklistWithRelations>()

  if (error) {
    console.error('Failed to load checklist for editing', error)

    if (typeof error.message === 'string' && error.message.toLowerCase().includes('permission denied')) {
      return (
        <main className="min-h-screen bg-gray-50 p-4 md:p-6">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
              <h1 className="text-xl font-semibold">Unable to edit this checklist</h1>
              <p className="mt-3 text-sm leading-relaxed">
                Supabase row-level security blocked access to checklist <code className="rounded bg-amber-100 px-1">{id}</code>. Update your <code className="rounded bg-amber-100 px-1">SELECT</code> and <code className="rounded bg-amber-100 px-1">UPDATE</code> policies on
                the <code className="rounded bg-amber-100 px-1">checklists</code>, <code className="rounded bg-amber-100 px-1">checklist_items</code>, and <code className="rounded bg-amber-100 px-1">properties</code> tables so that the signed-in user can manage their own records.
              </p>
              <p className="mt-4 text-sm">
                <Link href={`/checklists/${id}`} className="text-primary-600 hover:underline">Return to checklist</Link>
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
      console.warn('Failed to create signed URL for checklist photo (edit view)', { storagePath, error })
      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(objectPath)
      return publicUrlData?.publicUrl ?? null
    }

    return signedData?.signedUrl ?? null
  }

  const defaultItems = await Promise.all(
    (checklist.checklist_items ?? []).map(async item => {
      const photos = await Promise.all(
        (item.checklist_photos ?? []).map(async photo => {
          const previewUrl = await resolvePhotoUrl(photo.storage_path)
          if (!previewUrl) return null
          return {
            id: photo.id,
            previewUrl,
            storagePath: photo.storage_path,
            persistedId: photo.id
          }
        })
      )

      return {
        id: item.id,
        persistedId: item.id,
        label: item.item_text,
        category: item.category ?? 'general',
        status: (item.status ?? 'unchecked') as ChecklistItemStatus,
        notes: item.notes ?? '',
        photos: photos.filter((photo): photo is NonNullable<typeof photo> => Boolean(photo))
      }
    })
  )

  const defaultData = {
    checklistId: checklist.id,
    propertyId: property?.id ?? null,
    clientId: meta.clientId ?? propertyClient?.id ?? property?.client_id ?? null,
    clientName: meta.clientName ?? propertyClient?.name ?? property?.name ?? '',
    address: meta.address ?? property?.address ?? '',
    inspector: meta.inspector ?? '',
    dateOfArrival: toDateInput(checklist.visit_date ?? checklist.created_at),
    phone: meta.phone ?? propertyClient?.phone ?? '',
    email: meta.email ?? propertyClient?.email ?? '',
    comments: meta.comments ?? '',
    items: defaultItems
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6">
        <div className="flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
          <Link href={`/checklists/${id}`} className="text-primary-600 hover:underline">Back to checklist</Link>
          <span className="text-xs sm:text-sm">Updates save to the same record immediately.</span>
        </div>
      </div>
      <ChecklistForm defaultData={defaultData} />
    </main>
  )
}
