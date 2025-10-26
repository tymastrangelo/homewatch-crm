import { type AuthError, type AuthResponse } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabaseClient'

export async function signInWithPassword(email: string, password: string): Promise<AuthResponse> {
  const supabase = getSupabaseClient()
  const response = await supabase.auth.signInWithPassword({ email, password })
  if (response.error) {
    console.error('Sign-in error:', response.error.message)
  }
  return response
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  const supabase = getSupabaseClient()
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Sign-out error:', error.message)
  }
  return { error }
}

export async function getSession() {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    console.error('Get session error:', error.message)
    return null
  }
  return data.session
}

// Helper to check if user is authenticated on the client side
export function requireAuth() {
  const session = getSession()
  if (!session) {
    window.location.href = '/login'
    return null
  }
  return session
}
