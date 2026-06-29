import Link from 'next/link'
import { notFound } from 'next/navigation'
import ChecklistForm, { type ChecklistFormDefaults } from '@/components/ChecklistForm'
import SetupNotice from '@/components/SetupNotice'
import { getChecklistView } from '@/lib/checklistData'

export const revalidate = 0

function toDateInput(value: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10)
  return parsed.toISOString().slice(0, 10)
}

export default async function EditChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { view, status } = await getChecklistView(id)

  if (status !== 'ok') {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <Link href={`/checklists/${id}`} className="text-sm text-primary-700 hover:underline">← Back to checklist</Link>
        <SetupNotice status={status} />
      </main>
    )
  }

  if (!view) notFound()

  const defaults: ChecklistFormDefaults = {
    checklistId: view.id,
    clientId: view.client?.id ?? null,
    clientName: view.client?.name ?? '',
    phone: view.client?.phone ?? '',
    email: view.client?.email ?? '',
    propertyId: view.property?.id ?? null,
    address: view.property?.address ?? '',
    inspectorId: view.inspector?.id || null,
    inspectorName: view.inspector?.name ?? '',
    inspectorEmail: view.inspector?.email ?? '',
    inspectorPhone: view.inspector?.phone ?? '',
    dateOfArrival: toDateInput(view.visitDate ?? view.createdAt),
    comments: view.comments ?? '',
    temps: {
      garage: view.temps.garage ?? '',
      mainFloor: view.temps.mainFloor ?? '',
      secondFloor: view.temps.secondFloor ?? '',
      thirdFloor: view.temps.thirdFloor ?? ''
    },
    items: view.items.map(item => ({
      persistedId: item.id,
      itemKey: item.itemKey,
      category: item.category,
      label: item.label,
      status: item.status,
      notes: item.notes,
      photos: item.photos.map(photo => ({ id: photo.id, url: photo.url, storagePath: photo.storagePath }))
    }))
  }

  return <ChecklistForm defaultData={defaults} />
}
