import { createBrowserClient } from '@supabase/ssr'
import { type AuthError, type AuthResponse } from '@supabase/supabase-js'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function signInWithPassword(email: string, password: string): Promise<AuthResponse> {
  const response = await supabase.auth.signInWithPassword({ email, password })
  if (response.error) {
    console.error('Sign-in error:', response.error.message)
  }
  return response
}

export async function signOut(): Promise<{ error: AuthError | null }> {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Sign-out error:', error.message)
  }
  return { error }
}

export async function getSession() {
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
