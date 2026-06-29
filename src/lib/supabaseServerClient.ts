import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Database } from './types'
import { getSupabaseCredentials } from './supabaseCredentials'

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 * Reads the user's session from cookies. Cookie writes are only possible from
 * Route Handlers / Server Actions — in a Server Component the setAll call is a
 * no-op (token refresh there is handled by the middleware instead).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials()

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component — safe to ignore; middleware refreshes.
        }
      }
    }
  })
}
