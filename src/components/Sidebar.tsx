// src/components/Sidebar.tsx
'use client'

import Image from 'next/image'
import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { COMPANY } from '@/lib/constants'
import {
  HomeIcon,
  ClipboardPlusIcon,
  ClipboardListIcon,
  UsersIcon,
  UserCheckIcon
} from '@/components/icons'

type IconType = (props: { className?: string }) => React.ReactNode

const links: Array<{ name: string; href: string; icon: IconType; match: (p: string) => boolean }> = [
  { name: 'Dashboard', href: '/', icon: HomeIcon, match: p => p === '/' },
  { name: 'New checklist', href: '/checklist', icon: ClipboardPlusIcon, match: p => p === '/checklist' },
  { name: 'Checklists', href: '/checklists', icon: ClipboardListIcon, match: p => p === '/checklists' || p.startsWith('/checklists/') },
  { name: 'Clients', href: '/clients', icon: UsersIcon, match: p => p.startsWith('/clients') },
  { name: 'Inspectors', href: '/inspectors', icon: UserCheckIcon, match: p => p.startsWith('/inspectors') }
]

function LinkSpinner() {
  const { pending } = useLinkStatus()
  if (!pending) return null
  return <span className="ml-auto h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" aria-hidden />
}

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center border-b border-gray-200 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo-mark.png" alt="" width={34} height={38} className="h-9 w-auto" priority />
          <span className="text-sm font-bold leading-tight text-gray-900">
            239 Home Services
            <span className="block text-xs font-normal text-gray-400">Home Watch CRM</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {links.map(link => {
          const active = link.match(pathname)
          const Icon = link.icon
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                active ? 'bg-primary-50 font-semibold text-primary-800' : 'font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-primary-700' : 'text-gray-400'}`} />
              {link.name}
              <LinkSpinner />
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-gray-200 px-4 py-3 text-xs text-gray-400">
        <p className="font-medium text-gray-500">{COMPANY.name}</p>
        <p>{COMPANY.phone}</p>
      </div>
    </div>
  )
}
