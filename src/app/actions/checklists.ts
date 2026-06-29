'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabaseServerClient'
import { CHECKLIST_PHOTO_BUCKET } from '@/lib/constants'
import type { ChecklistItemStatus } from '@/lib/types'

export type SaveChecklistItem = {
  itemKey: string | null
  category: string
  label: string
  status: ChecklistItemStatus
  notes: string | null
  sortOrder: number
  /** Existing checklist_items.id when editing; null for a brand-new row. */
  persistedId: string | null
  /** Storage paths for photos uploaded during this session. */
  newPhotoPaths: string[]
}

export type SaveChecklistInput = {
  checklistId: string | null
  clientId: string | null
  clientName: string
  clientPhone: string | null
  clientEmail: string | null
  propertyId: string | null
  address: string
  inspectorId: string | null
  inspectorName: string
  inspectorEmail: string | null
  inspectorPhone: string | null
  visitDate: string | null
  comments: string | null
  temps: {
    garage: string | null
    mainFloor: string | null
    secondFloor: string | null
    thirdFloor: string | null
  }
  items: SaveChecklistItem[]
  /** checklist_photos.id values the user removed while editing. */
  deletedPhotoIds: string[]
  /** Their storage paths, so the underlying files can be cleaned up too. */
  deletedPhotoPaths: string[]
}

export type SaveChecklistResult = { ok: true; checklistId: string } | { ok: false; error: string }

const clean = (value: string | null | undefined) => {
  const trimmed = (value ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Single source of truth for persisting a checklist. Resolves (creates or
 * updates) the client, property and inspector, writes the checklist and its
 * items to real columns, and reconciles photos — all server-side under the
 * signed-in user's RLS context.
 */
export async function saveChecklist(input: SaveChecklistInput): Promise<SaveChecklistResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) return { ok: false, error: 'You must be signed in to save a checklist.' }
    const userId = user.id

    const clientName = clean(input.clientName)
    const address = clean(input.address)
    const inspectorName = clean(input.inspectorName)

    if (!clientName) return { ok: false, error: 'A client name is required.' }
    if (!address) return { ok: false, error: 'A property address is required.' }

    // ---- Inspector ---------------------------------------------------------
    let inspectorId = input.inspectorId
    if (inspectorName) {
      if (!inspectorId) {
        const { data: existing } = await supabase
          .from('inspectors')
          .select('id')
          .ilike('name', inspectorName)
          .limit(1)
          .maybeSingle()
        inspectorId = existing?.id ?? null
      }

      const inspectorPayload = {
        name: inspectorName,
        email: clean(input.inspectorEmail),
        phone: clean(input.inspectorPhone)
      }

      if (inspectorId) {
        const { error } = await supabase.from('inspectors').update(inspectorPayload).eq('id', inspectorId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('inspectors')
          .insert({ ...inspectorPayload, user_id: userId })
          .select('id')
          .single()
        if (error) throw error
        inspectorId = data.id
      }
    }

    // ---- Client ------------------------------------------------------------
    let clientId = input.clientId
    const clientPayload = {
      name: clientName,
      phone: clean(input.clientPhone),
      email: clean(input.clientEmail)
    }
    if (clientId) {
      const { error } = await supabase.from('clients').update(clientPayload).eq('id', clientId)
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('clients')
        .insert({ ...clientPayload, user_id: userId })
        .select('id')
        .single()
      if (error) throw error
      clientId = data.id
    }

    // ---- Property ----------------------------------------------------------
    let propertyId = input.propertyId
    const propertyPayload = { client_id: clientId, name: address, address }
    if (propertyId) {
      const { error } = await supabase.from('properties').update(propertyPayload).eq('id', propertyId)
      if (error) throw error
    } else {
      // Reuse an existing matching address for this client before creating one.
      const { data: existing } = await supabase
        .from('properties')
        .select('id')
        .eq('client_id', clientId)
        .ilike('address', address)
        .limit(1)
        .maybeSingle()

      if (existing) {
        propertyId = existing.id
        const { error } = await supabase.from('properties').update(propertyPayload).eq('id', propertyId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('properties')
          .insert({ ...propertyPayload, user_id: userId })
          .select('id')
          .single()
        if (error) throw error
        propertyId = data.id
      }
    }

    // ---- Checklist ---------------------------------------------------------
    const checklistPayload = {
      property_id: propertyId,
      inspector_id: inspectorId,
      visit_date: input.visitDate || null,
      comments: clean(input.comments),
      temp_garage: clean(input.temps.garage),
      temp_main_floor: clean(input.temps.mainFloor),
      temp_second_floor: clean(input.temps.secondFloor),
      temp_third_floor: clean(input.temps.thirdFloor)
    }

    let checklistId = input.checklistId
    if (checklistId) {
      const { error } = await supabase.from('checklists').update(checklistPayload).eq('id', checklistId)
      if (error) throw error
    } else {
      const { data, error } = await supabase
        .from('checklists')
        .insert({ ...checklistPayload, user_id: userId })
        .select('id')
        .single()
      if (error) throw error
      checklistId = data.id
    }

    // ---- Items -------------------------------------------------------------
    const itemRows = input.items.map(item => ({
      id: item.persistedId ?? randomUUID(),
      checklist_id: checklistId!,
      item_key: item.itemKey,
      sort_order: item.sortOrder,
      category: item.category,
      item_text: item.label,
      status: item.status,
      notes: clean(item.notes)
    }))

    const { error: itemsError } = await supabase.from('checklist_items').upsert(itemRows, { onConflict: 'id' })
    if (itemsError) throw itemsError

    // Remove any stale items that are no longer part of this checklist.
    const keepIds = itemRows.map(row => row.id)
    if (keepIds.length > 0) {
      const { error: pruneError } = await supabase
        .from('checklist_items')
        .delete()
        .eq('checklist_id', checklistId)
        .not('id', 'in', `(${keepIds.join(',')})`)
      if (pruneError) throw pruneError
    }

    // ---- Photos: deletions -------------------------------------------------
    if (input.deletedPhotoIds.length > 0) {
      const { error } = await supabase.from('checklist_photos').delete().in('id', input.deletedPhotoIds)
      if (error) throw error
    }
    if (input.deletedPhotoPaths.length > 0) {
      const objectPaths = input.deletedPhotoPaths
        .map(p => (p.includes('/') ? p.split('/').slice(1).join('/') : null))
        .filter((p): p is string => Boolean(p))
      if (objectPaths.length > 0) {
        await supabase.storage.from(CHECKLIST_PHOTO_BUCKET).remove(objectPaths)
      }
    }

    // ---- Photos: new rows --------------------------------------------------
    const photoRows: { checklist_item_id: string; storage_path: string }[] = []
    itemRows.forEach((row, index) => {
      input.items[index].newPhotoPaths.forEach(storagePath => {
        photoRows.push({ checklist_item_id: row.id, storage_path: storagePath })
      })
    })
    if (photoRows.length > 0) {
      const { error } = await supabase.from('checklist_photos').insert(photoRows)
      if (error) throw error
    }

    revalidatePath('/dashboard')
    revalidatePath('/checklists')
    revalidatePath(`/checklists/${checklistId}`)

    return { ok: true, checklistId: checklistId! }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save checklist.'
    console.error('saveChecklist failed', error)
    return { ok: false, error: message }
  }
}

export async function deleteChecklist(checklistId: string): Promise<SaveChecklistResult> {
  try {
    const supabase = await createSupabaseServerClient()

    // Gather photo storage paths so we can clean up the bucket afterwards.
    const { data: items } = await supabase
      .from('checklist_items')
      .select('id, checklist_photos(storage_path)')
      .eq('checklist_id', checklistId)

    const storagePaths: string[] = []
    for (const item of items ?? []) {
      for (const photo of (item as { checklist_photos?: { storage_path: string }[] }).checklist_photos ?? []) {
        storagePaths.push(photo.storage_path)
      }
    }

    const itemIds = (items ?? []).map(i => (i as { id: string }).id)
    if (itemIds.length > 0) {
      await supabase.from('checklist_photos').delete().in('checklist_item_id', itemIds)
    }
    await supabase.from('checklist_items').delete().eq('checklist_id', checklistId)

    const { error } = await supabase.from('checklists').delete().eq('id', checklistId)
    if (error) throw error

    if (storagePaths.length > 0) {
      const objectPaths = storagePaths
        .map(p => (p.includes('/') ? p.split('/').slice(1).join('/') : null))
        .filter((p): p is string => Boolean(p))
      if (objectPaths.length > 0) {
        await supabase.storage.from(CHECKLIST_PHOTO_BUCKET).remove(objectPaths)
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/checklists')
    return { ok: true, checklistId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete checklist.'
    console.error('deleteChecklist failed', error)
    return { ok: false, error: message }
  }
}
