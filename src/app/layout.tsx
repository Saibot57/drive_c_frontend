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
        {/* Sidebar - Now has higher z-index to appear "in front" */}
        <div className="fixed top-0 left-0 bottom-0 w-24 border-r-2 border-black bg-[#fcd7d7] z-30">
          {/* Sidebar content will go here */}
        </div>

        {/* Top Navigation Bar - Lower z-index */}
        <div className="fixed top-0 left-24 right-0 h-24 bg-[#fcd7d7] z-20">
          {/* Bottom border starts from sidebar */}
          <div className="absolute bottom-0 left-0 right-0 border-b-2 border-black"></div>
          
          <div className="h-full flex items-center px-8">
            <h1 className="text-4xl font-monument mr-12">Bibliotek</h1>
            <nav className="flex space-x-8">
              <span className="text-3xl font-monument">Kalender</span>
              <span className="text-3xl font-monument">Schema</span>
              <span className="text-3xl font-monument">TBA</span>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <main className="ml-24 pt-32 px-8">
          <div className="max-w-[1000px] mx-auto">
            {children}
          </div>
        </main>
      </body>
    </html>
  )
}