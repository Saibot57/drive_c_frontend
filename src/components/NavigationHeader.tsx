// src/components/NavigationHeader.tsx
'use client';

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavigationHeader() {
  const pathname = usePathname()

  return (
    <nav className="flex space-x-8">
      <Link 
        href="/features/calendar" 
        className={`text-3xl font-monument transition-colors ${
          pathname === '/features/calendar' ? 'text-[#ff6b6b]' : 'hover:text-[#ff6b6b]'
        }`}
      >
        Kalender
      </Link>
      <span className="text-3xl font-monument">Schema</span>
      <span className="text-3xl font-monument">TBA</span>
    </nav>
  )
}