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

  // getClaims() verifies the JWT locally (cached JWKS) instead of calling the
  // Supabase Auth server on every request like getUser() — this ran on every
  // navigation and added a network round trip per click. Expired sessions
  // still refresh, and forged cookies only reach the shell: every data read
  // goes through RLS. Falls back to getUser() on projects with legacy keys.
  let user: unknown = null
  try {
    const { data } = await supabase.auth.getClaims()
    user = data?.claims ?? null
  } catch {
    const { data } = await supabase.auth.getUser()
    user = data.user
  }

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
  // Run on the Node.js runtime rather than the Edge runtime. The Supabase SSR
  // client pulls in @supabase/realtime-js, which uses dynamic code evaluation
  // and Node-only APIs (process.versions) that the Edge runtime forbids —
  // under Edge the middleware throws "EvalError: Code generation from strings
  // disallowed" on every request, returning an unstyled 500 page.
  runtime: 'nodejs',
  // The extension group keeps public assets (manifest, icons, logo) reachable
  // without a session — the browser fetches the PWA manifest and home-screen
  // icons outside any authenticated context.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:png|ico|svg|webmanifest)$).*)']
}
