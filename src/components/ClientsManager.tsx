"use client"

import { useMemo, useState } from 'react'
import Modal from '@/components/Modal'
import {
  getSupabaseClient,
  type Client,
  type Property
} from '@/lib/supabaseClient'

function formatDisplayDate(value: string) {
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
      return value
    }
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date)
  } catch (error) {
    console.warn('Failed to format date', { value, error })
    return value
  }
}

type PropertySummary = Pick<Property, 'id' | 'name' | 'address' | 'created_at' | 'updated_at'>

type ClientWithRelations = Client & {
  properties: PropertySummary[]
}

type ClientsManagerProps = {
  initialClients: ClientWithRelations[]
  fetchError?: string | null
}

type Notification = {
  type: 'success' | 'error'
  message: string
}

type AddressDraftState = Record<string, string>
type AddressSubmittingState = Record<string, boolean>
type AddressErrorState = Record<string, string | null>

type ClientFormState = {
  name: string
  phone: string
  email: string
  addresses: string[]
}

const emptyFormState: ClientFormState = {
  name: '',
  phone: '',
  email: '',
  addresses: ['']
}

export default function ClientsManager({ initialClients, fetchError }: ClientsManagerProps) {
  const [clients, setClients] = useState<ClientWithRelations[]>(() => initialClients)
  const [isAddClientModalOpen, setIsAddClientModalOpen] = useState(false)
  const [formState, setFormState] = useState<ClientFormState>(emptyFormState)
  const [isSubmittingClient, setIsSubmittingClient] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [notification, setNotification] = useState<Notification | null>(null)
  const [addressDrafts, setAddressDrafts] = useState<AddressDraftState>({})
  const [addressSubmitting, setAddressSubmitting] = useState<AddressSubmittingState>({})
  const [addressErrors, setAddressErrors] = useState<AddressErrorState>({})
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [clientDeleting, setClientDeleting] = useState<Record<string, boolean>>({})
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const supabase = useMemo(() => getSupabaseClient(), [])

  const hasClients = clients.length > 0

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) => a.name.localeCompare(b.name))
  }, [clients])

  const selectedClient = selectedClientId
    ? clients.find(client => client.id === selectedClientId) ?? null
    : null

  function handleOpenModal() {
    setIsAddClientModalOpen(true)
    setFormError(null)
  }

  function handleCloseModal() {
    setIsAddClientModalOpen(false)
    setFormState(emptyFormState)
    setFormError(null)
  }

  function updateFormField<K extends keyof ClientFormState>(key: K, value: ClientFormState[K]) {
    setFormState(prev => ({ ...prev, [key]: value }))
  }

  function updateAddressField(index: number, value: string) {
    setFormState(prev => {
      const nextAddresses = [...prev.addresses]
      nextAddresses[index] = value
      return { ...prev, addresses: nextAddresses }
    })
  }

  function addAddressField() {
    setFormState(prev => ({ ...prev, addresses: [...prev.addresses, ''] }))
  }

  function removeAddressField(index: number) {
    setFormState(prev => {
      if (prev.addresses.length === 1) {
        return prev
      }
      const nextAddresses = prev.addresses.filter((_, i) => i !== index)
      return { ...prev, addresses: nextAddresses.length > 0 ? nextAddresses : [''] }
    })
  }

  async function handleSubmitClient() {
    setFormError(null)

    const trimmedName = formState.name.trim()
    const trimmedPhone = formState.phone.trim()
    const trimmedEmail = formState.email.trim()
    const trimmedAddresses = formState.addresses.map(address => address.trim()).filter(Boolean)

    if (!trimmedName) {
      setFormError('Client name is required.')
      return
    }

    setIsSubmittingClient(true)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      const userId = sessionData.session?.user.id
      if (!userId) {
        throw new Error('You must be signed in to add a client.')
      }

      const { data: insertedClient, error: clientInsertError } = await supabase
        .from('clients')
        .insert([
          {
            user_id: userId,
            name: trimmedName,
            phone: trimmedPhone || null,
            email: trimmedEmail || null
          }
        ])
  .select('id, user_id, name, phone, email, created_at, updated_at')
        .single<Client>()

      if (clientInsertError) throw clientInsertError
      if (!insertedClient) throw new Error('Failed to create client record.')

      let insertedProperties: PropertySummary[] = []

      if (trimmedAddresses.length > 0) {
        const { data: properties, error: propertyInsertError } = await supabase
          .from('properties')
          .insert(
            trimmedAddresses.map(address => ({
              user_id: userId,
              client_id: insertedClient.id,
              name: address,
              address
            }))
          )
          .select('id, name, address, created_at, updated_at')

        if (propertyInsertError) throw propertyInsertError

        insertedProperties = (properties ?? []) as PropertySummary[]
      }

      const nextClient: ClientWithRelations = {
        ...insertedClient,
        updated_at: insertedClient.created_at,
        properties: insertedProperties
      }

      setClients(prev => [...prev, nextClient])
      setNotification({ type: 'success', message: 'Client created successfully.' })
      handleCloseModal()
    } catch (error) {
      console.error('Failed to add client', error)
      const message = error instanceof Error ? error.message : 'Failed to save client.'
      setFormError(message)
    } finally {
      setIsSubmittingClient(false)
    }
  }

  function updateAddressDraft(clientId: string, value: string) {
    setAddressDrafts(prev => ({ ...prev, [clientId]: value }))
  }

  async function handleAddAddress(clientId: string) {
    setAddressErrors(prev => ({ ...prev, [clientId]: null }))

    const draftAddress = (addressDrafts[clientId] ?? '').trim()
    if (!draftAddress) {
      setAddressErrors(prev => ({ ...prev, [clientId]: 'Address is required.' }))
      return
    }

    setAddressSubmitting(prev => ({ ...prev, [clientId]: true }))

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      const userId = sessionData.session?.user.id
      if (!userId) {
        throw new Error('You must be signed in to add an address.')
      }

      const { data: insertedProperty, error: propertyInsertError } = await supabase
        .from('properties')
        .insert([
          {
            user_id: userId,
            client_id: clientId,
            name: draftAddress,
            address: draftAddress
          }
        ])
  .select('id, name, address, created_at, updated_at')
        .single<PropertySummary>()

      if (propertyInsertError) throw propertyInsertError
      if (!insertedProperty) throw new Error('Failed to create property record.')

      setClients(prev => prev.map(client => client.id === clientId
        ? { ...client, properties: [...client.properties, insertedProperty] }
        : client
      ))

      setAddressDrafts(prev => ({ ...prev, [clientId]: '' }))
      setNotification({ type: 'success', message: 'Address added successfully.' })
    } catch (error) {
      console.error('Failed to add address', error)
      const message = error instanceof Error ? error.message : 'Failed to add address.'
      setAddressErrors(prev => ({ ...prev, [clientId]: message }))
    } finally {
      setAddressSubmitting(prev => ({ ...prev, [clientId]: false }))
    }
  }

  function handleOpenViewModal(clientId: string) {
    setSelectedClientId(clientId)
    setIsViewModalOpen(true)
    setAddressErrors(prev => ({ ...prev, [clientId]: null }))
  }

  function handleCloseViewModal() {
    setIsViewModalOpen(false)
  }

  async function handleDeleteClient(clientId: string) {
    const confirmed = window.confirm('Delete this client? This action cannot be undone.')
    if (!confirmed) return

    setClientDeleting(prev => ({ ...prev, [clientId]: true }))

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      const userId = sessionData.session?.user.id
      if (!userId) {
        throw new Error('You must be signed in to delete a client.')
      }

      const { error: propertiesError } = await supabase
        .from('properties')
        .delete()
        .eq('client_id', clientId)

      if (propertiesError) throw propertiesError

      const { error: clientError } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId)

      if (clientError) throw clientError

      setClients(prev => prev.filter(client => client.id !== clientId))
      setSelectedClientId(prev => (prev === clientId ? null : prev))
      setIsViewModalOpen(false)
      setNotification({ type: 'success', message: 'Client deleted successfully.' })
    } catch (error) {
      console.error('Failed to delete client', error)
      const message = error instanceof Error ? error.message : 'Failed to delete client.'
      setNotification({ type: 'error', message })
    } finally {
      setClientDeleting(prev => ({ ...prev, [clientId]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-600">Manage your clients and their property addresses.</p>
        </div>
        <button
          type="button"
          onClick={handleOpenModal}
          className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        >
          + Add client
        </button>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {fetchError}
        </div>
      )}

      {notification && (
        <div
          className={`rounded-lg border p-4 text-sm ${notification.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}
        >
          {notification.message}
        </div>
      )}

      {hasClients ? (
        <div className="space-y-3">
          {sortedClients.map(client => (
            <div
              key={client.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 transition hover:border-primary-200"
            >
              <div>
                <p className="font-semibold text-gray-900">{client.name}</p>
                <p className="text-sm text-gray-500">{client.properties.length} {client.properties.length === 1 ? 'address' : 'addresses'}</p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenViewModal(client.id)}
                className="inline-flex items-center justify-center rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
              >
                View
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-gray-900">No clients yet</h2>
          <p className="mt-2 text-sm text-gray-600">Add your first client to start tracking their addresses.</p>
          <button
            type="button"
            onClick={handleOpenModal}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            Add your first client
          </button>
        </div>
      )}

      <Modal
        isOpen={isAddClientModalOpen}
        onClose={handleCloseModal}
        title="Add new client"
      >
        <div className="space-y-5">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {formError}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Client name *</span>
              <input
                className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                value={formState.name}
                onChange={event => updateFormField('name', event.target.value)}
                placeholder="Jane Smith"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Phone</span>
              <input
                className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                value={formState.phone}
                onChange={event => updateFormField('phone', event.target.value)}
                placeholder="239-555-0123"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Email</span>
              <input
                className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                type="email"
                value={formState.email}
                onChange={event => updateFormField('email', event.target.value)}
                placeholder="client@example.com"
              />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Addresses</span>
              <button
                type="button"
                onClick={addAddressField}
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                + Add another address
              </button>
            </div>
            <div className="space-y-2">
              {formState.addresses.map((address, index) => (
                <div key={`address-${index}`} className="flex items-center gap-2">
                  <input
                    className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                    value={address}
                    onChange={event => updateAddressField(index, event.target.value)}
                    placeholder="123 Main St"
                  />
                  {formState.addresses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeAddressField(index)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">Leave blank if you want to add addresses later.</p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmitClient}
              disabled={isSubmittingClient}
              className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmittingClient ? 'Saving...' : 'Save client'}
            </button>
          </div>
        </div>
      </Modal>

      {selectedClient && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={handleCloseViewModal}
          title={selectedClient.name}
        >
          <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <dl className="space-y-2 text-sm text-gray-600">
                <div>
                  <dt className="font-medium text-gray-700">Client ID</dt>
                  <dd className="font-mono text-xs text-gray-500">{selectedClient.id}</dd>
                </div>
                {selectedClient.phone && (
                  <div>
                    <dt className="font-medium text-gray-700">Phone</dt>
                    <dd>{selectedClient.phone}</dd>
                  </div>
                )}
                {selectedClient.email && (
                  <div>
                    <dt className="font-medium text-gray-700">Email</dt>
                    <dd>{selectedClient.email}</dd>
                  </div>
                )}
                <div>
                  <dt className="font-medium text-gray-700">Created</dt>
                  <dd>{formatDisplayDate(selectedClient.created_at)}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => handleDeleteClient(selectedClient.id)}
                disabled={clientDeleting[selectedClient.id]}
                className="hidden items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex"
              >
                {clientDeleting[selectedClient.id] ? 'Deleting...' : 'Delete client'}
              </button>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Addresses</h3>
              {selectedClient.properties.length > 0 ? (
                <ul className="mt-3 grid gap-3 md:grid-cols-2">
                  {selectedClient.properties.map(property => (
                    <li key={property.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                      <p className="font-medium text-gray-900">{property.address || property.name}</p>
                      <p className="text-xs text-gray-500">Added {property.created_at ? formatDisplayDate(property.created_at) : 'recently'}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-gray-500">No addresses saved yet.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Add address</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  className="w-full sm:w-64 rounded-lg border border-gray-300 p-2 text-sm"
                  placeholder="123 Main St"
                  value={addressDrafts[selectedClient.id] ?? ''}
                  onChange={event => updateAddressDraft(selectedClient.id, event.target.value)}
                />
                <button
                  type="button"
                  onClick={() => handleAddAddress(selectedClient.id)}
                  disabled={addressSubmitting[selectedClient.id]}
                  className="inline-flex items-center justify-center rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {addressSubmitting[selectedClient.id] ? 'Saving...' : 'Save address'}
                </button>
              </div>
              {addressErrors[selectedClient.id] && (
                <p className="mt-1 text-sm text-red-600">{addressErrors[selectedClient.id]}</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleDeleteClient(selectedClient.id)}
              disabled={clientDeleting[selectedClient.id]}
              className="inline-flex w-full items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 md:hidden"
            >
              {clientDeleting[selectedClient.id] ? 'Deleting...' : 'Delete client'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
