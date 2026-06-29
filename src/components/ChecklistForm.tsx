'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient, type Client, type Inspector, type Property } from '@/lib/supabaseClient'
import { CHECKLIST_PHOTO_BUCKET, COMPANY } from '@/lib/constants'
import {
  CHECKLIST_TEMPLATE,
  CATEGORY_ORDER,
  categoryLabel,
  type ChecklistCategory
} from '@/lib/checklistTemplate'
import { saveChecklist, type SaveChecklistItem } from '@/app/actions/checklists'
import { CameraIcon } from '@/components/icons'
import { prepareImageForUpload, runWithConcurrency } from '@/lib/clientImage'
import type { ChecklistItemStatus } from '@/lib/types'

type PhotoDraft = {
  id: string
  previewUrl: string
  file?: File
  storagePath?: string | null
  persistedId?: string | null
}

type ItemState = {
  uid: string
  itemKey: string | null
  category: string
  label: string
  status: ChecklistItemStatus
  notes: string
  sortOrder: number
  persistedId: string | null
  photos: PhotoDraft[]
}

export type ChecklistFormDefaultItem = {
  persistedId?: string | null
  itemKey?: string | null
  category?: string
  label: string
  status?: ChecklistItemStatus
  notes?: string | null
  photos?: Array<{ id?: string; url: string; storagePath?: string | null }>
}

export type ChecklistFormDefaults = {
  checklistId?: string
  clientId?: string | null
  clientName?: string
  address?: string
  propertyId?: string | null
  inspectorId?: string | null
  inspectorName?: string
  inspectorEmail?: string
  inspectorPhone?: string
  phone?: string
  email?: string
  dateOfArrival?: string
  comments?: string
  temps?: { garage?: string; mainFloor?: string; secondFloor?: string; thirdFloor?: string }
  items?: ChecklistFormDefaultItem[]
}

type ClientOption = Client & { properties: Array<Pick<Property, 'id' | 'name' | 'address'>> }

const STATUS_BUTTONS: Array<{ value: ChecklistItemStatus; label: string; active: string }> = [
  { value: 'done', label: 'Done', active: 'bg-green-600 border-green-600 text-white' },
  { value: 'issue', label: 'Issue', active: 'bg-red-600 border-red-600 text-white' },
  { value: 'na', label: 'N/A', active: 'bg-gray-500 border-gray-500 text-white' },
  { value: 'unchecked', label: 'Skip', active: 'bg-gray-200 border-gray-300 text-gray-700' }
]

function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

function buildInitialItems(defaults?: ChecklistFormDefaults): ItemState[] {
  const fromDefaults = new Map<string, ChecklistFormDefaultItem>()
  ;(defaults?.items ?? []).forEach(item => {
    const key = item.itemKey ?? item.label.trim().toLowerCase()
    fromDefaults.set(key, item)
  })

  const items: ItemState[] = CHECKLIST_TEMPLATE.map(template => {
    const match = fromDefaults.get(template.key) ?? fromDefaults.get(template.label.trim().toLowerCase())
    if (match) fromDefaults.delete(match.itemKey ?? match.label.trim().toLowerCase())
    return {
      uid: uid(),
      itemKey: template.key,
      category: template.category,
      label: template.label,
      sortOrder: template.sortOrder,
      status: match?.status ?? 'unchecked',
      notes: match?.notes ?? '',
      persistedId: match?.persistedId ?? null,
      photos: (match?.photos ?? []).map(p => ({
        id: p.id ?? uid(),
        previewUrl: p.url,
        storagePath: p.storagePath ?? null,
        persistedId: p.id ?? null
      }))
    }
  })

  // Preserve any non-template (custom) items that came from saved data.
  let extraOrder = 1000
  for (const leftover of fromDefaults.values()) {
    items.push({
      uid: uid(),
      itemKey: leftover.itemKey ?? null,
      category: leftover.category ?? 'general',
      label: leftover.label,
      sortOrder: extraOrder++,
      status: leftover.status ?? 'unchecked',
      notes: leftover.notes ?? '',
      persistedId: leftover.persistedId ?? null,
      photos: (leftover.photos ?? []).map(p => ({
        id: p.id ?? uid(),
        previewUrl: p.url,
        storagePath: p.storagePath ?? null,
        persistedId: p.id ?? null
      }))
    })
  }

  return items
}

export default function ChecklistForm({ defaultData }: { defaultData?: ChecklistFormDefaults }) {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseClient(), [])
  const isEditing = Boolean(defaultData?.checklistId)

  const [clients, setClients] = useState<ClientOption[]>([])
  const [inspectors, setInspectors] = useState<Inspector[]>([])

  const [clientId, setClientId] = useState<string | null>(defaultData?.clientId ?? null)
  const [clientName, setClientName] = useState(defaultData?.clientName ?? '')
  const [phone, setPhone] = useState(defaultData?.phone ?? '')
  const [email, setEmail] = useState(defaultData?.email ?? '')
  const [propertyId, setPropertyId] = useState<string | null>(defaultData?.propertyId ?? null)
  const [address, setAddress] = useState(defaultData?.address ?? '')
  const [addingClient, setAddingClient] = useState(false)
  const [addingProperty, setAddingProperty] = useState(false)

  const [inspectorId, setInspectorId] = useState<string | null>(defaultData?.inspectorId ?? null)
  const [inspectorName, setInspectorName] = useState(defaultData?.inspectorName ?? '')
  const [inspectorEmail, setInspectorEmail] = useState(defaultData?.inspectorEmail ?? '')
  const [inspectorPhone, setInspectorPhone] = useState(defaultData?.inspectorPhone ?? '')
  const [addingInspector, setAddingInspector] = useState(!defaultData?.inspectorId)

  const [dateOfArrival, setDateOfArrival] = useState(defaultData?.dateOfArrival ?? new Date().toISOString().slice(0, 10))
  const [temps, setTemps] = useState({
    garage: defaultData?.temps?.garage ?? '',
    mainFloor: defaultData?.temps?.mainFloor ?? '',
    secondFloor: defaultData?.temps?.secondFloor ?? '',
    thirdFloor: defaultData?.temps?.thirdFloor ?? ''
  })
  const [comments, setComments] = useState(defaultData?.comments ?? '')
  const [items, setItems] = useState<ItemState[]>(() => buildInitialItems(defaultData))

  const deletedPhotos = useRef<{ ids: string[]; paths: string[] }>({ ids: [], paths: [] })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load clients + inspectors for the dropdowns.
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const [{ data: clientData }, { data: inspectorData }] = await Promise.all([
        supabase
          .from('clients')
          .select('id, user_id, name, phone, email, created_at, updated_at, properties:properties(id, name, address)')
          .order('name'),
        supabase.from('inspectors').select('id, user_id, name, email, phone, created_at, updated_at').order('name')
      ])
      if (!mounted) return
      setClients((clientData ?? []) as unknown as ClientOption[])
      setInspectors((inspectorData ?? []) as Inspector[])
    })()
    return () => {
      mounted = false
    }
  }, [supabase])

  // Revoke object URLs on unmount.
  useEffect(() => {
    return () => {
      items.forEach(item =>
        item.photos.forEach(photo => {
          if (photo.previewUrl.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl)
        })
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedClient = clients.find(c => c.id === clientId) ?? null

  function onSelectClient(value: string) {
    if (value === '__new__') {
      setClientId(null)
      setClientName('')
      setPhone('')
      setEmail('')
      setPropertyId(null)
      setAddress('')
      setAddingClient(true)
      setAddingProperty(true)
      return
    }
    const client = clients.find(c => c.id === value)
    setAddingClient(false)
    setClientId(value)
    setClientName(client?.name ?? '')
    setPhone(client?.phone ?? '')
    setEmail(client?.email ?? '')
    const props = client?.properties ?? []
    if (props.length === 1) {
      setPropertyId(props[0].id)
      setAddress(props[0].address ?? '')
      setAddingProperty(false)
    } else {
      setPropertyId(null)
      setAddress('')
      setAddingProperty(props.length === 0)
    }
  }

  function onSelectProperty(value: string) {
    if (value === '__new__') {
      setPropertyId(null)
      setAddress('')
      setAddingProperty(true)
      return
    }
    const property = selectedClient?.properties.find(p => p.id === value)
    setPropertyId(value)
    setAddress(property?.address ?? '')
    setAddingProperty(false)
  }

  function onSelectInspector(value: string) {
    if (value === '__new__' || value === '') {
      setInspectorId(null)
      setAddingInspector(true)
      setInspectorName('')
      setInspectorEmail('')
      setInspectorPhone('')
      return
    }
    const inspector = inspectors.find(i => i.id === value)
    setInspectorId(value)
    setAddingInspector(false)
    setInspectorName(inspector?.name ?? '')
    setInspectorEmail(inspector?.email ?? '')
    setInspectorPhone(inspector?.phone ?? '')
  }

  function updateItem(id: string, patch: Partial<ItemState>) {
    setItems(prev => prev.map(item => (item.uid === id ? { ...item, ...patch } : item)))
  }

  function addPhotos(id: string, files: FileList | null) {
    if (!files || files.length === 0) return
    const additions: PhotoDraft[] = Array.from(files).map(file => ({
      id: uid(),
      previewUrl: URL.createObjectURL(file),
      file
    }))
    setItems(prev => prev.map(item => (item.uid === id ? { ...item, photos: [...item.photos, ...additions] } : item)))
  }

  function removePhoto(itemId: string, photo: PhotoDraft) {
    if (photo.previewUrl.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl)
    if (photo.persistedId) {
      deletedPhotos.current.ids.push(photo.persistedId)
      if (photo.storagePath) deletedPhotos.current.paths.push(photo.storagePath)
    }
    setItems(prev =>
      prev.map(item => (item.uid === itemId ? { ...item, photos: item.photos.filter(p => p.id !== photo.id) } : item))
    )
  }

  function bulkSet(status: ChecklistItemStatus) {
    setItems(prev => prev.map(item => ({ ...item, status })))
  }

  const grouped = useMemo(() => {
    const map = new Map<string, ItemState[]>()
    items.forEach(item => {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    })
    const orderedKeys = [
      ...CATEGORY_ORDER.filter(k => map.has(k)),
      ...Array.from(map.keys()).filter(k => !CATEGORY_ORDER.includes(k as ChecklistCategory))
    ]
    return orderedKeys.map(key => ({ key, items: (map.get(key) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder) }))
  }, [items])

  const completed = items.filter(i => i.status !== 'unchecked').length
  const issues = items.filter(i => i.status === 'issue').length

  async function handleSubmit() {
    setError(null)
    if (!clientName.trim()) return setError('Please enter a client name.')
    if (!address.trim()) return setError('Please enter a property address.')
    if (!inspectorName.trim()) return setError('Please choose or enter an inspector.')

    setIsSubmitting(true)
    try {
      // Collect every new photo across all items as upload jobs.
      const jobs: Array<{ itemIndex: number; file: File }> = []
      items.forEach((item, itemIndex) => {
        item.photos.forEach(photo => {
          if (photo.file) jobs.push({ itemIndex, file: photo.file })
        })
      })

      const uploadedPathsByItem = new Map<number, string[]>()

      if (jobs.length > 0) {
        setUploadProgress({ done: 0, total: jobs.length })

        // Compress + upload each photo, with a couple of retries. Bounded
        // concurrency keeps things fast without flooding the connection or
        // freezing the page on a big batch of phone photos.
        const tasks = jobs.map(job => async () => {
          const { blob, ext } = await prepareImageForUpload(job.file)
          const objectPath = `${uid()}.${ext}`

          let lastError: unknown = null
          for (let attempt = 0; attempt < 3; attempt++) {
            const { error: uploadError } = await supabase.storage
              .from(CHECKLIST_PHOTO_BUCKET)
              .upload(objectPath, blob, { cacheControl: '3600', upsert: false, contentType: blob.type || 'image/jpeg' })
            if (!uploadError) {
              const list = uploadedPathsByItem.get(job.itemIndex) ?? []
              list.push(`${CHECKLIST_PHOTO_BUCKET}/${objectPath}`)
              uploadedPathsByItem.set(job.itemIndex, list)
              return
            }
            lastError = uploadError
          }
          throw new Error(`A photo failed to upload after several tries: ${lastError instanceof Error ? lastError.message : 'unknown error'}`)
        })

        await runWithConcurrency(tasks, 4, (done, total) => setUploadProgress({ done, total }))
        setUploadProgress(null)
      }

      const itemsPayload: SaveChecklistItem[] = items.map((item, itemIndex) => ({
        itemKey: item.itemKey,
        category: item.category,
        label: item.label,
        status: item.status,
        notes: item.notes,
        sortOrder: item.sortOrder,
        persistedId: item.persistedId,
        newPhotoPaths: uploadedPathsByItem.get(itemIndex) ?? []
      }))

      const result = await saveChecklist({
        checklistId: defaultData?.checklistId ?? null,
        clientId,
        clientName,
        clientPhone: phone,
        clientEmail: email,
        propertyId,
        address,
        inspectorId,
        inspectorName,
        inspectorEmail,
        inspectorPhone,
        visitDate: dateOfArrival || null,
        comments,
        temps: {
          garage: temps.garage,
          mainFloor: temps.mainFloor,
          secondFloor: temps.secondFloor,
          thirdFloor: temps.thirdFloor
        },
        items: itemsPayload,
        deletedPhotoIds: deletedPhotos.current.ids,
        deletedPhotoPaths: deletedPhotos.current.paths
      })

      if (!result.ok) throw new Error(result.error)
      router.push(`/checklists/${result.checklistId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save checklist.')
      setUploadProgress(null)
      setIsSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'
  const labelClass = 'block text-sm font-medium text-gray-700'

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEditing ? 'Edit checklist' : 'New home watch checklist'}</h1>
          <p className="mt-1 text-sm text-gray-500">{COMPANY.name} · {COMPANY.phone}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-700">{completed}/{items.length} done</span>
          {issues > 0 && <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">{issues} issue{issues === 1 ? '' : 's'}</span>}
        </div>
      </header>

      {/* Visit details */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Visit details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Client</label>
            <select className={`mt-1 ${inputClass}`} value={addingClient ? '__new__' : clientId ?? ''} onChange={e => onSelectClient(e.target.value)}>
              <option value="">Select a client…</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__new__">+ Add new client</option>
            </select>
            {addingClient && (
              <input className={`mt-2 ${inputClass}`} placeholder="Client name" value={clientName} onChange={e => setClientName(e.target.value)} />
            )}
          </div>

          <div>
            <label className={labelClass}>Property address</label>
            <select
              className={`mt-1 ${inputClass}`}
              value={addingProperty ? '__new__' : propertyId ?? ''}
              onChange={e => onSelectProperty(e.target.value)}
              disabled={!addingClient && !clientId}
            >
              <option value="">{clientId || addingClient ? 'Select an address…' : 'Choose a client first'}</option>
              {(selectedClient?.properties ?? []).map(p => (
                <option key={p.id} value={p.id}>{p.address || p.name}</option>
              ))}
              {(clientId || addingClient) && <option value="__new__">+ Add new address</option>}
            </select>
            {addingProperty && (
              <input className={`mt-2 ${inputClass}`} placeholder="123 Main St, Naples FL" value={address} onChange={e => setAddress(e.target.value)} />
            )}
          </div>

          <div>
            <label className={labelClass}>Client phone</label>
            <input className={`mt-1 ${inputClass}`} value={phone} onChange={e => setPhone(e.target.value)} placeholder="239-555-0123" />
          </div>
          <div>
            <label className={labelClass}>Client email</label>
            <input type="email" className={`mt-1 ${inputClass}`} value={email} onChange={e => setEmail(e.target.value)} placeholder="client@example.com" />
          </div>

          <div>
            <label className={labelClass}>Visit date</label>
            <input type="date" className={`mt-1 ${inputClass}`} value={dateOfArrival} onChange={e => setDateOfArrival(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Inspector</label>
            <select className={`mt-1 ${inputClass}`} value={addingInspector ? '__new__' : inspectorId ?? ''} onChange={e => onSelectInspector(e.target.value)}>
              <option value="">Select an inspector…</option>
              {inspectors.map(i => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
              <option value="__new__">+ Add new inspector</option>
            </select>
            {addingInspector && (
              <input className={`mt-2 ${inputClass}`} placeholder="Inspector name" value={inspectorName} onChange={e => setInspectorName(e.target.value)} />
            )}
          </div>
        </div>
      </section>

      {/* Temperatures */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Interior temperatures</h2>
        <p className="mt-1 text-sm text-gray-500">Optional — record readings for any zone you check.</p>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          {([
            ['garage', 'Garage / Storage'],
            ['mainFloor', 'Main floor'],
            ['secondFloor', '2nd floor'],
            ['thirdFloor', '3rd floor']
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label className={labelClass}>{label}</label>
              <input className={`mt-1 ${inputClass}`} value={temps[key]} onChange={e => setTemps(prev => ({ ...prev, [key]: e.target.value }))} placeholder="78°F" />
            </div>
          ))}
        </div>
      </section>

      {/* Checklist items */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Inspection checklist</h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500">Mark all:</span>
            <button type="button" onClick={() => bulkSet('done')} className="rounded-md border border-green-200 bg-green-50 px-2 py-1 font-medium text-green-700 hover:bg-green-100">Done</button>
            <button type="button" onClick={() => bulkSet('unchecked')} className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 font-medium text-gray-600 hover:bg-gray-100">Reset</button>
          </div>
        </div>

        <div className="mt-4 space-y-6">
          {grouped.map(group => (
            <div key={group.key}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{categoryLabel(group.key)}</h3>
              <div className="space-y-3">
                {group.items.map(item => (
                  <div key={item.uid} className={`rounded-xl border p-3 ${item.status === 'issue' ? 'border-red-200 bg-red-50/40' : 'border-gray-100 bg-white'}`}>
                    <p className="text-sm font-medium text-gray-800">{item.label}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {STATUS_BUTTONS.map(btn => (
                        <button
                          key={btn.value}
                          type="button"
                          onClick={() => updateItem(item.uid, { status: btn.value })}
                          className={`rounded-lg border px-3 py-1 text-sm font-medium transition ${
                            item.status === btn.value ? btn.active : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                    {(item.status === 'issue' || item.notes || item.photos.length > 0) && (
                      <textarea
                        value={item.notes}
                        onChange={e => updateItem(item.uid, { notes: e.target.value })}
                        placeholder={item.status === 'issue' ? 'Describe the issue…' : 'Notes (optional)'}
                        className="mt-3 w-full resize-y rounded-lg border border-gray-200 p-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        rows={2}
                      />
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                        <CameraIcon className="h-4 w-4" /> Add photo
                        <input hidden type="file" accept="image/*" multiple onChange={e => addPhotos(item.uid, e.target.files)} />
                      </label>
                      {item.notes === '' && item.status !== 'issue' && (
                        <button type="button" onClick={() => updateItem(item.uid, { notes: ' ' })} className="text-xs text-primary-600 hover:underline">
                          + Add note
                        </button>
                      )}
                      {item.photos.map(photo => (
                        <div key={photo.id} className="relative">
                          <Image src={photo.previewUrl} alt="" width={64} height={64} unoptimized className="h-16 w-16 rounded-md border object-cover" />
                          <button
                            type="button"
                            onClick={() => removePhoto(item.uid, photo)}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white"
                            aria-label="Remove photo"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Comments */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
        <h2 className="text-lg font-semibold text-gray-900">Summary comments</h2>
        <textarea
          value={comments}
          onChange={e => setComments(e.target.value)}
          placeholder="Overall observations, follow-up tasks, anything the homeowner should know…"
          className="mt-3 h-28 w-full resize-y rounded-lg border border-gray-200 p-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </section>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-gray-200 bg-gray-50/95 py-4 backdrop-blur sm:flex-row sm:justify-end">
        <Link href={isEditing ? `/checklists/${defaultData?.checklistId}` : '/dashboard'} className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Cancel
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-lg bg-primary-700 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-800 disabled:cursor-not-allowed disabled:bg-primary-400"
        >
          {uploadProgress
            ? `Uploading photos ${uploadProgress.done}/${uploadProgress.total}…`
            : isSubmitting
              ? 'Saving…'
              : isEditing
                ? 'Update checklist'
                : 'Save checklist'}
        </button>
      </div>
    </div>
  )
}
