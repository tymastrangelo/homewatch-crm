'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // iOS Safari tints its toolbars from the page and can leave them stuck dark
  // after the dimmed menu overlay closes. Re-assert the white theme-color on
  // every toggle so the chrome reliably reverts without a manual refresh.
  useEffect(() => {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', '#ffffff')
  }, [sidebarOpen])

  // Don't show the shell on the login page
  if (pathname === '/login') {
    return <>{children}</>
  }

  return (
    // h-dvh (dynamic viewport height) rather than h-screen (100vh): on iOS
    // Safari 100vh extends behind the bottom toolbar, which parks sticky
    // footers (e.g. the checklist Save button) off-screen behind it.
    <div className="flex h-dvh bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden w-full">
        <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        {/* Lock background scroll while the mobile menu is open so iOS doesn't
            collapse/expand the toolbar underneath the overlay. */}
        <div className={`flex-1 overflow-x-hidden ${sidebarOpen ? 'overflow-y-hidden' : 'overflow-y-auto'}`}>
          {children}
        </div>
      </div>
    </div>
  )
}