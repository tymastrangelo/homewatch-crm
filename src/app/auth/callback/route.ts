import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { getSupabaseCredentials } from '@/lib/supabaseClient'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const response = NextResponse.redirect(requestUrl.origin)

    const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials()

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get: (name: string) => request.cookies.get(name)?.value,
          set: (name: string, value: string, options: CookieOptions) => {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove: (name: string, options: CookieOptions) => {
            response.cookies.delete({
              name,
              ...options,
            })
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return response
    }
  }

  // Return the user to an error page with some instructions
  return NextResponse.redirect(`${requestUrl.origin}/auth-error`)
}