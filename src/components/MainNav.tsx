import Link from 'next/link'
import { MenuIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function MainNav() {
  return (
    <header className="h-16 border-b-2 border-black bg-white">
      <div className="flex h-full items-center px-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          className="mr-4 h-12 w-12 rounded-xl border-2 border-black p-2 lg:hidden"
        >
          <MenuIcon className="h-6 w-6" />
        </Button>

        {/* Logo/Title */}
        <div className="mr-8 text-xl font-bold">
          <Link href="/">Personal Dashboard</Link>
        </div>

        {/* Main navigation */}
        <nav className="hidden space-x-4 lg:flex">
          <Link 
            href="/drive"
            className="rounded-xl border-2 border-black bg-white px-4 py-2 font-medium hover:bg-[#fcd7d7]"
          >
            Drive Catalog
          </Link>
          <Link 
            href="/calendar"
            className="rounded-xl border-2 border-black bg-white px-4 py-2 font-medium hover:bg-[#fcd7d7]"
          >
            Calendar
          </Link>
        </nav>
      </div>
    </header>
  )
}