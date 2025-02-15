import type { Metadata } from 'next'
import { Red_Hat_Text } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'

const redHat = Red_Hat_Text({
  subsets: ['latin'],
  weight: ['400', '500', '700']
})

const monument = localFont({
  src: [
    {
      path: '../fonts/MonumentExtended-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/MonumentExtended-Ultrabold.otf',
      weight: '700',
      style: 'normal',
    }
  ],
  variable: '--font-monument'
})

export const metadata: Metadata = {
  title: 'Bibliotek',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${redHat.className} ${monument.variable} min-h-screen bg-[#fcd7d7]`}>
        {/* Top Navigation Bar */}
        <div className="fixed top-0 left-0 right-0 h-16 border-b-2 border-black bg-[#fcd7d7] z-10">
          <div className="ml-16 h-full flex items-center px-6">
            <h1 className="text-xl font-monument mr-8">Bibliotek</h1>
            <nav className="flex space-x-6">
              <span className="text-sm font-monument">Kalender</span>
              <span className="text-sm font-monument">Schema</span>
              <span className="text-sm font-monument">TBA</span>
            </nav>
          </div>
        </div>

        {/* Sidebar */}
        <div className="fixed top-0 left-0 bottom-0 w-16 border-r-2 border-black bg-[#fcd7d7] z-20">
          {/* Sidebar content will go here */}
        </div>

        {/* Main Content */}
        <main className="ml-16 pt-16 p-6">
          <div className="max-w-[1000px] mx-auto">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}