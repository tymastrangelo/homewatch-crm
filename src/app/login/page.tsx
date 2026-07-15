// src/app/login/page.tsx
'use client'

import { Suspense, useMemo, useState } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { getSupabaseClient } from '@/lib/supabaseClient'
import { COMPANY } from '@/lib/constants'

function LoginContent() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = useMemo(() => getSupabaseClient(), [])

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    // Hard navigation guarantees the freshly-set auth cookie is sent with the
    // next request, so the middleware sees the session and won't bounce back to
    // login. (A client-side router.replace can race the cookie write and freeze.)
    const redirectTo = searchParams.get('redirectTo') || '/'
    window.location.assign(redirectTo)
  }

  const inputClass =
    'mt-1.5 min-h-12 w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm shadow-sm transition placeholder:text-gray-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30'

  return (
    // The navy field + sky keyline: the same signature band the PDF report
    // carries, so the tool and its deliverable read as one identity.
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#16233b]">
      <div className="h-1.5 w-full bg-primary-400" aria-hidden />
      {/* Oversized house-key mark as a quiet watermark on the navy field. */}
      <Image
        src="/logo-mark.png"
        alt=""
        width={229}
        height={256}
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-16 w-[380px] select-none opacity-[0.06]"
      />

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="rounded-3xl bg-white p-7 shadow-2xl shadow-black/40 sm:p-9">
            <div className="flex justify-center">
              <Image src="/logo.png" alt="239 Home Services" width={210} height={118} priority className="h-auto w-48" />
            </div>

            <div className="mb-6 mt-7 flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-gray-200" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-400">Staff sign in</span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@239homeservices.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="!mt-6 min-h-12 w-full rounded-xl bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-800 disabled:bg-primary-400"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-primary-200/70">
            {COMPANY.name} · {COMPANY.phone} · {COMPANY.email}
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  )
}
