// src/components/Navbar.tsx
'use client'

import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth'

interface NavbarProps {
  onMenuClick?: () => void
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.replace('/login')
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6">
      {/* Hamburger menu for mobile */}
      <button
        onClick={onMenuClick}
        className="lg:hidden text-gray-700 hover:text-gray-900 focus:outline-none"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      
      {/* Spacer for desktop (no menu button) */}
      <div className="hidden lg:block"></div>
      
      <button
        onClick={handleSignOut}
        className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
      >
        Sign Out
      </button>
    </header>
  )
}
