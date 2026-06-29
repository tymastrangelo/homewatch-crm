import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseCredentials } from '@/lib/supabaseCredentials'

const PUBLIC_PATHS = ['/login', '/auth']

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials()

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        // Mirror refreshed auth cookies onto both the request and the response
        // so the session stays valid for the downstream render.
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
        res = NextResponse.next({ request: req })
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      }
    }
  })

  // getUser() revalidates the token with Supabase — unlike getSession(), which
  // trusts whatever is in the cookie. This is the secure choice for gating.
  const {
    data: { user }
  } = await supabase.auth.getUser()

  const { pathname } = req.nextUrl
  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))

  if (!user && !isPublic) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && (pathname === '/login' || pathname === '/')) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)']
}
