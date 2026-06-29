import { type AuthError } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabaseClient'

export async function signOut(): Promise<{ error: AuthError | null }> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Sign-out error:', error.message)
  }
  return { error }
}
