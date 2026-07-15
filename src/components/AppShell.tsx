'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Navbar from './Navbar'
import TabBar from './TabBar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Don't show the shell on the login page
  if (pathname === '/login') {
    return <>{children}</>
  }

  // Hide the tab bar during the checklist form flow — its sticky save bar
  // owns the bottom edge there (the native "compose screen" pattern).
  const hideTabBar = pathname === '/checklist' || pathname.endsWith('/edit')

  return (
    // h-dvh (dynamic viewport height) rather than h-screen (100vh): on iOS
    // Safari 100vh extends behind the bottom toolbar, which parks sticky
    // footers (e.g. the checklist Save button) off-screen behind it.
    <div className="flex h-dvh bg-gray-50">
      {/* Sidebar: desktop only. Phones use the bottom tab bar instead. */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex w-full flex-1 flex-col overflow-hidden">
        <Navbar />
        {/* Bottom padding on mobile keeps content clear of the tab bar. */}
        <div
          className={`flex-1 overflow-y-auto overflow-x-hidden lg:pb-0 ${
            hideTabBar ? '' : 'pb-[calc(4rem+env(safe-area-inset-bottom))]'
          }`}
        >
          {children}
        </div>
      </div>

      {!hideTabBar && <TabBar />}
    </div>
  )
}
