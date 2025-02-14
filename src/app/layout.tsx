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
        {/* Header */}
        <header className="w-full px-4 py-4 mb-8">
          <div className="max-w-[1500px] mx-auto bg-[#fcd7d7] rounded-2xl border-2 border-white p-4">
            <h1 className="text-2xl font-bold mb-4 font-monument">
              Bibliotek
            </h1>
            <nav className="flex space-x-6">
              <span className="text-sm font-monument">Kalender</span>
              <span className="text-sm font-monument">Schema</span>
              <span className="text-sm font-monument">TBA</span>
            </nav>
          </div>
        </header>

        <div className="flex min-h-[calc(100vh-120px)]">
          {/* Sidebar - we'll add content later */}
          <div className="w-64 bg-[#fcd7d7] rounded-2xl border-2 border-white p-4 hidden md:block">
            {/* Sidebar content will go here */}
          </div>

          {/* Main content area */}
          <main className="flex-1 px-4 py-8">
            {/* Main content */}
            <div className="max-w-[1500px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}