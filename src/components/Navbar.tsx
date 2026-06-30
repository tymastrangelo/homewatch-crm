// src/components/Navbar.tsx
'use client'

import { useState } from 'react'
import { signOut } from '@/lib/auth'
import { MenuIcon, LogOutIcon } from '@/components/icons'

interface NavbarProps {
  onMenuClick?: () => void
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut()
    window.location.assign('/login')
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="-ml-2 rounded-lg p-2 text-gray-600 hover:text-gray-900 active:bg-gray-100 lg:hidden"
        aria-label="Open menu"
      >
        <MenuIcon className="h-6 w-6" />
      </button>

      <div className="flex items-center gap-2 lg:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-700 text-xs font-bold text-white">239</span>
        <span className="text-sm font-semibold text-gray-900">Home Services</span>
      </div>

      <div className="hidden lg:block" />

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-60"
      >
        <LogOutIcon className="h-4 w-4" />
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </header>
  )
}
