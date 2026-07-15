// src/components/Navbar.tsx
'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { signOut } from '@/lib/auth'
import { LogOutIcon } from '@/components/icons'

export default function Navbar() {
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    window.location.assign('/login')
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6 lg:h-16">
      {/* Brand: shown on mobile where there is no sidebar. */}
      <Link href="/" className="flex items-center gap-2.5 lg:hidden">
        <Image src="/logo-mark.png" alt="" width={28} height={31} className="h-8 w-auto" priority />
        <span className="text-sm font-bold leading-tight text-gray-900">
          239 Home Services
          <span className="block text-[11px] font-normal text-gray-400">Home Watch CRM</span>
        </span>
      </Link>

      <div className="hidden lg:block" />

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-60"
      >
        <LogOutIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{signingOut ? 'Signing out…' : 'Sign out'}</span>
      </button>
    </header>
  )
}
