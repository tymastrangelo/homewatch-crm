// src/app/login/page.tsx
'use client'

import { Suspense, useMemo, useState } from 'react'
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
    const redirectTo = searchParams.get('redirectTo') || '/dashboard'
    window.location.assign(redirectTo)
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-50 to-gray-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-700 text-lg font-bold text-white shadow-sm">239</span>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">{COMPANY.name}</h1>
            <p className="text-sm text-gray-500">Home Watch CRM</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-lg">
          <h2 className="text-lg font-semibold text-gray-900">Sign in</h2>
          <p className="mt-1 text-sm text-gray-500">Welcome back. Enter your staff credentials.</p>
          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
              <input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputClass} />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
              <input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required className={inputClass} />
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-800 disabled:bg-primary-400"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">{COMPANY.phone} · {COMPANY.email}</p>
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
