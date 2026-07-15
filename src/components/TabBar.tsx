'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { HomeIcon, ClipboardListIcon, UsersIcon, UserCheckIcon, PlusIcon } from '@/components/icons'

type IconType = (props: React.SVGProps<SVGSVGElement>) => React.ReactNode

const tabs: Array<{ name: string; href: string; icon: IconType; match: (p: string) => boolean }> = [
  { name: 'Home', href: '/', icon: HomeIcon, match: p => p === '/' },
  { name: 'Checklists', href: '/checklists', icon: ClipboardListIcon, match: p => p === '/checklists' || p.startsWith('/checklists/') },
  { name: 'Clients', href: '/clients', icon: UsersIcon, match: p => p.startsWith('/clients') },
  { name: 'Inspectors', href: '/inspectors', icon: UserCheckIcon, match: p => p.startsWith('/inspectors') }
]

/**
 * Native-style bottom tab bar for phones. The raised center button starts a
 * new checklist — the app's primary action in the field.
 */
export default function TabBar() {
  const pathname = usePathname()
  const onNewChecklist = pathname === '/checklist'

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto grid h-14 max-w-md grid-cols-5 items-stretch">
        {tabs.slice(0, 2).map(tab => (
          <Tab key={tab.name} tab={tab} active={tab.match(pathname)} />
        ))}

        <div className="relative">
          <Link
            href="/checklist"
            aria-label="New checklist"
            className={`absolute left-1/2 top-0 flex h-14 w-14 -translate-x-1/2 -translate-y-4 items-center justify-center rounded-full text-white shadow-lg shadow-primary-900/25 transition ${
              onNewChecklist ? 'bg-primary-900 ring-4 ring-primary-100' : 'bg-primary-700 active:bg-primary-800'
            }`}
          >
            <PlusIcon className="h-7 w-7" strokeWidth={2.2} />
          </Link>
        </div>

        {tabs.slice(2).map(tab => (
          <Tab key={tab.name} tab={tab} active={tab.match(pathname)} />
        ))}
      </div>
    </nav>
  )
}

function Tab({ tab, active }: { tab: (typeof tabs)[number]; active: boolean }) {
  return (
    <Link
      href={tab.href}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
        active ? 'text-primary-700' : 'text-gray-400'
      }`}
    >
      <TabInner tab={tab} active={active} />
    </Link>
  )
}

// Separate component so useLinkStatus (must render inside the Link) can pulse
// the icon while the navigation is in flight — instant feedback on tap.
function TabInner({ tab, active }: { tab: (typeof tabs)[number]; active: boolean }) {
  const { pending } = useLinkStatus()
  const Icon = tab.icon
  return (
    <>
      <Icon
        className={`h-6 w-6 ${active ? '' : 'text-gray-400'} ${pending ? 'animate-pulse text-primary-600' : ''}`}
        strokeWidth={active || pending ? 2.1 : 1.8}
      />
      {tab.name}
    </>
  )
}
