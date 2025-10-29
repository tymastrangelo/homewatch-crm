"use client"
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  getSupabaseClient,
  type Client,
  type ClientInsert,
  type ClientUpdate,
  type Property,
  type PropertyInsert,
  type PropertyUpdate,
  type Checklist,
  type ChecklistInsert,
  type ChecklistUpdate,
  type ChecklistItemInsert,
  type Inspector,
  type InspectorInsert,
  type InspectorUpdate
} from '@/lib/supabaseClient'

type ChecklistPhotoDraft = {
  id: string
  previewUrl: string
  file?: File
  storagePath?: string | null
  persistedId?: string | null
}

type ItemStatus = 'done' | 'na' | 'issue' | 'unchecked'

type ChecklistItemForm = {
  id: string
  label: string
  category: string
  status: ItemStatus
  notes?: string | null
  photos: ChecklistPhotoDraft[]
  persistedId?: string | null
}

type ChecklistItemInput = Omit<ChecklistItemForm, 'photos'> & {
  photos?: Array<ChecklistPhotoDraft | string>
}

type ClientOption = Client & {
  properties: Array<Pick<Property, 'id' | 'address' | 'name'>>
}

type ChecklistData = {
  clientId?: string | null
  clientName: string
  address: string
  dateOfArrival: string
  inspector: string
  inspectorId?: string | null
  inspectorEmail?: string | null
  inspectorPhone?: string | null
  phone: string
  email: string
  garageTemp?: string | null
  mainFloorTemp?: string | null
  secondFloorTemp?: string | null
  thirdFloorTemp?: string | null
  items?: ChecklistItemInput[]
  comments?: string
  checklistId?: string
  propertyId?: string | null
}

const COMPANY_PHONE = '239.572.2025'
const COMPANY_PRIMARY_EMAIL = 'info@239homeservices.com'
const COMPANY_SECONDARY_EMAIL = 'info@239homeservices.com'

const initialItems: ChecklistItemForm[] = [
  { id: 'forced_entry', category: 'exterior', label: 'Visual check for evidence of forced entry, vandalism, theft or damage', status: 'unchecked', photos: [], persistedId: null },
  { id: 'yard_maintenance', category: 'exterior', label: 'Visual inspection of yard/landscaping to assure regular maintenance', status: 'unchecked', photos: [], persistedId: null },
  { id: 'outdoor_fixtures', category: 'exterior', label: 'Visual inspection of outdoor light fixtures, fencing, windows, screens, and mailbox', status: 'unchecked', photos: [], persistedId: null },
  { id: 'hose_faucet', category: 'exterior', label: 'Check exterior hose and faucet for leaks', status: 'unchecked', photos: [], persistedId: null },
  { id: 'remove_mail', category: 'exterior', label: 'Removal of newspapers, flyers, packages, mail and other evidence of non-occupancy', status: 'unchecked', photos: [], persistedId: null },
  { id: 'roof_gutters', category: 'exterior', label: 'Visual inspection of roof and gutters from the ground', status: 'unchecked', photos: [], persistedId: null },
  { id: 'interior_theft', category: 'interior', label: 'Inspect for signs of theft, vandalism, damage or other disturbance', status: 'unchecked', photos: [], persistedId: null },
  { id: 'fuse_box', category: 'interior', label: 'Check fuse box for tripped breakers or evidence of power surge', status: 'unchecked', photos: [], persistedId: null },
  { id: 'water_supply', category: 'interior', label: 'Turn on water supply if turned off', status: 'unchecked', photos: [], persistedId: null },
  { id: 'hot_water_heater', category: 'interior', label: 'Visual check of hot water heater', status: 'unchecked', photos: [], persistedId: null },
  { id: 'hvac', category: 'interior', label: 'Visual check of HVAC', status: 'unchecked', photos: [], persistedId: null },
  { id: 'thermostat', category: 'interior', label: 'Check that thermostat is set at correct temperature', status: 'unchecked', photos: [], persistedId: null },
  { id: 'temps', category: 'interior', label: 'Document interior temperature levels (Garage/Storage, Main Floor, 2nd Zone, 3rd Floor)', status: 'unchecked', photos: [], persistedId: null },
  { id: 'secure_windows', category: 'security', label: 'Check that all windows and entryways are secure', status: 'unchecked', photos: [], persistedId: null },
  { id: 'security_system', category: 'security', label: 'Check security system is set and working properly', status: 'unchecked', photos: [], persistedId: null },
  { id: 'lighting', category: 'interior', label: 'Check interior and exterior lighting', status: 'unchecked', photos: [], persistedId: null },
  { id: 'lights_operation', category: 'interior', label: 'Operation of all lights - interior and exterior', status: 'unchecked', photos: [], persistedId: null },
  { id: 'water_damage', category: 'interior', label: 'Visual inspection of walls, ceilings, windows, tubs/showers for evidence of water damage, leakage, mold', status: 'unchecked', photos: [], persistedId: null },
  { id: 'water_lines', category: 'interior', label: 'Water flex lines and drains – Run sinks and toilets', status: 'unchecked', photos: [], persistedId: null },
  { id: 'garbage_disposal', category: 'interior', label: 'Garbage disposal(s)', status: 'unchecked', photos: [], persistedId: null },
  { id: 'pests', category: 'interior', label: 'Inspect for visible evidence of insects, pests, rodents', status: 'unchecked', photos: [], persistedId: null },
  { id: 'appliances', category: 'interior', label: 'Visual check of appliances', status: 'unchecked', photos: [], persistedId: null },
  { id: 'freezers', category: 'interior', label: 'Check that freezers, refrigerators and wine coolers are working', status: 'unchecked', photos: [], persistedId: null },
  { id: 'icemaker', category: 'interior', label: 'Ensure icemakers are in "off" position', status: 'unchecked', photos: [], persistedId: null },
  { id: 'clocks', category: 'interior', label: 'Check clocks settings - reset if needed', status: 'unchecked', photos: [], persistedId: null },
  { id: 'lanai_screens', category: 'lanai_pool', label: 'Lanai/Pool - Screen door(s), screens, and cage structure', status: 'unchecked', photos: [], persistedId: null },
  { id: 'lanai_water', category: 'lanai_pool', label: 'Lanai/Pool - Water level and condition', status: 'unchecked', photos: [], persistedId: null },
  { id: 'lanai_equipment', category: 'lanai_pool', label: 'Lanai/Pool - Equipment', status: 'unchecked', photos: [], persistedId: null },
  { id: 'final_hot_water', category: 'final', label: 'Turn off hot water heater', status: 'unchecked', photos: [], persistedId: null },
  { id: 'final_water_supply', category: 'final', label: 'Turn off water supply', status: 'unchecked', photos: [], persistedId: null },
  { id: 'final_lights', category: 'final', label: 'Turn off all lights', status: 'unchecked', photos: [], persistedId: null },
  { id: 'final_security', category: 'final', label: 'Enable security system (if applicable) and lock all doors and windows', status: 'unchecked', photos: [], persistedId: null }
]

const generateLocalId = () => {
  if (typeof crypto !== 'undefined') {
    if ('randomUUID' in crypto && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }

    if ('getRandomValues' in crypto && typeof crypto.getRandomValues === 'function') {
      const buffer = new Uint8Array(16)
      crypto.getRandomValues(buffer)
      buffer[6] = (buffer[6] & 0x0f) | 0x40
      buffer[8] = (buffer[8] & 0x3f) | 0x80
      const hex = Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    }
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = (Math.random() * 16) | 0
    const value = char === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}

const normalizeItems = (rawItems?: ChecklistItemInput[]): ChecklistItemForm[] => {
  const source: ChecklistItemInput[] = rawItems && rawItems.length > 0 ? rawItems : initialItems
  const normalized = source.map((item: ChecklistItemInput) => {
    const normalizedPhotos: ChecklistPhotoDraft[] = (item.photos ?? []).map((photo: ChecklistPhotoDraft | string) => {
      if (typeof photo === 'string') {
        return {
          id: generateLocalId(),
          previewUrl: photo,
          storagePath: null,
          persistedId: null
        }
      }

      return {
        id: photo.id ?? generateLocalId(),
        previewUrl: photo.previewUrl ?? photo.storagePath ?? '',
        file: photo.file,
        storagePath: photo.storagePath ?? null,
        persistedId: photo.persistedId ?? null
      }
    }).filter(photo => Boolean(photo.previewUrl))

    return {
      ...item,
      id: item.id ?? item.persistedId ?? generateLocalId(),
      category: item.category ?? 'general',
      status: item.status ?? 'unchecked',
      notes: item.notes ?? '',
      photos: normalizedPhotos,
      persistedId: item.persistedId ?? null
    }
  })

  const presentLabels = new Set(normalized.map(item => item.label.trim().toLowerCase()))

  initialItems.forEach(templateItem => {
    if (!presentLabels.has(templateItem.label.trim().toLowerCase())) {
      normalized.push({
        ...templateItem,
        id: templateItem.id,
        notes: '',
        photos: [],
        status: 'unchecked',
        persistedId: null
      })
    }
  })

  return normalized
}
export default function ChecklistForm({ defaultData }: { defaultData?: Partial<ChecklistData> }) {
  const router = useRouter()
  const supabase = useMemo(() => getSupabaseClient(), [])
  const [clientName, setClientName] = useState(defaultData?.clientName || '')
  const [address, setAddress] = useState(defaultData?.address || '')
  const [dateOfArrival, setDateOfArrival] = useState(defaultData?.dateOfArrival || '')
  const [inspector, setInspector] = useState(defaultData?.inspector || '')
  const [selectedInspectorId, setSelectedInspectorId] = useState<string | null>(defaultData?.inspectorId ?? null)
  const [inspectorEmail, setInspectorEmail] = useState(defaultData?.inspectorEmail || '')
  const [inspectorPhone, setInspectorPhone] = useState(defaultData?.inspectorPhone || '')
  const [inspectors, setInspectors] = useState<Inspector[]>([])
  const [isLoadingInspectors, setIsLoadingInspectors] = useState<boolean>(true)
  const [isAddingNewInspector, setIsAddingNewInspector] = useState<boolean>(() => !defaultData?.inspectorId)
  const defaultInspectorName = defaultData?.inspector ?? ''
  const [phone, setPhone] = useState(defaultData?.phone ?? '')
  const [email, setEmail] = useState(defaultData?.email ?? '')
  const [garageTemp, setGarageTemp] = useState(defaultData?.garageTemp || '')
  const [mainFloorTemp, setMainFloorTemp] = useState(defaultData?.mainFloorTemp || '')
  const [secondFloorTemp, setSecondFloorTemp] = useState(defaultData?.secondFloorTemp || '')
  const [thirdFloorTemp, setThirdFloorTemp] = useState(defaultData?.thirdFloorTemp || '')
  const [items, setItems] = useState<ChecklistItemForm[]>(() => normalizeItems(defaultData?.items))
  const [comments, setComments] = useState(defaultData?.comments || '')
  const [selectedClientId, setSelectedClientId] = useState<string | null>(defaultData?.clientId ?? null)
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(defaultData?.propertyId ?? null)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [isLoadingClients, setIsLoadingClients] = useState<boolean>(true)
  const [isAddingNewClient, setIsAddingNewClient] = useState<boolean>(false)
  const [isAddingNewProperty, setIsAddingNewProperty] = useState<boolean>(false)
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(defaultData?.checklistId ?? null)
  const submitLabel = editingChecklistId ? 'Update Checklist' : 'Submit Checklist'

  useEffect(() => {
    let isMounted = true

    const loadClients = async () => {
      try {
        const { data, error } = await supabase
          .from('clients')
          .select('id, user_id, name, phone, email, created_at, updated_at, properties:properties(id, name, address, client_id)')
          .order('name', { ascending: true })

        if (!isMounted) return

        if (error) {
          console.error('Failed to load clients', error)
          setClients([])
          setIsAddingNewClient(true)
          setIsAddingNewProperty(true)
        } else {
          const hydrated = ((data ?? []) as unknown) as ClientOption[]
          setClients(hydrated)
          if (hydrated.length === 0) {
            setIsAddingNewClient(true)
            setIsAddingNewProperty(true)
          }
        }
      } catch (error) {
        if (isMounted) {
          console.error('Unexpected error loading clients', error)
          setClients([])
          setIsAddingNewClient(true)
          setIsAddingNewProperty(true)
        }
      } finally {
        if (isMounted) {
          setIsLoadingClients(false)
        }
      }
    }

    loadClients()

    return () => {
      isMounted = false
    }
  }, [supabase])

  useEffect(() => {
    let isMounted = true

    const loadInspectors = async () => {
      try {
        const { data, error } = await supabase
          .from('inspectors')
          .select('id, user_id, name, email, phone, created_at, updated_at')
          .order('name', { ascending: true })

        if (!isMounted) return

        if (error) {
          console.error('Failed to load inspectors', error)
          setInspectors([])
          if (!selectedInspectorId) {
            setIsAddingNewInspector(true)
          }
        } else {
          const records = ((data ?? []) as unknown) as Inspector[]
          setInspectors(records)

          const trimmedDefaultName = defaultInspectorName.trim().toLowerCase()

          if (records.length === 0) {
            setIsAddingNewInspector(true)
          } else if (selectedInspectorId) {
            const match = records.find(entry => entry.id === selectedInspectorId)
            if (match) {
              setInspector(match.name ?? '')
              setInspectorEmail(match.email ?? '')
              setInspectorPhone(match.phone ?? '')
              setIsAddingNewInspector(false)
            } else if (trimmedDefaultName) {
              const fallback = records.find(entry => (entry.name ?? '').trim().toLowerCase() === trimmedDefaultName)
              if (fallback) {
                setSelectedInspectorId(fallback.id)
                setInspector(fallback.name ?? '')
                setInspectorEmail(fallback.email ?? '')
                setInspectorPhone(fallback.phone ?? '')
                setIsAddingNewInspector(false)
              } else {
                setIsAddingNewInspector(true)
              }
            }
          } else if (trimmedDefaultName) {
            const fallback = records.find(entry => (entry.name ?? '').trim().toLowerCase() === trimmedDefaultName)
            if (fallback) {
              setSelectedInspectorId(fallback.id)
              setInspector(fallback.name ?? '')
              setInspectorEmail(fallback.email ?? '')
              setInspectorPhone(fallback.phone ?? '')
              setIsAddingNewInspector(false)
            } else {
              setIsAddingNewInspector(true)
            }
          } else {
            setIsAddingNewInspector(true)
          }
        }
      } catch (error) {
        if (!isMounted) return
        console.error('Unexpected error loading inspectors', error)
        setInspectors([])
        if (!selectedInspectorId) {
          setIsAddingNewInspector(true)
        }
      } finally {
        if (isMounted) {
          setIsLoadingInspectors(false)
        }
      }
    }

    loadInspectors()

    return () => {
      isMounted = false
    }
  }, [supabase, defaultInspectorName, selectedInspectorId])

  const propertyLookup = useMemo(() => {
    const map = new Map<string, Pick<Property, 'id' | 'address' | 'name'>>()
    clients.forEach(client => {
      (client.properties ?? []).forEach(property => {
        map.set(property.id, property)
      })
    })
    return map
  }, [clients])

  const selectedClient = useMemo(() => {
    if (!selectedClientId) return null
    return clients.find(client => client.id === selectedClientId) ?? null
  }, [clients, selectedClientId])

  useEffect(() => {
    if (!selectedClient) return
    if (selectedPropertyId) {
      setIsAddingNewProperty(false)
      return
    }
    if (selectedClient.properties.length === 1) {
      const property = selectedClient.properties[0]
      setSelectedPropertyId(property.id)
      setAddress(property.address ?? '')
      setIsAddingNewProperty(false)
    }
  }, [selectedClient, selectedPropertyId])

  useEffect(() => {
    if (!selectedPropertyId) return
    const property = propertyLookup.get(selectedPropertyId)
    if (property) {
      setAddress(property.address ?? '')
      setIsAddingNewProperty(false)
    }
  }, [selectedPropertyId, propertyLookup])

  useEffect(() => {
    // Revoke object URLs when unmounting
    return () => {
      items.forEach((item: ChecklistItemForm) =>
        item.photos.forEach((photo: ChecklistPhotoDraft) => {
          if (photo.previewUrl && photo.previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(photo.previewUrl)
          }
        })
      )
    }
  }, [items])

  function updateItem(id: string, patch: Partial<ChecklistItemForm>) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
  }

  function handlePhotoChange(id: string, files: FileList | null) {
    if (!files) return

    const additions: ChecklistPhotoDraft[] = Array.from(files).map(file => ({
      id: generateLocalId(),
      previewUrl: URL.createObjectURL(file),
      file
    }))

    updateItem(id, {
      photos: [...(items.find(i => i.id === id)?.photos || []), ...additions]
    })
  }

  function handleClientSelection(value: string) {
    if (value === '__new__') {
      setSelectedClientId(null)
      setClientName('')
      setSelectedPropertyId(null)
      setAddress('')
      setPhone('')
      setEmail('')
      setIsAddingNewClient(true)
      setIsAddingNewProperty(true)
      return
    }

    setSelectedClientId(value)
    setIsAddingNewClient(false)

    const client = clients.find(entry => entry.id === value)
    if (!client) {
      return
    }

    setClientName(client.name ?? '')
    setPhone(client.phone ?? '')
    setEmail(client.email ?? '')

    const properties = client.properties ?? []
    if (selectedPropertyId && properties.some(property => property.id === selectedPropertyId)) {
      const property = properties.find(property => property.id === selectedPropertyId)
      if (property) {
        setAddress(property.address ?? '')
        setIsAddingNewProperty(false)
      }
      return
    }

    if (properties.length === 1) {
      const property = properties[0]
      setSelectedPropertyId(property.id)
      setAddress(property.address ?? '')
      setIsAddingNewProperty(false)
    } else {
      setIsAddingNewProperty(properties.length === 0)
      setSelectedPropertyId(null)
      setAddress('')
    }
  }

  function handlePropertySelection(value: string) {
    if (value === '__new__') {
      setSelectedPropertyId(null)
      setAddress('')
      setIsAddingNewProperty(true)
      return
    }

    setSelectedPropertyId(value)
    setIsAddingNewProperty(false)
    const property = propertyLookup.get(value)
    if (property) {
      setAddress(property.address ?? '')
    }
  }

  function handleInspectorSelection(value: string) {
    if (value === '__new__') {
      setSelectedInspectorId(null)
      setIsAddingNewInspector(true)
      setInspector('')
      setInspectorEmail('')
      setInspectorPhone('')
      return
    }

    if (!value) {
      setSelectedInspectorId(null)
      setIsAddingNewInspector(true)
      setInspector('')
      setInspectorEmail('')
      setInspectorPhone('')
      return
    }

    setSelectedInspectorId(value)
    setIsAddingNewInspector(false)
    const record = inspectors.find(entry => entry.id === value)
    if (record) {
      setInspector(record.name ?? '')
      setInspectorEmail(record.email ?? '')
      setInspectorPhone(record.phone ?? '')
    }
  }

  const [photosMarkedForDeletion, setPhotosMarkedForDeletion] = useState<Array<{ id: string; storagePath?: string | null }>>([])

  function removePhoto(itemId: string, photo: ChecklistPhotoDraft) {
    setItems(prev =>
      prev.map(it =>
        it.id === itemId
          ? {
              ...it,
              photos: it.photos.filter(current => current.id !== photo.id)
            }
          : it
      )
    )

    if (photo.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(photo.previewUrl)
    }

    if (photo.persistedId) {
      const persistedId = photo.persistedId
      setPhotosMarkedForDeletion(prev => {
        if (prev.some(entry => entry.id === persistedId)) {
          return prev
        }
        return [...prev, { id: persistedId, storagePath: photo.storagePath ?? null }]
      })
    }
  }

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSubmit() {
    const trimmedName = clientName.trim()
    const trimmedAddress = address.trim()
    const trimmedInspector = inspector.trim()
  const trimmedInspectorEmail = inspectorEmail.trim()
  const trimmedInspectorPhone = inspectorPhone.trim()
    const trimmedPhone = phone.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName || !trimmedAddress || !dateOfArrival || !trimmedInspector) {
      setSubmitError('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    const isEditing = Boolean(editingChecklistId)

    console.debug('Saving checklist', {
      mode: isEditing ? 'edit' : 'create',
      clientName,
      address,
      dateOfArrival,
      inspector,
      itemCount: items.length,
      checklistId: editingChecklistId
    })

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      const userId = sessionData.session?.user.id
      if (!userId) {
        throw new Error('You must be signed in to submit a checklist.')
      }

      if (!trimmedName) {
        throw new Error('Client name is required for this checklist.')
      }
      if (!trimmedAddress) {
        throw new Error('Please provide an address for this checklist.')
      }

      let effectiveInspectorId: string | null = selectedInspectorId
      if (trimmedInspector) {
        const normalizedName = trimmedInspector.toLowerCase()

        if (!effectiveInspectorId) {
          const existingInspector = inspectors.find(entry => (entry.name ?? '').trim().toLowerCase() === normalizedName)
          if (existingInspector) {
            effectiveInspectorId = existingInspector.id
            setSelectedInspectorId(existingInspector.id)
            setIsAddingNewInspector(false)
            setInspector(existingInspector.name ?? trimmedInspector)
            setInspectorEmail(existingInspector.email ?? '')
            setInspectorPhone(existingInspector.phone ?? '')
          }
        }

        if (effectiveInspectorId) {
          const currentRecord = inspectors.find(entry => entry.id === effectiveInspectorId)
          const currentName = (currentRecord?.name ?? '').trim()
          const currentEmail = (currentRecord?.email ?? '').trim()
          const currentPhone = (currentRecord?.phone ?? '').trim()
          const nextEmail = trimmedInspectorEmail
          const nextPhone = trimmedInspectorPhone

          const needsUpdate =
            currentName !== trimmedInspector ||
            currentEmail !== nextEmail ||
            currentPhone !== nextPhone

          if (needsUpdate) {
            const inspectorUpdatePayload: InspectorUpdate = {
              name: trimmedInspector,
              email: nextEmail ? nextEmail : null,
              phone: nextPhone ? nextPhone : null,
              updated_at: new Date().toISOString()
            }

            const { data: updatedInspector, error: inspectorUpdateError } = await supabase
              .from('inspectors')
              .update(inspectorUpdatePayload)
              .eq('id', effectiveInspectorId)
              .eq('user_id', userId)
              .select()
              .single<Inspector>()

            if (inspectorUpdateError) throw inspectorUpdateError

            if (updatedInspector) {
              setInspectors(prev => {
                const next = prev.map(entry => entry.id === updatedInspector.id ? updatedInspector : entry)
                return next.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
              })
              setInspector(updatedInspector.name ?? trimmedInspector)
              setInspectorEmail(updatedInspector.email ?? '')
              setInspectorPhone(updatedInspector.phone ?? '')
            }
          }
        } else {
          const inspectorPayload: InspectorInsert = {
            user_id: userId,
            name: trimmedInspector,
            email: trimmedInspectorEmail || null,
            phone: trimmedInspectorPhone || null
          }

          const { data: insertedInspector, error: inspectorInsertError } = await supabase
            .from('inspectors')
            .insert([inspectorPayload])
            .select()
            .single<Inspector>()

          if (inspectorInsertError) {
            if (typeof inspectorInsertError.message === 'string' && inspectorInsertError.message.toLowerCase().includes('inspectors')) {
              throw new Error('Unable to save inspector. Ensure the `inspectors` table exists and the migration SQL has been executed.')
            }
            throw inspectorInsertError
          }

          if (insertedInspector) {
            effectiveInspectorId = insertedInspector.id
            setInspectors(prev => [...prev, insertedInspector].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')))
            setSelectedInspectorId(insertedInspector.id)
            setIsAddingNewInspector(false)
            setInspector(insertedInspector.name ?? trimmedInspector)
            setInspectorEmail(insertedInspector.email ?? trimmedInspectorEmail)
            setInspectorPhone(insertedInspector.phone ?? trimmedInspectorPhone)
          }
        }
      }

      let effectiveClientId = selectedClientId
      let resolvedClient: Client | null = null

      if (effectiveClientId) {
        const clientPayload: ClientUpdate = {
          name: trimmedName,
          phone: trimmedPhone || null,
          email: trimmedEmail || null,
          updated_at: new Date().toISOString()
        }

        const { data: updatedClient, error: clientUpdateError } = await supabase
          .from('clients')
          .update(clientPayload)
          .eq('id', effectiveClientId)
          .eq('user_id', userId)
          .select()
          .maybeSingle<Client>()

        if (clientUpdateError) throw clientUpdateError

        if (updatedClient) {
          resolvedClient = updatedClient
          console.debug('Updated client record', { id: updatedClient.id })
        } else {
          const { data: existingClient, error: clientLookupError } = await supabase
            .from('clients')
            .select('*')
            .eq('id', effectiveClientId)
            .eq('user_id', userId)
            .maybeSingle<Client>()

          if (clientLookupError) throw clientLookupError
          if (!existingClient) {
            throw new Error('Selected client could not be found. Please refresh and try again.')
          }

          resolvedClient = existingClient
        }
      } else {
        const clientPayload: ClientInsert = {
          user_id: userId,
          name: trimmedName,
          phone: trimmedPhone || null,
          email: trimmedEmail || null
        }

        const { data: insertedClient, error: clientInsertError } = await supabase
          .from('clients')
          .insert([clientPayload])
          .select()
          .single<Client>()

        if (clientInsertError) throw clientInsertError

        resolvedClient = insertedClient
        effectiveClientId = insertedClient.id
        setSelectedClientId(insertedClient.id)
        console.debug('Created new client record', { id: insertedClient.id })
      }

      if (!resolvedClient) {
        throw new Error('Failed to resolve the client record.')
      }

    setClientName(resolvedClient.name)
    setSelectedClientId(resolvedClient.id)
  setPhone(resolvedClient.phone ?? '')
  setEmail(resolvedClient.email ?? '')
    setIsAddingNewClient(false)

      let effectivePropertyId = selectedPropertyId
      let resolvedProperty: Property | null = null

      if (effectivePropertyId) {
        const propertyPayload: PropertyUpdate = {
          client_id: resolvedClient.id,
          name: trimmedAddress || trimmedName,
          address: trimmedAddress || null,
          updated_at: new Date().toISOString()
        }

        const { data: updatedProperty, error: propertyUpdateError } = await supabase
          .from('properties')
          .update(propertyPayload)
          .eq('id', effectivePropertyId)
          .eq('user_id', userId)
          .select()
          .maybeSingle<Property>()

        if (propertyUpdateError) throw propertyUpdateError

        if (updatedProperty) {
          resolvedProperty = updatedProperty
          console.debug('Updated property record', { id: updatedProperty.id })
        } else {
          const { data: existingProperty, error: propertyLookupError } = await supabase
            .from('properties')
            .select('*')
            .eq('id', effectivePropertyId)
            .eq('user_id', userId)
            .maybeSingle<Property>()

          if (propertyLookupError) throw propertyLookupError
          if (!existingProperty) {
            throw new Error('Selected property could not be found. Please refresh and try again.')
          }

          resolvedProperty = existingProperty
        }
      }

      if (!resolvedProperty) {
        const { data: existingProperty, error: propertyLookupError } = await supabase
          .from('properties')
          .select('*')
          .eq('user_id', userId)
          .eq('client_id', resolvedClient.id)
          .eq('address', trimmedAddress)
          .maybeSingle<Property>()

        if (propertyLookupError) throw propertyLookupError

        if (existingProperty) {
          resolvedProperty = existingProperty
          effectivePropertyId = existingProperty.id
          console.debug('Reusing property record', { id: existingProperty.id })
        }
      }

      if (!resolvedProperty) {
        const propertyPayload: PropertyInsert = {
          user_id: userId,
          client_id: resolvedClient.id,
          name: trimmedAddress || trimmedName,
          address: trimmedAddress || null
        }

        const { data: insertedProperty, error: propertyInsertError } = await supabase
          .from('properties')
          .insert([propertyPayload])
          .select()
          .single<Property>()

        if (propertyInsertError) throw propertyInsertError
        if (!insertedProperty) throw new Error('Failed to create property record')

        resolvedProperty = insertedProperty
        effectivePropertyId = insertedProperty.id
        console.debug('Created new property record', { id: insertedProperty.id })
      }

    setSelectedPropertyId(resolvedProperty?.id ?? null)
    setAddress(resolvedProperty?.address ?? trimmedAddress)
    setIsAddingNewProperty(false)

      // 2. Create or update the checklist entry
      const itemSummary = items
        .map(item => `${item.label}: ${item.status.toUpperCase()}${item.notes ? ` - ${item.notes}` : ''}`)
        .join('\n')

      const resolvedPropertyId = resolvedProperty?.id ?? effectivePropertyId ?? null

      const notesPayload = JSON.stringify({
        clientId: resolvedClient.id,
        propertyId: resolvedPropertyId,
        clientName: trimmedName,
        address: trimmedAddress,
        inspector: trimmedInspector,
        inspectorId: effectiveInspectorId ?? null,
          inspectorEmail: trimmedInspectorEmail || null,
          inspectorPhone: trimmedInspectorPhone || null,
        phone: trimmedPhone || null,
        email: trimmedEmail || null,
        garageTemp: garageTemp.trim() || null,
        mainFloorTemp: mainFloorTemp.trim() || null,
        secondFloorTemp: secondFloorTemp.trim() || null,
        thirdFloorTemp: thirdFloorTemp.trim() || null,
        temperatures: {
          garage: garageTemp.trim() || null,
          mainFloor: mainFloorTemp.trim() || null,
          secondFloor: secondFloorTemp.trim() || null,
          thirdFloor: thirdFloorTemp.trim() || null
        },
        comments: comments?.trim() || null,
        itemSummary
      })

      let currentChecklist: Checklist

      if (isEditing && editingChecklistId) {
        const checklistUpdate: ChecklistUpdate = {
          property_id: resolvedPropertyId,
          visit_date: dateOfArrival || null,
          notes: notesPayload,
          updated_at: new Date().toISOString()
        }

        const { data: updatedChecklist, error: checklistUpdateError } = await supabase
          .from('checklists')
          .update(checklistUpdate)
          .eq('id', editingChecklistId)
          .eq('user_id', userId)
          .select()
          .single<Checklist>()

        if (checklistUpdateError) throw checklistUpdateError
        currentChecklist = updatedChecklist
        setEditingChecklistId(updatedChecklist.id)
        console.debug('Updated checklist', { id: updatedChecklist.id })
      } else {
        const checklistInsert: ChecklistInsert = {
          property_id: resolvedPropertyId,
          user_id: userId,
          visit_date: dateOfArrival || null,
          notes: notesPayload
        }

        const { data: createdChecklist, error: checklistError } = await supabase
          .from('checklists')
          .insert([checklistInsert])
          .select()
          .single<Checklist>()

        if (checklistError) throw checklistError
        if (!createdChecklist) throw new Error('Failed to create checklist')

        currentChecklist = createdChecklist
        console.debug('Created checklist', { id: createdChecklist.id })
      }

      // 3. Persist individual checklist items
  const itemIdMap = new Map<string, string>()
  const checklistItemsPayload: ChecklistItemInsert[] = items.map((item: ChecklistItemForm) => {
        const resolvedId = item.persistedId ?? generateLocalId()
        itemIdMap.set(item.id, resolvedId)
        return {
          id: resolvedId,
          checklist_id: currentChecklist.id,
          category: item.category,
          item_text: item.label,
          status: item.status,
          notes: item.notes?.trim() || null
        }
      })

      if (isEditing && editingChecklistId) {
        if (checklistItemsPayload.length > 0) {
          const { error: checklistItemsError } = await supabase
            .from('checklist_items')
            .upsert(checklistItemsPayload, { onConflict: 'id' })

          if (checklistItemsError) {
            throw checklistItemsError
          }
        }

      } else {
        if (checklistItemsPayload.length > 0) {
          const { error: checklistItemsError } = await supabase
            .from('checklist_items')
            .insert(checklistItemsPayload)

          if (checklistItemsError) {
            // best effort cleanup to avoid leaving an empty checklist behind
            await supabase.from('checklists').delete().eq('id', currentChecklist.id)
            throw checklistItemsError
          }

          console.debug('Persisted checklist items', { count: checklistItemsPayload.length })
        }
      }

      const bucketName = process.env.NEXT_PUBLIC_SUPABASE_CHECKLIST_BUCKET ?? 'checklist-photos'

      // Handle photo deletions for edited checklists
      if (isEditing && photosMarkedForDeletion.length > 0) {
        const idsToDelete = photosMarkedForDeletion.map(photo => photo.id)

        const { error: deletePhotosError } = await supabase
          .from('checklist_photos')
          .delete()
          .in('id', idsToDelete)

        if (deletePhotosError) {
          throw deletePhotosError
        }

        const removalsByBucket = new Map<string, string[]>()
        photosMarkedForDeletion.forEach(photo => {
          if (!photo.storagePath) return
          if (photo.storagePath.includes('://')) return
          const [bucket, ...objectParts] = photo.storagePath.split('/')
          if (!bucket || objectParts.length === 0) return
          const objectPath = objectParts.join('/')
          const existing = removalsByBucket.get(bucket)
          if (existing) {
            existing.push(objectPath)
          } else {
            removalsByBucket.set(bucket, [objectPath])
          }
        })

        for (const [bucket, objectPaths] of removalsByBucket) {
          const { error: storageRemoveError } = await supabase.storage.from(bucket).remove(objectPaths)
          if (storageRemoveError) {
            console.warn('Failed to remove checklist photos from storage', { bucket, error: storageRemoveError })
          }
        }
      }

      // Upload new photos and create checklist_photo rows
      const photoUploads: Array<{ checklistItemId: string; objectPath: string; file: File }> = []

      items.forEach((item: ChecklistItemForm) => {
        const persistedId = itemIdMap.get(item.id) ?? item.persistedId
        if (!persistedId) return

        item.photos.forEach((photo: ChecklistPhotoDraft) => {
          if (photo.file) {
            const extension = photo.file.name.split('.').pop()?.toLowerCase() || 'jpg'
            const objectPath = `${currentChecklist.id}/${persistedId}/${photo.id}.${extension}`
            photoUploads.push({ checklistItemId: persistedId, objectPath, file: photo.file })
          }
        })
      })

      const insertedPhotoRecords: Array<{ checklist_item_id: string; storage_path: string }> = []

      for (const upload of photoUploads) {
        const { error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(upload.objectPath, upload.file, { cacheControl: '3600', upsert: false })

        if (uploadError) {
          throw uploadError
        }

        insertedPhotoRecords.push({
          checklist_item_id: upload.checklistItemId,
          storage_path: `${bucketName}/${upload.objectPath}`
        })
      }

      if (insertedPhotoRecords.length > 0) {
        const { error: photoInsertError } = await supabase
          .from('checklist_photos')
          .insert(insertedPhotoRecords)

        if (photoInsertError) {
          // Try to clean up uploaded files since DB rows failed
          const objectPaths = insertedPhotoRecords.map(record => record.storage_path.split('/').slice(1).join('/'))
          await supabase.storage.from(bucketName).remove(objectPaths)
          throw photoInsertError
        }
      }

      setPhotosMarkedForDeletion([])

      setEditingChecklistId(currentChecklist.id)

      router.push(`/checklists/${currentChecklist.id}`)
      return
    } catch (error) {
      console.error('Submission error:', error)

      const extractedMessage = (() => {
        if (error instanceof Error) return error.message
        if (error && typeof error === 'object' && 'message' in error && error.message) {
          return String(error.message)
        }
        return 'Failed to submit checklist'
      })()

      setSubmitError(extractedMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
          <h1 className="text-2xl md:text-3xl font-bold">Basic Home Watch Checklist</h1>
          <p className="text-sm text-gray-600 mt-1">PROPERTY INSPECTIONS &amp; SERVICES — Phone: {COMPANY_PHONE} — Email: {COMPANY_PRIMARY_EMAIL}</p>
        </header>

        <section className="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Client</label>
            <div className="mt-1 space-y-2">
              <select
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                value={selectedClientId ?? ''}
                onChange={e => handleClientSelection(e.target.value)}
                disabled={isLoadingClients && clients.length === 0}
              >
                <option value="">
                  {isLoadingClients ? 'Loading clients...' : clients.length > 0 ? 'Select a client' : 'Select a client (or add new)'}
                </option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
                <option value="__new__">+ Add new client</option>
              </select>
              {isAddingNewClient && (
                <input
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  placeholder="Client name"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                />
              )}
            </div>
            {selectedClient && selectedClient.properties.length > 1 && (
              <p className="mt-2 text-xs text-gray-500">This client has multiple properties. Choose one below to autofill the address.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Property Address</label>
            <div className="mt-1 space-y-2">
              <select
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                value={selectedPropertyId ?? ''}
                onChange={e => handlePropertySelection(e.target.value)}
                disabled={isLoadingClients}
              >
                <option value="">
                  {!selectedClientId
                    ? 'Select a client first'
                    : selectedClient && selectedClient.properties.length > 0
                      ? 'Select an address'
                      : 'No saved addresses yet'}
                </option>
                {(selectedClient?.properties ?? []).map(property => (
                  <option key={property.id} value={property.id}>
                    {property.address || property.name || 'Unnamed address'}
                  </option>
                ))}
                {selectedClientId && <option value="__new__">+ Add new address</option>}
              </select>
              {isAddingNewProperty && (
                <input
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  placeholder="Street address"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Date of Arrival</label>
            <input type="date" className="mt-1 w-full border border-gray-300 rounded-lg p-2 text-sm" value={dateOfArrival} onChange={e => setDateOfArrival(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Inspector</label>
            <div className="mt-1 space-y-2">
              <select
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                value={isAddingNewInspector ? '__new__' : (selectedInspectorId ?? '')}
                onChange={e => handleInspectorSelection(e.target.value)}
                disabled={isLoadingInspectors && inspectors.length === 0}
              >
                <option value="">
                  {isLoadingInspectors
                    ? 'Loading inspectors...'
                    : inspectors.length > 0
                      ? 'Select an inspector'
                      : 'Select an inspector (or add new)'}
                </option>
                {inspectors.map(entry => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
                <option value="__new__">+ Add new inspector</option>
              </select>
              {(isAddingNewInspector || inspectors.length === 0) && (
                <input
                  className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  placeholder="Inspector name"
                  value={inspector}
                  onChange={e => setInspector(e.target.value)}
                />
              )}
              <input
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                type="email"
                placeholder="Inspector email"
                value={inspectorEmail}
                onChange={e => setInspectorEmail(e.target.value)}
              />
              <input
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                placeholder="Inspector phone"
                value={inspectorPhone}
                onChange={e => setInspectorPhone(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Client phone</label>
            <input className="mt-1 w-full border border-gray-300 rounded-lg p-2 text-sm" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Client phone" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Client email</label>
            <input type="email" className="mt-1 w-full border border-gray-300 rounded-lg p-2 text-sm" value={email} onChange={e => setEmail(e.target.value)} placeholder="client@example.com" />
          </div>
        </section>

        <section className="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm">
          <h3 className="font-semibold mb-2 text-lg">Interior Temperature Levels</h3>
          <p className="text-sm text-gray-600 mb-4">Record temperature readings for each zone to mirror the checklist rows.</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Garage / Storage</label>
              <input className="mt-1 w-full border border-gray-300 rounded-lg p-2 text-sm" value={garageTemp} onChange={e => setGarageTemp(e.target.value)} placeholder="e.g. 78°F" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Main Floor</label>
              <input className="mt-1 w-full border border-gray-300 rounded-lg p-2 text-sm" value={mainFloorTemp} onChange={e => setMainFloorTemp(e.target.value)} placeholder="e.g. 76°F" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">2nd Floor / 2nd Zone</label>
              <input className="mt-1 w-full border border-gray-300 rounded-lg p-2 text-sm" value={secondFloorTemp} onChange={e => setSecondFloorTemp(e.target.value)} placeholder="e.g. 74°F" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">3rd Floor</label>
              <input className="mt-1 w-full border border-gray-300 rounded-lg p-2 text-sm" value={thirdFloorTemp} onChange={e => setThirdFloorTemp(e.target.value)} placeholder="e.g. 72°F" />
            </div>
          </div>
        </section>

        <section className="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm">
          <h2 className="font-semibold mb-2 text-lg">Exterior / Interior Checklist</h2>
          <p className="text-sm text-gray-600 mb-4">Visual review and ensure mechanicals are in working order. For each item, choose Done, NA or Issue and add notes or photos if needed.</p>

          <div className="space-y-4">
            {items.map((item: ChecklistItemForm) => (
              <div key={item.id} className="border border-gray-100 rounded-lg p-3 bg-white">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm md:text-base font-medium text-gray-800">{item.label}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, { status: 'done' })}
                        className={`px-3 py-1 text-sm rounded-lg border ${item.status === 'done' ? 'bg-green-50 border-green-300 text-green-800' : 'bg-white border-gray-200 text-gray-700'}`}>
                        Done
                      </button>
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, { status: 'na' })}
                        className={`px-3 py-1 text-sm rounded-lg border ${item.status === 'na' ? 'bg-yellow-50 border-yellow-300 text-yellow-800' : 'bg-white border-gray-200 text-gray-700'}`}>
                        NA
                      </button>
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, { status: 'issue' })}
                        className={`px-3 py-1 text-sm rounded-lg border ${item.status === 'issue' ? 'bg-red-50 border-red-300 text-red-800' : 'bg-white border-gray-200 text-gray-700'}`}>
                        Issue
                      </button>
                      <button
                        type="button"
                        onClick={() => updateItem(item.id, { status: 'unchecked' })}
                        className={`px-3 py-1 text-sm rounded-lg border ${item.status === 'unchecked' ? 'bg-gray-50 border-gray-300 text-gray-700' : 'bg-white border-gray-200 text-gray-700'}`}>
                        Unchecked
                      </button>
                    </div>

                    <textarea placeholder="Notes for this item" value={item.notes || ''} onChange={e => updateItem(item.id, { notes: e.target.value })} className="mt-3 w-full border border-gray-200 rounded-lg p-2 text-sm resize-y" />
                  </div>

                  <div className="w-full md:w-52 flex-shrink-0">
                    <label className="block text-sm font-medium text-gray-700">Photos</label>
                    <div className="mt-2 flex items-center gap-2">
                      <label className="inline-flex items-center px-3 py-1 rounded-md bg-white border border-gray-200 text-sm cursor-pointer">
                        Take Photo
                        <input hidden type="file" accept="image/*" capture="environment" onChange={e => handlePhotoChange(item.id, e.target.files)} />
                      </label>
                      <label className="inline-flex items-center px-3 py-1 rounded-md bg-white border border-gray-200 text-sm cursor-pointer">
                        Choose from Library
                        <input hidden type="file" accept="image/*" multiple onChange={e => handlePhotoChange(item.id, e.target.files)} />
                      </label>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(item.photos || []).map((photo: ChecklistPhotoDraft) => (
                        <div key={photo.id} className="relative">
                          <Image
                            src={photo.previewUrl}
                            alt="Checklist item preview"
                            width={160}
                            height={160}
                            unoptimized
                            className="w-full h-20 md:h-24 object-cover rounded-md border"
                          />
                          <button onClick={() => removePhoto(item.id, photo)} className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-6 h-6 text-xs">x</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm space-y-3">
          <div>
            <h3 className="font-semibold text-lg">Comments and Photos</h3>
            <p className="text-xs text-gray-500">PROPERTY INSPECTIONS &amp; SERVICES — Phone: {COMPANY_PHONE} — Email: {COMPANY_SECONDARY_EMAIL}</p>
          </div>
          <textarea placeholder="Add any additional observations, follow-up tasks, or photo references" value={comments} onChange={e => setComments(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 h-32 text-sm resize-y" />
        </section>

        <div className="space-y-4">
          {submitError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {submitError}
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 font-semibold text-white bg-primary-700 rounded-md text-sm hover:bg-primary-800 disabled:bg-primary-400"
            >
              {isSubmitting ? 'Saving...' : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
