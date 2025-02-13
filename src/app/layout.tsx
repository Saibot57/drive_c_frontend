import type { Metadata } from 'next'
import { Red_Hat_Text } from 'next/font/google'
import './globals.css'
import { MainNav } from '@/components/MainNav'
import { Sidebar } from '@/components/Sidebar'

const redHat = Red_Hat_Text({ 
  subsets: ['latin'],
  weight: ['400', '500', '700']
})

export const metadata: Metadata = {
  title: 'Personal Dashboard',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${redHat.className} min-h-screen bg-[#fcd7d7]`}>
        {/* Main header */}
        <MainNav />
        
        <div className="flex min-h-[calc(100vh-4rem)]">
          {/* Sidebar */}
          <Sidebar />

          {/* Main content area */}
          <main className="flex-1 px-4 py-8">
            <div className="max-w-[1500px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}