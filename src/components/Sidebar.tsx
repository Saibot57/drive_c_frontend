import Link from 'next/link'
import { FolderOpen, Calendar, Home } from 'lucide-react'

export function Sidebar() {
  return (
    <div className="hidden w-64 bg-[#fcd7d7] p-4 md:block">
      <nav className="space-y-2">
        <Link
          href="/"
          className="flex items-center rounded-xl border-2 border-black bg-white p-3 hover:bg-[#ff6b6b] hover:text-white"
        >
          <Home className="mr-2 h-5 w-5" />
          <span>Home</span>
        </Link>
        
        <Link
          href="/drive"
          className="flex items-center rounded-xl border-2 border-black bg-white p-3 hover:bg-[#ff6b6b] hover:text-white"
        >
          <FolderOpen className="mr-2 h-5 w-5" />
          <span>Drive Catalog</span>
        </Link>
        
        <Link
          href="/calendar"
          className="flex items-center rounded-xl border-2 border-black bg-white p-3 hover:bg-[#ff6b6b] hover:text-white"
        >
          <Calendar className="mr-2 h-5 w-5" />
          <span>Calendar</span>
        </Link>
      </nav>
    </div>
  )
}