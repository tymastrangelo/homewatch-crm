import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export type Tables = Database['public']['Tables']
export type Client = Tables['clients']['Row']
export type ClientInsert = Tables['clients']['Insert']
export type ClientUpdate = Tables['clients']['Update']
export type Property = Tables['properties']['Row']
export type PropertyInsert = Tables['properties']['Insert']
export type PropertyUpdate = Tables['properties']['Update']
export type Checklist = Tables['checklists']['Row']
export type ChecklistInsert = Tables['checklists']['Insert']
export type ChecklistUpdate = Tables['checklists']['Update']
export type ChecklistItem = Tables['checklist_items']['Row']
export type ChecklistItemInsert = Tables['checklist_items']['Insert']
export type ChecklistItemUpdate = Tables['checklist_items']['Update']
export type ChecklistPhoto = Tables['checklist_photos']['Row']

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or Anon Key')
}

export const supabase = typeof window === 'undefined'
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false
      }
    })
  : createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
