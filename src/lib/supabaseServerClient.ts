import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Database } from './types'
import { getSupabaseCredentials } from './supabaseCredentials'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials()

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      // Server components cannot set cookies; provide no-op implementations.
      set() {
        /* noop */
      },
      remove() {
        /* noop */
      }
    }
  })
}
