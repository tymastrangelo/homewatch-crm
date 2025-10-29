import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'
import { getSupabaseCredentials } from './supabaseCredentials'

export type Tables = Database['public']['Tables']
export type Client = Tables['clients']['Row']
export type ClientInsert = Tables['clients']['Insert']
export type ClientUpdate = Tables['clients']['Update']
export type Property = Tables['properties']['Row']
export type PropertyInsert = Tables['properties']['Insert']
export type PropertyUpdate = Tables['properties']['Update']
export type Inspector = Tables['inspectors']['Row']
export type InspectorInsert = Tables['inspectors']['Insert']
export type InspectorUpdate = Tables['inspectors']['Update']
export type Checklist = Tables['checklists']['Row']
export type ChecklistInsert = Tables['checklists']['Insert']
export type ChecklistUpdate = Tables['checklists']['Update']
export type ChecklistItem = Tables['checklist_items']['Row']
export type ChecklistItemInsert = Tables['checklist_items']['Insert']
export type ChecklistItemUpdate = Tables['checklist_items']['Update']
export type ChecklistPhoto = Tables['checklist_photos']['Row']

let browserClient: SupabaseClient<Database> | null = null
let serverClient: SupabaseClient<Database> | null = null

export function getSupabaseClient(): SupabaseClient<Database> {
  if (typeof window === 'undefined') {
    if (!serverClient) {
      const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials()
      serverClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false
        }
      })
    }
    return serverClient
  }

  if (!browserClient) {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials()
    browserClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
  }

  return browserClient
}

export function resetSupabaseClientCache() {
  browserClient = null
  serverClient = null
}

export { getSupabaseCredentials } from './supabaseCredentials'
