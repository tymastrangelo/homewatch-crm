"use client"

import { useMemo, useState } from 'react'
import Modal from '@/components/Modal'
import { PlusIcon, UserCheckIcon, TrashIcon } from '@/components/icons'
import { getSupabaseClient, type Inspector } from '@/lib/supabaseClient'

type InspectorsManagerProps = {
  initialInspectors: Inspector[]
  fetchError?: string | null
}

type Notification = {
  type: 'success' | 'error'
  message: string
}

type InspectorFormState = {
  name: string
  email: string
  phone: string
}

const emptyFormState: InspectorFormState = {
  name: '',
  email: '',
  phone: ''
}

export default function InspectorsManager({ initialInspectors, fetchError }: InspectorsManagerProps) {
  const supabase = useMemo(() => getSupabaseClient(), [])
  const [inspectors, setInspectors] = useState<Inspector[]>(() => initialInspectors)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [formState, setFormState] = useState<InspectorFormState>(emptyFormState)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState<Notification | null>(null)
  const [deleteState, setDeleteState] = useState<Record<string, boolean>>({})

  const hasInspectors = inspectors.length > 0
  const sortedInspectors = useMemo(() => {
    return [...inspectors].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  }, [inspectors])

  function handleOpenModal() {
    setIsAddModalOpen(true)
    setFormError(null)
  }

  function handleCloseModal() {
    setIsAddModalOpen(false)
    setFormState(emptyFormState)
    setFormError(null)
  }

  function updateFormField<K extends keyof InspectorFormState>(key: K, value: InspectorFormState[K]) {
    setFormState(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmitInspector() {
    setFormError(null)

    const trimmedName = formState.name.trim()
    const trimmedEmail = formState.email.trim()
    const trimmedPhone = formState.phone.trim()

    if (!trimmedName) {
      setFormError('Inspector name is required.')
      return
    }

    setIsSubmitting(true)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      const userId = sessionData.session?.user.id
      if (!userId) {
        throw new Error('You must be signed in to add an inspector.')
      }

      const payload = {
        user_id: userId,
        name: trimmedName,
        email: trimmedEmail || null,
        phone: trimmedPhone || null
      }

      const { data: insertedInspector, error: insertError } = await supabase
        .from('inspectors')
        .insert([payload])
        .select('id, user_id, name, email, phone, created_at, updated_at')
        .single<Inspector>()

      if (insertError) throw insertError
      if (!insertedInspector) {
        throw new Error('Failed to create inspector record.')
      }

      setInspectors(prev => [...prev, insertedInspector])
      setNotification({ type: 'success', message: 'Inspector added successfully.' })
      handleCloseModal()
    } catch (error) {
      console.error('Failed to add inspector', error)
      const message = error instanceof Error ? error.message : 'Failed to save inspector.'
      setFormError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDeleteInspector(inspectorId: string) {
    const confirmed = window.confirm('Delete this inspector? This action cannot be undone.')
    if (!confirmed) return

    setDeleteState(prev => ({ ...prev, [inspectorId]: true }))

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError

      const userId = sessionData.session?.user.id
      if (!userId) {
        throw new Error('You must be signed in to delete an inspector.')
      }

      const { error: deleteError } = await supabase
        .from('inspectors')
        .delete()
        .eq('id', inspectorId)
        .eq('user_id', userId)

      if (deleteError) throw deleteError

      setInspectors(prev => prev.filter(inspector => inspector.id !== inspectorId))
      setNotification({ type: 'success', message: 'Inspector removed.' })
    } catch (error) {
      console.error('Failed to delete inspector', error)
      const message = error instanceof Error ? error.message : 'Failed to delete inspector.'
      setNotification({ type: 'error', message })
    } finally {
      setDeleteState(prev => ({ ...prev, [inspectorId]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">Inspectors</h1>
          <p className="mt-1 text-sm text-gray-600">The inspectors available when capturing a checklist.</p>
        </div>
        <button
          type="button"
          onClick={handleOpenModal}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-800 sm:w-auto"
        >
          <PlusIcon className="h-4 w-4" /> Add inspector
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

      {hasInspectors ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {sortedInspectors.map(inspector => (
            <div
              key={inspector.id}
              className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-primary-200"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold uppercase text-primary-700">
                {inspector.name?.trim().charAt(0) || '?'}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate font-semibold text-gray-900">{inspector.name}</p>
                {inspector.email && <p className="truncate text-sm text-gray-600">{inspector.email}</p>}
                {inspector.phone && <p className="truncate text-sm text-gray-600">{inspector.phone}</p>}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteInspector(inspector.id)}
                disabled={deleteState[inspector.id]}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <TrashIcon className="h-4 w-4" />
                {deleteState[inspector.id] ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
            <UserCheckIcon className="h-6 w-6" />
          </span>
          <h2 className="mt-3 text-lg font-semibold text-gray-900">No inspectors yet</h2>
          <p className="mt-1 text-sm text-gray-600">Add your inspectors so they can be selected on new checklists.</p>
          <button
            type="button"
            onClick={handleOpenModal}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-800"
          >
            <PlusIcon className="h-4 w-4" /> Add your first inspector
          </button>
        </div>
      )}

      <Modal isOpen={isAddModalOpen} onClose={handleCloseModal} title="Add inspector">
        <div className="space-y-5">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {formError}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-gray-700">Inspector name *</span>
              <input
                className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                value={formState.name}
                onChange={event => updateFormField('name', event.target.value)}
                placeholder="Inspector name"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Email</span>
              <input
                className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                type="email"
                value={formState.email}
                onChange={event => updateFormField('email', event.target.value)}
                placeholder="inspector@example.com"
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
              onClick={handleSubmitInspector}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : 'Save inspector'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
